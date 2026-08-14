import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { TacticalGameState } from './tactical-game-state.type';

// Persistência do TacticalGameState (ver docs/tactical-engine-domain.md). Camada fina sobre
// o Prisma — nenhuma regra de avaliação tática vive aqui (isso entra nas Fases 2–4).
@Injectable()
export class TacticalSnapshotsService {
  constructor(private readonly prisma: PrismaService) {}

  async save(state: TacticalGameState) {
    const players = [...state.userPlayers, ...state.opponentPlayers].map((player) => ({
      trackingId: player.trackingId,
      team: player.team,
      x: player.position.x,
      y: player.position.y,
      role: player.role,
      confidence: player.confidence,
    }));

    return this.prisma.tacticalSnapshot.create({
      data: {
        matchId: state.matchId,
        timestampMs: state.timestampMs,
        possession: state.possession,
        ballX: state.ball?.x ?? null,
        ballY: state.ball?.y ?? null,
        controlledPlayerId: state.controlledPlayerId ?? null,
        confidence: state.confidence,
        players: { create: players },
      },
      include: { players: true },
    });
  }

  async findByMatch(matchId: string) {
    return this.prisma.tacticalSnapshot.findMany({
      where: { matchId },
      orderBy: { timestampMs: 'asc' },
      include: { players: true },
    });
  }
}
