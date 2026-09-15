import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { SquadBuilderService } from './squad-builder.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { AuthUser } from '../../shared/types/auth-user.type';
import { EfootballCoachService } from '../efootball-coach/efootball-coach.service';

describe('SquadBuilderService', () => {
  const userA: AuthUser = { id: 'user-a', email: 'a@a.com', role: 'player' };
  const userB: AuthUser = { id: 'user-b', email: 'b@a.com', role: 'player' };

  const formationRow = {
    id: 'formation-1',
    gameId: 'game-1',
    code: '4-4-2',
    name: '4-4-2',
    active: true,
    positions: [
      { slot: 'GK', position: 'GK', order: 0, x: 0.5, y: 0.03 },
      { slot: 'LB', position: 'LB', order: 1, x: 0.15, y: 0.22 },
      { slot: 'CB1', position: 'CB', order: 2, x: 0.38, y: 0.18 },
      { slot: 'CB2', position: 'CB', order: 3, x: 0.62, y: 0.18 },
      { slot: 'RB', position: 'RB', order: 4, x: 0.85, y: 0.22 },
      { slot: 'LMF', position: 'LMF', order: 5, x: 0.15, y: 0.5 },
      { slot: 'CM1', position: 'CMF', order: 6, x: 0.38, y: 0.48 },
      { slot: 'CM2', position: 'CMF', order: 7, x: 0.62, y: 0.48 },
      { slot: 'RMF', position: 'RMF', order: 8, x: 0.85, y: 0.5 },
      { slot: 'CF1', position: 'CF', order: 9, x: 0.38, y: 0.85 },
      { slot: 'CF2', position: 'CF', order: 10, x: 0.62, y: 0.85 },
    ],
  };

  const rosterRows = [
    { id: 'up-gk', playerCard: { position: 'GK', overallBase: 80 } },
    { id: 'up-lb', playerCard: { position: 'LB', overallBase: 78 } },
    { id: 'up-cb1', playerCard: { position: 'CB', overallBase: 82 } },
    { id: 'up-cb2', playerCard: { position: 'CB', overallBase: 81 } },
    { id: 'up-rb', playerCard: { position: 'RB', overallBase: 77 } },
    { id: 'up-lmf', playerCard: { position: 'LMF', overallBase: 79 } },
    { id: 'up-cm1', playerCard: { position: 'CMF', overallBase: 80 } },
    { id: 'up-cm2', playerCard: { position: 'CMF', overallBase: 80 } },
    { id: 'up-rmf', playerCard: { position: 'RMF', overallBase: 79 } },
    { id: 'up-cf1', playerCard: { position: 'CF', overallBase: 85 } },
    { id: 'up-cf2', playerCard: { position: 'CF', overallBase: 83 } },
  ];

  let prisma: {
    formation: { findMany: jest.Mock; findUnique: jest.Mock };
    userPlayer: { findMany: jest.Mock };
    userSquad: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; delete: jest.Mock };
    squadPlayer: { createMany: jest.Mock };
  };
  let efootballCoach: { explainSquad: jest.Mock };
  let service: SquadBuilderService;

  beforeEach(() => {
    prisma = {
      formation: { findMany: jest.fn(), findUnique: jest.fn() },
      userPlayer: { findMany: jest.fn() },
      userSquad: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), delete: jest.fn() },
      squadPlayer: { createMany: jest.fn() },
    };
    efootballCoach = { explainSquad: jest.fn() };
    service = new SquadBuilderService(
      prisma as unknown as PrismaService,
      efootballCoach as unknown as EfootballCoachService,
    );
  });

  describe('generate', () => {
    it('monta o time a partir do elenco do usuário e da formação pedida', async () => {
      prisma.formation.findUnique.mockResolvedValue(formationRow);
      prisma.userPlayer.findMany.mockResolvedValue(rosterRows);

      const result = await service.generate({ gameId: 'game-1', formationCode: '4-4-2' }, userA);

      expect(result.formationCode).toBe('4-4-2');
      expect(result.startingXI).toHaveLength(11);
      expect(prisma.userPlayer.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: userA.id, playerCard: { player: { gameId: 'game-1' } } },
        }),
      );
    });

    it('lança NotFoundException para formação inexistente', async () => {
      prisma.formation.findUnique.mockResolvedValue(null);

      await expect(service.generate({ gameId: 'game-1', formationCode: '9-9-9' }, userA)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lança NotFoundException para formação inativa', async () => {
      prisma.formation.findUnique.mockResolvedValue({ ...formationRow, active: false });

      await expect(service.generate({ gameId: 'game-1', formationCode: '4-4-2' }, userA)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('saveSquad', () => {
    it('gera e persiste o elenco como UserSquad + SquadPlayer', async () => {
      prisma.formation.findUnique.mockResolvedValue(formationRow);
      prisma.userPlayer.findMany.mockResolvedValue(rosterRows);
      prisma.userSquad.create.mockResolvedValue({ id: 'squad-1' });
      prisma.userSquad.findUnique.mockResolvedValue({ id: 'squad-1', userId: userA.id, players: [] });

      await service.saveSquad({ gameId: 'game-1', formationCode: '4-4-2', name: 'Meu Time' }, userA);

      expect(prisma.userSquad.create).toHaveBeenCalledWith({
        data: { userId: userA.id, gameId: 'game-1', name: 'Meu Time', formationId: 'formation-1' },
      });
      expect(prisma.squadPlayer.createMany).toHaveBeenCalled();
      const rows = prisma.squadPlayer.createMany.mock.calls[0][0].data;
      expect(rows).toHaveLength(11); // roster exato, banco vazio
      expect(rows.filter((r: any) => r.isStarting)).toHaveLength(11);
    });
  });

  describe('segurança — usuário A não acessa elenco do usuário B', () => {
    it('findOne: lança ForbiddenException quando o elenco pertence a outro usuário', async () => {
      prisma.userSquad.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.findOne('squad-de-b', userA)).rejects.toThrow(ForbiddenException);
    });

    it('remove: lança ForbiddenException quando o elenco pertence a outro usuário', async () => {
      prisma.userSquad.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.remove('squad-de-b', userA)).rejects.toThrow(ForbiddenException);
      expect(prisma.userSquad.delete).not.toHaveBeenCalled();
    });

    it('listSquads: sempre filtra pelo userId do usuário autenticado', async () => {
      prisma.userSquad.findMany.mockResolvedValue([]);

      await service.listSquads('game-1', userA);

      expect(prisma.userSquad.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: userA.id, gameId: 'game-1' } }),
      );
    });

    it('explainSquad: lança ForbiddenException quando o elenco pertence a outro usuário', async () => {
      prisma.userSquad.findUnique.mockResolvedValue({ userId: userB.id });

      await expect(service.explainSquad('squad-de-b', userA)).rejects.toThrow(ForbiddenException);
      expect(efootballCoach.explainSquad).not.toHaveBeenCalled();
    });
  });

  describe('explainSquad — Tarefa 10 (Coach de Elenco)', () => {
    it('reexecuta o motor com o elenco atual e delega a explicação ao EfootballCoachService', async () => {
      prisma.userSquad.findUnique
        .mockResolvedValueOnce({ userId: userA.id }) // assertOwner
        .mockResolvedValueOnce({
          id: 'squad-1',
          gameId: 'game-1',
          formation: { code: '4-4-2', name: '4-4-2', positions: formationRow.positions },
        });
      prisma.userPlayer.findMany.mockResolvedValue(
        rosterRows.map((r) => ({ id: r.id, playerCard: { ...r.playerCard, player: { name: `Nome ${r.id}` } } })),
      );
      efootballCoach.explainSquad.mockResolvedValue({ explanation: 'Elenco equilibrado.', modelUsed: 'claude-sonnet-4-6' });

      const result = await service.explainSquad('squad-1', userA);

      expect(result).toEqual({ explanation: 'Elenco equilibrado.', modelUsed: 'claude-sonnet-4-6' });
      const context = efootballCoach.explainSquad.mock.calls[0][0];
      expect(context.formationCode).toBe('4-4-2');
      expect(context.startingXI).toHaveLength(11);
      expect(context.startingXI[0].playerName).toContain('Nome');
    });
  });
});
