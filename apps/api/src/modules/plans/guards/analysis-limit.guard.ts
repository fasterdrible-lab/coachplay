import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user.type';

@Injectable()
export class AnalysisLimitGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user as AuthUser;

    const subscription = await this.prisma.subscription.findUnique({
      where: { userId: user.id },
      include: { plan: true },
    });

    if (!subscription) {
      throw new HttpException(
        { statusCode: 402, message: 'Nenhuma assinatura ativa encontrada.' },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const analysesThisMonth = await this.prisma.match.count({
      where: {
        userId: user.id,
        status: 'analyzed',
        createdAt: { gte: startOfMonth },
      },
    });

    if (analysesThisMonth >= subscription.plan.monthlyAnalysisLimit) {
      throw new HttpException(
        {
          statusCode: 402,
          message: `Limite de ${subscription.plan.monthlyAnalysisLimit} análises mensais atingido. Faça upgrade do plano.`,
          plan: subscription.plan.name,
          analysesUsed: analysesThisMonth,
          limit: subscription.plan.monthlyAnalysisLimit,
        },
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    return true;
  }
}
