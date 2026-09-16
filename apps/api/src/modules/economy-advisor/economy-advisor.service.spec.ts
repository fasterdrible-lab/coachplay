import { NotFoundException } from '@nestjs/common';
import { EconomyAdvisorService } from './economy-advisor.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { SquadBuilderService } from '../squad-builder/squad-builder.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('EconomyAdvisorService', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };

  const packRow = {
    id: 'pack-1',
    gameId: 'game-1',
    cost: 500,
    active: true,
    targets: [
      { playerCardId: 'card-1', probability: 0.5, playerCard: { overallBase: 88, position: 'RB' } },
    ],
  };

  let prisma: {
    pack: { findUnique: jest.Mock; findMany: jest.Mock };
    userPlayer: { findMany: jest.Mock };
    economyRecommendation: { create: jest.Mock };
  };
  let squadBuilder: { getWeakPositionGroups: jest.Mock };
  let service: EconomyAdvisorService;

  beforeEach(() => {
    prisma = {
      pack: { findUnique: jest.fn(), findMany: jest.fn() },
      userPlayer: { findMany: jest.fn().mockResolvedValue([]) },
      economyRecommendation: { create: jest.fn().mockResolvedValue({}) },
    };
    squadBuilder = { getWeakPositionGroups: jest.fn().mockResolvedValue([]) };
    service = new EconomyAdvisorService(
      prisma as unknown as PrismaService,
      squadBuilder as unknown as SquadBuilderService,
    );
  });

  it('listPacks: lista só os packs ativos do jogo, campos básicos pro seletor do frontend', async () => {
    prisma.pack.findMany.mockResolvedValue([{ id: 'pack-1', name: 'Pack A', cost: 500, currency: 'coins', oddsVerifiedAt: null }]);

    const result = await service.listPacks('game-1');

    expect(prisma.pack.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { gameId: 'game-1', active: true } }),
    );
    expect(result).toEqual([{ id: 'pack-1', name: 'Pack A', cost: 500, currency: 'coins', oddsVerifiedAt: null }]);
  });

  it('lança NotFoundException para pack inexistente', async () => {
    prisma.pack.findUnique.mockResolvedValue(null);

    await expect(service.evaluate({ packId: 'pack-x', userCoins: 1000 }, userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('lança NotFoundException para pack inativo', async () => {
    prisma.pack.findUnique.mockResolvedValue({ ...packRow, active: false });

    await expect(service.evaluate({ packId: 'pack-1', userCoins: 1000 }, userA)).rejects.toThrow(
      NotFoundException,
    );
  });

  it('avalia o pack usando as cartas já possuídas pelo usuário (duplicateRisk)', async () => {
    prisma.pack.findUnique.mockResolvedValue(packRow);
    prisma.userPlayer.findMany.mockResolvedValue([{ playerCardId: 'card-1' }]);

    const result = await service.evaluate({ packId: 'pack-1', userCoins: 1000 }, userA);

    expect(result.duplicateRisk).toBe(1);
  });

  it('busca "needs" no Squad Builder quando userSquadId é informado', async () => {
    prisma.pack.findUnique.mockResolvedValue(packRow);
    squadBuilder.getWeakPositionGroups.mockResolvedValue(['FB']);

    const result = await service.evaluate({ packId: 'pack-1', userCoins: 1000, userSquadId: 'squad-1' }, userA);

    expect(squadBuilder.getWeakPositionGroups).toHaveBeenCalledWith('squad-1', userA);
    expect(result.teamNeedScore).toBe(1); // RB pertence ao grupo FB
  });

  it('não consulta o Squad Builder quando userSquadId não é informado (nenhuma necessidade assumida)', async () => {
    prisma.pack.findUnique.mockResolvedValue(packRow);

    const result = await service.evaluate({ packId: 'pack-1', userCoins: 1000 }, userA);

    expect(squadBuilder.getWeakPositionGroups).not.toHaveBeenCalled();
    expect(result.teamNeedScore).toBe(0);
  });

  it('persiste a recomendação (EconomyRecommendation)', async () => {
    prisma.pack.findUnique.mockResolvedValue(packRow);

    await service.evaluate({ packId: 'pack-1', userCoins: 1000 }, userA);

    expect(prisma.economyRecommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: userA.id, packId: 'pack-1' }) }),
    );
  });
});
