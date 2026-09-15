import { PrismaClient } from '@prisma/client';
import { FORMATIONS } from '../src/modules/squad-builder/formations.catalog';
import { LEARNING_PATHS } from '../src/modules/learning/learning-content.catalog';

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

const GAMES: Array<{ provider: 'EFOOTBALL'; name: string }> = [
  { provider: 'EFOOTBALL', name: 'eFootball' },
];

async function main() {
  for (const game of GAMES) {
    await prisma.game.upsert({
      where: { provider: game.provider },
      update: { name: game.name, active: true },
      create: game,
    });
    console.log(`✓ Jogo ${game.name} (${game.provider}) sincronizado`);
  }

  const efootball = await prisma.game.findUniqueOrThrow({ where: { provider: 'EFOOTBALL' } });

  for (const formationDef of FORMATIONS) {
    const formation = await prisma.formation.upsert({
      where: { gameId_code: { gameId: efootball.id, code: formationDef.code } },
      update: { name: formationDef.name, active: true },
      create: { gameId: efootball.id, code: formationDef.code, name: formationDef.name },
    });

    for (const [order, slotDef] of formationDef.slots.entries()) {
      await prisma.formationPosition.upsert({
        where: { formationId_slot: { formationId: formation.id, slot: slotDef.slot } },
        update: { position: slotDef.position, order, x: slotDef.x, y: slotDef.y },
        create: { formationId: formation.id, slot: slotDef.slot, position: slotDef.position, order, x: slotDef.x, y: slotDef.y },
      });
    }
    console.log(`✓ Formação ${formationDef.code} sincronizada (${formationDef.slots.length} posições)`);
  }

  for (const [pathOrder, pathSeed] of LEARNING_PATHS.entries()) {
    const path = await prisma.learningPath.upsert({
      where: { gameId_level: { gameId: efootball.id, level: pathSeed.level } },
      update: { title: pathSeed.title, description: pathSeed.description, order: pathOrder, active: true },
      create: {
        gameId: efootball.id,
        level: pathSeed.level,
        title: pathSeed.title,
        description: pathSeed.description,
        order: pathOrder,
      },
    });

    for (const [moduleOrder, moduleSeed] of pathSeed.modules.entries()) {
      const learningModule = await prisma.learningModule.upsert({
        where: { learningPathId_order: { learningPathId: path.id, order: moduleOrder } },
        update: { title: moduleSeed.title },
        create: { learningPathId: path.id, title: moduleSeed.title, order: moduleOrder },
      });

      for (const [lessonOrder, lessonSeed] of moduleSeed.lessons.entries()) {
        await prisma.lesson.upsert({
          where: { learningModuleId_order: { learningModuleId: learningModule.id, order: lessonOrder } },
          update: { title: lessonSeed.title, content: lessonSeed.content },
          create: {
            learningModuleId: learningModule.id,
            title: lessonSeed.title,
            content: lessonSeed.content,
            order: lessonOrder,
          },
        });
      }
    }
    console.log(`✓ Trilha ${pathSeed.level} sincronizada (${pathSeed.modules.length} módulos)`);
  }

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
