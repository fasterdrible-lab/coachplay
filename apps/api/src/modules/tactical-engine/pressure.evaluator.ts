import { VirtualPlayer } from './tactical-game-state.type';
import { PressureLevel, PressureState } from './pressure-state.type';
import { clamp, euclideanDistance } from './geometry.util';

// Raio (unidades normalizadas de campo) considerado pressão imediata sobre o portador.
const PRESSURE_RADIUS = 0.15;

const WEIGHT_PROXIMITY = 0.7;
const WEIGHT_COUNT = 0.3;
// Cada adversário dentro do raio soma até este tanto ao componente de contagem (4+ = máximo).
const COUNT_SCORE_PER_OPPONENT = 25;

const LEVEL_THRESHOLDS: ReadonlyArray<{ upTo: number; level: PressureLevel }> = [
  { upTo: 25, level: 'LOW' },
  { upTo: 50, level: 'MEDIUM' },
  { upTo: 75, level: 'HIGH' },
  { upTo: 100, level: 'CRITICAL' },
];

/** Classifica a pressão adversária sobre o portador da bola. Determinístico, sem IA. */
export function evaluatePressure(ballCarrier: VirtualPlayer, opponents: VirtualPlayer[]): PressureState {
  if (opponents.length === 0) {
    return { level: 'LOW', nearestOpponentDistance: null, opponentsWithinRadius: 0, score: 0 };
  }

  const distances = opponents.map((opponent) => euclideanDistance(ballCarrier.position, opponent.position));
  const nearestOpponentDistance = Math.min(...distances);
  const opponentsWithinRadius = distances.filter((distance) => distance <= PRESSURE_RADIUS).length;

  const proximityScore = clamp((1 - nearestOpponentDistance / PRESSURE_RADIUS) * 100, 0, 100);
  const countScore = clamp(opponentsWithinRadius * COUNT_SCORE_PER_OPPONENT, 0, 100);
  const score = clamp(proximityScore * WEIGHT_PROXIMITY + countScore * WEIGHT_COUNT, 0, 100);

  const level = LEVEL_THRESHOLDS.find((threshold) => score <= threshold.upTo)!.level;

  return { level, nearestOpponentDistance, opponentsWithinRadius, score };
}
