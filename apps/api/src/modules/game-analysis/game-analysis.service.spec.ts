import { ConfigService } from '@nestjs/config';
import { MatchStatus } from '@prisma/client';
import { GameAnalysisService } from './game-analysis.service';
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
    detectedError: { deleteMany: jest.Mock; createMany: jest.Mock };
    gameEvent: { deleteMany: jest.Mock; createManyAndReturn: jest.Mock };
    match: { update: jest.Mock };
  };
  let service: GameAnalysisService;

  beforeEach(() => {
    jest.clearAllMocks();

    prisma = {
      $transaction: jest.fn().mockResolvedValue([]),
      detectedError: {
        deleteMany: jest.fn().mockResolvedValue({}),
        createMany: jest.fn().mockResolvedValue({}),
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
      },
      match: { update: jest.fn().mockResolvedValue({}) },
    };

    const config = {
      get: jest.fn((key: string, fallback?: string) => fallback ?? ''),
    } as unknown as ConfigService;

    service = new GameAnalysisService(prisma as unknown as PrismaService, config);
  });

  it('marca a partida como analisada sem eventos quando não há frames', async () => {
    await service.analyzeMatch('match-1', []);

    expect(prisma.match.update).toHaveBeenCalledWith({
      where: { id: 'match-1' },
      data: { status: MatchStatus.analyzed },
    });
    expect(prisma.gameEvent.createManyAndReturn).not.toHaveBeenCalled();
  });

  it('copia o frame de cada erro detectado e grava a URL pública no registro', async () => {
    // 9 frames (posicionamento/defesa/decisao cobrem as 3 categorias de erro) —
    // suficiente para pelo menos 1 erro (heurística: 1 a cada 3 eventos de risco)
    const framePaths = Array.from({ length: 9 }, (_, i) =>
      `/tmp/frames/match-1/frame_${String(i + 1).padStart(4, '0')}.jpg`,
    );

    await service.analyzeMatch('match-1', framePaths);

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
  });

  it('não falha a análise se copiar o frame do erro der erro — só fica sem frameUrl', async () => {
    mockMkdirSync.mockImplementation(() => {
      throw new Error('disco cheio');
    });

    const framePaths = Array.from({ length: 9 }, (_, i) =>
      `/tmp/frames/match-1/frame_${String(i + 1).padStart(4, '0')}.jpg`,
    );

    await service.analyzeMatch('match-1', framePaths);

    const [[{ data: errors }]] = prisma.detectedError.createMany.mock.calls;
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error.frameUrl).toBeNull();
    }
  });
});
