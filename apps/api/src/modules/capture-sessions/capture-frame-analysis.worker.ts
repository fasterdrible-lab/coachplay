import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from '../../shared/database/prisma.service';
import { AiCoachService } from '../ai-coach/ai-coach.service';
import { GameStateDetectorService } from './game-state-detector.service';
import { EventDetectorService } from './event-detector.service';
import { resolveAbsoluteFramePath } from './capture.config';
import {
  CAPTURE_FRAME_ANALYSIS_QUEUE,
  CaptureFrameAnalysisJobData,
  EVENT_MIN_CONFIDENCE,
  FEEDBACK_MIN_CONFIDENCE,
} from './capture-frame-analysis.constants';

@Processor(CAPTURE_FRAME_ANALYSIS_QUEUE, { concurrency: 3 })
export class CaptureFrameAnalysisWorker extends WorkerHost {
  private readonly logger = new Logger(CaptureFrameAnalysisWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gameStateDetector: GameStateDetectorService,
    private readonly eventDetector: EventDetectorService,
    private readonly aiCoachService: AiCoachService,
  ) {
    super();
  }

  async process(job: Job<CaptureFrameAnalysisJobData>): Promise<void> {
    const { frameSampleId, captureSessionId, absoluteFramePath, timestampMs } = job.data;

    const session = await this.prisma.captureSession.findUnique({
      where: { id: captureSessionId },
      select: { id: true, matchId: true, user: { select: { preferences: { select: { feedbackLevel: true } } } } },
    });
    if (!session) {
      this.logger.warn(`Job ${job.id}: sessão ${captureSessionId} não encontrada — descartando`);
      return;
    }

    // Frame anterior = literalmente o anterior por timestamp, independente do analysisStatus
    // dele. Filtrar por analysisStatus: 'analyzed' aqui parece mais "correto" à primeira vista,
    // mas cria uma trava em cascata: o primeiro frame de qualquer sessão nunca tem anterior,
    // então fica 'skipped' — e como nenhum frame seguinte encontra um anterior "analyzed",
    // TODA a sessão fica 'skipped' para sempre (achado validando com captura real; os testes
    // deste worker mockam o retorno de findFirst, então nunca exercitam essa cadeia). Só
    // precisamos do arquivo de imagem do anterior para o diff, não do resultado da análise dele.
    const previous = await this.prisma.frameSample.findFirst({
      where: { captureSessionId, timestampMs: { lt: timestampMs } },
      orderBy: { timestampMs: 'desc' },
      select: { framePath: true },
    });
    const previousFramePath = previous ? resolveAbsoluteFramePath(previous.framePath) : null;

    const detection = await this.gameStateDetector.detect(absoluteFramePath, previousFramePath);

    if (detection.gameState === null) {
      await this.prisma.frameSample.update({
        where: { id: frameSampleId },
        data: { analysisStatus: 'skipped' },
      });
      return;
    }

    await this.prisma.frameSample.update({
      where: { id: frameSampleId },
      data: {
        gameState: detection.gameState,
        confidenceScore: detection.confidence,
        motionScore: detection.motionScore,
        analysisStatus: 'analyzed',
      },
    });

    const candidate = await this.eventDetector.detectCandidate(captureSessionId, {
      id: frameSampleId,
      timestampMs,
      motionScore: detection.motionScore ?? 0,
      gameState: detection.gameState,
    });

    if (!candidate || candidate.confidence < EVENT_MIN_CONFIDENCE) return;

    if (!session.matchId) {
      this.logger.debug(
        `Job ${job.id}: evento candidato detectado na sessão ${captureSessionId}, mas ela não tem match associado — não persistido`,
      );
      return;
    }

    const event = await this.prisma.gameEvent.create({
      data: {
        matchId: session.matchId,
        captureSessionId,
        eventType: 'motion_spike',
        category: 'evento_provavel',
        timestampStart: timestampMs,
        confidence: candidate.confidence,
        description: candidate.description,
        evidence: { motionScore: detection.motionScore, spike: candidate.motionSpike, windowSize: candidate.windowSize },
      },
    });

    if (candidate.confidence < FEEDBACK_MIN_CONFIDENCE) return;

    try {
      await this.aiCoachService.generateEventFeedback(event, captureSessionId, session.user.preferences?.feedbackLevel ?? null);
    } catch (err) {
      this.logger.warn(`Job ${job.id}: geração de feedback falhou (${(err as Error).message})`);
    }
  }
}
