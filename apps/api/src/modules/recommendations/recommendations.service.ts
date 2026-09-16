import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { GameProvider, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GamesService } from '../games/games.service';
import { LearningService } from '../learning/learning.service';
import { findNextUnlockedLesson, NextLessonRef } from '../learning/next-lesson.util';
import { ProgressService } from '../progress/progress.service';
import { computeNextBestAction, NextBestActionSignals, NextBestActionType } from './next-best-action.util';

export interface NextBestActionResult {
  id: string;
  type: NextBestActionType;
  reason: string;
  lessonId: string | null;
  dismissed: boolean;
  createdAt: Date;
}

/**
 * Recomendação adaptativa (Tarefa 17) — `GET /recommendations/next-best-action`. Reaproveita o
 * `ProgressService` (Tarefa 16) pros sinais de onboarding/elenco/squad (evita recontar o que já
 * foi contado ali) e só consulta a Academia (`LearningService.getMatchInformedRecommendation` da
 * Tarefa 15, ou a próxima aula sequencial da Tarefa 12/14) quando as 3 condições de maior
 * prioridade já estão satisfeitas — nunca faz uma consulta cujo resultado a cadeia de prioridade
 * (`next-best-action.util.ts`) vai descartar de qualquer forma.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
    private readonly progress: ProgressService,
    private readonly learning: LearningService,
  ) {}

  async getNextBestAction(currentUser: AuthUser): Promise<NextBestActionResult> {
    const { metrics } = await this.progress.getMyProgress(currentUser);

    const onboardingCompleted = metrics.learning.onboardingCompletedAt !== null;
    const { playersOwned } = metrics.roster;
    const { squadsSaved } = metrics.squads;

    let signals: NextBestActionSignals = {
      onboardingCompleted,
      playersOwned,
      squadsSaved,
      matchInformedLesson: null,
      nextSequentialLesson: null,
    };

    if (onboardingCompleted && playersOwned > 0 && squadsSaved > 0) {
      const game = await this.gamesService.findByProvider(GameProvider.EFOOTBALL);
      const matchInformedLesson = await this.learning.getMatchInformedRecommendation(
        metrics.matchAnalysis.worstCategory,
        game.id,
        currentUser,
      );

      let nextSequentialLesson: NextLessonRef | null = null;
      if (!matchInformedLesson) {
        const paths = await this.learning.listPaths(game.id, metrics.learning.level);
        const pathSummary = paths[0];
        if (pathSummary) {
          const path = await this.learning.getPath(pathSummary.id, currentUser);
          nextSequentialLesson = findNextUnlockedLesson(path.modules);
        }
      }

      signals = { ...signals, matchInformedLesson, nextSequentialLesson };
    }

    const computed = computeNextBestAction(signals);
    return this.persistRecommendation(currentUser.id, computed);
  }

  /** Marca a recomendação atual como dispensada — a próxima `GET` só volta a mostrá-la se a
   * cadeia de prioridade recalcular exatamente a mesma ação (`dismissedAt` só é limpo quando a
   * ação computada muda). */
  async dismiss(recommendationId: string, currentUser: AuthUser): Promise<void> {
    const recommendation = await this.prisma.learningRecommendation.findUnique({
      where: { id: recommendationId },
      select: { userId: true },
    });
    if (!recommendation) throw new NotFoundException('Recomendação não encontrada');
    if (recommendation.userId !== currentUser.id) throw new ForbiddenException('Acesso negado');

    await this.prisma.learningRecommendation.update({
      where: { id: recommendationId },
      data: { dismissedAt: new Date() },
    });
  }

  private async persistRecommendation(
    userId: string,
    computed: ReturnType<typeof computeNextBestAction>,
  ): Promise<NextBestActionResult> {
    const existing = await this.prisma.learningRecommendation.findUnique({ where: { userId } });

    const isSameAction =
      existing?.type === computed.type && existing?.reason === computed.reason && existing?.lessonId === computed.lessonId;

    const update: Prisma.LearningRecommendationUncheckedUpdateInput = isSameAction
      ? {}
      : { type: computed.type, reason: computed.reason, lessonId: computed.lessonId, dismissedAt: null };

    const row = await this.prisma.learningRecommendation.upsert({
      where: { userId },
      create: { userId, type: computed.type, reason: computed.reason, lessonId: computed.lessonId },
      update,
    });

    return {
      id: row.id,
      type: row.type as NextBestActionType,
      reason: row.reason,
      lessonId: row.lessonId,
      dismissed: row.dismissedAt !== null,
      createdAt: row.createdAt,
    };
  }
}
