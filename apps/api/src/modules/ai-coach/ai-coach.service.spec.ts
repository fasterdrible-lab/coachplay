import { AIAnalysisStatus } from '@prisma/client';
import { AiCoachService } from './ai-coach.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { DecisionEvaluation } from '../tactical-engine/decision-evaluation.type';
import { PrincipleAdherence } from '../tactical-engine/principle-adherence.type';
import { TacticalEngineFeatureFlagService } from '../tactical-engine/tactical-engine-feature-flag.service';

const mockAnthropicCreate = jest.fn();
const mockOpenAiCreate = jest.fn();

// Feature flag habilitada por padrão nos testes — o comportamento "desabilitado" (Tarefa 35) é
// testado explicitamente na describe de explainDecision/deliverLiveTacticalFeedback.
const enabledFeatureFlag = { isEnabled: () => true } as unknown as TacticalEngineFeatureFlagService;

jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    messages: { create: mockAnthropicCreate },
  })),
}));

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockOpenAiCreate } },
  })),
}));

describe('AiCoachService — fallback de IA', () => {
  let prisma: {
    gameEvent: { findMany: jest.Mock };
    detectedError: { findMany: jest.Mock };
    aIAnalysis: { upsert: jest.Mock; update: jest.Mock };
    coachFeedback: { count: jest.Mock; create: jest.Mock };
  };
  let service: AiCoachService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      gameEvent: { findMany: jest.fn().mockResolvedValue([]) },
      detectedError: { findMany: jest.fn().mockResolvedValue([]) },
      aIAnalysis: {
        upsert: jest.fn().mockResolvedValue({}),
        update: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      coachFeedback: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;

    service = new AiCoachService(prisma as unknown as PrismaService, settings, enabledFeatureFlag);
  });

  it('usa Claude Sonnet quando a chamada é bem-sucedida', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Resumo via Claude' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await service.analyzeMatch('match-1');

    expect(mockOpenAiCreate).not.toHaveBeenCalled();
    expect(result.modelUsed).toBe('claude-sonnet-4-6');
    expect(result.summary).toBe('Resumo via Claude');
    expect(result.status).toBe(AIAnalysisStatus.done);
  });

  it('cai para GPT-4o quando Claude falha', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockResolvedValue({
      choices: [{ message: { content: 'Resumo via GPT-4o' } }],
      usage: { prompt_tokens: 80, completion_tokens: 40 },
    });

    const result = await service.analyzeMatch('match-1');

    expect(mockAnthropicCreate).toHaveBeenCalled();
    expect(mockOpenAiCreate).toHaveBeenCalled();
    expect(result.modelUsed).toBe('gpt-4o');
    expect(result.summary).toBe('Resumo via GPT-4o');
    expect(result.status).toBe(AIAnalysisStatus.done);
  });

  it('cai para DeepSeek quando Claude e GPT-4o falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Resumo via DeepSeek' } }],
        usage: { prompt_tokens: 60, completion_tokens: 30 },
      });

    const result = await service.analyzeMatch('match-1');

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(result.modelUsed).toBe('deepseek-chat');
    expect(result.summary).toBe('Resumo via DeepSeek');
    expect(result.status).toBe(AIAnalysisStatus.done);
  });

  it('marca a análise como failed quando todos os provedores falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    await expect(service.analyzeMatch('match-1')).rejects.toThrow('Provedor indisponível');

    expect(prisma.aIAnalysis.update).toHaveBeenCalledWith({
      where: { matchId: 'match-1' },
      data: { status: AIAnalysisStatus.failed },
    });
  });
});

describe('AiCoachService — generateEventFeedback', () => {
  const event = {
    id: 'event-1',
    matchId: 'match-1',
    category: 'evento_provavel',
    description: 'Pico de movimento detectado',
    confidence: 0.8,
  } as any;

  let prisma: {
    coachFeedback: { count: jest.Mock; create: jest.Mock };
  };
  let service: AiCoachService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      coachFeedback: {
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
    };

    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;

    service = new AiCoachService(prisma as unknown as PrismaService, settings, enabledFeatureFlag);
  });

  it('gera e persiste uma dica curta quando o Claude responde', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Segura a bola e organize a defesa.' }],
      usage: { input_tokens: 20, output_tokens: 10 },
    });

    const result = await service.generateEventFeedback(event, 'sess-1', 'normal');

    expect(result).toEqual(
      expect.objectContaining({
        matchId: 'match-1',
        eventId: 'event-1',
        feedbackType: 'live_tip',
        message: 'Segura a bola e organize a defesa.',
        deliveredChannel: 'text',
      }),
    );
  });

  it('cai para GPT-4o e depois DeepSeek seguindo a mesma cadeia de fallback', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Ataque pelo lado esquerdo agora.' } }],
        usage: { prompt_tokens: 15, completion_tokens: 8 },
      });

    const result = await service.generateEventFeedback(event, 'sess-1', 'normal');

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(result?.message).toBe('Ataque pelo lado esquerdo agora.');
  });

  it('retorna null sem chamar nenhum provedor quando o nível é "silencioso"', async () => {
    const result = await service.generateEventFeedback(event, 'sess-1', 'silencioso');

    expect(result).toBeNull();
    expect(prisma.coachFeedback.count).not.toHaveBeenCalled();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('retorna null quando o cap de dicas/minuto já foi atingido', async () => {
    prisma.coachFeedback.count.mockResolvedValue(3);

    const result = await service.generateEventFeedback(event, 'sess-1', 'normal');

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('aceita valores legados de feedbackLevel (apps/web) via alias', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Cuidado com contra-ataques.' }],
      usage: { input_tokens: 20, output_tokens: 10 },
    });
    prisma.coachFeedback.count.mockResolvedValue(1);

    // 'detailed' mapeia para cap 6 — 1 dica recente ainda está abaixo do limite
    const result = await service.generateEventFeedback(event, 'sess-1', 'detailed');

    expect(result).not.toBeNull();
  });

  it('retorna null quando todos os provedores falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    const result = await service.generateEventFeedback(event, 'sess-1', 'normal');

    expect(result).toBeNull();
  });
});

describe('AiCoachService — explainDecision', () => {
  let service: AiCoachService;

  const evaluation: DecisionEvaluation = {
    actualAction: { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 60 },
    actualScore: {
      total: 70,
      possessionSafety: 70,
      progression: 50,
      spaceCreation: 60,
      defensiveBalance: 70,
      futureOptions: 60,
      pressureManagement: 70,
    },
    bestAlternative: { type: 'PROGRESSIVE_PASS', estimatedRisk: 30, estimatedReward: 90 },
    bestAlternativeScore: {
      total: 85,
      possessionSafety: 60,
      progression: 90,
      spaceCreation: 80,
      defensiveBalance: 70,
      futureOptions: 80,
      pressureManagement: 70,
    },
    scoreDifference: -15,
    classification: 'ACCEPTABLE',
  };

  const principles: PrincipleAdherence[] = [
    { principleId: 'KING_SAFETY', adhered: true },
    { principleId: 'CENTRAL_CONTROL', adhered: false },
    { principleId: 'INITIATIVE', adhered: null },
  ];

  beforeEach(() => {
    jest.clearAllMocks();

    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;

    service = new AiCoachService({} as unknown as PrismaService, settings, enabledFeatureFlag);
  });

  it('monta o TacticalDecisionFeedback a partir do texto da IA + dados já calculados pelo motor', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Passe seguro, mas o passe progressivo pelo centro era melhor.' }],
      usage: { input_tokens: 40, output_tokens: 20 },
    });

    const result = await service.explainDecision(evaluation, principles);

    expect(result).toEqual({
      explanation: 'Passe seguro, mas o passe progressivo pelo centro era melhor.',
      classification: 'ACCEPTABLE',
      scoreDifference: -15,
      principlesFollowed: ['KING_SAFETY'],
      principlesViolated: ['CENTRAL_CONTROL'],
    });
  });

  it('nunca recalcula classificação/scoreDifference/princípios — só usa os já fornecidos', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Texto qualquer da IA.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.explainDecision(evaluation, principles);

    expect(result?.classification).toBe(evaluation.classification);
    expect(result?.scoreDifference).toBe(evaluation.scoreDifference);
  });

  it('cai para GPT-4o e depois DeepSeek seguindo a mesma cadeia de fallback', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Explicação via DeepSeek.' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });

    const result = await service.explainDecision(evaluation, principles);

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(result?.explanation).toBe('Explicação via DeepSeek.');
  });

  it('retorna null (best-effort) quando todos os provedores falham, sem lançar', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    await expect(service.explainDecision(evaluation, principles)).resolves.toBeNull();
  });

  it('retorna null sem chamar nenhum provedor quando a feature flag do motor está desabilitada (Tarefa 35)', async () => {
    const disabledFeatureFlag = { isEnabled: () => false } as unknown as TacticalEngineFeatureFlagService;
    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;
    const disabledService = new AiCoachService({} as unknown as PrismaService, settings, disabledFeatureFlag);

    const result = await disabledService.explainDecision(evaluation, principles);

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });
});

describe('AiCoachService — deliverLiveTacticalFeedback', () => {
  let prisma: { coachFeedback: { create: jest.Mock } };
  let service: AiCoachService;

  const principles: PrincipleAdherence[] = [{ principleId: 'KING_SAFETY', adhered: false }];

  function evaluationWith(classification: DecisionEvaluation['classification']): DecisionEvaluation {
    return {
      actualAction: { type: 'HOLD', estimatedRisk: 80, estimatedReward: 10 },
      actualScore: {
        total: 20,
        possessionSafety: 20,
        progression: 20,
        spaceCreation: 20,
        defensiveBalance: 20,
        futureOptions: 20,
        pressureManagement: 20,
      },
      scoreDifference: -40,
      classification,
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = { coachFeedback: { create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)) } };

    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;

    service = new AiCoachService(prisma as unknown as PrismaService, settings, enabledFeatureFlag);

    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Você segurou a bola sob pressão alta sem necessidade.' }],
      usage: { input_tokens: 30, output_tokens: 15 },
    });
  });

  it('entrega e persiste (feedbackType tactical_feedback) quando prioridade e cooldown permitem', async () => {
    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('MAJOR_ERROR'),
      principles,
      'match-1',
      'normal',
      null,
    );

    expect(result).not.toBeNull();
    expect(result?.priority).toBe('CRITICAL');
    expect(prisma.coachFeedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        matchId: 'match-1',
        feedbackType: 'tactical_feedback',
        message: 'Você segurou a bola sob pressão alta sem necessidade.',
        deliveredChannel: 'text',
      }),
    });
  });

  it('retorna null sem chamar IA nem persistir quando o feedbackLevel é "silencioso"', async () => {
    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('MAJOR_ERROR'),
      principles,
      'match-1',
      'silencioso',
      null,
    );

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(prisma.coachFeedback.create).not.toHaveBeenCalled();
  });

  it('retorna null sem chamar IA quando a prioridade é LOW (classificação de rotina)', async () => {
    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('ACCEPTABLE'),
      principles,
      'match-1',
      'normal',
      null,
    );

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('retorna null quando o cooldown da prioridade ainda não passou', async () => {
    const lastDelivery = { priority: 'HIGH' as const, atMs: Date.now() };

    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('ERROR'),
      principles,
      'match-1',
      'normal',
      lastDelivery,
    );

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
  });

  it('CRITICAL ignora o cooldown maior de uma entrega MEDIUM recente, respeitando só o próprio (15s)', async () => {
    // 20s atrás: já passou do cooldown de CRITICAL (15s), mas não do de MEDIUM (60s) — CRITICAL
    // não deveria ser bloqueado pelo cooldown maior de uma prioridade menor.
    const lastDelivery = { priority: 'MEDIUM' as const, atMs: Date.now() - 20_000 };

    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('MAJOR_ERROR'),
      principles,
      'match-1',
      'normal',
      lastDelivery,
    );

    expect(result).not.toBeNull();
  });

  it('retorna null (best-effort) sem persistir quando todos os provedores de IA falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    const result = await service.deliverLiveTacticalFeedback(
      evaluationWith('MAJOR_ERROR'),
      principles,
      'match-1',
      'normal',
      null,
    );

    expect(result).toBeNull();
    expect(prisma.coachFeedback.create).not.toHaveBeenCalled();
  });

  it('retorna null sem chamar IA nem persistir quando a feature flag do motor está desabilitada (Tarefa 35)', async () => {
    const disabledFeatureFlag = { isEnabled: () => false } as unknown as TacticalEngineFeatureFlagService;
    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    } as unknown as SettingsService;
    const disabledService = new AiCoachService(prisma as unknown as PrismaService, settings, disabledFeatureFlag);

    const result = await disabledService.deliverLiveTacticalFeedback(
      evaluationWith('MAJOR_ERROR'),
      principles,
      'match-1',
      'normal',
      null,
    );

    expect(result).toBeNull();
    expect(mockAnthropicCreate).not.toHaveBeenCalled();
    expect(prisma.coachFeedback.create).not.toHaveBeenCalled();
  });
});
