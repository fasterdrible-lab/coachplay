import { VirtualPlayer } from './tactical-game-state.type';
import { PassingLane } from './passing-lane.type';
import { clamp, euclideanDistance, perpendicularDistance, projectionParameter } from './geometry.util';

// Largura (em unidades normalizadas de campo) do "corredor" ao redor da linha reta
// passador→receptor dentro do qual um adversário é considerado obstrução.
const OBSTRUCTION_CORRIDOR_WIDTH = 0.06;
// Raio de proximidade considerado pressão imediata sobre o receptor.
const PRESSURE_RADIUS = 0.15;

const WEIGHT_OBSTRUCTION = 0.5;
const WEIGHT_PRESSURE = 0.3;
const WEIGHT_PROGRESSION = 0.2;

/**
 * Avalia todas as linhas de passe candidatas do portador da bola para seus companheiros.
 * Retorna ordenado por score decrescente (melhor opção primeiro).
 */
export function evaluatePassingLanes(
  ballCarrier: VirtualPlayer,
  teammates: VirtualPlayer[],
  opponents: VirtualPlayer[],
): PassingLane[] {
  return teammates
    .filter((teammate) => teammate.trackingId !== ballCarrier.trackingId)
    .map((teammate) => buildPassingLane(ballCarrier, teammate, opponents))
    .sort((a, b) => b.score - a.score);
}

function buildPassingLane(from: VirtualPlayer, to: VirtualPlayer, opponents: VirtualPlayer[]): PassingLane {
  const distance = euclideanDistance(from.position, to.position);
  const obstructionRisk = computeObstructionRisk(from, to, opponents);
  const pressureRisk = computePressureRisk(to, opponents);
  const progressionValue = clamp((to.position.y - from.position.y) * 100, -100, 100);

  const score = clamp(
    100 -
      obstructionRisk * WEIGHT_OBSTRUCTION -
      pressureRisk * WEIGHT_PRESSURE +
      progressionValue * WEIGHT_PROGRESSION,
    0,
    100,
  );

  return {
    fromPlayerId: from.trackingId,
    toPlayerId: to.trackingId,
    distance,
    obstructionRisk,
    pressureRisk,
    progressionValue,
    score,
  };
}

// Risco de obstrução = o adversário mais "no caminho": precisa estar entre passador e
// receptor (0 < t < 1) e perto o bastante da linha reta entre os dois.
function computeObstructionRisk(from: VirtualPlayer, to: VirtualPlayer, opponents: VirtualPlayer[]): number {
  let maxRisk = 0;

  for (const opponent of opponents) {
    const t = projectionParameter(from.position, to.position, opponent.position);
    if (t <= 0 || t >= 1) continue;

    const perpDistance = perpendicularDistance(from.position, to.position, opponent.position);
    const risk = clamp((1 - perpDistance / OBSTRUCTION_CORRIDOR_WIDTH) * 100, 0, 100);
    maxRisk = Math.max(maxRisk, risk);
  }

  return maxRisk;
}

function computePressureRisk(receiver: VirtualPlayer, opponents: VirtualPlayer[]): number {
  if (opponents.length === 0) return 0;

  const nearestDistance = Math.min(...opponents.map((o) => euclideanDistance(receiver.position, o.position)));
  return clamp((1 - nearestDistance / PRESSURE_RADIUS) * 100, 0, 100);
}
