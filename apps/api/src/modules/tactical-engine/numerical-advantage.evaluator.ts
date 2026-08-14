import { PitchCoordinate } from './pitch-coordinate.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { NumericalAdvantage } from './numerical-advantage.type';
import { PitchZone, getNeighboringZones, getPitchZone, pitchZoneEquals } from './pitch-zone';

/** Superioridade numérica dentro de uma única zona do campo. */
export function evaluateNumericalAdvantage(
  zone: PitchZone,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): NumericalAdvantage {
  return buildAdvantage(zone, countInZones([zone], userPlayers), countInZones([zone], opponentPlayers));
}

/**
 * Superioridade numérica na zona da bola e nas zonas adjacentes (vizinhança de Moore —
 * ver getNeighboringZones), não só na zona exata. Mais representativo de uma jogada real:
 * "3 atacantes × 2 defensores perto da bola", não restrito a uma única célula do grid.
 */
export function evaluateNumericalAdvantageAroundBall(
  ball: PitchCoordinate,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
): NumericalAdvantage {
  const ballZone = getPitchZone(ball);
  const zones = getNeighboringZones(ballZone);

  return buildAdvantage(ballZone, countInZones(zones, userPlayers), countInZones(zones, opponentPlayers));
}

function buildAdvantage(zone: PitchZone, userCount: number, opponentCount: number): NumericalAdvantage {
  const difference = userCount - opponentCount;
  const advantage = difference > 0 ? 'user' : difference < 0 ? 'opponent' : 'neutral';

  return { zone, userPlayers: userCount, opponentPlayers: opponentCount, difference, advantage };
}

function countInZones(zones: PitchZone[], players: VirtualPlayer[]): number {
  return players.filter((player) => {
    const playerZone = getPitchZone(player.position);
    return zones.some((zone) => pitchZoneEquals(zone, playerZone));
  }).length;
}
