import { TacticalSnapshotsService } from './tactical-snapshots.service';
import { PrismaService } from '../../shared/database/prisma.service';
import { TacticalGameState } from './tactical-game-state.type';

describe('TacticalSnapshotsService', () => {
  let prisma: {
    tacticalSnapshot: { create: jest.Mock; findMany: jest.Mock };
  };
  let service: TacticalSnapshotsService;

  beforeEach(() => {
    prisma = {
      tacticalSnapshot: { create: jest.fn(), findMany: jest.fn() },
    };
    service = new TacticalSnapshotsService(prisma as unknown as PrismaService);
  });

  const buildState = (overrides: Partial<TacticalGameState> = {}): TacticalGameState => ({
    matchId: 'match-1',
    timestampMs: 1000,
    possession: 'user',
    ball: { x: 0.5, y: 0.5 },
    userPlayers: [
      { trackingId: 'u1', team: 'user', position: { x: 0.4, y: 0.5 }, confidence: 0.9 },
    ],
    opponentPlayers: [
      { trackingId: 'o1', team: 'opponent', position: { x: 0.6, y: 0.5 }, confidence: 0.9 },
    ],
    controlledPlayerId: 'u1',
    confidence: 0.9,
    ...overrides,
  });

  describe('save', () => {
    it('persiste o snapshot com os jogadores de ambos os times criados juntos', async () => {
      prisma.tacticalSnapshot.create.mockResolvedValue({ id: 'snap-1' });

      await service.save(buildState());

      expect(prisma.tacticalSnapshot.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          matchId: 'match-1',
          timestampMs: 1000,
          possession: 'user',
          ballX: 0.5,
          ballY: 0.5,
          controlledPlayerId: 'u1',
          confidence: 0.9,
          players: {
            create: [
              { trackingId: 'u1', team: 'user', x: 0.4, y: 0.5, role: undefined, confidence: 0.9 },
              { trackingId: 'o1', team: 'opponent', x: 0.6, y: 0.5, role: undefined, confidence: 0.9 },
            ],
          },
        }),
        include: { players: true },
      });
    });

    it('grava ballX/ballY como null quando a bola não foi localizada', async () => {
      prisma.tacticalSnapshot.create.mockResolvedValue({ id: 'snap-1' });

      await service.save(buildState({ ball: null }));

      expect(prisma.tacticalSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ ballX: null, ballY: null }) }),
      );
    });

    it('grava controlledPlayerId como null quando não identificado', async () => {
      prisma.tacticalSnapshot.create.mockResolvedValue({ id: 'snap-1' });

      await service.save(buildState({ controlledPlayerId: undefined }));

      expect(prisma.tacticalSnapshot.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ controlledPlayerId: null }) }),
      );
    });
  });

  describe('findByMatch', () => {
    it('busca snapshots ordenados por timestamp crescente, com jogadores incluídos', async () => {
      prisma.tacticalSnapshot.findMany.mockResolvedValue([]);

      await service.findByMatch('match-1');

      expect(prisma.tacticalSnapshot.findMany).toHaveBeenCalledWith({
        where: { matchId: 'match-1' },
        orderBy: { timestampMs: 'asc' },
        include: { players: true },
      });
    });
  });
});
