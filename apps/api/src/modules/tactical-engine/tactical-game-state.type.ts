import { PitchCoordinate } from './pitch-coordinate.type';

// Ver docs/tactical-engine-domain.md, seção 2 — nomenclatura de jogadores.
// `TacticalTeam`/`VirtualPlayer` nunca se referem à conta autenticada (`User` do Prisma).
export type TacticalTeam = 'user' | 'opponent';

export type PossessionState = 'user' | 'opponent' | 'contested' | 'unknown';

// Jogador virtual em campo (do time do usuário ou adversário). Sem identificação nominal
// do atleta no MVP — `trackingId` é só um identificador de rastreamento por sessão/partida.
export interface VirtualPlayer {
  trackingId: string;
  team: TacticalTeam;
  position: PitchCoordinate;
  role?: string;
  confidence: number;
}

// Instante estruturado da partida — entrada única do Tactical Engine.
// Ver docs/tactical-engine-domain.md, seção 3 (GameState) e seção 5 (fronteira com outros
// módulos): nenhum campo aqui é preenchido a partir de game-analysis/capture-sessions hoje.
export interface TacticalGameState {
  matchId: string;
  timestampMs: number;

  possession: PossessionState;

  ball: PitchCoordinate | null;

  userPlayers: VirtualPlayer[];
  opponentPlayers: VirtualPlayer[];

  // trackingId do VirtualPlayer (team: 'user') que o usuário está controlando neste instante.
  // Ausente quando não identificável com confiança suficiente.
  controlledPlayerId?: string;

  confidence: number;
}
