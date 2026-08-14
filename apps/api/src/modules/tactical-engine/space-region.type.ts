import { PitchZone } from './pitch-zone';

// Ver docs/tactical-engine-domain.md, seção 3 (SpaceRegion). MVP: grid = as 15 PitchZone
// (3 terços × 5 corredores) já usadas em todo o motor — não uma malha independente.
export interface SpaceRegion {
  zone: PitchZone;
  occupation: number; // 0-100 — densidade de jogadores (ambos os times) na zona
  pressure: number; // 0-100 — presença adversária na zona
  freeSpace: number; // 0-100 — inverso ponderado de occupation/pressure
  goalProximity: number; // 0-100 — proximidade ao gol adversário (y → 1)
}
