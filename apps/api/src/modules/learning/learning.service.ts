import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { LearningLevel } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { computePathProgress, flattenLessons, isLessonUnlocked, ModuleWithLessons } from './learning-progress.util';
import { UpdateLearningProfileDto } from './dto/update-learning-profile.dto';

const MODULES_WITH_LESSONS_INCLUDE = {
  orderBy: { order: 'asc' as const },
  include: { lessons: { orderBy: { order: 'asc' as const } } },
};

@Injectable()
export class LearningService {
  constructor(private readonly prisma: PrismaService) {}

  async listPaths(gameId: string, level?: LearningLevel) {
    return this.prisma.learningPath.findMany({
      where: { gameId, active: true, ...(level && { level }) },
      orderBy: { order: 'asc' },
    });
  }

  async getPath(pathId: string, currentUser: AuthUser) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { modules: MODULES_WITH_LESSONS_INCLUDE },
    });
    if (!path || !path.active) {
      throw new NotFoundException(`Trilha "${pathId}" não encontrada`);
    }

    const flat = flattenLessons(path.modules);
    const completedIds = await this.completedLessonIds(currentUser.id, flat.map((l) => l.id));

    return {
      ...path,
      modules: path.modules.map((m) => ({
        ...m,
        lessons: m.lessons.map((l) => ({
          ...l,
          unlocked: isLessonUnlocked(flat, l.id, completedIds),
          completed: completedIds.has(l.id),
        })),
      })),
    };
  }

  /** "concluir aula" / "repetir aula" (Tarefa 12) — upsert idempotente: concluir de novo uma
   * aula já concluída nunca cria uma segunda linha, só atualiza completedAt/attempts. */
  async completeLesson(lessonId: string, currentUser: AuthUser) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, learningModule: { select: { learningPathId: true } } },
    });
    if (!lesson) {
      throw new NotFoundException(`Aula "${lessonId}" não encontrada`);
    }

    const flat = await this.flattenPathLessons(lesson.learningModule.learningPathId);
    const completedIds = await this.completedLessonIds(currentUser.id, flat.map((l) => l.id));

    if (!isLessonUnlocked(flat, lessonId, completedIds)) {
      throw new BadRequestException('Esta aula ainda está bloqueada — conclua a aula anterior primeiro');
    }

    const existing = await this.prisma.userLessonProgress.findUnique({
      where: { userId_lessonId: { userId: currentUser.id, lessonId } },
    });

    return this.prisma.userLessonProgress.upsert({
      where: { userId_lessonId: { userId: currentUser.id, lessonId } },
      create: { userId: currentUser.id, lessonId, status: 'COMPLETED', attempts: 1, completedAt: new Date() },
      update: { status: 'COMPLETED', attempts: (existing?.attempts ?? 0) + 1, completedAt: new Date() },
    });
  }

  async getProgress(pathId: string, currentUser: AuthUser) {
    const flat = await this.flattenPathLessons(pathId);
    const completedIds = await this.completedLessonIds(currentUser.id, flat.map((l) => l.id));

    return computePathProgress(flat, completedIds);
  }

  async getProfile(currentUser: AuthUser) {
    const profile = await this.prisma.userLearningProfile.findUnique({ where: { userId: currentUser.id } });
    return profile ?? { userId: currentUser.id, level: LearningLevel.BEGINNER, goals: null };
  }

  /** "alteração de nível" (Tarefa 12). */
  async updateProfile(dto: UpdateLearningProfileDto, currentUser: AuthUser) {
    return this.prisma.userLearningProfile.upsert({
      where: { userId: currentUser.id },
      create: { userId: currentUser.id, level: dto.level, goals: dto.goals },
      update: { level: dto.level, ...(dto.goals !== undefined && { goals: dto.goals }) },
    });
  }

  private async flattenPathLessons(pathId: string) {
    const path = await this.prisma.learningPath.findUnique({
      where: { id: pathId },
      include: { modules: MODULES_WITH_LESSONS_INCLUDE },
    });
    if (!path) {
      throw new NotFoundException(`Trilha "${pathId}" não encontrada`);
    }
    return flattenLessons(path.modules as ModuleWithLessons[]);
  }

  /** Sempre filtrado pelo userId do chamador — nunca aceita um userId vindo do cliente
   * (Tarefa 12: progresso de um usuário nunca visível/afetável por outro). */
  private async completedLessonIds(userId: string, lessonIds: string[]): Promise<Set<string>> {
    if (lessonIds.length === 0) return new Set();

    const rows = await this.prisma.userLessonProgress.findMany({
      where: { userId, lessonId: { in: lessonIds }, status: 'COMPLETED' },
      select: { lessonId: true },
    });
    return new Set(rows.map((r) => r.lessonId));
  }
}
