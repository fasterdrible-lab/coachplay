import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserPlayersService } from './user-players.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';

describe('UserPlayersService', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const userB: AuthUser = { id: 'user-b', email: 'b@a.com', role: 'player' };

  let prisma: {
    playerCard: { findUnique: jest.Mock };
    userPlayer: { findUnique: jest.Mock; findMany: jest.Mock; create: jest.Mock; update: jest.Mock; delete: jest.Mock };
    userPlayerBuild: { findUnique: jest.Mock; create: jest.Mock };
  };
  let service: UserPlayersService;

  beforeEach(() => {
    prisma = {
      playerCard: { findUnique: jest.fn() },
      userPlayer: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      userPlayerBuild: { findUnique: jest.fn(), create: jest.fn() },
    };
    service = new UserPlayersService(prisma as unknown as PrismaService);
  });

  describe('create — adicionar jogador', () => {
    const dto = { playerCardId: 'card-1', currentLevel: 30 };

    it('adiciona a carta ao elenco do usuário', async () => {
      prisma.playerCard.findUnique.mockResolvedValue({ id: 'card-1' });
      prisma.userPlayer.findUnique.mockResolvedValue(null);
      prisma.userPlayer.create.mockResolvedValue({ id: 'up-1', userId: userA.id, ...dto });

      const result = await service.create(dto, userA);

      expect(result).toEqual(expect.objectContaining({ id: 'up-1', userId: userA.id }));
    });

    it('lança NotFoundException quando a carta não existe', async () => {
      prisma.playerCard.findUnique.mockResolvedValue(null);

      await expect(service.create(dto, userA)).rejects.toThrow(NotFoundException);
    });

    it('duplicar jogador: lança ConflictException quando a carta já está no elenco', async () => {
      prisma.playerCard.findUnique.mockResolvedValue({ id: 'card-1' });
      prisma.userPlayer.findUnique.mockResolvedValue({ id: 'up-existing' });

      await expect(service.create(dto, userA)).rejects.toThrow(ConflictException);
      expect(prisma.userPlayer.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('remove o jogador do elenco do dono', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userA.id });

      await service.remove('up-1', userA);

      expect(prisma.userPlayer.delete).toHaveBeenCalledWith({ where: { id: 'up-1' } });
    });
  });

  describe('update — editar nível', () => {
    it('atualiza currentLevel do próprio jogador', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userA.id });
      prisma.userPlayer.update.mockResolvedValue({ id: 'up-1', currentLevel: 50 });

      const result = await service.update('up-1', { currentLevel: 50 }, userA);

      expect(prisma.userPlayer.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'up-1' }, data: { currentLevel: 50 } }),
      );
      expect(result).toEqual({ id: 'up-1', currentLevel: 50 });
    });
  });

  describe('activateBuild — trocar build', () => {
    it('define currentBuildId quando a build pertence ao mesmo jogador', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userA.id });
      prisma.userPlayerBuild.findUnique.mockResolvedValue({ id: 'build-2', userPlayerId: 'up-1' });
      prisma.userPlayer.update.mockResolvedValue({ id: 'up-1', currentBuildId: 'build-2' });

      const result = await service.activateBuild('up-1', 'build-2', userA);

      expect(prisma.userPlayer.update).toHaveBeenCalledWith({
        where: { id: 'up-1' },
        data: { currentBuildId: 'build-2' },
      });
      expect(result.currentBuildId).toBe('build-2');
    });

    it('lança NotFoundException quando a build pertence a outro UserPlayer', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userA.id });
      prisma.userPlayerBuild.findUnique.mockResolvedValue({ id: 'build-9', userPlayerId: 'up-OUTRO' });

      await expect(service.activateBuild('up-1', 'build-9', userA)).rejects.toThrow(NotFoundException);
      expect(prisma.userPlayer.update).not.toHaveBeenCalled();
    });
  });

  describe('segurança — usuário A não acessa elenco do usuário B', () => {
    it('findOne: lança ForbiddenException quando o jogador pertence a outro usuário', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.findOne('up-de-b', userA)).rejects.toThrow(ForbiddenException);
    });

    it('update: lança ForbiddenException quando o jogador pertence a outro usuário', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.update('up-de-b', { currentLevel: 99 }, userA)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('remove: lança ForbiddenException quando o jogador pertence a outro usuário', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.remove('up-de-b', userA)).rejects.toThrow(ForbiddenException);
      expect(prisma.userPlayer.delete).not.toHaveBeenCalled();
    });

    it('activateBuild: lança ForbiddenException quando o jogador pertence a outro usuário', async () => {
      prisma.userPlayer.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.activateBuild('up-de-b', 'build-1', userA)).rejects.toThrow(ForbiddenException);
    });

    it('findAll: sempre filtra pelo userId do usuário autenticado, nunca por um userId arbitrário', async () => {
      prisma.userPlayer.findMany.mockResolvedValue([]);

      await service.findAll({}, userA);

      expect(prisma.userPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ userId: userA.id }) }),
      );
    });
  });

  describe('findAll — filtros', () => {
    it('filtra por posição, tipo/raridade e faixa de overall (via PlayerCard)', async () => {
      prisma.userPlayer.findMany.mockResolvedValue([]);

      await service.findAll({ position: 'LWF', cardType: 'epic', minOverall: 85, maxOverall: 95 }, userA);

      expect(prisma.userPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            playerCard: { position: 'LWF', cardType: 'epic', overallBase: { gte: 85, lte: 95 } },
          }),
        }),
      );
    });

    it('filtra por nível e por favoritos', async () => {
      prisma.userPlayer.findMany.mockResolvedValue([]);

      await service.findAll({ level: 40, favorite: true }, userA);

      expect(prisma.userPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currentLevel: 40, isFavorite: true }),
        }),
      );
    });
  });
});
