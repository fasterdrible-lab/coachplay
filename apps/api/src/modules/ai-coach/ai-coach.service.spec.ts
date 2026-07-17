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
