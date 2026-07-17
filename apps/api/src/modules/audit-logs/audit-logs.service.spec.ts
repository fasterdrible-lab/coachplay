import { AuditLogsService } from './audit-logs.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('AuditLogsService', () => {
  let prisma: { auditLog: { findMany: jest.Mock; count: jest.Mock; create: jest.Mock } };
  let service: AuditLogsService;

  beforeEach(() => {
    prisma = {
      auditLog: { findMany: jest.fn(), count: jest.fn(), create: jest.fn() },
    };
    service = new AuditLogsService(prisma as unknown as PrismaService);
  });

  describe('findAll', () => {
    it('pagina e ordena por data mais recente primeiro', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ page: 2, limit: 10 });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, orderBy: { createdAt: 'desc' } }),
      );
    });

    it('filtra por módulo e ação quando informados', async () => {
      prisma.auditLog.findMany.mockResolvedValue([]);
      prisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20, module: 'auth', action: 'login_failed' });

      expect(prisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { module: 'auth', action: 'login_failed' } }),
      );
    });

    it('calcula totalPages a partir do total e do limit', async () => {
      prisma.auditLog.findMany.mockResolvedValue([{ id: '1' }]);
      prisma.auditLog.count.mockResolvedValue(45);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result).toMatchObject({ total: 45, page: 1, limit: 20, totalPages: 3 });
    });
  });

  describe('log', () => {
    it('nunca lança mesmo se a escrita no banco falhar', async () => {
      prisma.auditLog.create.mockRejectedValue(new Error('db down'));

      await expect(
        service.log({ module: 'auth', action: 'login' }),
      ).resolves.toBeUndefined();
    });
  });
});
