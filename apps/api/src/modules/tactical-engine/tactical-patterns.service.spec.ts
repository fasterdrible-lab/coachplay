import { TacticalPatternsService } from './tactical-patterns.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { TacticalPattern } from './tactical-pattern.type';

describe('TacticalPatternsService', () => {
  let prisma: { tacticalPattern: { upsert: jest.Mock; findMany: jest.Mock } };
  let service: TacticalPatternsService;

  beforeEach(() => {
    prisma = { tacticalPattern: { upsert: jest.fn(), findMany: jest.fn() } };
    service = new TacticalPatternsService(prisma as unknown as PrismaService);
  });

  function buildPattern(overrides: Partial<TacticalPattern> = {}): TacticalPattern {
    return {
      pattern: 'KING_SAFETY_NEGLECTED',
      frequency: 4,
      confidence: 80,
      severity: 'MEDIUM',
      firstDetectedAt: new Date('2026-08-01'),
      lastDetectedAt: new Date('2026-08-10'),
      ...overrides,
    };
  }

  describe('upsertPatterns', () => {
    it('faz upsert de cada padrão pela chave composta (userId, pattern)', async () => {
      prisma.tacticalPattern.upsert.mockResolvedValue({ id: 'pattern-1' });

      await service.upsertPatterns('user-1', [buildPattern()]);

      expect(prisma.tacticalPattern.upsert).toHaveBeenCalledWith({
        where: { userId_pattern: { userId: 'user-1', pattern: 'KING_SAFETY_NEGLECTED' } },
        create: {
          userId: 'user-1',
          pattern: 'KING_SAFETY_NEGLECTED',
          frequency: 4,
          confidence: 80,
          severity: 'MEDIUM',
          firstDetectedAt: new Date('2026-08-01'),
          lastDetectedAt: new Date('2026-08-10'),
        },
        update: {
          frequency: 4,
          confidence: 80,
          severity: 'MEDIUM',
          lastDetectedAt: new Date('2026-08-10'),
        },
      });
    });

    it('não inclui firstDetectedAt no update — nunca sobrescreve a primeira detecção histórica', async () => {
      prisma.tacticalPattern.upsert.mockResolvedValue({ id: 'pattern-1' });

      await service.upsertPatterns('user-1', [buildPattern()]);

      const call = prisma.tacticalPattern.upsert.mock.calls[0][0];
      expect(call.update.firstDetectedAt).toBeUndefined();
    });

    it('faz upsert de múltiplos padrões em paralelo', async () => {
      prisma.tacticalPattern.upsert.mockResolvedValue({ id: 'pattern-1' });

      await service.upsertPatterns('user-1', [
        buildPattern({ pattern: 'KING_SAFETY_NEGLECTED' }),
        buildPattern({ pattern: 'SPACE_EXPANSION_STRENGTH' }),
      ]);

      expect(prisma.tacticalPattern.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('findByUser', () => {
    it('busca padrões do usuário ordenados por confiança e detecção mais recente', async () => {
      prisma.tacticalPattern.findMany.mockResolvedValue([]);

      await service.findByUser('user-1');

      expect(prisma.tacticalPattern.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: [{ confidence: 'desc' }, { lastDetectedAt: 'desc' }],
      });
    });
  });
});
