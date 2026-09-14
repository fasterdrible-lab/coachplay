import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlayerBuildEngineService } from './player-build-engine.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { STAT_KEYS } from './player-build-engine.config';

describe('PlayerBuildEngineService', () => {
  let prisma: { playerCard: { findUnique: jest.Mock } };
  let service: PlayerBuildEngineService;

  const cardWithStats = {
    id: 'card-1',
    overallBase: 85,
    maxLevel: 99,
    stats: STAT_KEYS.map((key) => ({ statKey: key, baseValue: 60, maxValue: 99 })),
  };

  beforeEach(() => {
    prisma = { playerCard: { findUnique: jest.fn() } };
    service = new PlayerBuildEngineService(prisma as unknown as PrismaService);
  });

  it('lança NotFoundException quando a carta não existe', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(null);

    await expect(
      service.generateBuild({
        playerCardId: 'card-x',
        level: 50,
        position: 'CF',
        strategy: 'POSITION_OPTIMIZED',
        availableProgressionPoints: 20,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('gera a build a partir dos atributos oficiais da carta', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(cardWithStats);

    const result = await service.generateBuild({
      playerCardId: 'card-1',
      level: 50,
      position: 'CF',
      strategy: 'FINISHER',
      availableProgressionPoints: 20,
    });

    expect(result.playerCardId).toBe('card-1');
    expect(result.totalPointsUsed).toBeLessThanOrEqual(20);
  });

  it('converte erro de validação do engine em BadRequestException', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(cardWithStats);

    await expect(
      service.generateBuild({
        playerCardId: 'card-1',
        level: 200,
        position: 'CF',
        strategy: 'FINISHER',
        availableProgressionPoints: 20,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
