import { LearningLevel } from '@prisma/client';
import { ProgressService, PROGRESS_FORMULA_VERSION } from './progress.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { GamesService } from '../games/games.service';
import { LearningService } from '../learning/learning.service';
import { ReportsService } from '../reports/reports.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('ProgressService (Tarefa 16)', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const game = { id: 'game-efootball', provider: 'EFOOTBALL', name: 'eFootball', active: true };

  let prisma: {
    lesson: { count: jest.Mock };
    userLessonProgress: { count: jest.Mock };
    userPlayer: { count: jest.Mock };
    userPlayerBuild: { count: jest.Mock };
    userSquad: { count: jest.Mock };
    economyRecommendation: { count: jest.Mock };
    userProgressSnapshot: { upsert: jest.Mock };
  };
  let gamesService: { findByProvider: jest.Mock };
  let learning: { getProfile: jest.Mock };
  let reports: { getSummary: jest.Mock };
  let service: ProgressService;

  beforeEach(() => {
    prisma = {
      lesson: { count: jest.fn().mockResolvedValue(12) },
      userLessonProgress: { count: jest.fn().mockResolvedValue(3) },
      userPlayer: { count: jest.fn().mockResolvedValue(5) },
      userPlayerBuild: { count: jest.fn().mockResolvedValue(2) },
      userSquad: { count: jest.fn().mockResolvedValue(1) },
      economyRecommendation: { count: jest.fn().mockResolvedValue(4) },
      userProgressSnapshot: {
        upsert: jest.fn().mockImplementation(({ create }) =>
          Promise.resolve({ ...create, id: 'snap-1', computedAt: new Date('2026-09-15T12:00:00Z') }),
        ),
      },
    };
    gamesService = { findByProvider: jest.fn().mockResolvedValue(game) };
    learning = {
      getProfile: jest.fn().mockResolvedValue({
        level: LearningLevel.CASUAL,
        onboardingCompletedAt: new Date('2026-09-01T00:00:00Z'),
      }),
    };
    reports = {
      getSummary: jest.fn().mockResolvedValue({
        totalAnalyzed: 8,
        avgOverallScore: 6.5,
        worstCategory: 'passing',
      }),
    };

    service = new ProgressService(
      prisma as unknown as PrismaService,
      gamesService as unknown as GamesService,
      learning as unknown as LearningService,
      reports as unknown as ReportsService,
    );
  });

  it('agrega métricas de todos os engines num único snapshot', async () => {
    const result = await service.getMyProgress(userA);

    expect(result.formulaVersion).toBe(PROGRESS_FORMULA_VERSION);
    expect(result.metrics).toEqual({
      learning: {
        level: LearningLevel.CASUAL,
        onboardingCompletedAt: new Date('2026-09-01T00:00:00Z'),
        lessonsCompleted: 3,
        lessonsTotal: 12,
        percent: 25,
      },
      roster: { playersOwned: 5, favoritePlayers: 5, buildsSaved: 2 },
      squads: { squadsSaved: 1 },
      economy: { evaluationsCount: 4, recommendedCount: 4 },
      matchAnalysis: { totalAnalyzed: 8, worstCategory: 'passing', avgOverallScore: 6.5 },
    });
  });

  it('persiste (upsert) o snapshot mais recente pra (userId, gameId)', async () => {
    await service.getMyProgress(userA);

    expect(prisma.userProgressSnapshot.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_gameId: { userId: userA.id, gameId: game.id } },
      }),
    );
  });

  it('trilha sem nenhuma aula cadastrada: percent vem 0 em vez de dividir por zero', async () => {
    prisma.lesson.count.mockResolvedValue(0);
    prisma.userLessonProgress.count.mockResolvedValue(0);

    const result = await service.getMyProgress(userA);

    expect(result.metrics.learning.percent).toBe(0);
  });

  it('usuário sem nenhuma partida analisada: matchAnalysis reflete zero/null sem inventar dado', async () => {
    reports.getSummary.mockResolvedValue({ totalAnalyzed: 0, avgOverallScore: null, worstCategory: null });

    const result = await service.getMyProgress(userA);

    expect(result.metrics.matchAnalysis).toEqual({ totalAnalyzed: 0, avgOverallScore: null, worstCategory: null });
  });

  it('usuário diferente: métricas nunca vazam entre usuários (cada contagem é filtrada por userId)', async () => {
    await service.getMyProgress(userA);

    expect(prisma.userPlayer.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: userA.id }) }),
    );
    expect(prisma.userSquad.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: userA.id }) }),
    );
    expect(prisma.economyRecommendation.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: userA.id }) }),
    );
  });
});
