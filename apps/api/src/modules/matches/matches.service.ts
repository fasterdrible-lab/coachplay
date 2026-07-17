import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { basename, join } from 'path';
import { unlinkSync } from 'fs';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { FindMatchesQueryDto } from './dto/find-matches-query.dto';
import {
  VIDEO_PROCESSING_JOB,
  VIDEO_PROCESSING_QUEUE,
  VideoProcessingJobData,
} from '../video-capture/video-processing.constants';
import { AuditLogsService } from '../audit-logs/audit-logs.service';

const LIST_SELECT = {
  id: true,
  title: true,
  gameMode: true,
  platform: true,
  matchDate: true,
  scoreUser: true,
  scoreOpponent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  video: { select: { processingStatus: true } },
  report: { select: { overallScore: true } },
} as const;

const DETAIL_SELECT = {
  id: true,
  title: true,
  gameMode: true,
  platform: true,
  matchDate: true,
  scoreUser: true,
  scoreOpponent: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  video: {
    select: {
      id: true,
      fileUrl: true,
      fileName: true,
      fileSize: true,
      durationSeconds: true,
      format: true,
      processingStatus: true,
    },
  },
  gameEvents: {
    select: {
      id: true,
      eventType: true,
      category: true,
      timestampStart: true,
      timestampEnd: true,
      description: true,
      confidence: true,
    },
    orderBy: { timestampStart: 'asc' as const },
  },
  errors: {
    select: {
      id: true,
      errorType: true,
      category: true,
      severity: true,
      description: true,
      suggestion: true,
    },
  },
  report: {
    select: {
      overallScore: true,
      attackScore: true,
      defenseScore: true,
      passingScore: true,
      decisionScore: true,
      mainProblem: true,
      recommendation: true,
    },
  },
} as const;

@Injectable()
export class MatchesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly videoQueue: Queue,
    private readonly auditLogs: AuditLogsService,
  ) {}

  async create(dto: CreateMatchDto, currentUser: AuthUser) {
    return this.prisma.match.create({
      data: {
        userId: currentUser.id,
        title: dto.title,
        gameMode: dto.gameMode,
        platform: dto.platform ?? 'xbox',
        matchDate: dto.matchDate ? new Date(dto.matchDate) : undefined,
        scoreUser: dto.scoreUser,
        scoreOpponent: dto.scoreOpponent,
      },
      select: LIST_SELECT,
    });
  }

  async findAll(query: FindMatchesQueryDto, currentUser: AuthUser) {
    const { page = 1, limit = 20, search, status } = query;
    const skip = (page - 1) * limit;

    const where = {
      userId: currentUser.id,
      deletedAt: null,
      ...(status && { status }),
      ...(search && { title: { contains: search, mode: 'insensitive' as const } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        select: LIST_SELECT,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.match.count({ where }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async findOne(id: string, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    return this.prisma.match.findUnique({ where: { id }, select: DETAIL_SELECT });
  }

  async update(id: string, dto: UpdateMatchDto, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    return this.prisma.match.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.gameMode !== undefined && { gameMode: dto.gameMode }),
        ...(dto.platform !== undefined && { platform: dto.platform }),
        ...(dto.matchDate !== undefined && {
          matchDate: dto.matchDate ? new Date(dto.matchDate) : null,
        }),
        ...(dto.scoreUser !== undefined && { scoreUser: dto.scoreUser }),
        ...(dto.scoreOpponent !== undefined && { scoreOpponent: dto.scoreOpponent }),
      },
      select: LIST_SELECT,
    });
  }

  async remove(id: string, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    await this.prisma.match.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async uploadVideo(id: string, file: Express.Multer.File, currentUser: AuthUser) {
    await this.assertOwner(id, currentUser);

    const existing = await this.prisma.matchVideo.findUnique({
      where: { matchId: id },
      select: { fileUrl: true },
    });

    const fileUrl = `/uploads/videos/${file.filename}`;

    if (existing) {
      this.deleteFile(existing.fileUrl);
      await this.prisma.matchVideo.update({
        where: { matchId: id },
        data: {
          fileUrl,
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          format: file.mimetype,
          processingStatus: 'pending',
        },
      });
    } else {
      await this.prisma.matchVideo.create({
        data: {
          matchId: id,
          fileUrl,
          fileName: file.originalname,
          fileSize: BigInt(file.size),
          format: file.mimetype,
        },
      });
    }

    // Despacha job de processamento para a fila BullMQ
    const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
    const videoPath = join(process.cwd(), uploadDir, 'videos', file.filename);

    await this.videoQueue.add(
      VIDEO_PROCESSING_JOB,
      { matchId: id, videoPath } satisfies VideoProcessingJobData,
      { attempts: 3, backoff: { type: 'exponential', delay: 5_000 } },
    );

    await this.auditLogs.log({
      userId: currentUser.id,
      module: 'matches',
      action: 'video_upload',
      metadata: { matchId: id, fileName: file.originalname, fileSize: file.size },
    });

    return { matchId: id, fileUrl, queued: true };
  }

  private deleteFile(fileUrl: string) {
    try {
      const uploadDir = process.env.UPLOAD_DIR ?? 'uploads';
      const filePath = join(process.cwd(), uploadDir, 'videos', basename(fileUrl));
      unlinkSync(filePath);
    } catch {
      // Best-effort: não falha a requisição por erro na remoção do arquivo antigo
    }
  }

  private async assertOwner(id: string, currentUser: AuthUser) {
    const match = await this.prisma.match.findUnique({
      where: { id, deletedAt: null },
      select: { userId: true },
    });

    if (!match) throw new NotFoundException('Partida não encontrada');
    if (match.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');
  }
}
