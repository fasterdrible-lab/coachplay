import { ConfigService } from '@nestjs/config';
import { MatchStatus } from '@prisma/client';
import { GameAnalysisService } from './game-analysis.service';
import { GeminiNotConfiguredError, GeminiVisionService } from './gemini-vision.service';
import { PrismaService } from '../../shared/database/prisma.service';

const mockCopyFileSync = jest.fn();
const mockMkdirSync = jest.fn();

jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  copyFileSync: (...args: unknown[]) => mockCopyFileSync(...args),
  mkdirSync: (...args: unknown[]) => mockMkdirSync(...args),
}));

describe('GameAnalysisService', () => {
  let prisma: {
    $transaction: jest.Mock;
    detectedError: { deleteMany: jest.Mock; createMany: jest.Mock; create: jest.Mock };
    gameEvent: { deleteMany: jest.Mock; createManyAndReturn: jest.Mock; create: jest.Mock };
    match: { update: jest.Mock };
  };
  let geminiVision: { analyzeVideo: jest.Mock };
  let extractFrame: jest.Mock;
  let service: GameAnalysisService;

  const FRAME_PATHS = Array.from(
    { length: 9 },
    (_, i) => `/tmp/frames/match-1/frame_${String(i + 1).padStart(4, '0')}.jpg`,
  );

  beforeEach(() => {
    // resetAllMocks (não só clear) — mockMkdirSync/mockCopyFileSync recebem
    // mockImplementation em alguns testes (ex. simular disco cheio) e isso vaza
    // pro próximo teste se só limparmos o histórico de chamadas.
    jest.resetAllMocks();

    let eventSeq = 0;
    prisma = {
      $transaction: jest.fn().mockResolvedValue([]),
      detectedError: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve(data)),
      },
      gameEvent: {
        deleteMany: jest.fn().mockResolvedValue({}),
        // Simula o Prisma retornando os eventos criados, na mesma ordem dos
        // frames de entrada (comportamento real do createManyAndReturn no Postgres).
        createManyAndReturn: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve(
            data.map((d: any, i: number) => ({
              id: `event-${i}`,
              category: d.category,
              timestampStart: d.timestampStart,
            })),
          ),
        ),
        create: jest.fn().mockImplementation(({ data }) =>
          Promise.resolve({ id: `gemini-event-${eventSeq++}`, ...data }),
        ),
      },
      match: { update: jest.fn().mockResolvedValue({}) },
    };

    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
    } as unknown as ConfigService;

    geminiVision = { analyzeVideo: jest.fn().mockRejectedValue(new GeminiNotConfiguredError()) };
    extractFrame = jest.fn().mockResolvedValue(undefined);

    service = new GameAnalysisService(
      prisma as unknown as PrismaService,
      config,
      geminiVision as unknown as GeminiVisionService,
    );
  });

  // ─── Fallback (Gemini não configurado) ─────────────────────────────────────

  describe('fallback heurístico (sem GEMINI_API_KEY)', () => {
    it('marca a partida como analisada sem eventos quando não há frames', async () => {
      const result = await service.analyzeMatch('match-1', '/tmp/video.mp4', [], extractFrame);

      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: MatchStatus.analyzed },
      });
      expect(prisma.gameEvent.createManyAndReturn).not.toHaveBeenCalled();
      expect(result.visionCostEstimate).toBe(0);
    });

    it('copia o frame de cada erro detectado e grava a URL pública no registro', async () => {
      // 9 frames (posicionamento/defesa/decisao cobrem as 3 categorias de erro) —
      // suficiente para pelo menos 1 erro (heurística: 1 a cada 3 eventos de risco)
      await service.analyzeMatch('match-1', '/tmp/video.mp4', FRAME_PATHS, extractFrame);

      expect(prisma.detectedError.createMany).toHaveBeenCalled();
      const [[{ data: errors }]] = prisma.detectedError.createMany.mock.calls;
      expect(errors.length).toBeGreaterThan(0);

      for (const error of errors) {
        expect(error.frameUrl).toMatch(/^\/uploads\/error-frames\/match-1\/frame_\d{4}\.jpg$/);
      }

      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining(require('path').join('error-frames', 'match-1')),
        { recursive: true },
      );
      expect(mockCopyFileSync).toHaveBeenCalled();
      // fallback não usa o extractFrame do Gemini (frame reaproveitado do grid de 30s)
      expect(extractFrame).not.toHaveBeenCalled();
    });

    it('não falha a análise se copiar o frame do erro der erro — só fica sem frameUrl', async () => {
      mockMkdirSync.mockImplementation(() => {
        throw new Error('disco cheio');
      });

      await service.analyzeMatch('match-1', '/tmp/video.mp4', FRAME_PATHS, extractFrame);

      const [[{ data: errors }]] = prisma.detectedError.createMany.mock.calls;
      expect(errors.length).toBeGreaterThan(0);
      for (const error of errors) {
        expect(error.frameUrl).toBeNull();
      }
    });
  });

  // ─── Caminho real (Gemini configurado) ─────────────────────────────────────

  describe('análise real via Gemini', () => {
    it('persiste 1 evento + 1 erro por finding, extrai o frame no timestamp exato e retorna o custo', async () => {
      geminiVision.analyzeVideo.mockResolvedValue({
        findings: [
          {
            timestampSeconds: 125,
            category: 'defesa',
            severity: 'high',
            description: 'Zagueiro saiu de posição.',
            suggestion: 'Manter a linha defensiva.',
          },
        ],
        costEstimate: 0.042,
      });

      const result = await service.analyzeMatch('match-1', '/tmp/video.mp4', [], extractFrame);

      expect(prisma.gameEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchId: 'match-1',
          category: 'defesa',
          timestampStart: 125,
          timestampEnd: 125,
        }),
      });
      expect(extractFrame).toHaveBeenCalledWith(
        125,
        expect.stringContaining(require('path').join('error-frames', 'match-1')),
      );
      expect(prisma.detectedError.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchId: 'match-1',
          eventId: 'gemini-event-0',
          category: 'defesa',
          severity: 'high',
          description: 'Zagueiro saiu de posição.',
          suggestion: 'Manter a linha defensiva.',
          frameUrl: expect.stringMatching(/^\/uploads\/error-frames\/match-1\/error_\d{4}\.jpg$/),
        }),
      });
      expect(result.visionCostEstimate).toBe(0.042);
      // caminho Gemini não usa a heurística de fallback
      expect(prisma.gameEvent.createManyAndReturn).not.toHaveBeenCalled();
    });

    it('não falha a análise se a extração do frame do Gemini der erro — só fica sem frameUrl', async () => {
      geminiVision.analyzeVideo.mockResolvedValue({
        findings: [
          { timestampSeconds: 10, category: 'ataque', severity: 'low', description: 'x', suggestion: 'y' },
        ],
        costEstimate: 0.01,
      });
      extractFrame.mockRejectedValue(new Error('ffmpeg falhou'));

      await service.analyzeMatch('match-1', '/tmp/video.mp4', [], extractFrame);

      expect(prisma.detectedError.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ frameUrl: null }),
      });
    });

    it('propaga erros do Gemini que não sejam "não configurado" (worker já faz retry/marca failed)', async () => {
      geminiVision.analyzeVideo.mockRejectedValue(new Error('Gemini: upload do vídeo falhou'));

      await expect(
        service.analyzeMatch('match-1', '/tmp/video.mp4', [], extractFrame),
      ).rejects.toThrow('Gemini: upload do vídeo falhou');

      expect(prisma.match.update).not.toHaveBeenCalled();
    });

    it('não gera nenhum erro quando o Gemini não encontra problemas na partida', async () => {
      geminiVision.analyzeVideo.mockResolvedValue({ findings: [], costEstimate: 0.005 });

      const result = await service.analyzeMatch('match-1', '/tmp/video.mp4', [], extractFrame);

      expect(prisma.gameEvent.create).not.toHaveBeenCalled();
      expect(prisma.detectedError.create).not.toHaveBeenCalled();
      expect(prisma.match.update).toHaveBeenCalledWith({
        where: { id: 'match-1' },
        data: { status: MatchStatus.analyzed },
      });
      expect(result.visionCostEstimate).toBe(0.005);
    });
  });
});
