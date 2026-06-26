import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { MatchStatus, ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiCoachService } from '../ai-coach/ai-coach.service';
import { GameAnalysisService } from '../game-analysis/game-analysis.service';
import { ReportsService } from '../reports/reports.service';
import { VideoCaptureService } from './video-capture.service';
import { VIDEO_PROCESSING_QUEUE, VideoProcessingJobData } from './video-processing.constants';

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessingWorker extends WorkerHost {
  private readonly logger = new Logger(VideoProcessingWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly videoCaptureService: VideoCaptureService,
    private readonly gameAnalysisService: GameAnalysisService,
    private readonly aiCoachService: AiCoachService,
    private readonly reportsService: ReportsService,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>): Promise<void> {
    const { matchId, videoPath } = job.data;
    this.logger.log(`Job ${job.id}: iniciando processamento da partida ${matchId}`);

    try {
      // 1 — Marca como em processamento
      await this.setStatuses(matchId, MatchStatus.processing, ProcessingStatus.processing);

      // 2 — Valida duração (máx. 90 min)
      const validation = await this.videoCaptureService.validateVideo(videoPath);
      if (!validation.valid) {
        throw new Error(validation.error ?? 'Vídeo inválido');
      }

      await this.prisma.matchVideo.update({
        where: { matchId },
        data: { durationSeconds: Math.round(validation.durationSeconds) },
      });

      // 3 — Extrai frames (1 a cada 30s)
      const framePaths = await this.videoCaptureService.extractFrames(matchId, videoPath);

      // 4 — Vídeo processado; marca como done antes da análise
      await this.prisma.matchVideo.update({
        where: { matchId },
        data: { processingStatus: ProcessingStatus.done },
      });

      this.logger.log(
        `Job ${job.id}: ${framePaths.length} frames extraídos — iniciando análise`,
      );

      // 5 — Análise de eventos e erros; atualiza match.status = analyzed ao concluir
      await this.gameAnalysisService.analyzeMatch(matchId, framePaths);

      // 6 — AI Coach: gera resumo tático e persiste AIAnalysis; falha não cancela a partida
      try {
        await this.aiCoachService.analyzeMatch(matchId);
      } catch (aiErr) {
        this.logger.warn(
          `Job ${job.id}: AI Coach falhou para partida ${matchId} — ${(aiErr as Error).message}`,
        );
      }

      // 7 — Reports: gera e persiste MatchReport com scores; falha não cancela a partida
      try {
        await this.reportsService.generateReport(matchId);
      } catch (reportErr) {
        this.logger.warn(
          `Job ${job.id}: Reports falhou para partida ${matchId} — ${(reportErr as Error).message}`,
        );
      }

      // 8 — Remove frames temporários (best-effort; extração pode ser refeita em retry)
      await this.videoCaptureService.cleanFrames(matchId);

      this.logger.log(`Job ${job.id}: partida ${matchId} analisada com sucesso`);
    } catch (err) {
      this.logger.error(
        `Job ${job.id}: falha ao processar partida ${matchId} — ${(err as Error).message}`,
      );
      await this.setStatuses(matchId, MatchStatus.failed, ProcessingStatus.failed).catch(() => {});
      throw err; // BullMQ marca o job como failed e aplica retry
    }
  }

  private async setStatuses(
    matchId: string,
    matchStatus: MatchStatus,
    videoStatus: ProcessingStatus,
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.match.update({
        where: { id: matchId },
        data: { status: matchStatus },
      }),
      this.prisma.matchVideo.update({
        where: { matchId },
        data: { processingStatus: videoStatus },
      }),
    ]);
  }
}
