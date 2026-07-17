import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

const ANALYSIS_USAGE_ACTION = 'video_analysis';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.plan.findMany({
      where: { status: 'active' },
      orderBy: { price: 'asc' },
    });
  }

  async getMySubscription(userId: string) {
    const subscription = await this.prisma.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    });

    if (!subscription) {
      throw new NotFoundException('Assinatura não encontrada.');
    }

    const analysesThisMonth = await this.countAnalysesThisMonth(userId);

    return {
      id: subscription.id,
      status: subscription.status,
      startedAt: subscription.startedAt,
      expiresAt: subscription.expiresAt,
      plan: subscription.plan,
      usage: {
        analysesThisMonth,
        limit: subscription.plan.monthlyAnalysisLimit,
        limitReached: analysesThisMonth >= subscription.plan.monthlyAnalysisLimit,
      },
    };
  }

  /** Conta o consumo do mês corrente a partir do UsageLog (fonte de verdade de consumo). */
  async countAnalysesThisMonth(userId: string): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return this.prisma.usageLog.count({
      where: {
        userId,
        action: ANALYSIS_USAGE_ACTION,
        createdAt: { gte: startOfMonth },
      },
    });
  }

  /** Registra o consumo de 1 análise em UsageLog. Chamado pelo worker ao concluir a análise. */
  async registerAnalysisUsage(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: { userId: true },
    });
    if (!match) return;

    await this.prisma.usageLog.create({
      data: {
        userId: match.userId,
        action: ANALYSIS_USAGE_ACTION,
        resourceType: 'match',
        resourceId: matchId,
      },
    });
  }
}
