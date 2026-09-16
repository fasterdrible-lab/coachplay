import { Injectable } from '@nestjs/common';
import { GameProvider } from '@prisma/client';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { GamesService } from '../games/games.service';
import { PlayersService } from '../players/players.service';
import { PlayerBuildEngineService } from '../player-build-engine/player-build-engine.service';
import { SquadBuilderService } from '../squad-builder/squad-builder.service';
import { EconomyAdvisorService } from '../economy-advisor/economy-advisor.service';
import { LearningService } from '../learning/learning.service';
import { findNextUnlockedLesson } from '../learning/next-lesson.util';
import { ReportsService } from '../reports/reports.service';
import { EfootballCoachService } from '../efootball-coach/efootball-coach.service';
import { BuildCoachContext } from '../efootball-coach/build-coach.types';
import { AskCoachDto } from './dto/ask-coach.dto';
import { AskCoachAnswer, AskCoachIntent } from './ask-coach.types';
import { extractPlayerSearchQuery, routeIntent } from './intent-router';

const MAX_PLAYER_MATCHES = 5;

/**
 * Ask Coach / Intent Router (Tarefa 14) — recebe uma pergunta em texto livre, classifica a
 * intenção (`intent-router.ts`, determinístico, sem IA na classificação) e chama o motor
 * correspondente: busca de jogadores (Tarefa 3), Player Build Engine (Tarefa 5), Squad Builder
 * (Tarefa 9), Economy Advisor (Tarefa 11) ou Academia (Tarefa 12, com integração de Match
 * Analysis da Tarefa 15). Só as intents cujo resultado é narrativo (SQUAD_ADVICE via
 * `SquadBuilderService.explainSquad`, BUILD_RECOMMENDATION via `EfootballCoachService.explainBuild`)
 * chamam IA generativa — e só pra explicar em texto um resultado já calculado pelo motor
 * determinístico correspondente, nunca pra recalcular ou inventar dado de jogo. PLAYER_SEARCH,
 * ECONOMY_ADVICE e LEARNING_RECOMMENDATION já têm resposta determinística suficiente e nunca
 * chamam IA — mesmo vale pra UNKNOWN: uma pergunta fora do vocabulário reconhecido recebe uma
 * resposta fixa, nunca uma IA generativa "adivinhando" sobre mecânica de jogo sem fonte validada.
 * `costEstimate` (Tarefa 20) é sempre 0 nas intents que nunca chamam IA — só `BUILD_RECOMMENDATION`/
 * `SQUAD_ADVICE` podem devolver um valor > 0, herdado de `EfootballCoachService`.
 */
@Injectable()
export class AskCoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gamesService: GamesService,
    private readonly playersService: PlayersService,
    private readonly playerBuildEngine: PlayerBuildEngineService,
    private readonly squadBuilder: SquadBuilderService,
    private readonly economyAdvisor: EconomyAdvisorService,
    private readonly learning: LearningService,
    private readonly reports: ReportsService,
    private readonly efootballCoach: EfootballCoachService,
  ) {}

  async ask(dto: AskCoachDto, currentUser: AuthUser): Promise<AskCoachAnswer> {
    const game = await this.gamesService.findByProvider(GameProvider.EFOOTBALL);
    const intent = routeIntent(dto.question);

    switch (intent) {
      case 'PLAYER_SEARCH':
        return this.handlePlayerSearch(dto, game.id, intent);
      case 'BUILD_RECOMMENDATION':
        return this.handleBuildRecommendation(dto, currentUser, intent);
      case 'SQUAD_ADVICE':
        return this.handleSquadAdvice(dto, game.id, currentUser, intent);
      case 'ECONOMY_ADVICE':
        return this.handleEconomyAdvice(dto, currentUser, intent);
      case 'LEARNING_RECOMMENDATION':
        return this.handleLearningRecommendation(game.id, currentUser, intent);
      default:
        return {
          intent,
          answer:
            'Não entendi bem sua pergunta. Você pode perguntar sobre um jogador específico, ' +
            'como evoluir a build de um jogador, seu elenco/escalação, se vale a pena abrir um ' +
            'pack, ou qual aula da Academia CoachPlay fazer a seguir.',
          modelUsed: null,
          costEstimate: 0,
        };
    }
  }

  private async handlePlayerSearch(dto: AskCoachDto, gameId: string, intent: AskCoachIntent): Promise<AskCoachAnswer> {
    const query = extractPlayerSearchQuery(dto.question);
    if (!query) {
      return { intent, answer: 'Diga o nome (ou apelido) do jogador que você quer buscar.', modelUsed: null, costEstimate: 0 };
    }

    const matches = await this.playersService.search(query, gameId);
    if (matches.length === 0) {
      return {
        intent,
        answer: `Não encontrei nenhum jogador chamado "${query}" na base do eFootball. Confira a grafia do nome.`,
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const names = matches.slice(0, MAX_PLAYER_MATCHES).map((p) => p.name).join(', ');
    const extra = matches.length > MAX_PLAYER_MATCHES ? ` e mais ${matches.length - MAX_PLAYER_MATCHES}` : '';
    return {
      intent,
      answer: `Encontrei ${matches.length} jogador(es): ${names}${extra}. Abra a carta pra ver atributos, skills e playstyles.`,
      modelUsed: null,
      costEstimate: 0,
    };
  }

  private async handleBuildRecommendation(dto: AskCoachDto, currentUser: AuthUser, intent: AskCoachIntent): Promise<AskCoachAnswer> {
    const { playerCardId, level, availableProgressionPoints } = dto;

    const missing: string[] = [];
    if (!playerCardId) missing.push('a carta do jogador (playerCardId)');
    if (level === undefined) missing.push('o nível atual do jogador');
    if (availableProgressionPoints === undefined) missing.push('os pontos de progressão disponíveis');

    if (missing.length > 0 || !playerCardId || level === undefined || availableProgressionPoints === undefined) {
      return {
        intent,
        answer: `Pra recomendar uma build preciso saber: ${missing.join(', ')}. Pergunte a partir da tela da carta do jogador.`,
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const card = await this.prisma.playerCard.findUnique({
      where: { id: playerCardId },
      select: { position: true, player: { select: { name: true } } },
    });
    if (!card) {
      return { intent, answer: `Não encontrei nenhuma carta com o id "${playerCardId}".`, modelUsed: null, costEstimate: 0 };
    }

    const strategy = dto.strategy ?? 'BALANCED';
    const build = await this.playerBuildEngine.generateBuild({
      playerCardId,
      level,
      position: card.position,
      strategy,
      availableProgressionPoints,
    });

    const context: BuildCoachContext = {
      playerName: card.player.name,
      position: card.position,
      strategy,
      level,
      roleScore: build.roleScore,
      totalPointsUsed: build.totalPointsUsed,
      totalPointsAvailable: build.totalPointsAvailable,
      prioritizedStats: build.explanationData.prioritizedStats,
      topGains: build.explanationData.topGains.map((g) => ({ statKey: g.statKey, delta: g.delta })),
    };

    const explanation = await this.efootballCoach.explainBuild(context, currentUser.id);
    return {
      intent,
      answer: explanation?.explanation ?? this.fallbackBuildAnswer(context),
      modelUsed: explanation?.modelUsed ?? null,
      costEstimate: explanation?.costEstimate ?? 0,
    };
  }

  private fallbackBuildAnswer(context: BuildCoachContext): string {
    const prioritized = context.prioritizedStats.length > 0 ? context.prioritizedStats.join(', ') : 'nenhum atributo específico';
    return (
      `Build ${context.strategy} para ${context.playerName} (nível ${context.level}, posição ${context.position}): ` +
      `usou ${context.totalPointsUsed} de ${context.totalPointsAvailable} pontos de progressão, priorizando ${prioritized}. ` +
      `Nota de adequação à posição: ${context.roleScore}/100.`
    );
  }

  private async handleSquadAdvice(
    dto: AskCoachDto,
    gameId: string,
    currentUser: AuthUser,
    intent: AskCoachIntent,
  ): Promise<AskCoachAnswer> {
    const userSquadId = dto.userSquadId ?? (await this.findDefaultSquadId(gameId, currentUser.id));
    if (!userSquadId) {
      return {
        intent,
        answer: 'Você ainda não tem nenhum elenco salvo. Monte um no Squad Builder primeiro e pergunte de novo.',
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const explanation = await this.squadBuilder.explainSquad(userSquadId, currentUser);
    return {
      intent,
      answer:
        explanation?.explanation ??
        'Não consegui gerar uma explicação detalhada agora — veja os detalhes do elenco na tela do Squad Builder.',
      modelUsed: explanation?.modelUsed ?? null,
      costEstimate: explanation?.costEstimate ?? 0,
    };
  }

  private async findDefaultSquadId(gameId: string, userId: string): Promise<string | null> {
    const squad = await this.prisma.userSquad.findFirst({
      where: { userId, gameId },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
      select: { id: true },
    });
    return squad?.id ?? null;
  }

  private async handleEconomyAdvice(dto: AskCoachDto, currentUser: AuthUser, intent: AskCoachIntent): Promise<AskCoachAnswer> {
    if (!dto.packId || dto.userCoins === undefined) {
      return {
        intent,
        answer: 'Pra avaliar um pack preciso saber qual pack (packId) e quantas moedas você tem. Pergunte a partir da tela do pack.',
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const result = await this.economyAdvisor.evaluate(
      { packId: dto.packId, userCoins: dto.userCoins, userSquadId: dto.userSquadId },
      currentUser,
    );

    const lead = this.economyRecommendationLead(result.recommendation);
    const reasons = result.reasons.join(' ');
    return { intent, answer: reasons ? `${lead} ${reasons}` : lead, modelUsed: null, costEstimate: 0 };
  }

  private economyRecommendationLead(recommendation: string): string {
    switch (recommendation) {
      case 'RECOMMENDED':
        return 'Vale a pena considerar esse pack.';
      case 'NEUTRAL':
        return 'Esse pack é neutro — não recomendo nem desaconselho fortemente.';
      case 'NOT_RECOMMENDED':
        return 'Não recomendo esse pack agora.';
      default:
        return 'Não temos dados confiáveis (probabilidade verificada) pra avaliar esse pack com segurança.';
    }
  }

  /**
   * Integração com Match Analysis (Tarefa 15): antes de cair na próxima aula "em sequência" da
   * trilha do nível atual, tenta uma recomendação informada pela categoria de erro mais frequente
   * das partidas REAIS já analisadas (`ReportsService.getSummary`, EA FC hoje —
   * `LearningService.getMatchInformedRecommendation` nunca fura a ordem de desbloqueio da Tarefa
   * 12: só recomenda se a aula do módulo correspondente já estiver desbloqueada e pendente).
   */
  private async handleLearningRecommendation(gameId: string, currentUser: AuthUser, intent: AskCoachIntent): Promise<AskCoachAnswer> {
    const summary = await this.reports.getSummary(currentUser.id);
    const matchInformed = await this.learning.getMatchInformedRecommendation(summary.worstCategory, gameId, currentUser);
    if (matchInformed) {
      return {
        intent,
        answer:
          `Suas partidas analisadas mostram dificuldade em "${matchInformed.matchCategory}" — recomendo a aula ` +
          `"${matchInformed.moduleTitle} > ${matchInformed.lessonTitle}".`,
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const profile = await this.learning.getProfile(currentUser);
    const paths = await this.learning.listPaths(gameId, profile.level);
    const pathSummary = paths[0];

    if (!pathSummary) {
      return {
        intent,
        answer: `Ainda não temos uma trilha cadastrada pro seu nível (${profile.level}). Ajuste seu nível em /learning/profile e pergunte de novo.`,
        modelUsed: null,
        costEstimate: 0,
      };
    }

    const path = await this.learning.getPath(pathSummary.id, currentUser);
    const nextLesson = findNextUnlockedLesson(path.modules);

    if (!nextLesson) {
      return {
        intent,
        answer: `Você já concluiu todas as aulas da trilha "${path.title}" (nível ${profile.level})! Considere subir de nível em /learning/profile.`,
        modelUsed: null,
        costEstimate: 0,
      };
    }

    return {
      intent,
      answer: `Você está na trilha "${path.title}" (nível ${profile.level}). Sua próxima aula é "${nextLesson.moduleTitle} > ${nextLesson.lessonTitle}".`,
      modelUsed: null,
      costEstimate: 0,
    };
  }
}
