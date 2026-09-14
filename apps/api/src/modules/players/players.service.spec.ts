import { ConflictException, NotFoundException } from '@nestjs/common';
import { PlayersService } from './players.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { normalizePlayerName } from './player-name.util';

describe('PlayersService', () => {
  let prisma: {
    player: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
    playerCard: { findUnique: jest.Mock; create: jest.Mock; findMany: jest.Mock };
  };
  let service: PlayersService;

  beforeEach(() => {
    prisma = {
      player: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      playerCard: { findUnique: jest.fn(), create: jest.fn(), findMany: jest.fn() },
    };
    service = new PlayersService(prisma as unknown as PrismaService);
  });

  describe('createPlayer', () => {
    const dto = { gameId: 'game-1', externalId: 'kvara-001', name: 'Khvicha Kvaratskhelia' };

    it('cria um jogador novo, normalizando o nome', async () => {
      prisma.player.findUnique.mockResolvedValue(null);
      prisma.player.create.mockResolvedValue({ id: 'player-1', ...dto });

      const result = await service.createPlayer(dto);

      expect(prisma.player.create).toHaveBeenCalledWith({
        data: { ...dto, normalizedName: normalizePlayerName(dto.name) },
      });
      expect(result).toEqual({ id: 'player-1', ...dto });
    });

    it('lança ConflictException para jogador duplicado (mesmo gameId + externalId)', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: 'player-1', ...dto });

      await expect(service.createPlayer(dto)).rejects.toThrow(ConflictException);
      expect(prisma.player.create).not.toHaveBeenCalled();
    });
  });

  describe('findPlayerById', () => {
    it('retorna o jogador mesmo sem nenhuma carta cadastrada', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: 'player-1', name: 'Sem Carta', cards: [] });

      const result = await service.findPlayerById('player-1');

      expect(result.cards).toEqual([]);
    });

    it('lança NotFoundException quando o jogador não existe', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(service.findPlayerById('player-x')).rejects.toThrow(NotFoundException);
    });
  });

  describe('search', () => {
    it('busca por nome exato', async () => {
      const kvara = { id: 'player-1', name: 'Khvicha Kvaratskhelia' };
      prisma.player.findMany.mockResolvedValue([kvara]);

      const result = await service.search('Khvicha Kvaratskhelia');

      expect(prisma.player.findMany).toHaveBeenCalledWith({
        where: {
          normalizedName: { contains: normalizePlayerName('Khvicha Kvaratskhelia'), mode: 'insensitive' },
        },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([kvara]);
    });

    it('busca aproximada: "Kvara" encontra Khvicha Kvaratskhelia', async () => {
      const kvara = { id: 'player-1', name: 'Khvicha Kvaratskhelia' };
      prisma.player.findMany.mockResolvedValue([kvara]);

      const result = await service.search('Kvara');

      expect(prisma.player.findMany).toHaveBeenCalledWith({
        where: { normalizedName: { contains: 'kvara', mode: 'insensitive' } },
        orderBy: { name: 'asc' },
      });
      expect(result).toEqual([kvara]);
    });

    it('filtra por gameId quando informado, sem query de texto', async () => {
      prisma.player.findMany.mockResolvedValue([]);

      await service.search(undefined, 'game-1');

      expect(prisma.player.findMany).toHaveBeenCalledWith({
        where: { gameId: 'game-1' },
        orderBy: { name: 'asc' },
      });
    });
  });

  describe('addCard', () => {
    const cardDto = {
      externalId: 'kvara-standard',
      cardType: 'standard',
      version: '1.0',
      overallBase: 89,
      maxLevel: 99,
      position: 'LWF',
      dataVersion: '2026.09',
    };

    it('cria duas cartas diferentes para o mesmo jogador', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: 'player-1', cards: [] });
      prisma.playerCard.findUnique.mockResolvedValue(null);
      prisma.playerCard.create
        .mockResolvedValueOnce({ id: 'card-1', ...cardDto })
        .mockResolvedValueOnce({ id: 'card-2', ...cardDto, externalId: 'kvara-epic', cardType: 'epic' });

      const standard = await service.addCard('player-1', cardDto);
      const epic = await service.addCard('player-1', { ...cardDto, externalId: 'kvara-epic', cardType: 'epic' });

      expect(standard.id).not.toEqual(epic.id);
      expect(prisma.playerCard.create).toHaveBeenCalledTimes(2);
    });

    it('lança ConflictException para carta duplicada (mesmo playerId + externalId)', async () => {
      prisma.player.findUnique.mockResolvedValue({ id: 'player-1', cards: [] });
      prisma.playerCard.findUnique.mockResolvedValue({ id: 'card-1', ...cardDto });

      await expect(service.addCard('player-1', cardDto)).rejects.toThrow(ConflictException);
      expect(prisma.playerCard.create).not.toHaveBeenCalled();
    });

    it('lança NotFoundException ao adicionar carta a jogador inexistente', async () => {
      prisma.player.findUnique.mockResolvedValue(null);

      await expect(service.addCard('player-x', cardDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('findCardById', () => {
    it('lança NotFoundException para carta inexistente', async () => {
      prisma.playerCard.findUnique.mockResolvedValue(null);

      await expect(service.findCardById('card-x')).rejects.toThrow(NotFoundException);
    });

    it('retorna a carta quando existe', async () => {
      const card = { id: 'card-1', cardType: 'standard' };
      prisma.playerCard.findUnique.mockResolvedValue(card);

      const result = await service.findCardById('card-1');

      expect(result).toEqual(card);
    });
  });

  describe('findCards', () => {
    it('filtra por posição', async () => {
      prisma.playerCard.findMany.mockResolvedValue([{ id: 'card-1', position: 'LWF' }]);

      await service.findCards({ position: 'LWF' });

      expect(prisma.playerCard.findMany).toHaveBeenCalledWith({
        where: { position: 'LWF' },
        orderBy: { overallBase: 'desc' },
      });
    });

    it('filtra por tipo de carta', async () => {
      prisma.playerCard.findMany.mockResolvedValue([{ id: 'card-1', cardType: 'epic' }]);

      await service.findCards({ cardType: 'epic' });

      expect(prisma.playerCard.findMany).toHaveBeenCalledWith({
        where: { cardType: 'epic' },
        orderBy: { overallBase: 'desc' },
      });
    });
  });
});
