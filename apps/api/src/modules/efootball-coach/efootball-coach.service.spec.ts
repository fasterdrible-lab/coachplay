import { EfootballCoachService } from './efootball-coach.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { SquadCoachContext } from './squad-coach.types';
import { BuildCoachContext } from './build-coach.types';

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

function buildSettingsMock(): SettingsService {
  return {
    getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
    getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
    getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
    getGroqKey: jest.fn().mockResolvedValue('test-groq-key'),
  } as unknown as SettingsService;
}

describe('EfootballCoachService — Coach de Elenco (Tarefa 10)', () => {
  const context: SquadCoachContext = {
    formationCode: '4-3-3',
    startingXI: [{ slot: 'CF', position: 'CF', playerName: 'Khvicha Kvaratskhelia', overallBase: 89 }],
    weakPositions: [{ slot: 'RB', position: 'RB', reason: 'EMPTY' }],
    rosterCompositionByGroup: { CF: 6, FB: 1 },
  };

  let prisma: { aiCallLog: { create: jest.Mock } };
  let service: EfootballCoachService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { aiCallLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new EfootballCoachService(prisma as unknown as PrismaService, buildSettingsMock());
  });

  it('usa Claude quando a chamada é bem-sucedida e envia o contexto correto no prompt', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Seu elenco tem muitos atacantes e falta lateral-direito.' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await service.explainSquad(context, 'user-1');

    expect(result).toMatchObject({
      explanation: 'Seu elenco tem muitos atacantes e falta lateral-direito.',
      modelUsed: 'claude-sonnet-4-6',
    });
    // 100 * (3/1_000_000) + 50 * (15/1_000_000)
    expect(result?.costEstimate).toBeCloseTo(0.00105, 9);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();

    // valida o contexto enviado: formação, jogador e posição fraca corretos no prompt
    const sentPrompt = mockAnthropicCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentPrompt).toContain('4-3-3');
    expect(sentPrompt).toContain('Khvicha Kvaratskhelia');
    expect(sentPrompt).toContain('RB (RB)');
  });

  it('Tarefa 21: grava AiCallLog com feature/userId/provider/custo/latência quando bem-sucedido', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Seu elenco tem muitos atacantes e falta lateral-direito.' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    await service.explainSquad(context, 'user-1');

    expect(prisma.aiCallLog.create).toHaveBeenCalledTimes(1);
    const data = prisma.aiCallLog.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      feature: 'squad_coach',
      userId: 'user-1',
      provider: 'claude-sonnet-4-6',
      success: true,
    });
    expect(data.costEstimate).toBeCloseTo(0.00105, 9);
    expect(typeof data.latencyMs).toBe('number');
  });

  it('fallback: cai para GPT-4o quando Claude falha', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Explicação via GPT-4o' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await service.explainSquad(context, 'user-1');

    expect(mockAnthropicCreate).toHaveBeenCalled();
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({ explanation: 'Explicação via GPT-4o', modelUsed: 'gpt-4o' });
    expect(result?.costEstimate).toBeCloseTo(0.00075, 9); // 100 * (2.5/1_000_000) + 50 * (10/1_000_000)
  });

  it('fallback: cai para DeepSeek quando Claude e GPT-4o falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Explicação via DeepSeek' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

    const result = await service.explainSquad(context, 'user-1');

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(result).toMatchObject({ explanation: 'Explicação via DeepSeek', modelUsed: 'deepseek-chat' });
    expect(result?.costEstimate).toBeCloseTo(0.000082, 9); // 100 * (0.27/1_000_000) + 50 * (1.1/1_000_000)
  });

  it('fallback: cai para Groq quando todos os outros falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockRejectedValueOnce(new Error('DeepSeek indisponível'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Explicação via Groq' } }],
        usage: { prompt_tokens: 100, completion_tokens: 50 },
      });

    const result = await service.explainSquad(context, 'user-1');

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(3);
    expect(result).toMatchObject({ explanation: 'Explicação via Groq', modelUsed: 'llama-3.3-70b-versatile' });
    expect(result?.costEstimate).toBeCloseTo(0.0000985, 9); // 100 * (0.59/1_000_000) + 50 * (0.79/1_000_000)
  });

  it('sem usage no retorno do provedor (OpenAI-compatível), custo vem zero em vez de lançar', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'Sem usage' } }] });

    const result = await service.explainSquad(context, 'user-1');

    expect(result).toEqual({ explanation: 'Sem usage', modelUsed: 'gpt-4o', costEstimate: 0 });
  });

  it('retorna null (best-effort) quando todos os provedores falham — nunca lança', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    const result = await service.explainSquad(context, 'user-1');

    expect(result).toBeNull();
  });

  it('Tarefa 21: grava AiCallLog com success:false e provider null quando todos falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    await service.explainSquad(context, 'user-1');

    expect(prisma.aiCallLog.create).toHaveBeenCalledTimes(1);
    expect(prisma.aiCallLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        feature: 'squad_coach',
        userId: 'user-1',
        provider: null,
        success: false,
        costEstimate: 0,
        errorMessage: 'todos os provedores de IA falharam',
      }),
    });
  });

  it('Tarefa 21: falha ao gravar AiCallLog nunca derruba a resposta (best-effort)', async () => {
    prisma.aiCallLog.create.mockRejectedValue(new Error('DB indisponível'));
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Explicação normal.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    const result = await service.explainSquad(context, 'user-1');

    expect(result?.explanation).toBe('Explicação normal.');
  });
});

describe('EfootballCoachService — Coach de Build (Tarefa 14, Ask Coach)', () => {
  const buildContext: BuildCoachContext = {
    playerName: 'Khvicha Kvaratskhelia',
    position: 'LWF',
    strategy: 'DRIBBLER',
    level: 30,
    roleScore: 87,
    totalPointsUsed: 10,
    totalPointsAvailable: 10,
    prioritizedStats: ['dribbling', 'ball_control'],
    topGains: [{ statKey: 'dribbling', delta: 4 }],
  };

  let prisma: { aiCallLog: { create: jest.Mock } };
  let service: EfootballCoachService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = { aiCallLog: { create: jest.fn().mockResolvedValue({}) } };
    service = new EfootballCoachService(prisma as unknown as PrismaService, buildSettingsMock());
  });

  it('usa Claude quando a chamada é bem-sucedida e envia o contexto correto no prompt', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Essa build prioriza drible, encaixando bem no papel de ponta.' }],
      usage: { input_tokens: 100, output_tokens: 50 },
    });

    const result = await service.explainBuild(buildContext, 'user-1');

    expect(result).toMatchObject({
      explanation: 'Essa build prioriza drible, encaixando bem no papel de ponta.',
      modelUsed: 'claude-sonnet-4-6',
    });
    expect(result?.costEstimate).toBeCloseTo(0.00105, 9);

    const sentPrompt = mockAnthropicCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentPrompt).toContain('Khvicha Kvaratskhelia');
    expect(sentPrompt).toContain('DRIBBLER');
    expect(sentPrompt).toContain('dribbling: +4');
  });

  it('Tarefa 21: grava AiCallLog com feature "build_coach"', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Explicação.' }],
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    await service.explainBuild(buildContext, 'user-2');

    expect(prisma.aiCallLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ feature: 'build_coach', userId: 'user-2', success: true }),
    });
  });

  it('fallback: cai para GPT-4o quando Claude falha', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockResolvedValueOnce({
      choices: [{ message: { content: 'Explicação via GPT-4o' } }],
      usage: { prompt_tokens: 100, completion_tokens: 50 },
    });

    const result = await service.explainBuild(buildContext, 'user-1');

    expect(result).toMatchObject({ explanation: 'Explicação via GPT-4o', modelUsed: 'gpt-4o' });
    expect(result?.costEstimate).toBeCloseTo(0.00075, 9);
  });

  it('retorna null (best-effort) quando todos os provedores falham — nunca lança', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    const result = await service.explainBuild(buildContext, 'user-1');

    expect(result).toBeNull();
  });
});
