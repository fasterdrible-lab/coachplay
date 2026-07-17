import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CaptureSessionsService } from './capture-sessions.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('CaptureSessionsService', () => {
  const owner: AuthUser = { id: 'user-1', email: 'owner@a.com', role: 'player' };
  const otherUser: AuthUser = { id: 'user-2', email: 'other@a.com', role: 'player' };

  let prisma: {
    captureSession: { create: jest.Mock; findUnique: jest.Mock; update: jest.Mock };
    match: { findUnique: jest.Mock };
    frameSample: { create: jest.Mock };
    videoSegment: { create: jest.Mock };
    gameEvent: { findMany: jest.Mock };
    coachFeedback: { findMany: jest.Mock };
  };
  let auditLogs: Partial<AuditLogsService>;
  let service: CaptureSessionsService;

  beforeEach(() => {
    prisma = {
      captureSession: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      match: { findUnique: jest.fn() },
      frameSample: { create: jest.fn() },
      videoSegment: { create: jest.fn() },
      gameEvent: { findMany: jest.fn() },
      coachFeedback: { findMany: jest.fn() },
    };
    auditLogs = { log: jest.fn() };
    service = new CaptureSessionsService(
      prisma as unknown as PrismaService,
      auditLogs as AuditLogsService,
    );
  });

  describe('create', () => {
    it('cria a sessão já como "running" e registra log de auditoria', async () => {
      prisma.captureSession.create.mockResolvedValue({ id: 'sess-1', status: 'running' });

      const result = await service.create(
        { sourceType: 'window', sourceName: 'Xbox' } as any,
        owner,
      );

      expect(prisma.captureSession.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ userId: owner.id, status: 'running' }) }),
      );
      expect(auditLogs.log).toHaveBeenCalled();
      expect(result).toEqual({ id: 'sess-1', status: 'running' });
    });

    it('valida dono da partida quando matchId é informado', async () => {
      prisma.match.findUnique.mockResolvedValue(null);

      await expect(
        service.create({ sourceType: 'window', sourceName: 'Xbox', matchId: 'm-1' } as any, owner),
      ).rejects.toThrow(NotFoundException);
      expect(prisma.captureSession.create).not.toHaveBeenCalled();
    });
  });

  describe('transições de estado', () => {
    it('permite pausar uma sessão em execução', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });
      prisma.captureSession.update.mockResolvedValue({ id: 's1', status: 'paused' });

      const result = await service.pause('s1', owner);

      expect(result.status).toBe('paused');
    });

    it('rejeita retomar uma sessão que já está em execução (transição inválida)', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });

      await expect(service.resume('s1', owner)).rejects.toThrow(BadRequestException);
      expect(prisma.captureSession.update).not.toHaveBeenCalled();
    });

    it('rejeita qualquer transição de uma sessão já parada', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'stopped' });

      await expect(service.pause('s1', owner)).rejects.toThrow(BadRequestException);
    });

    it('marca como failed quando stop recebe errorMessage', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });
      prisma.captureSession.update.mockResolvedValue({ id: 's1', status: 'failed' });

      await service.stop('s1', owner, { errorMessage: 'janela fechada' });

      expect(prisma.captureSession.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'failed', errorMessage: 'janela fechada' }),
        }),
      );
    });

    it('lança ForbiddenException quando outro usuário tenta alterar a sessão', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });

      await expect(service.pause('s1', otherUser)).rejects.toThrow(ForbiddenException);
    });

    it('lança NotFoundException quando a sessão não existe', async () => {
      prisma.captureSession.findUnique.mockResolvedValue(null);

      await expect(service.pause('missing', owner)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addFrame / addSegment', () => {
    const file = { filename: 'frame-1.png' } as Express.Multer.File;

    it('grava o frame com o caminho público esperado', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });
      prisma.frameSample.create.mockResolvedValue({ id: 'f1' });

      await service.addFrame('s1', { timestampMs: 1000 } as any, file, owner);

      expect(prisma.frameSample.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ framePath: '/uploads/frames/frame-1.png', timestampMs: 1000 }),
        }),
      );
    });

    it('rejeita segmento cujo fim é anterior ou igual ao início', async () => {
      prisma.captureSession.findUnique.mockResolvedValue({ id: 's1', userId: owner.id, status: 'running' });

      await expect(
        service.addSegment(
          's1',
          { startTimestampMs: 5000, endTimestampMs: 4000 } as any,
          { filename: 'seg-1.mp4' } as Express.Multer.File,
          owner,
        ),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.videoSegment.create).not.toHaveBeenCalled();
    });
  });

  describe('getMatchEvents / getMatchFeedbacks', () => {
    it('retorna eventos ordenados por timestamp quando o usuário é dono da partida', async () => {
      prisma.match.findUnique.mockResolvedValue({ userId: owner.id });
      prisma.gameEvent.findMany.mockResolvedValue([{ id: 'e1' }]);

      const result = await service.getMatchEvents('m1', owner);

      expect(result).toEqual([{ id: 'e1' }]);
      expect(prisma.gameEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { matchId: 'm1' } }),
      );
    });

    it('nega acesso a feedbacks de partida de outro usuário', async () => {
      prisma.match.findUnique.mockResolvedValue({ userId: owner.id });

      await expect(service.getMatchFeedbacks('m1', otherUser)).rejects.toThrow(ForbiddenException);
    });
  });
});
