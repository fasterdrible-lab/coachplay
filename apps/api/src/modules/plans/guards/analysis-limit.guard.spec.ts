import { ExecutionContext, HttpException } from '@nestjs/common';
import { AnalysisLimitGuard } from './analysis-limit.guard';
import { PrismaService } from '../../../shared/database/prisma.service';
import { PlansService } from '../plans.service';

function buildContext(user: { id: string }): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('AnalysisLimitGuard', () => {
  const user = { id: 'user-1' };

  let prisma: { subscription: { findUnique: jest.Mock } };
  let plansService: { countAnalysesThisMonth: jest.Mock };
  let guard: AnalysisLimitGuard;

  beforeEach(() => {
    prisma = { subscription: { findUnique: jest.fn() } };
    plansService = { countAnalysesThisMonth: jest.fn() };
    guard = new AnalysisLimitGuard(
      prisma as unknown as PrismaService,
      plansService as unknown as PlansService,
    );
  });

  it('bloqueia com HTTP 402 quando o plano Free atingiu o limite mensal de análises', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: { name: 'Free', monthlyAnalysisLimit: 3 },
    });
    plansService.countAnalysesThisMonth.mockResolvedValue(3);

    await expect(guard.canActivate(buildContext(user))).rejects.toMatchObject({
      status: 402,
    });
  });

  it('permite a análise quando o consumo do mês está abaixo do limite do plano', async () => {
    prisma.subscription.findUnique.mockResolvedValue({
      plan: { name: 'Free', monthlyAnalysisLimit: 3 },
    });
    plansService.countAnalysesThisMonth.mockResolvedValue(2);

    await expect(guard.canActivate(buildContext(user))).resolves.toBe(true);
  });

  it('bloqueia com HTTP 402 quando o usuário não possui assinatura ativa', async () => {
    prisma.subscription.findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(buildContext(user))).rejects.toBeInstanceOf(HttpException);
  });
});
