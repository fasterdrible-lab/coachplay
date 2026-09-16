import { LearningLevel } from '@prisma/client';
import { OnboardingService } from './onboarding.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { GamesService } from '../games/games.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('OnboardingService', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const userB: AuthUser = { id: 'user-b', email: 'b@a.com', role: 'player' };
  const game = { id: 'game-efootball', provider: 'EFOOTBALL', name: 'eFootball', active: true };
  const beginnerPath = { id: 'path-beginner', gameId: game.id, level: LearningLevel.BEGINNER };
  const advancedPath = { id: 'path-advanced', gameId: game.id, level: LearningLevel.ADVANCED };

  let prisma: {
    userLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
    learningPath: { findUnique: jest.Mock };
  };
  let gamesService: { findByProvider: jest.Mock };
  let service: OnboardingService;
  let profilesByUser: Record<string, { level: LearningLevel; goals?: string[]; onboardingCompletedAt: Date | null }>;

  beforeEach(() => {
    profilesByUser = {};

    prisma = {
      userLearningProfile: {
        findUnique: jest.fn().mockImplementation(({ where: { userId } }) =>
          Promise.resolve(profilesByUser[userId] ? { userId, ...profilesByUser[userId] } : null),
        ),
        upsert: jest.fn().mockImplementation(({ where: { userId }, create, update }) => {
          const existing = profilesByUser[userId];
          const data = existing ? update : create;
          profilesByUser[userId] = {
            level: data.level,
            goals: data.goals,
            onboardingCompletedAt: data.onboardingCompletedAt,
          };
          return Promise.resolve({ userId, ...profilesByUser[userId] });
        }),
      },
      learningPath: {
        findUnique: jest.fn().mockImplementation(({ where: { gameId_level } }) => {
          const { level } = gameId_level;
          const path = [beginnerPath, advancedPath].find((p) => p.level === level);
          return Promise.resolve(path ?? null);
        }),
      },
    };

    gamesService = { findByProvider: jest.fn().mockResolvedValue(game) };

    service = new OnboardingService(
      prisma as unknown as PrismaService,
      gamesService as unknown as GamesService,
    );
  });

  it('registra nível/objetivos e retorna a trilha inicial correspondente ao nível informado', async () => {
    const result = await service.completeOnboarding(
      { level: LearningLevel.BEGINNER, goals: ['melhorar finalização'] },
      userA,
    );

    expect(result.profile.level).toBe(LearningLevel.BEGINNER);
    expect(result.profile.onboardingCompletedAt).toBeInstanceOf(Date);
    expect(result.recommendedPath).toEqual(beginnerPath);
    expect(gamesService.findByProvider).toHaveBeenCalledWith('EFOOTBALL');
  });

  it('refazer o onboarding atualiza nível sem perder a data original de conclusão', async () => {
    const first = await service.completeOnboarding({ level: LearningLevel.BEGINNER }, userA);
    const firstCompletedAt = first.profile.onboardingCompletedAt;

    const second = await service.completeOnboarding({ level: LearningLevel.ADVANCED }, userA);

    expect(second.profile.level).toBe(LearningLevel.ADVANCED);
    expect(second.profile.onboardingCompletedAt).toEqual(firstCompletedAt);
    expect(second.recommendedPath).toEqual(advancedPath);
  });

  it('usuário diferente: onboarding de A nunca afeta o perfil de B', async () => {
    await service.completeOnboarding({ level: LearningLevel.ADVANCED }, userA);
    await service.completeOnboarding({ level: LearningLevel.BEGINNER }, userB);

    expect(profilesByUser[userA.id].level).toBe(LearningLevel.ADVANCED);
    expect(profilesByUser[userB.id].level).toBe(LearningLevel.BEGINNER);
  });

  it('sem trilha cadastrada para o nível, recommendedPath vem nulo em vez de lançar erro', async () => {
    prisma.learningPath.findUnique.mockResolvedValueOnce(null);

    const result = await service.completeOnboarding({ level: LearningLevel.COMPETITIVE }, userA);

    expect(result.recommendedPath).toBeNull();
  });
});
