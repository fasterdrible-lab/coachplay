import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { MatchesService } from './matches.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('MatchesService', () => {
  const owner: AuthUser = { id: 'user-1', email: 'owner@a.com', role: 'player' };
  const otherUser: AuthUser = { id: 'user-2', email: 'other@a.com', role: 'player' };

  let prisma: { match: { findUnique: jest.Mock } };
  let queue: { add: jest.Mock };
  let auditLogs: Partial<AuditLogsService>;
  let service: MatchesService;

  beforeEach(() => {
    prisma = { match: { findUnique: jest.fn() } };
    queue = { add: jest.fn() };
    auditLogs = { log: jest.fn() };
    service = new MatchesService(
      prisma as unknown as PrismaService,
      queue as any,
      auditLogs as AuditLogsService,
    );
  });

  it('lança ForbiddenException quando o usuário tenta ver a partida de outro usuário', async () => {
    prisma.match.findUnique.mockResolvedValue({ userId: owner.id });

    await expect(service.findOne('match-1', otherUser)).rejects.toThrow(ForbiddenException);
  });

  it('lança NotFoundException quando a partida não existe (ou foi deletada)', async () => {
    prisma.match.findUnique.mockResolvedValue(null);

    await expect(service.findOne('match-1', owner)).rejects.toThrow(NotFoundException);
  });

  it('permite que o dono acesse a própria partida', async () => {
    prisma.match.findUnique
      .mockResolvedValueOnce({ userId: owner.id }) // assertOwner
      .mockResolvedValueOnce({ id: 'match-1', title: 'Final' }); // findUnique com DETAIL_SELECT

    const result = await service.findOne('match-1', owner);

    expect(result).toEqual({ id: 'match-1', title: 'Final' });
  });
});
