import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PLANS = [
  {
    name: 'Free',
    monthlyAnalysisLimit: 3,
    maxVideoMinutes: 45,
    liveFeedbackEnabled: false,
    price: 0.0,
  },
  {
    name: 'Pro',
    monthlyAnalysisLimit: 20,
    maxVideoMinutes: 90,
    liveFeedbackEnabled: false,
    price: 29.9,
  },
  {
    name: 'Premium',
    monthlyAnalysisLimit: 100,
    maxVideoMinutes: 90,
    liveFeedbackEnabled: true,
    price: 79.9,
  },
];

async function main() {
  for (const plan of PLANS) {
    const existing = await prisma.plan.findFirst({ where: { name: plan.name } });

    if (existing) {
      await prisma.plan.update({
        where: { id: existing.id },
        data: {
          monthlyAnalysisLimit: plan.monthlyAnalysisLimit,
          maxVideoMinutes: plan.maxVideoMinutes,
          liveFeedbackEnabled: plan.liveFeedbackEnabled,
          price: plan.price,
          status: 'active',
        },
      });
      console.log(`↻ Plano ${plan.name} atualizado`);
    } else {
      await prisma.plan.create({ data: plan });
      console.log(`+ Plano ${plan.name} criado`);
    }
  }

  console.log('\nSeed concluído.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
