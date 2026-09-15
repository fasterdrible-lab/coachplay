import { EfootballCoachService } from './efootball-coach.service';
import { SettingsService } from '../settings/settings.service';
import { SquadCoachContext } from './squad-coach.types';

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

describe('EfootballCoachService — Coach de Elenco (Tarefa 10)', () => {
  const context: SquadCoachContext = {
    formationCode: '4-3-3',
    startingXI: [{ slot: 'CF', position: 'CF', playerName: 'Khvicha Kvaratskhelia', overallBase: 89 }],
    weakPositions: [{ slot: 'RB', position: 'RB', reason: 'EMPTY' }],
    rosterCompositionByGroup: { CF: 6, FB: 1 },
  };

  let service: EfootballCoachService;

  beforeEach(() => {
    jest.clearAllMocks();

    const settings = {
      getAnthropicKey: jest.fn().mockResolvedValue('test-anthropic-key'),
      getOpenAiKey: jest.fn().mockResolvedValue('test-openai-key'),
      getDeepSeekKey: jest.fn().mockResolvedValue('test-deepseek-key'),
      getGroqKey: jest.fn().mockResolvedValue('test-groq-key'),
    } as unknown as SettingsService;

    service = new EfootballCoachService(settings);
  });

  it('usa Claude quando a chamada é bem-sucedida e envia o contexto correto no prompt', async () => {
    mockAnthropicCreate.mockResolvedValue({
      content: [{ type: 'text', text: 'Seu elenco tem muitos atacantes e falta lateral-direito.' }],
    });

    const result = await service.explainSquad(context);

    expect(result).toEqual({
      explanation: 'Seu elenco tem muitos atacantes e falta lateral-direito.',
      modelUsed: 'claude-sonnet-4-6',
    });
    expect(mockOpenAiCreate).not.toHaveBeenCalled();

    // valida o contexto enviado: formação, jogador e posição fraca corretos no prompt
    const sentPrompt = mockAnthropicCreate.mock.calls[0][0].messages[0].content as string;
    expect(sentPrompt).toContain('4-3-3');
    expect(sentPrompt).toContain('Khvicha Kvaratskhelia');
    expect(sentPrompt).toContain('RB (RB)');
  });

  it('fallback: cai para GPT-4o quando Claude falha', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockResolvedValueOnce({ choices: [{ message: { content: 'Explicação via GPT-4o' } }] });

    const result = await service.explainSquad(context);

    expect(mockAnthropicCreate).toHaveBeenCalled();
    expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ explanation: 'Explicação via GPT-4o', modelUsed: 'gpt-4o' });
  });

  it('fallback: cai para DeepSeek quando Claude e GPT-4o falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Explicação via DeepSeek' } }] });

    const result = await service.explainSquad(context);

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ explanation: 'Explicação via DeepSeek', modelUsed: 'deepseek-chat' });
  });

  it('fallback: cai para Groq quando todos os outros falham', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate
      .mockRejectedValueOnce(new Error('GPT-4o indisponível'))
      .mockRejectedValueOnce(new Error('DeepSeek indisponível'))
      .mockResolvedValueOnce({ choices: [{ message: { content: 'Explicação via Groq' } }] });

    const result = await service.explainSquad(context);

    expect(mockOpenAiCreate).toHaveBeenCalledTimes(3);
    expect(result).toEqual({ explanation: 'Explicação via Groq', modelUsed: 'llama-3.3-70b-versatile' });
  });

  it('retorna null (best-effort) quando todos os provedores falham — nunca lança', async () => {
    mockAnthropicCreate.mockRejectedValue(new Error('Claude indisponível'));
    mockOpenAiCreate.mockRejectedValue(new Error('Provedor indisponível'));

    const result = await service.explainSquad(context);

    expect(result).toBeNull();
  });
});
