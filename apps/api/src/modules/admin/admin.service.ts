import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { UsageQueryDto } from './dto/usage-query.dto';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [
      usersTotal,
      usersActive,
      usersBlocked,
      usersInactive,
      matchesTotal,
      matchesAnalyzed,
      matchesProcessing,
      matchesFailed,
      matchesPending,
      aiAgg,
      recentLogs,
    ] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'active' } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'blocked' } }),
      this.prisma.user.count({ where: { deletedAt: null, status: 'inactive' } }),
      this.prisma.match.count({ where: { deletedAt: null } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'analyzed' } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'processing' } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'failed' } }),
      this.prisma.match.count({ where: { deletedAt: null, status: 'pending' } }),
      this.prisma.aIAnalysis.aggregate({
        where: { status: 'done' },
        _sum: { costEstimate: true },
        _count: true,
      }),
      this.prisma.auditLog.findMany({
        take: 8,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          module: true,
          action: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    const totalCost = Number(aiAgg._sum.costEstimate ?? 0);
    const totalAnalyses = aiAgg._count;

    return {
      users: {
        total: usersTotal,
        active: usersActive,
        blocked: usersBlocked,
        inactive: usersInactive,
      },
      matches: {
        total: matchesTotal,
        analyzed: matchesAnalyzed,
        processing: matchesProcessing,
        failed: matchesFailed,
        pending: matchesPending,
      },
      ai: {
        totalAnalyses,
        totalCost,
        avgCostPerAnalysis: totalAnalyses > 0 ? totalCost / totalAnalyses : 0,
      },
      recentLogs,
    };
  }

  async getUsage(query: UsageQueryDto) {
    const { page = 1, limit = 20 } = query;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          email: true,
          subscription: { select: { plan: { select: { name: true } } } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where: { deletedAt: null } }),
    ]);

    const userIds = users.map((u) => u.id);

    const analyses = await this.prisma.aIAnalysis.findMany({
      where: { status: 'done', match: { userId: { in: userIds } } },
      select: { costEstimate: true, match: { select: { userId: true } } },
    });

    const costByUser = new Map<string, number>();
    const countByUser = new Map<string, number>();
    for (const a of analyses) {
      const uid = a.match.userId;
      costByUser.set(uid, (costByUser.get(uid) ?? 0) + Number(a.costEstimate ?? 0));
      countByUser.set(uid, (countByUser.get(uid) ?? 0) + 1);
    }

    const data = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      plan: u.subscription?.plan?.name ?? null,
      totalAnalyses: countByUser.get(u.id) ?? 0,
      totalCost: countByUser.get(u.id) ? (costByUser.get(u.id) ?? 0) : 0,
    }));

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Observabilidade do módulo eFootball (Tarefa 21) — histórico consultável de `AiCallLog`,
   * separado do `getUsage()` acima (100% EA FC, `AIAnalysis`/`Match`) por serem tabelas e domínios
   * diferentes; nenhuma alteração no endpoint clássico. Agregado geral + quebra por `feature`
   * (`squad_coach`/`build_coach`) + as 20 chamadas mais recentes, mesmo formato de "overview +
   * lista recente" já usado em `getOverview()`.
   */
  async getEfootballAiUsage() {
    const [totalAgg, byFeature, recentCalls] = await Promise.all([
      this.prisma.aiCallLog.aggregate({
        _sum: { costEstimate: true },
        _avg: { latencyMs: true },
        _count: true,
      }),
      this.prisma.aiCallLog.groupBy({
        by: ['feature'],
        _sum: { costEstimate: true },
        _avg: { latencyMs: true },
        _count: true,
      }),
      this.prisma.aiCallLog.findMany({
        take: 20,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          feature: true,
          provider: true,
          success: true,
          costEstimate: true,
          latencyMs: true,
          errorMessage: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
        },
      }),
    ]);

    const totalCalls = totalAgg._count;
    const successCalls = await this.prisma.aiCallLog.count({ where: { success: true } });

    return {
      totalCalls,
      successCalls,
      failureRate: totalCalls > 0 ? (totalCalls - successCalls) / totalCalls : 0,
      totalCost: Number(totalAgg._sum.costEstimate ?? 0),
      avgLatencyMs: Number(totalAgg._avg.latencyMs ?? 0),
      byFeature: byFeature.map((f) => ({
        feature: f.feature,
        calls: f._count,
        totalCost: Number(f._sum.costEstimate ?? 0),
        avgLatencyMs: Number(f._avg.latencyMs ?? 0),
      })),
      recentCalls,
    };
  }
}
