import { VirtualPlayer } from './tactical-game-state.type';
import { SpaceRegion } from './space-region.type';
import { PitchThird, PitchZone, getAllPitchZones, getPitchZone, pitchZoneEquals } from './pitch-zone';
import { clamp } from './geometry.util';

// Contagem de jogadores que satura occupation/pressure a 100 — acima disso, mais um
// jogador na mesma zona não aumenta a nota (já é o máximo de densidade considerado).
const OCCUPATION_SATURATION_COUNT = 4;
const PRESSURE_SATURATION_COUNT = 3;

const WEIGHT_OCCUPATION = 0.4;
const WEIGHT_PRESSURE = 0.6;

const WEIGHT_FREE_SPACE = 0.6;
const WEIGHT_GOAL_PROXIMITY = 0.4;

// Proximidade ao gol adversário (y=1) no centro de cada terço — o grid é o próprio
// PitchZone (3×5), sem malha independente.
const THIRD_GOAL_PROXIMITY: Record<PitchThird, number> = {
  [PitchThird.DEFENSIVE_THIRD]: (1 / 6) * 100,
  [PitchThird.MIDDLE_THIRD]: 0.5 * 100,
  [PitchThird.ATTACKING_THIRD]: (5 / 6) * 100,
};

/**
 * Avalia as 15 zonas do campo por ocupação, pressão adversária, espaço livre e
 * proximidade ao gol. Retorna ordenado por valor estratégico decrescente
 * (espaço livre + proximidade ao gol, ver pesos acima).
 */
export function evaluateSpace(userPlayers: VirtualPlayer[], opponentPlayers: VirtualPlayer[]): SpaceRegion[] {
  const allPlayers = [...userPlayers, ...opponentPlayers];

  return getAllPitchZones()
    .map((zone) => buildSpaceRegion(zone, allPlayers, opponentPlayers))
    .sort((a, b) => strategicValue(b) - strategicValue(a));
}

function buildSpaceRegion(zone: PitchZone, allPlayers: VirtualPlayer[], opponentPlayers: VirtualPlayer[]): SpaceRegion {
  const playersInZone = countInZone(zone, allPlayers);
  const opponentsInZone = countInZone(zone, opponentPlayers);

  const occupation = clamp((playersInZone / OCCUPATION_SATURATION_COUNT) * 100, 0, 100);
  const pressure = clamp((opponentsInZone / PRESSURE_SATURATION_COUNT) * 100, 0, 100);
  const freeSpace = clamp(100 - (occupation * WEIGHT_OCCUPATION + pressure * WEIGHT_PRESSURE), 0, 100);
  const goalProximity = THIRD_GOAL_PROXIMITY[zone.third];

  return { zone, occupation, pressure, freeSpace, goalProximity };
}

function countInZone(zone: PitchZone, players: VirtualPlayer[]): number {
  return players.filter((player) => pitchZoneEquals(getPitchZone(player.position), zone)).length;
}

function strategicValue(region: SpaceRegion): number {
  return region.freeSpace * WEIGHT_FREE_SPACE + region.goalProximity * WEIGHT_GOAL_PROXIMITY;
}
