import { Injectable } from '@nestjs/common';
import { GameProvider, LearningLevel, Prisma } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GamesService } from '../games/games.service';
import { LearningService } from '../learning/learning.service';
import { ReportsService } from '../reports/reports.service';

/** Versiona a fórmula de agregação (mesmo padrão de `DECISION_SCORE_CONFIG_VERSION`/
 * `PLAYER_BUILD_ENGINE_CONFIG_VERSION`) — mudar quais métricas entram ou como são calculadas é
 * uma mudança de produto, sobe a versão. */
export const PROGRESS_FORMULA_VERSION = '1.0.0';

export interface LearningProgressMetrics {
  level: LearningLevel;
  onboardingCompletedAt: Date | null;
  lessonsCompleted: number;
  lessonsTotal: number;
  percent: number;
}

export interface RosterProgressMetrics {
  playersOwned: number;
  favoritePlayers: number;
  buildsSaved: number;
}

export interface SquadsProgressMetrics {
  squadsSaved: number;
}

export interface EconomyProgressMetrics {
  evaluationsCount: number;
  recommendedCount: number;
}

export interface MatchAnalysisProgressMetrics {
  totalAnalyzed: number;
  worstCategory: string | null;
  avgOverallScore: number | null;
}

export interface UserProgressMetrics {
  learning: LearningProgressMetrics;
  roster: RosterProgressMetrics;
  squads: SquadsProgressMetrics;
  economy: EconomyProgressMetrics;
  matchAnalysis: MatchAnalysisProgressMetrics;
}

export interface UserProgressResult {
  computedAt: Date;
  formulaVersion: string;
  metrics: UserProgressMetrics;
}

/**
 * Progresso agregado (Tarefa 16) — `GET /progress/me`. Depende de todas as tarefas anteriores:
 * lê Academia (12, com o `onboardingCompletedAt` da 13), Meus Jogadores/builds (8), Squad Builder
 * (9), Economy Advisor (11) e o resumo de Match Analysis já usado na integração da Tarefa 15
 * (`ReportsService.getSummary`). Nunca recalcula nada desses motores — só conta/lê o que cada um
 * já persistiu, mesmo princípio de "camada fina de leitura" do `StrategicProfileBuilder`
 * (Tactical Engine, Fase 4).
 */
@Injectable()
export class ProgressService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
    private readonly learning: LearningService,
    private readonly reports: ReportsService,
  ) {}

  async getMyProgress(currentUser: AuthUser): Promise<UserProgressResult> {
    const game = await this.gamesService.findByProvider(GameProvider.EFOOTBALL);
    const metrics = await this.computeMetrics(game.id, currentUser);

    const snapshot = await this.prisma.userProgressSnapshot.upsert({
      where: { userId_gameId: { userId: currentUser.id, gameId: game.id } },
      create: {
        userId: currentUser.id,
        gameId: game.id,
        metrics: metrics as unknown as Prisma.InputJsonValue,
        formulaVersion: PROGRESS_FORMULA_VERSION,
      },
      update: {
        metrics: metrics as unknown as Prisma.InputJsonValue,
        formulaVersion: PROGRESS_FORMULA_VERSION,
        computedAt: new Date(),
      },
    });

    return { computedAt: snapshot.computedAt, formulaVersion: snapshot.formulaVersion, metrics };
  }

  private async computeMetrics(gameId: string, currentUser: AuthUser): Promise<UserProgressMetrics> {
    const [learning, roster, squads, economy, matchAnalysis] = await Promise.all([
      this.computeLearningMetrics(gameId, currentUser),
      this.computeRosterMetrics(gameId, currentUser.id),
      this.computeSquadsMetrics(gameId, currentUser.id),
      this.computeEconomyMetrics(gameId, currentUser.id),
      this.computeMatchAnalysisMetrics(currentUser.id),
    ]);

    return { learning, roster, squads, economy, matchAnalysis };
  }

  private async computeLearningMetrics(gameId: string, currentUser: AuthUser): Promise<LearningProgressMetrics> {
    const [profile, lessonsTotal, lessonsCompleted] = await Promise.all([
      this.learning.getProfile(currentUser),
      this.prisma.lesson.count({ where: { learningModule: { learningPath: { gameId, active: true } } } }),
      this.prisma.userLessonProgress.count({
        where: {
          userId: currentUser.id,
          status: 'COMPLETED',
          lesson: { learningModule: { learningPath: { gameId, active: true } } },
        },
      }),
    ]);

    return {
      level: profile.level,
      onboardingCompletedAt: profile.onboardingCompletedAt,
      lessonsCompleted,
      lessonsTotal,
      percent: lessonsTotal === 0 ? 0 : Math.round((lessonsCompleted / lessonsTotal) * 100),
    };
  }

  private async computeRosterMetrics(gameId: string, userId: string): Promise<RosterProgressMetrics> {
    const [playersOwned, favoritePlayers, buildsSaved] = await Promise.all([
      this.prisma.userPlayer.count({ where: { userId, playerCard: { player: { gameId } } } }),
      this.prisma.userPlayer.count({ where: { userId, playerCard: { player: { gameId } }, isFavorite: true } }),
      this.prisma.userPlayerBuild.count({ where: { userPlayer: { userId, playerCard: { player: { gameId } } } } }),
    ]);

    return { playersOwned, favoritePlayers, buildsSaved };
  }

  private async computeSquadsMetrics(gameId: string, userId: string): Promise<SquadsProgressMetrics> {
    const squadsSaved = await this.prisma.userSquad.count({ where: { userId, gameId } });
    return { squadsSaved };
  }

  private async computeEconomyMetrics(gameId: string, userId: string): Promise<EconomyProgressMetrics> {
    const [evaluationsCount, recommendedCount] = await Promise.all([
      this.prisma.economyRecommendation.count({ where: { userId, pack: { gameId } } }),
      this.prisma.economyRecommendation.count({
        where: { userId, pack: { gameId }, recommendation: 'RECOMMENDED' },
      }),
    ]);

    return { evaluationsCount, recommendedCount };
  }

  private async computeMatchAnalysisMetrics(userId: string): Promise<MatchAnalysisProgressMetrics> {
    const summary = await this.reports.getSummary(userId);
    return {
      totalAnalyzed: summary.totalAnalyzed,
      worstCategory: summary.worstCategory,
      avgOverallScore: summary.avgOverallScore,
    };
  }
}
