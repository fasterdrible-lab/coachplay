import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CaptureSessionStatus } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { CreateCaptureSessionDto } from './dto/create-capture-session.dto';
import { StopCaptureSessionDto } from './dto/stop-capture-session.dto';
import { CreateFrameSampleDto } from './dto/create-frame-sample.dto';
import { CreateVideoSegmentDto } from './dto/create-video-segment.dto';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import {
  CAPTURE_FRAME_ANALYSIS_JOB,
  CAPTURE_FRAME_ANALYSIS_QUEUE,
  CaptureFrameAnalysisJobData,
} from './capture-frame-analysis.constants';

// Transições válidas da state machine de uma sessão de captura.
// Espelha a mesma lógica usada no state machine puro do app desktop
// (apps/desktop/src/main/capture-session-state.ts) — o backend é a fonte
// de verdade, o desktop só reflete localmente para responder rápido à UI.
const VALID_TRANSITIONS: Record<CaptureSessionStatus, CaptureSessionStatus[]> = {
  starting: ['running', 'failed', 'stopped'],
  running: ['paused', 'stopped', 'failed'],
  paused: ['running', 'stopped', 'failed'],
  stopped: [],
  failed: [],
};

@Injectable()
export class CaptureSessionsService {
  private readonly logger = new Logger(CaptureSessionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogs: AuditLogsService,
    @InjectQueue(CAPTURE_FRAME_ANALYSIS_QUEUE) private readonly frameAnalysisQueue: Queue,
  ) {}

  async create(dto: CreateCaptureSessionDto, currentUser: AuthUser) {
    if (dto.matchId) await this.assertMatchOwner(dto.matchId, currentUser);

    const session = await this.prisma.captureSession.create({
      data: {
        userId: currentUser.id,
        matchId: dto.matchId,
        sourceType: dto.sourceType,
        sourceName: dto.sourceName,
        resolutionWidth: dto.resolutionWidth,
        resolutionHeight: dto.resolutionHeight,
        captureFps: dto.captureFps ?? 2,
        analysisFps: dto.analysisFps ?? 1,
        status: 'running',
        startedAt: new Date(),
      },
    });

    await this.auditLogs.log({
      userId: currentUser.id,
      module: 'capture-sessions',
      action: 'session_started',
      metadata: { sessionId: session.id, sourceType: session.sourceType },
    });

    return session;
  }

  async pause(id: string, currentUser: AuthUser) {
    return this.transition(id, currentUser, 'paused');
  }

  async resume(id: string, currentUser: AuthUser) {
    return this.transition(id, currentUser, 'running');
  }

  async stop(id: string, currentUser: AuthUser, dto?: StopCaptureSessionDto) {
    const status = dto?.errorMessage ? 'failed' : 'stopped';
    return this.transition(id, currentUser, status, dto?.errorMessage, { ended: true });
  }

  async getStatus(id: string, currentUser: AuthUser) {
    const session = await this.findOwned(id, currentUser);
    return session;
  }

  async addFrame(id: string, dto: CreateFrameSampleDto, file: Express.Multer.File, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    const framePath = `/uploads/frames/${file.filename}`;

    const sample = await this.prisma.frameSample.create({
      data: {
        captureSessionId: id,
        timestampMs: dto.timestampMs,
        framePath,
        width: dto.width,
        height: dto.height,
      },
    });

    // Best-effort: o frame já está persistido: se a fila falhar ao aceitar o job, essa amostra
    // simplesmente nunca ganha gameState/confidence — não é motivo para falhar o upload.
    try {
      await this.frameAnalysisQueue.add(CAPTURE_FRAME_ANALYSIS_JOB, {
        frameSampleId: sample.id,
        captureSessionId: id,
        absoluteFramePath: file.path,
        timestampMs: dto.timestampMs,
      } satisfies CaptureFrameAnalysisJobData);
    } catch (err) {
      this.logger.warn(`Falha ao enfileirar análise do frame ${sample.id} (${(err as Error).message})`);
    }

    return sample;
  }

  async addSegment(id: string, dto: CreateVideoSegmentDto, file: Express.Multer.File, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    if (dto.endTimestampMs <= dto.startTimestampMs) {
      throw new BadRequestException('endTimestampMs deve ser maior que startTimestampMs');
    }
    if (dto.matchId) await this.assertMatchOwner(dto.matchId, currentUser);

    const filePath = `/uploads/segments/${file.filename}`;

    return this.prisma.videoSegment.create({
      data: {
        captureSessionId: id,
        matchId: dto.matchId,
        startTimestampMs: dto.startTimestampMs,
        endTimestampMs: dto.endTimestampMs,
        filePath,
        reason: dto.reason ?? 'manual',
      },
    });
  }

  async getMatchEvents(matchId: string, currentUser: AuthUser) {
    await this.assertMatchOwner(matchId, currentUser);

    return this.prisma.gameEvent.findMany({
      where: { matchId },
      orderBy: { timestampStart: 'asc' },
    });
  }

  async getMatchFeedbacks(matchId: string, currentUser: AuthUser) {
    await this.assertMatchOwner(matchId, currentUser);

    return this.prisma.coachFeedback.findMany({
      where: { matchId },
      orderBy: { createdAt: 'asc' },
    });
  }

  private async transition(
    id: string,
    currentUser: AuthUser,
    nextStatus: CaptureSessionStatus,
    errorMessage?: string,
    opts?: { ended?: boolean },
  ) {
    const session = await this.findOwned(id, currentUser);

    if (!VALID_TRANSITIONS[session.status].includes(nextStatus)) {
      throw new BadRequestException(
        `Transição inválida: sessão está em "${session.status}", não pode ir para "${nextStatus}"`,
      );
    }

    const updated = await this.prisma.captureSession.update({
      where: { id },
      data: {
        status: nextStatus,
        ...(errorMessage !== undefined && { errorMessage }),
        ...(opts?.ended && { endedAt: new Date() }),
      },
    });

    await this.auditLogs.log({
      userId: currentUser.id,
      module: 'capture-sessions',
      action: `session_${nextStatus}`,
      metadata: { sessionId: id },
    });

    return updated;
  }

  private async findOwned(id: string, currentUser: AuthUser) {
    const session = await this.prisma.captureSession.findUnique({ where: { id } });
    if (!session) throw new NotFoundException('Sessão de captura não encontrada');
    if (session.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
    return session;
  }

  private async assertOwner(id: string, currentUser: AuthUser) {
    await this.findOwned(id, currentUser);
  }

  private async assertMatchOwner(matchId: string, currentUser: AuthUser) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId, deletedAt: null },
      select: { userId: true },
    });
    if (!match) throw new NotFoundException('Partida não encontrada');
    if (match.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
  }
}
