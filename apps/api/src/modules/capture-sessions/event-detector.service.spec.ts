import { EventDetectorService } from './event-detector.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('EventDetectorService', () => {
  let prisma: { frameSample: { findMany: jest.Mock } };
  let service: EventDetectorService;

  beforeEach(() => {
    prisma = { frameSample: { findMany: jest.fn() } };
    service = new EventDetectorService(prisma as unknown as PrismaService);
  });

  it('retorna null quando o frame atual não está em match_running', async () => {
    const result = await service.detectCandidate('sess-1', {
      id: 'f1',
      timestampMs: 5000,
      motionScore: 0.9,
      gameState: 'menu',
    });

    expect(result).toBeNull();
    expect(prisma.frameSample.findMany).not.toHaveBeenCalled();
  });

  it('retorna null quando não há atividade sustentada suficiente na janela', async () => {
    prisma.frameSample.findMany.mockResolvedValue([
      { motionScore: 0.06, gameState: 'match_running' },
      { motionScore: 0.01, gameState: 'menu' },
      { motionScore: 0.01, gameState: 'menu' },
    ]);

    const result = await service.detectCandidate('sess-1', {
      id: 'f4',
      timestampMs: 5000,
      motionScore: 0.5,
      gameState: 'match_running',
    });

    expect(result).toBeNull();
  });

  it('retorna null quando há atividade sustentada mas sem pico relevante', async () => {
    prisma.frameSample.findMany.mockResolvedValue([
      { motionScore: 0.08, gameState: 'match_running' },
      { motionScore: 0.07, gameState: 'match_running' },
      { motionScore: 0.09, gameState: 'match_running' },
    ]);

    const result = await service.detectCandidate('sess-1', {
      id: 'f4',
      timestampMs: 5000,
      motionScore: 0.1,
      gameState: 'match_running',
    });

    expect(result).toBeNull();
  });

  it('detecta um candidato quando há atividade sustentada seguida de um pico de movimento', async () => {
    prisma.frameSample.findMany.mockResolvedValue([
      { motionScore: 0.08, gameState: 'match_running' },
      { motionScore: 0.07, gameState: 'match_running' },
      { motionScore: 0.09, gameState: 'match_running' },
    ]);

    const result = await service.detectCandidate('sess-1', {
      id: 'f4',
      timestampMs: 5000,
      motionScore: 0.6,
      gameState: 'match_running',
    });

    expect(result).not.toBeNull();
    expect(result!.confidence).toBeGreaterThan(0);
    expect(result!.confidence).toBeLessThanOrEqual(0.9);
  });
});
