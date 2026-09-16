import { BadRequestException, NotFoundException } from '@nestjs/common';
import { LearningLevel } from '@prisma/client';
import { LearningService } from './learning.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('LearningService', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const userB: AuthUser = { id: 'user-b', email: 'b@a.com', role: 'player' };

  const pathWithModules = {
    id: 'path-1',
    active: true,
    modules: [
      {
        order: 0,
        lessons: [
          { id: 'l1', order: 0 },
          { id: 'l2', order: 1 },
        ],
      },
      { order: 1, lessons: [{ id: 'l3', order: 0 }] },
    ],
  };

  let prisma: {
    learningPath: { findUnique: jest.Mock; findMany: jest.Mock };
    learningModule: { findFirst: jest.Mock };
    lesson: { findUnique: jest.Mock };
    userLessonProgress: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
    userLearningProfile: { findUnique: jest.Mock; upsert: jest.Mock };
  };
  let service: LearningService;
  let completedByUser: Record<string, Set<string>>;

  beforeEach(() => {
    completedByUser = { [userA.id]: new Set(), [userB.id]: new Set() };

    prisma = {
      learningPath: {
        findUnique: jest.fn().mockResolvedValue(pathWithModules),
        findMany: jest.fn(),
      },
      learningModule: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      lesson: {
        findUnique: jest.fn().mockImplementation(({ where: { id } }) =>
          Promise.resolve({ id, learningModule: { learningPathId: 'path-1' } }),
        ),
      },
      userLessonProgress: {
        findUnique: jest.fn().mockImplementation(({ where: { userId_lessonId } }) => {
          const { userId, lessonId } = userId_lessonId;
          return Promise.resolve(
            completedByUser[userId]?.has(lessonId) ? { attempts: 1, status: 'COMPLETED' } : null,
          );
        }),
        findMany: jest.fn().mockImplementation(({ where: { userId, lessonId } }) => {
          const completed = completedByUser[userId] ?? new Set();
          const ids: string[] = lessonId.in.filter((id: string) => completed.has(id));
          return Promise.resolve(ids.map((id) => ({ lessonId: id })));
        }),
        upsert: jest.fn().mockImplementation(({ where: { userId_lessonId }, create }) => {
          const { userId, lessonId } = userId_lessonId;
          (completedByUser[userId] ??= new Set()).add(lessonId);
          return Promise.resolve({ userId, lessonId, status: 'COMPLETED', ...create });
        }),
      },
      userLearningProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockImplementation(({ create }) => Promise.resolve(create)),
      },
    };

    service = new LearningService(prisma as unknown as PrismaService);
  });

  it('concluir aula: a primeira aula da trilha pode ser concluída direto', async () => {
    const result = await service.completeLesson('l1', userA);

    expect(result.status).toBe('COMPLETED');
  });

  it('desbloquear aula seguinte: l2 fica bloqueada até l1 ser concluída', async () => {
    await expect(service.completeLesson('l2', userA)).rejects.toThrow(BadRequestException);

    await service.completeLesson('l1', userA);
    const result = await service.completeLesson('l2', userA);

    expect(result.status).toBe('COMPLETED');
  });

  it('repetir aula: concluir de novo uma aula já concluída não lança erro e mantém concluída', async () => {
    await service.completeLesson('l1', userA);
    const second = await service.completeLesson('l1', userA);

    expect(second.status).toBe('COMPLETED');
    expect(prisma.userLessonProgress.upsert).toHaveBeenCalledTimes(2);
  });

  it('progresso: reflete exatamente as aulas concluídas pelo usuário', async () => {
    await service.completeLesson('l1', userA);
    await service.completeLesson('l2', userA);

    const progress = await service.getProgress('path-1', userA);

    expect(progress).toEqual({ completed: 2, total: 3, percent: 67 });
  });

  it('alteração de nível: atualiza o nível do perfil de aprendizado', async () => {
    const result = await service.updateProfile({ level: LearningLevel.ADVANCED }, userA);

    expect(result.level).toBe(LearningLevel.ADVANCED);
    expect(prisma.userLearningProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: userA.id } }),
    );
  });

  it('usuário diferente: progresso de A não é visível nem afetado pelo progresso de B', async () => {
    await service.completeLesson('l1', userA);

    const progressB = await service.getProgress('path-1', userB);
    expect(progressB).toEqual({ completed: 0, total: 3, percent: 0 });

    // B também não pode pular pra l2 só porque A concluiu l1
    await expect(service.completeLesson('l2', userB)).rejects.toThrow(BadRequestException);
  });

  it('lança NotFoundException ao concluir aula inexistente', async () => {
    prisma.lesson.findUnique.mockResolvedValue(null);

    await expect(service.completeLesson('lesson-x', userA)).rejects.toThrow(NotFoundException);
  });

  describe('getMatchInformedRecommendation (Tarefa 15 — integração com Match Analysis)', () => {
    it('sem categoria (usuário sem partida analisada), retorna null sem consultar o banco', async () => {
      const result = await service.getMatchInformedRecommendation(null, 'game-1', userA);

      expect(result).toBeNull();
      expect(prisma.learningModule.findFirst).not.toHaveBeenCalled();
    });

    it('categoria sem módulo mapeado, retorna null sem consultar o banco', async () => {
      const result = await service.getMatchInformedRecommendation('categoria-desconhecida', 'game-1', userA);

      expect(result).toBeNull();
      expect(prisma.learningModule.findFirst).not.toHaveBeenCalled();
    });

    it('categoria mapeada mas sem módulo cadastrado nesse jogo, retorna null', async () => {
      prisma.learningModule.findFirst.mockResolvedValue(null);

      const result = await service.getMatchInformedRecommendation('passing', 'game-1', userA);

      expect(result).toBeNull();
    });

    it('primeira aula do módulo correspondente já desbloqueada e não concluída: recomenda', async () => {
      prisma.learningModule.findFirst.mockResolvedValue({
        id: 'm1',
        title: 'Passe',
        learningPathId: 'path-1',
        lessons: [{ id: 'l1', title: 'Escolhendo o passe certo' }],
      });

      const result = await service.getMatchInformedRecommendation('passing', 'game-1', userA);

      expect(result).toEqual({
        matchCategory: 'passing',
        moduleTitle: 'Passe',
        lessonId: 'l1',
        lessonTitle: 'Escolhendo o passe certo',
      });
    });

    it('primeira aula do módulo correspondente já concluída: não recomenda de novo', async () => {
      await service.completeLesson('l1', userA);
      prisma.learningModule.findFirst.mockResolvedValue({
        id: 'm1',
        title: 'Passe',
        learningPathId: 'path-1',
        lessons: [{ id: 'l1', title: 'Escolhendo o passe certo' }],
      });

      const result = await service.getMatchInformedRecommendation('passing', 'game-1', userA);

      expect(result).toBeNull();
    });

    it('primeira aula do módulo correspondente ainda bloqueada: nunca fura a ordem sequencial', async () => {
      prisma.learningModule.findFirst.mockResolvedValue({
        id: 'm2',
        title: 'Finalização',
        learningPathId: 'path-1',
        lessons: [{ id: 'l2', title: 'Escolhendo o momento de finalizar' }],
      });

      const result = await service.getMatchInformedRecommendation('attack', 'game-1', userA);

      expect(result).toBeNull();
    });

    it('usuário diferente: recomendação de A não é afetada pelo progresso de B', async () => {
      await service.completeLesson('l1', userB);
      prisma.learningModule.findFirst.mockResolvedValue({
        id: 'm1',
        title: 'Passe',
        learningPathId: 'path-1',
        lessons: [{ id: 'l1', title: 'Escolhendo o passe certo' }],
      });

      const result = await service.getMatchInformedRecommendation('passing', 'game-1', userA);

      expect(result).not.toBeNull();
    });
  });
});
