import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../../../shared/database/prisma.service';
import { AuthUser } from '../../../shared/types/auth-user.type';
import { PlansService } from '../plans.service';

@Injectable()
export class AnalysisLimitGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly plansService: PlansService,
  ) {}

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

    const analysesThisMonth = await this.plansService.countAnalysesThisMonth(user.id);

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
