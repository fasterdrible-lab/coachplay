import { BadRequestException, NotFoundException } from '@nestjs/common';
import { GameProvider } from '@prisma/client';
import { GamesService } from './games.service';
import { PrismaService } from '../../shared/database/prisma.service';

describe('GamesService', () => {
  let prisma: {
    game: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock };
  };
  let service: GamesService;

  beforeEach(() => {
    prisma = {
      game: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn() },
    };
    service = new GamesService(prisma as unknown as PrismaService);
  });

  describe('create', () => {
    it('cria um Game a partir do provider e nome informados', async () => {
      const created = { id: 'game-1', provider: GameProvider.EFOOTBALL, name: 'eFootball', active: true };
      prisma.game.create.mockResolvedValue(created);

      const result = await service.create({ provider: GameProvider.EFOOTBALL, name: 'eFootball' });

      expect(prisma.game.create).toHaveBeenCalledWith({
        data: { provider: GameProvider.EFOOTBALL, name: 'eFootball' },
      });
      expect(result).toEqual(created);
    });
  });

  describe('resolveProvider', () => {
    it('identifica um provider válido', () => {
      expect(service.resolveProvider('EFOOTBALL')).toBe(GameProvider.EFOOTBALL);
    });

    it('lança BadRequestException para provider inválido', () => {
      expect(() => service.resolveProvider('FIFA_99')).toThrow(BadRequestException);
    });
  });

  describe('findByProvider', () => {
    it('seleciona o eFootball quando ativo', async () => {
      const game = { id: 'game-1', provider: GameProvider.EFOOTBALL, name: 'eFootball', active: true };
      prisma.game.findUnique.mockResolvedValue(game);

      const result = await service.findByProvider('EFOOTBALL');

      expect(prisma.game.findUnique).toHaveBeenCalledWith({
        where: { provider: GameProvider.EFOOTBALL },
      });
      expect(result).toEqual(game);
    });

    it('lança NotFoundException quando o jogo não existe', async () => {
      prisma.game.findUnique.mockResolvedValue(null);

      await expect(service.findByProvider('EFOOTBALL')).rejects.toThrow(NotFoundException);
    });

    it('lança NotFoundException quando o jogo existe mas está inativo', async () => {
      prisma.game.findUnique.mockResolvedValue({
        id: 'game-1',
        provider: GameProvider.EFOOTBALL,
        name: 'eFootball',
        active: false,
      });

      await expect(service.findByProvider('EFOOTBALL')).rejects.toThrow(NotFoundException);
    });

    it('lança BadRequestException para provider inválido antes de consultar o banco', async () => {
      await expect(service.findByProvider('NOT_A_GAME')).rejects.toThrow(BadRequestException);
      expect(prisma.game.findUnique).not.toHaveBeenCalled();
    });
  });

  describe('findAll', () => {
    it('lista apenas jogos ativos, ordenados por nome', async () => {
      prisma.game.findMany.mockResolvedValue([
        { id: 'game-1', provider: GameProvider.EFOOTBALL, name: 'eFootball', active: true },
      ]);

      const result = await service.findAll();

      expect(prisma.game.findMany).toHaveBeenCalledWith({
        where: { active: true },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([
        { id: 'game-1', provider: GameProvider.EFOOTBALL, name: 'eFootball', active: true },
      ]);
    });
  });
});
