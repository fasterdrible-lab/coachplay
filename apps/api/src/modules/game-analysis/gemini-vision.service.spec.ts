import { SettingsService } from '../settings/settings.service';
import { GeminiVisionService, GeminiNotConfiguredError } from './gemini-vision.service';

const mockUpload = jest.fn();
const mockGet = jest.fn();
const mockGenerateContent = jest.fn();

jest.mock('@google/genai', () => {
  const actual = jest.requireActual('@google/genai');
  return {
    ...actual,
    GoogleGenAI: jest.fn().mockImplementation(() => ({
      files: { upload: mockUpload, get: mockGet },
      models: { generateContent: mockGenerateContent },
    })),
  };
});

function buildSettings(apiKey: string): SettingsService {
  return { getGeminiKey: jest.fn().mockResolvedValue(apiKey) } as unknown as SettingsService;
}

const ACTIVE_FILE = { name: 'files/abc', uri: 'https://gemini/files/abc', mimeType: 'video/mp4', state: 'ACTIVE' };

describe('GeminiVisionService', () => {
  let service: GeminiVisionService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUpload.mockResolvedValue({ name: 'files/abc' });
    mockGet.mockResolvedValue(ACTIVE_FILE);
  });

  it('lança GeminiNotConfiguredError sem tentar upload quando não há chave', async () => {
    service = new GeminiVisionService(buildSettings(''));

    await expect(service.analyzeVideo('/tmp/video.mp4')).rejects.toThrow(GeminiNotConfiguredError);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('sobe o vídeo, chama o Gemini e retorna os erros encontrados + custo estimado', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        errors: [
          {
            timestampSeconds: 123.6,
            category: 'defesa',
            severity: 'high',
            description: 'Zagueiro saiu de posição.',
            suggestion: 'Manter a linha defensiva.',
          },
        ],
      }),
      usageMetadata: { promptTokenCount: 100_000, candidatesTokenCount: 200 },
    });

    const result = await service.analyzeVideo('/tmp/video.mp4');

    expect(mockUpload).toHaveBeenCalledWith({ file: '/tmp/video.mp4' });
    expect(result.findings).toEqual([
      {
        timestampSeconds: 124, // arredondado
        category: 'defesa',
        severity: 'high',
        description: 'Zagueiro saiu de posição.',
        suggestion: 'Manter a linha defensiva.',
      },
    ]);
    // 100_000/1e6*0.30 + 200/1e6*2.50 = 0.03 + 0.0005
    expect(result.costEstimate).toBeCloseTo(0.0305, 6);
  });

  it('inclui o time do jogador no prompt quando informado, pra ajudar o Gemini a identificar o lado certo', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ errors: [] }),
      usageMetadata: {},
    });

    await service.analyzeVideo('/tmp/video.mp4', 'Real Madrid');

    const [[callArgs]] = mockGenerateContent.mock.calls;
    const promptText = callArgs.contents.parts.map((p: any) => p.text).join('\n');
    expect(promptText).toContain('Real Madrid');
  });

  it('espera o arquivo sair de PROCESSING antes de chamar generateContent', async () => {
    jest.useFakeTimers();
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGet
      .mockResolvedValueOnce({ ...ACTIVE_FILE, state: 'PROCESSING' })
      .mockResolvedValueOnce(ACTIVE_FILE);
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({ errors: [] }),
      usageMetadata: { promptTokenCount: 0, candidatesTokenCount: 0 },
    });

    const promise = service.analyzeVideo('/tmp/video.mp4');
    await jest.advanceTimersByTimeAsync(5_000);
    const result = await promise;

    expect(mockGet).toHaveBeenCalledTimes(2);
    expect(result.findings).toEqual([]);
    jest.useRealTimers();
  });

  it('lança erro quando o arquivo termina em FAILED', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGet.mockResolvedValue({ ...ACTIVE_FILE, state: 'FAILED' });

    await expect(service.analyzeVideo('/tmp/video.mp4')).rejects.toThrow(/falhou/);
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });

  it('lança erro quando a resposta não é JSON válido', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGenerateContent.mockResolvedValue({ text: 'não é json', usageMetadata: {} });

    await expect(service.analyzeVideo('/tmp/video.mp4')).rejects.toThrow(/JSON válido/);
  });

  it('lança erro quando a resposta não tem o campo "errors"', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGenerateContent.mockResolvedValue({ text: JSON.stringify({ foo: 'bar' }), usageMetadata: {} });

    await expect(service.analyzeVideo('/tmp/video.mp4')).rejects.toThrow(/errors/);
  });

  it('descarta findings que não batem com o schema (categoria/severidade fora do vocabulário)', async () => {
    service = new GeminiVisionService(buildSettings('test-key'));
    mockGenerateContent.mockResolvedValue({
      text: JSON.stringify({
        errors: [
          { timestampSeconds: 10, category: 'categoria_invalida', severity: 'high', description: 'x', suggestion: 'y' },
          { timestampSeconds: 20, category: 'ataque', severity: 'critical', description: 'ok', suggestion: 'ok' },
        ],
      }),
      usageMetadata: {},
    });

    const result = await service.analyzeVideo('/tmp/video.mp4');

    expect(result.findings).toHaveLength(1);
    expect(result.findings[0].category).toBe('ataque');
  });
});
