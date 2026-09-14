import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PlayerBuildsService } from './player-builds.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('PlayerBuildsService', () => {
  let prisma: { playerCard: { findUnique: jest.Mock } };
  let service: PlayerBuildsService;

  const card = {
    id: 'card-1',
    overallBase: 80,
    position: 'CF',
    positions: [],
    stats: [
      { statKey: 'finishing', baseValue: 70, maxValue: 99 },
      { statKey: 'speed', baseValue: 70, maxValue: 99 },
    ],
  };

  beforeEach(() => {
    prisma = { playerCard: { findUnique: jest.fn() } };
    service = new PlayerBuildsService(prisma as unknown as PrismaService);
  });

  const dto = (overrides: any = {}) => ({
    cardId: 'card-1',
    position: 'CF',
    buildA: { allocation: { finishing: 2 }, availableProgressionPoints: 10 },
    buildB: { allocation: { finishing: 8 }, availableProgressionPoints: 10 },
    ...overrides,
  });

  it('lança NotFoundException quando a carta não existe', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(null);

    await expect(service.compare(dto())).rejects.toThrow(NotFoundException);
  });

  it('compara duas builds válidas', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(card);

    const result = await service.compare(dto());

    expect(result.cardId).toBe('card-1');
    expect(result.buildB.attributes.finishing).toBeGreaterThan(result.buildA.attributes.finishing);
  });

  it('converte erro de posição incompatível em BadRequestException', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(card);

    await expect(service.compare(dto({ position: 'GK' }))).rejects.toThrow(BadRequestException);
  });

  it('converte erro de pontos acima do permitido em BadRequestException', async () => {
    prisma.playerCard.findUnique.mockResolvedValue(card);

    await expect(
      service.compare(
        dto({ buildB: { allocation: { finishing: 20 }, availableProgressionPoints: 10 } }),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
