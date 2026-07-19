import { AIAnalysisStatus } from '@prisma/client';
import { AiCoachService } from './ai-coach.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SettingsService } from '../settings/settings.service';

const mockAnthropicCreate = jest.fn();
const mockOpenAiCreate = jest.fn();

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

    service = new AiCoachService(prisma as unknown as PrismaService, settings);
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

    service = new AiCoachService(prisma as unknown as PrismaService, settings);
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
