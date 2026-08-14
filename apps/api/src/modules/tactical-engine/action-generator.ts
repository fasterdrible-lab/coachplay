import { DecisionContext } from './decision-context.type';
import { TacticalAction, TacticalActionType } from './tactical-action.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { PassingLane } from './passing-lane.type';
import { evaluatePassingLanes } from './passing-lanes.evaluator';
import { evaluatePressure } from './pressure.evaluator';
import { PitchChannel, getPitchZone } from './pitch-zone';
import { clamp } from './geometry.util';
import { PROGRESSIVE_PASS_MIN_PROGRESSION, SAFE_PASS_SCORE_THRESHOLD } from './action-thresholds';

// Avanço (eixo y) usado para estimar a zona-alvo de uma condução — não é uma previsão real
// de posição futura (o motor não simula movimento/física, ver Tarefa 40), só a zona
// imediatamente à frente do portador, usada para pontuar progressão/espaço da ação CARRY.
const CARRY_STEP = 0.1;
const HOLD_BASE_REWARD = 20;

const LEFT_SIDE: ReadonlySet<PitchChannel> = new Set([PitchChannel.LEFT_CHANNEL, PitchChannel.LEFT_HALF_SPACE]);
const RIGHT_SIDE: ReadonlySet<PitchChannel> = new Set([PitchChannel.RIGHT_CHANNEL, PitchChannel.RIGHT_HALF_SPACE]);

/**
 * Gera as ações táticas candidatas disponíveis para o portador da bola em `context`.
 * Puramente geométrico/determinístico — nenhuma IA generativa envolvida (ver Tarefa 23).
 * Retorna [] se `ballCarrierId` não corresponder a nenhum VirtualPlayer do usuário.
 */
export function generateActions(context: DecisionContext): TacticalAction[] {
  const { gameState, ballCarrierId } = context;
  const ballCarrier = gameState.userPlayers.find((player) => player.trackingId === ballCarrierId);
  if (!ballCarrier) return [];

  const teammates = gameState.userPlayers.filter((player) => player.trackingId !== ballCarrierId);
  const opponents = gameState.opponentPlayers;

  return [
    ...generatePassActions(ballCarrier, teammates, opponents),
    generateCarryAction(ballCarrier, opponents),
    generateHoldAction(ballCarrier, opponents),
  ];
}

function generatePassActions(
  ballCarrier: VirtualPlayer,
  teammates: VirtualPlayer[],
  opponents: VirtualPlayer[],
): TacticalAction[] {
  const lanes = evaluatePassingLanes(ballCarrier, teammates, opponents);
  const carrierChannel = getPitchZone(ballCarrier.position).channel;

  return lanes.map((lane) => {
    const target = teammates.find((teammate) => teammate.trackingId === lane.toPlayerId)!;
    const targetZone = getPitchZone(target.position);

    return {
      type: classifyPassType(lane, carrierChannel, targetZone.channel),
      targetPlayerId: lane.toPlayerId,
      targetZone,
      estimatedRisk: clamp(lane.obstructionRisk * 0.6 + lane.pressureRisk * 0.4, 0, 100),
      estimatedReward: clamp(lane.score * 0.7 + Math.max(lane.progressionValue, 0) * 0.3, 0, 100),
    };
  });
}

function classifyPassType(lane: PassingLane, fromChannel: PitchChannel, toChannel: PitchChannel): TacticalActionType {
  if (isOppositeSide(fromChannel, toChannel)) return 'SWITCH_SIDE';
  if (lane.progressionValue < 0) return 'RECYCLE';
  if (lane.progressionValue >= PROGRESSIVE_PASS_MIN_PROGRESSION) return 'PROGRESSIVE_PASS';
  if (lane.score >= SAFE_PASS_SCORE_THRESHOLD) return 'SAFE_PASS';
  return 'PASS';
}

function isOppositeSide(a: PitchChannel, b: PitchChannel): boolean {
  return (LEFT_SIDE.has(a) && RIGHT_SIDE.has(b)) || (RIGHT_SIDE.has(a) && LEFT_SIDE.has(b));
}

function generateCarryAction(ballCarrier: VirtualPlayer, opponents: VirtualPlayer[]): TacticalAction {
  const pressure = evaluatePressure(ballCarrier, opponents);
  const forward = { x: ballCarrier.position.x, y: clamp(ballCarrier.position.y + CARRY_STEP, 0, 1) };

  return {
    type: 'CARRY',
    targetZone: getPitchZone(forward),
    estimatedRisk: pressure.score,
    estimatedReward: clamp(100 - pressure.score, 0, 100),
  };
}

function generateHoldAction(ballCarrier: VirtualPlayer, opponents: VirtualPlayer[]): TacticalAction {
  const pressure = evaluatePressure(ballCarrier, opponents);

  return {
    type: 'HOLD',
    estimatedRisk: pressure.score,
    estimatedReward: clamp(HOLD_BASE_REWARD - pressure.score * 0.2, 0, 100),
  };
}
