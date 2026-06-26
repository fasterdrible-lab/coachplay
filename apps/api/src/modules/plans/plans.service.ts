import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';

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

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const analysesThisMonth = await this.prisma.match.count({
      where: { userId, status: 'analyzed', createdAt: { gte: startOfMonth } },
    });

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
}
