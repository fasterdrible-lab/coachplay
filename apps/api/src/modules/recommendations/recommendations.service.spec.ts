import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LearningLevel } from '@prisma/client';
import { RecommendationsService } from './recommendations.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { GamesService } from '../games/games.service';
import { ProgressService } from '../progress/progress.service';
import { LearningService } from '../learning/learning.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('RecommendationsService (Tarefa 17 — recomendação adaptativa)', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const userB: AuthUser = { id: 'user-b', email: 'b@a.com', role: 'player' };
  const game = { id: 'game-efootball', provider: 'EFOOTBALL', name: 'eFootball', active: true };

  const fullyOnboardedMetrics = {
    learning: { level: LearningLevel.BEGINNER, onboardingCompletedAt: new Date('2026-09-01'), lessonsCompleted: 0, lessonsTotal: 0, percent: 0 },
    roster: { playersOwned: 3, favoritePlayers: 0, buildsSaved: 0 },
    squads: { squadsSaved: 1 },
    economy: { evaluationsCount: 0, recommendedCount: 0 },
    matchAnalysis: { totalAnalyzed: 0, worstCategory: null as string | null, avgOverallScore: null },
  };

  let prisma: {
    learningRecommendation: { findUnique: jest.Mock; upsert: jest.Mock; update: jest.Mock };
  };
  let gamesService: { findByProvider: jest.Mock };
  let progress: { getMyProgress: jest.Mock };
  let learning: { getMatchInformedRecommendation: jest.Mock; listPaths: jest.Mock; getPath: jest.Mock };
  let service: RecommendationsService;
  let recommendationsByUser: Record<string, { id: string; type: string; reason: string; lessonId: string | null; dismissedAt: Date | null }>;

  beforeEach(() => {
    recommendationsByUser = {};
    let nextId = 1;

    prisma = {
      learningRecommendation: {
        findUnique: jest.fn().mockImplementation(({ where: { userId, id } }) => {
          if (userId) return Promise.resolve(recommendationsByUser[userId] ?? null);
          const row = Object.values(recommendationsByUser).find((r) => r.id === id);
          return Promise.resolve(row ? { userId: Object.keys(recommendationsByUser).find((k) => recommendationsByUser[k] === row), ...row } : null);
        }),
        upsert: jest.fn().mockImplementation(({ where: { userId }, create, update }) => {
          const existing = recommendationsByUser[userId];
          if (!existing) {
            const row = { id: `rec-${nextId++}`, dismissedAt: null, ...create };
            recommendationsByUser[userId] = row;
            return Promise.resolve(row);
          }
          const merged = { ...existing, ...update };
          recommendationsByUser[userId] = merged;
          return Promise.resolve(merged);
        }),
        update: jest.fn().mockImplementation(({ where: { id }, data }) => {
          const entry = Object.entries(recommendationsByUser).find(([, r]) => r.id === id);
          if (!entry) return Promise.resolve(null);
          const [userId, row] = entry;
          const merged = { ...row, ...data };
          recommendationsByUser[userId] = merged;
          return Promise.resolve(merged);
        }),
      },
    };
    gamesService = { findByProvider: jest.fn().mockResolvedValue(game) };
    progress = { getMyProgress: jest.fn().mockResolvedValue({ metrics: fullyOnboardedMetrics }) };
    learning = {
      getMatchInformedRecommendation: jest.fn().mockResolvedValue(null),
      listPaths: jest.fn().mockResolvedValue([{ id: 'path-1' }]),
      getPath: jest.fn().mockResolvedValue({
        title: 'Primeiros Passos',
        modules: [{ title: 'Fundamentos', lessons: [{ id: 'l1', title: 'Intro', unlocked: true, completed: false }] }],
      }),
    };

    service = new RecommendationsService(
      prisma as unknown as PrismaService,
      gamesService as unknown as GamesService,
      progress as unknown as ProgressService,
      learning as unknown as LearningService,
    );
  });

  it('onboarding pendente: recomenda completar onboarding sem consultar Academia/elenco', async () => {
    progress.getMyProgress.mockResolvedValue({
      metrics: { ...fullyOnboardedMetrics, learning: { ...fullyOnboardedMetrics.learning, onboardingCompletedAt: null } },
    });

    const result = await service.getNextBestAction(userA);

    expect(result.type).toBe('COMPLETE_ONBOARDING');
    expect(learning.getMatchInformedRecommendation).not.toHaveBeenCalled();
    expect(learning.listPaths).not.toHaveBeenCalled();
  });

  it('sem jogadores no elenco: recomenda adicionar jogadores', async () => {
    progress.getMyProgress.mockResolvedValue({
      metrics: { ...fullyOnboardedMetrics, roster: { ...fullyOnboardedMetrics.roster, playersOwned: 0 } },
    });

    const result = await service.getNextBestAction(userA);

    expect(result.type).toBe('ADD_PLAYERS');
  });

  it('onboarding/elenco/squad em dia: recomenda a próxima aula sequencial via Academia', async () => {
    const result = await service.getNextBestAction(userA);

    expect(result.type).toBe('DO_LESSON');
    expect(result.lessonId).toBe('l1');
    expect(result.dismissed).toBe(false);
  });

  it('prioriza a aula informada pelo Match Analysis sobre a sequencial', async () => {
    learning.getMatchInformedRecommendation.mockResolvedValue({
      moduleTitle: 'Passe',
      lessonTitle: 'Passe certo',
      lessonId: 'l2',
      matchCategory: 'passing',
    });

    const result = await service.getNextBestAction(userA);

    expect(result.lessonId).toBe('l2');
    expect(result.reason).toContain('passing');
    expect(learning.listPaths).not.toHaveBeenCalled();
  });

  it('persiste (upsert) uma única recomendação por usuário', async () => {
    await service.getNextBestAction(userA);
    const second = await service.getNextBestAction(userA);

    expect(Object.keys(recommendationsByUser)).toEqual([userA.id]);
    expect(second.id).toBe(recommendationsByUser[userA.id].id);
  });

  it('dismiss: marca dismissedAt e a mesma ação computada continua "dismissed" até o estado mudar', async () => {
    const first = await service.getNextBestAction(userA);
    await service.dismiss(first.id, userA);

    const second = await service.getNextBestAction(userA);

    expect(second.dismissed).toBe(true);
    expect(second.type).toBe(first.type);
  });

  it('dismiss: quando a ação computada muda, a nova recomendação não vem dismissed', async () => {
    const first = await service.getNextBestAction(userA);
    await service.dismiss(first.id, userA);

    learning.getMatchInformedRecommendation.mockResolvedValue({
      moduleTitle: 'Passe',
      lessonTitle: 'Passe certo',
      lessonId: 'l2',
      matchCategory: 'passing',
    });

    const second = await service.getNextBestAction(userA);

    expect(second.dismissed).toBe(false);
    expect(second.lessonId).toBe('l2');
  });

  it('dismiss: lança NotFoundException para recomendação inexistente', async () => {
    await expect(service.dismiss('rec-inexistente', userA)).rejects.toThrow(NotFoundException);
  });

  it('dismiss: usuário não pode dispensar a recomendação de outro usuário', async () => {
    const first = await service.getNextBestAction(userA);

    await expect(service.dismiss(first.id, userB)).rejects.toThrow(ForbiddenException);
  });

  it('usuário diferente: recomendação de A nunca é afetada pelo cálculo de B', async () => {
    await service.getNextBestAction(userA);

    progress.getMyProgress.mockResolvedValue({
      metrics: { ...fullyOnboardedMetrics, roster: { ...fullyOnboardedMetrics.roster, playersOwned: 0 } },
    });
    await service.getNextBestAction(userB);

    expect(recommendationsByUser[userA.id].type).toBe('DO_LESSON');
    expect(recommendationsByUser[userB.id].type).toBe('ADD_PLAYERS');
  });
});
