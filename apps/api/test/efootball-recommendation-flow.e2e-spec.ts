import { CanActivate, ExecutionContext, INestApplication, Injectable, ValidationPipe } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { AddressInfo } from 'net';
import { PrismaService } from '../src/shared/database/prisma.service';
import { PrismaModule } from '../src/shared/database/prisma.module';
import { OnboardingModule } from '../src/modules/onboarding/onboarding.module';
import { RecommendationsModule } from '../src/modules/recommendations/recommendations.module';
import { ReportsService } from '../src/modules/reports/reports.service';

/**
 * E2E (Tarefa 22) — fecha o gap documentado desde a Tarefa 1 da auditoria do módulo eFootball
 * (`docs/efootball-architecture.md`, risco 4): `apps/api/test/` nunca existiu, então
 * `npm run test:e2e` nunca rodava nada de verdade.
 *
 * Diferente dos "*.controller.integration.spec.ts" já existentes (Tarefas 2/6 — 1 módulo por
 * vez, service inteiro mockado), este teste sobe uma aplicação Nest real encadeando MÓDULOS
 * REAIS (Onboarding → Progress → Recommendations, todos com as classes de serviço verdadeiras,
 * unidas pelo container de DI de verdade) — só a camada de banco (`PrismaService`) e o
 * `ReportsService` (Match Analysis, fora do escopo deste fluxo) são substituídos por dublês.
 * Prova que a fiação real entre módulos (`@Module` imports, injeção de dependência) funciona,
 * algo que testes unitários com `new XService(...)` não conseguem verificar.
 *
 * Sem Postgres disponível neste ambiente (nem em CI, presumivelmente, até haver um serviço de
 * banco dedicado) — o "banco" aqui é um fake em memória fiel o bastante ao schema Prisma real
 * pra exercitar a jornada completa: onboarding pendente → elenco vazio → sem squad → aula
 * recomendada → dispensar → aula concluída → "em dia". Ver docs/efootball-architecture.md,
 * risco 4, pela decisão de criar isso do zero em vez de tentar restaurar um `test:e2e` que nunca
 * existiu.
 */
describe('Módulo eFootball (e2e) — Onboarding → Progresso → Recomendação adaptativa', () => {
  const USER_ID = 'user-e2e-1';
  const TEST_USER = { id: USER_ID, email: 'e2e@coachplay.com', role: 'player' };

  const GAME = { id: 'game-1', provider: 'EFOOTBALL', name: 'eFootball', active: true };
  const LESSON = { id: 'lesson-1', title: 'Como o jogo funciona', content: 'Conteúdo da aula.', order: 0 };
  const LEARNING_MODULE = { id: 'mod-1', title: 'Fundamentos', order: 0, lessons: [LESSON] };
  const PATH = {
    id: 'path-1',
    gameId: GAME.id,
    level: 'BEGINNER',
    title: 'Primeiros Passos no eFootball',
    description: 'Trilha inicial',
    order: 0,
    active: true,
    modules: [LEARNING_MODULE],
  };

  @Injectable()
  class FakeAuthGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
      context.switchToHttp().getRequest().user = TEST_USER;
      return true;
    }
  }

  let app: INestApplication;
  let baseUrl: string;

  // "Banco" em memória — só os campos que os fluxos abaixo realmente leem/escrevem.
  let profiles: Map<string, any>;
  let progressSnapshots: Map<string, any>;
  let recommendations: Map<string, any>;
  let lessonProgress: Array<{ userId: string; lessonId: string; status: string }>;
  let playersOwned: number;
  let squadsSaved: number;
  let recIdCounter: number;

  function resetState() {
    profiles = new Map();
    progressSnapshots = new Map();
    recommendations = new Map();
    lessonProgress = [];
    playersOwned = 0;
    squadsSaved = 0;
    recIdCounter = 1;
  }

  function buildFakePrisma(): Partial<PrismaService> {
    return {
      game: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(where.provider === GAME.provider ? GAME : null)),
      },
      userLearningProfile: {
        findUnique: jest.fn(({ where }: any) => Promise.resolve(profiles.get(where.userId) ?? null)),
        upsert: jest.fn(({ where, create, update }: any) => {
          const existing = profiles.get(where.userId);
          const row = existing ? { ...existing, ...update } : { userId: where.userId, ...create };
          profiles.set(where.userId, row);
          return Promise.resolve(row);
        }),
      },
      learningPath: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.id) return Promise.resolve(where.id === PATH.id ? { ...PATH } : null);
          if (where.gameId_level) {
            const match = where.gameId_level.gameId === PATH.gameId && where.gameId_level.level === PATH.level;
            return Promise.resolve(match ? { ...PATH } : null);
          }
          return Promise.resolve(null);
        }),
        findMany: jest.fn(({ where }: any) => {
          const matches = where.gameId === PATH.gameId && where.active === true && (!where.level || where.level === PATH.level);
          return Promise.resolve(matches ? [{ ...PATH }] : []);
        }),
      },
      lesson: {
        count: jest.fn(() => Promise.resolve(1)),
      },
      userLessonProgress: {
        findMany: jest.fn(({ where }: any) => {
          const ids: string[] = where.lessonId.in;
          const rows = lessonProgress.filter(
            (r) => r.userId === where.userId && ids.includes(r.lessonId) && r.status === 'COMPLETED',
          );
          return Promise.resolve(rows.map((r) => ({ lessonId: r.lessonId })));
        }),
        count: jest.fn(({ where }: any) => {
          const count = lessonProgress.filter((r) => r.userId === where.userId && r.status === 'COMPLETED').length;
          return Promise.resolve(count);
        }),
      },
      userPlayer: {
        count: jest.fn(() => Promise.resolve(playersOwned)),
      },
      userPlayerBuild: {
        count: jest.fn(() => Promise.resolve(0)),
      },
      userSquad: {
        count: jest.fn(() => Promise.resolve(squadsSaved)),
      },
      economyRecommendation: {
        count: jest.fn(() => Promise.resolve(0)),
      },
      userProgressSnapshot: {
        upsert: jest.fn(({ where, create, update }: any) => {
          const key = `${where.userId_gameId.userId}:${where.userId_gameId.gameId}`;
          const existing = progressSnapshots.get(key);
          const row = existing ? { ...existing, ...update, computedAt: new Date() } : { id: `snap-${key}`, computedAt: new Date(), ...create };
          progressSnapshots.set(key, row);
          return Promise.resolve(row);
        }),
      },
      learningRecommendation: {
        findUnique: jest.fn(({ where }: any) => {
          if (where.userId) return Promise.resolve(recommendations.get(where.userId) ?? null);
          if (where.id) {
            const row = [...recommendations.values()].find((r) => r.id === where.id);
            return Promise.resolve(row ?? null);
          }
          return Promise.resolve(null);
        }),
        upsert: jest.fn(({ where, create, update }: any) => {
          const existing = recommendations.get(where.userId);
          const row = existing
            ? { ...existing, ...update, updatedAt: new Date() }
            : { id: `rec-${recIdCounter++}`, createdAt: new Date(), updatedAt: new Date(), dismissedAt: null, ...create };
          recommendations.set(where.userId, row);
          return Promise.resolve(row);
        }),
        update: jest.fn(({ where, data }: any) => {
          const entry = [...recommendations.entries()].find(([, r]) => r.id === where.id);
          if (!entry) return Promise.resolve(null);
          const [userId, rec] = entry;
          const updated = { ...rec, ...data };
          recommendations.set(userId, updated);
          return Promise.resolve(updated);
        }),
      },
    } as unknown as Partial<PrismaService>;
  }

  const fakeReports = { getSummary: jest.fn().mockResolvedValue({ totalAnalyzed: 0, avgOverallScore: null, worstCategory: null }) };

  beforeAll(async () => {
    resetState();

    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, OnboardingModule, RecommendationsModule],
      providers: [{ provide: APP_GUARD, useClass: FakeAuthGuard }],
    })
      .overrideProvider(PrismaService)
      .useValue(buildFakePrisma())
      .overrideProvider(ReportsService)
      .useValue(fakeReports)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true }));
    await app.init();
    await app.listen(0);

    const address = app.getHttpServer().address() as AddressInfo;
    baseUrl = `http://127.0.0.1:${address.port}`;
  });

  afterAll(async () => {
    await app.close();
  });

  async function getNextBestAction() {
    const res = await fetch(`${baseUrl}/recommendations/next-best-action`);
    return { status: res.status, body: await res.json() };
  }

  it('1. usuário novo (sem onboarding): recomenda completar o onboarding', async () => {
    const { status, body } = await getNextBestAction();

    expect(status).toBe(200);
    expect(body.type).toBe('COMPLETE_ONBOARDING');
    expect(body.dismissed).toBe(false);
  });

  it('2. completa o onboarding via POST /onboarding/efootball', async () => {
    const res = await fetch(`${baseUrl}/onboarding/efootball`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ level: 'BEGINNER' }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.profile.onboardingCompletedAt).not.toBeNull();
    expect(body.recommendedPath.id).toBe(PATH.id);
  });

  it('3. onboarding feito mas elenco vazio: recomenda adicionar jogadores', async () => {
    const { body } = await getNextBestAction();

    expect(body.type).toBe('ADD_PLAYERS');
  });

  it('4. com jogador mas sem squad: recomenda montar elenco', async () => {
    playersOwned = 3;

    const { body } = await getNextBestAction();

    expect(body.type).toBe('BUILD_SQUAD');
  });

  let firstRecommendationId: string;

  it('5. com jogador e squad: recomenda a próxima aula da Academia (dado real, cross-módulo)', async () => {
    squadsSaved = 1;

    const { body } = await getNextBestAction();

    expect(body.type).toBe('DO_LESSON');
    expect(body.lessonId).toBe(LESSON.id);
    expect(body.reason).toContain('Fundamentos');
    expect(body.reason).toContain('Como o jogo funciona');
    expect(body.dismissed).toBe(false);
    firstRecommendationId = body.id;
  });

  it('6. dispensa a recomendação', async () => {
    const res = await fetch(`${baseUrl}/recommendations/${firstRecommendationId}/dismiss`, { method: 'POST' });

    expect(res.status).toBe(204);
  });

  it('7. mesma ação computada: continua "dismissed" em vez de reaparecer', async () => {
    const { body } = await getNextBestAction();

    expect(body.id).toBe(firstRecommendationId);
    expect(body.type).toBe('DO_LESSON');
    expect(body.dismissed).toBe(true);
  });

  it('8. usuário conclui a aula recomendada; estado muda de verdade → dismissedAt é limpo e a ação muda', async () => {
    lessonProgress.push({ userId: USER_ID, lessonId: LESSON.id, status: 'COMPLETED' });

    const { body } = await getNextBestAction();

    expect(body.type).toBe('ALL_CAUGHT_UP');
    expect(body.dismissed).toBe(false);
  });
});
