import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { unlink } from 'fs/promises';
import { MatchStatus, ProcessingStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiCoachService } from '../ai-coach/ai-coach.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { GameAnalysisService } from '../game-analysis/game-analysis.service';
import { PlansService } from '../plans/plans.service';
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
    private readonly plansService: PlansService,
    private readonly auditLogs: AuditLogsService,
  ) {
    super();
  }

  async process(job: Job<VideoProcessingJobData>): Promise<void> {
    const { matchId, videoPath } = job.data;
    this.logger.log(`Job ${job.id}: iniciando processamento da partida ${matchId}`);

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { userId: true },
    });
    const userId = match?.userId ?? null;

    try {
      // 1 — Marca como em processamento
      await this.setStatuses(matchId, MatchStatus.processing, ProcessingStatus.processing);

      // 2 — Valida duração (máx. 90 min)
      const validation = await this.videoCaptureService.validateVideo(videoPath);
      if (!validation.valid) {
        // Vídeo não é reprocessável (ex.: excede duração máxima) — remove do disco
        await unlink(videoPath).catch(() => {});
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

      // 5 — Análise de eventos e erros (via Gemini, com fallback heurístico se a chave
      // não estiver configurada); atualiza match.status = analyzed ao concluir. O
      // extractFrame injetado aqui é o que permite o frame exato de cada erro real do
      // Gemini (GameAnalysisModule não importa VideoCaptureModule pra evitar dependência
      // circular entre os dois módulos — este worker já tem os dois).
      const { visionCostEstimate } = await this.gameAnalysisService.analyzeMatch(
        matchId,
        videoPath,
        framePaths,
        (timestampSeconds, outputPath) =>
          this.videoCaptureService.extractFrameAt(videoPath, timestampSeconds, outputPath),
      );

      // 5.1 — Registra consumo de 1 análise em UsageLog (conta para o limite mensal do plano)
      await this.plansService.registerAnalysisUsage(matchId);

      // 5.2 — Audit log: análise concluída
      await this.auditLogs.log({
        userId,
        module: 'game-analysis',
        action: 'analysis_completed',
        metadata: { matchId },
      });

      // 6 — AI Coach: gera resumo tático e persiste AIAnalysis; falha não cancela a partida
      try {
        await this.aiCoachService.analyzeMatch(matchId, visionCostEstimate);
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
      await this.auditLogs.log({
        userId,
        module: 'video-processing',
        action: 'processing_failed',
        metadata: { matchId, error: (err as Error).message, attempt: job.attemptsMade },
      });
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
