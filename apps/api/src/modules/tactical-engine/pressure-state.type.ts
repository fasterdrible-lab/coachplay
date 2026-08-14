// Ver docs/tactical-engine-domain.md, seção 3 (PressureState).
export type PressureLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface PressureState {
  level: PressureLevel;
  // null quando não há nenhum adversário no estado (não é "distância infinita" — ausência
  // real de dado, ver docs/tactical-engine-domain.md sobre nunca inventar/inferir dado).
  nearestOpponentDistance: number | null;
  opponentsWithinRadius: number;
  score: number; // 0 (sem pressão) a 100 (pressão crítica)
}
