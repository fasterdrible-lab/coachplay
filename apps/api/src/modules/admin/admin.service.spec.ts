import { AdminService } from './admin.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('AdminService', () => {
  let prisma: {
    user: { count: jest.Mock; findMany: jest.Mock };
    match: { count: jest.Mock };
    aIAnalysis: { aggregate: jest.Mock; findMany: jest.Mock };
    auditLog: { findMany: jest.Mock };
    aiCallLog: { aggregate: jest.Mock; groupBy: jest.Mock; findMany: jest.Mock; count: jest.Mock };
  };
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      user: { count: jest.fn(), findMany: jest.fn() },
      match: { count: jest.fn() },
      aIAnalysis: { aggregate: jest.fn(), findMany: jest.fn() },
      auditLog: { findMany: jest.fn() },
      aiCallLog: { aggregate: jest.fn(), groupBy: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    };
    service = new AdminService(prisma as unknown as PrismaService);
  });

  describe('getOverview', () => {
    it('agrega contagens de usuários, partidas e custo de IA', async () => {
      prisma.user.count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // active
        .mockResolvedValueOnce(1) // blocked
        .mockResolvedValueOnce(1); // inactive
      prisma.match.count
        .mockResolvedValueOnce(50) // total
        .mockResolvedValueOnce(40) // analyzed
        .mockResolvedValueOnce(5) // processing
        .mockResolvedValueOnce(3) // failed
        .mockResolvedValueOnce(2); // pending
      prisma.aIAnalysis.aggregate.mockResolvedValue({
        _sum: { costEstimate: 2.5 },
        _count: 40,
      });
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getOverview();

      expect(result.users).toEqual({ total: 10, active: 8, blocked: 1, inactive: 1 });
      expect(result.matches).toEqual({
        total: 50,
        analyzed: 40,
        processing: 5,
        failed: 3,
        pending: 2,
      });
      expect(result.ai.totalAnalyses).toBe(40);
      expect(result.ai.totalCost).toBe(2.5);
      expect(result.ai.avgCostPerAnalysis).toBeCloseTo(0.0625);
    });

    it('não divide por zero quando não há análises concluídas', async () => {
      prisma.user.count.mockResolvedValue(0);
      prisma.match.count.mockResolvedValue(0);
      prisma.aIAnalysis.aggregate.mockResolvedValue({ _sum: { costEstimate: null }, _count: 0 });
      prisma.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getOverview();

      expect(result.ai.totalCost).toBe(0);
      expect(result.ai.avgCostPerAnalysis).toBe(0);
    });
  });

  describe('getUsage', () => {
    it('agrega custo e contagem de análises por usuário', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Ana', email: 'ana@a.com', subscription: { plan: { name: 'Free' } } },
        { id: 'u2', name: 'Bruno', email: 'bruno@a.com', subscription: null },
      ]);
      prisma.user.count.mockResolvedValue(2);
      prisma.aIAnalysis.findMany.mockResolvedValue([
        { costEstimate: 0.5, match: { userId: 'u1' } },
        { costEstimate: 0.3, match: { userId: 'u1' } },
        { costEstimate: 0.2, match: { userId: 'u2' } },
      ]);

      const result = await service.getUsage({ page: 1, limit: 20 });

      expect(result.data).toEqual([
        { id: 'u1', name: 'Ana', email: 'ana@a.com', plan: 'Free', totalAnalyses: 2, totalCost: 0.8 },
        { id: 'u2', name: 'Bruno', email: 'bruno@a.com', plan: null, totalAnalyses: 1, totalCost: 0.2 },
      ]);
    });

    it('retorna custo zero para usuários sem nenhuma análise concluída', async () => {
      prisma.user.findMany.mockResolvedValue([
        { id: 'u1', name: 'Ana', email: 'ana@a.com', subscription: null },
      ]);
      prisma.user.count.mockResolvedValue(1);
      prisma.aIAnalysis.findMany.mockResolvedValue([]);

      const result = await service.getUsage({ page: 1, limit: 20 });

      expect(result.data[0]).toMatchObject({ totalAnalyses: 0, totalCost: 0 });
    });
  });

  describe('getEfootballAiUsage (Tarefa 21 — observabilidade)', () => {
    it('agrega total, taxa de falha, custo/latência médios e quebra por feature', async () => {
      prisma.aiCallLog.aggregate.mockResolvedValue({
        _sum: { costEstimate: 1.5 },
        _avg: { latencyMs: 800 },
        _count: 10,
      });
      prisma.aiCallLog.count.mockResolvedValue(8); // sucessos
      prisma.aiCallLog.groupBy.mockResolvedValue([
        { feature: 'squad_coach', _sum: { costEstimate: 1.0 }, _avg: { latencyMs: 700 }, _count: 6 },
        { feature: 'build_coach', _sum: { costEstimate: 0.5 }, _avg: { latencyMs: 1000 }, _count: 4 },
      ]);
      prisma.aiCallLog.findMany.mockResolvedValue([]);

      const result = await service.getEfootballAiUsage();

      expect(result.totalCalls).toBe(10);
      expect(result.successCalls).toBe(8);
      expect(result.failureRate).toBeCloseTo(0.2);
      expect(result.totalCost).toBe(1.5);
      expect(result.avgLatencyMs).toBe(800);
      expect(result.byFeature).toEqual([
        { feature: 'squad_coach', calls: 6, totalCost: 1.0, avgLatencyMs: 700 },
        { feature: 'build_coach', calls: 4, totalCost: 0.5, avgLatencyMs: 1000 },
      ]);
    });

    it('não divide por zero quando não há nenhuma chamada de IA registrada ainda', async () => {
      prisma.aiCallLog.aggregate.mockResolvedValue({ _sum: { costEstimate: null }, _avg: { latencyMs: null }, _count: 0 });
      prisma.aiCallLog.count.mockResolvedValue(0);
      prisma.aiCallLog.groupBy.mockResolvedValue([]);
      prisma.aiCallLog.findMany.mockResolvedValue([]);

      const result = await service.getEfootballAiUsage();

      expect(result.failureRate).toBe(0);
      expect(result.totalCost).toBe(0);
      expect(result.avgLatencyMs).toBe(0);
    });
  });
});
