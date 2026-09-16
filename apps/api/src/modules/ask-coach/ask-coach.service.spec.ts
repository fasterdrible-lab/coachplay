import { LearningLevel } from '@prisma/client';
import { AskCoachService } from './ask-coach.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { GamesService } from '../games/games.service';
import { PlayersService } from '../players/players.service';
import { PlayerBuildEngineService } from '../player-build-engine/player-build-engine.service';
import { SquadBuilderService } from '../squad-builder/squad-builder.service';
import { EconomyAdvisorService } from '../economy-advisor/economy-advisor.service';
import { LearningService } from '../learning/learning.service';
import { ReportsService } from '../reports/reports.service';
import { EfootballCoachService } from '../efootball-coach/efootball-coach.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('AskCoachService — Intent Router (Tarefa 14)', () => {
  const user: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const game = { id: 'game-efootball', provider: 'EFOOTBALL', name: 'eFootball', active: true };

  let prisma: {
    playerCard: { findUnique: jest.Mock };
    userSquad: { findFirst: jest.Mock };
  };
  let gamesService: { findByProvider: jest.Mock };
  let playersService: { search: jest.Mock };
  let playerBuildEngine: { generateBuild: jest.Mock };
  let squadBuilder: { explainSquad: jest.Mock };
  let economyAdvisor: { evaluate: jest.Mock };
  let learning: { getProfile: jest.Mock; listPaths: jest.Mock; getPath: jest.Mock; getMatchInformedRecommendation: jest.Mock };
  let reports: { getSummary: jest.Mock };
  let efootballCoach: { explainBuild: jest.Mock };
  let service: AskCoachService;

  beforeEach(() => {
    prisma = {
      playerCard: { findUnique: jest.fn() },
      userSquad: { findFirst: jest.fn() },
    };
    gamesService = { findByProvider: jest.fn().mockResolvedValue(game) };
    playersService = { search: jest.fn().mockResolvedValue([]) };
    playerBuildEngine = { generateBuild: jest.fn() };
    squadBuilder = { explainSquad: jest.fn() };
    economyAdvisor = { evaluate: jest.fn() };
    learning = {
      getProfile: jest.fn(),
      listPaths: jest.fn(),
      getPath: jest.fn(),
      getMatchInformedRecommendation: jest.fn().mockResolvedValue(null),
    };
    reports = { getSummary: jest.fn().mockResolvedValue({ worstCategory: null }) };
    efootballCoach = { explainBuild: jest.fn() };

    service = new AskCoachService(
      prisma as unknown as PrismaService,
      gamesService as unknown as GamesService,
      playersService as unknown as PlayersService,
      playerBuildEngine as unknown as PlayerBuildEngineService,
      squadBuilder as unknown as SquadBuilderService,
      economyAdvisor as unknown as EconomyAdvisorService,
      learning as unknown as LearningService,
      reports as unknown as ReportsService,
      efootballCoach as unknown as EfootballCoachService,
    );
  });

  it('PLAYER_SEARCH: retorna os jogadores encontrados sem chamar IA', async () => {
    playersService.search.mockResolvedValue([{ id: 'p1', name: 'Lionel Messi' }]);

    const result = await service.ask({ question: 'Quem é Messi?' }, user);

    expect(result.intent).toBe('PLAYER_SEARCH');
    expect(result.modelUsed).toBeNull();
    expect(result.costEstimate).toBe(0);
    expect(result.answer).toContain('Lionel Messi');
    expect(playersService.search).toHaveBeenCalledWith('Messi', game.id);
  });

  it('PLAYER_SEARCH: sem resultado, avisa sem inventar jogador', async () => {
    playersService.search.mockResolvedValue([]);

    const result = await service.ask({ question: 'Quem é Fulano de Tal?' }, user);

    expect(result.answer).toContain('Não encontrei');
    expect(result.modelUsed).toBeNull();
  });

  it('BUILD_RECOMMENDATION: sem playerCardId/level/pontos, pede esclarecimento sem chamar o motor', async () => {
    const result = await service.ask({ question: 'Como evoluir meu jogador?' }, user);

    expect(result.intent).toBe('BUILD_RECOMMENDATION');
    expect(result.modelUsed).toBeNull();
    expect(result.answer).toContain('playerCardId');
    expect(playerBuildEngine.generateBuild).not.toHaveBeenCalled();
  });

  it('BUILD_RECOMMENDATION: com todos os slots, chama o motor e narra via IA', async () => {
    prisma.playerCard.findUnique.mockResolvedValue({ position: 'LWF', player: { name: 'Kvaratskhelia' } });
    playerBuildEngine.generateBuild.mockResolvedValue({
      roleScore: 87,
      totalPointsUsed: 10,
      totalPointsAvailable: 10,
      explanationData: { prioritizedStats: ['dribbling'], topGains: [{ statKey: 'dribbling', delta: 4 }] },
    });
    efootballCoach.explainBuild.mockResolvedValue({
      explanation: 'Boa build de drible.',
      modelUsed: 'claude-sonnet-4-6',
      costEstimate: 0.001,
    });

    const result = await service.ask(
      { question: 'Como evoluir esse jogador?', playerCardId: 'card-1', level: 30, availableProgressionPoints: 10 },
      user,
    );

    expect(result).toEqual({
      intent: 'BUILD_RECOMMENDATION',
      answer: 'Boa build de drible.',
      modelUsed: 'claude-sonnet-4-6',
      costEstimate: 0.001,
    });
    expect(playerBuildEngine.generateBuild).toHaveBeenCalledWith(
      expect.objectContaining({ playerCardId: 'card-1', level: 30, position: 'LWF', strategy: 'BALANCED', availableProgressionPoints: 10 }),
    );
  });

  it('BUILD_RECOMMENDATION: quando a IA falha, cai pra resposta determinística com os mesmos fatos', async () => {
    prisma.playerCard.findUnique.mockResolvedValue({ position: 'LWF', player: { name: 'Kvaratskhelia' } });
    playerBuildEngine.generateBuild.mockResolvedValue({
      roleScore: 87,
      totalPointsUsed: 10,
      totalPointsAvailable: 10,
      explanationData: { prioritizedStats: ['dribbling'], topGains: [] },
    });
    efootballCoach.explainBuild.mockResolvedValue(null);

    const result = await service.ask(
      { question: 'Build pra esse jogador', playerCardId: 'card-1', level: 30, availableProgressionPoints: 10 },
      user,
    );

    expect(result.modelUsed).toBeNull();
    expect(result.costEstimate).toBe(0);
    expect(result.answer).toContain('Kvaratskhelia');
    expect(result.answer).toContain('87');
  });

  it('SQUAD_ADVICE: sem userSquadId e sem elenco salvo, pede pra montar um elenco', async () => {
    prisma.userSquad.findFirst.mockResolvedValue(null);

    const result = await service.ask({ question: 'Quem devo escalar?' }, user);

    expect(result.intent).toBe('SQUAD_ADVICE');
    expect(result.answer).toContain('Squad Builder');
    expect(squadBuilder.explainSquad).not.toHaveBeenCalled();
  });

  it('SQUAD_ADVICE: usa o elenco padrão do usuário quando userSquadId não é informado', async () => {
    prisma.userSquad.findFirst.mockResolvedValue({ id: 'squad-1' });
    squadBuilder.explainSquad.mockResolvedValue({ explanation: 'Falta lateral-direito.', modelUsed: 'gpt-4o', costEstimate: 0.0007 });

    const result = await service.ask({ question: 'O que acha do meu time titular?' }, user);

    expect(squadBuilder.explainSquad).toHaveBeenCalledWith('squad-1', user);
    expect(result).toEqual({
      intent: 'SQUAD_ADVICE',
      answer: 'Falta lateral-direito.',
      modelUsed: 'gpt-4o',
      costEstimate: 0.0007,
    });
  });

  it('ECONOMY_ADVICE: sem packId/userCoins, pede esclarecimento sem chamar o motor', async () => {
    const result = await service.ask({ question: 'Vale a pena esse pack?' }, user);

    expect(result.intent).toBe('ECONOMY_ADVICE');
    expect(result.modelUsed).toBeNull();
    expect(economyAdvisor.evaluate).not.toHaveBeenCalled();
  });

  it('ECONOMY_ADVICE: com packId/userCoins, retorna a recomendação do motor (nunca via IA)', async () => {
    economyAdvisor.evaluate.mockResolvedValue({
      recommendation: 'RECOMMENDED',
      reasons: ['Necessidades do elenco: CF'],
    });

    const result = await service.ask({ question: 'Vale a pena comprar esse pack?', packId: 'pack-1', userCoins: 5000 }, user);

    expect(economyAdvisor.evaluate).toHaveBeenCalledWith({ packId: 'pack-1', userCoins: 5000, userSquadId: undefined }, user);
    expect(result.modelUsed).toBeNull();
    expect(result.answer).toContain('Vale a pena');
    expect(result.answer).toContain('Necessidades do elenco: CF');
  });

  it('LEARNING_RECOMMENDATION: recomenda a próxima aula desbloqueada e não concluída', async () => {
    learning.getProfile.mockResolvedValue({ level: LearningLevel.BEGINNER });
    learning.listPaths.mockResolvedValue([{ id: 'path-1' }]);
    learning.getPath.mockResolvedValue({
      title: 'Primeiros Passos',
      modules: [
        { title: 'Fundamentos', lessons: [{ title: 'Intro', unlocked: true, completed: true }, { title: 'Passe', unlocked: true, completed: false }] },
      ],
    });

    const result = await service.ask({ question: 'Qual aula eu devo fazer agora?' }, user);

    expect(result.intent).toBe('LEARNING_RECOMMENDATION');
    expect(result.modelUsed).toBeNull();
    expect(result.answer).toContain('Fundamentos > Passe');
  });

  it('LEARNING_RECOMMENDATION: prioriza recomendação informada pelo Match Analysis (Tarefa 15) sobre a sequencial', async () => {
    reports.getSummary.mockResolvedValue({ worstCategory: 'passing' });
    learning.getMatchInformedRecommendation.mockResolvedValue({
      matchCategory: 'passing',
      moduleTitle: 'Passe',
      lessonId: 'l1',
      lessonTitle: 'Escolhendo o passe certo',
    });

    const result = await service.ask({ question: 'Qual aula eu devo fazer agora?' }, user);

    expect(result.answer).toContain('passing');
    expect(result.answer).toContain('Passe > Escolhendo o passe certo');
    expect(result.modelUsed).toBeNull();
    expect(learning.getMatchInformedRecommendation).toHaveBeenCalledWith('passing', game.id, user);
    expect(learning.getProfile).not.toHaveBeenCalled();
  });

  it('LEARNING_RECOMMENDATION: sem recomendação do Match Analysis, cai pra próxima aula sequencial (Tarefa 12)', async () => {
    reports.getSummary.mockResolvedValue({ worstCategory: null });
    learning.getMatchInformedRecommendation.mockResolvedValue(null);
    learning.getProfile.mockResolvedValue({ level: LearningLevel.BEGINNER });
    learning.listPaths.mockResolvedValue([{ id: 'path-1' }]);
    learning.getPath.mockResolvedValue({
      title: 'Primeiros Passos',
      modules: [{ title: 'Fundamentos', lessons: [{ title: 'Intro', unlocked: true, completed: false }] }],
    });

    const result = await service.ask({ question: 'Qual aula eu devo fazer agora?' }, user);

    expect(result.answer).toContain('Fundamentos > Intro');
  });

  it('LEARNING_RECOMMENDATION: todas as aulas concluídas, sugere subir de nível', async () => {
    learning.getProfile.mockResolvedValue({ level: LearningLevel.BEGINNER });
    learning.listPaths.mockResolvedValue([{ id: 'path-1' }]);
    learning.getPath.mockResolvedValue({
      title: 'Primeiros Passos',
      modules: [{ title: 'Fundamentos', lessons: [{ title: 'Intro', unlocked: true, completed: true }] }],
    });

    const result = await service.ask({ question: 'Que aula eu faço agora?' }, user);

    expect(result.answer).toContain('já concluiu todas as aulas');
  });

  it('UNKNOWN: pergunta fora do vocabulário reconhecido nunca chama IA', async () => {
    const result = await service.ask({ question: 'Qual a previsão do tempo amanhã?' }, user);

    expect(result.intent).toBe('UNKNOWN');
    expect(result.modelUsed).toBeNull();
    expect(result.costEstimate).toBe(0);
    expect(efootballCoach.explainBuild).not.toHaveBeenCalled();
    expect(squadBuilder.explainSquad).not.toHaveBeenCalled();
  });
});
