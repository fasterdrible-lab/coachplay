import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { DecisionScore } from './decision-score.type';
import { DECISION_SCORE_WEIGHTS } from './decision-score.config';
import { VirtualPlayer } from './tactical-game-state.type';
import { PressureState } from './pressure-state.type';
import { SpaceRegion } from './space-region.type';
import { evaluatePassingLanes } from './passing-lanes.evaluator';
import { evaluatePressure } from './pressure.evaluator';
import { evaluateSpace } from './space.evaluator';
import { evaluateDefensiveBalance } from './defensive-balance.evaluator';
import { PitchThird, getPitchZone, pitchZoneEquals } from './pitch-zone';
import { clamp } from './geometry.util';
import { SAFE_PASS_SCORE_THRESHOLD } from './action-thresholds';

const THIRD_ORDER_INDEX: Record<PitchThird, number> = {
  [PitchThird.DEFENSIVE_THIRD]: 0,
  [PitchThird.MIDDLE_THIRD]: 1,
  [PitchThird.ATTACKING_THIRD]: 2,
};

// Cada opção de continuação boa (score de linha de passe ≥ SAFE_PASS_SCORE_THRESHOLD) soma
// este tanto ao componente futureOptions — 3+ opções já satura em 100.
const FUTURE_OPTION_UNIT = 34;

/**
 * Calcula o DecisionScore (0-100) de uma TacticalAction candidata dentro de um DecisionContext.
 * Determinístico — nenhuma chamada a IA generativa (ver Tarefa 23: IA só explica em texto,
 * nunca calcula o score).
 *
 * Limitação documentada (ver docs/tactical-engine-current-state.md e Tarefa 40): o motor não
 * simula reação do adversário nem movimento futuro dos jogadores — `defensiveBalance` reflete
 * o equilíbrio defensivo do INSTANTE da decisão (mesmo valor para todas as ações candidatas
 * desse instante), não uma projeção pós-ação.
 */
export function calculateDecisionScore(context: DecisionContext, action: TacticalAction): DecisionScore {
  const { gameState, ballCarrierId } = context;
  const ballCarrier = gameState.userPlayers.find((player) => player.trackingId === ballCarrierId);
  if (!ballCarrier) {
    throw new Error(`DecisionContext.ballCarrierId "${ballCarrierId}" não encontrado em gameState.userPlayers`);
  }

  const pressure = evaluatePressure(ballCarrier, gameState.opponentPlayers);
  const spaceRegions = evaluateSpace(gameState.userPlayers, gameState.opponentPlayers);
  const ballPosition = gameState.ball ?? ballCarrier.position;
  const defensiveBalance = evaluateDefensiveBalance(ballPosition, gameState.userPlayers, gameState.opponentPlayers);

  const possessionSafety = clamp(100 - action.estimatedRisk, 0, 100);
  const progression = computeProgression(ballCarrier, action);
  const spaceCreation = computeSpaceCreation(ballCarrier, action, spaceRegions);
  const futureOptions = computeFutureOptions(gameState, ballCarrier, action);
  const pressureManagement = computePressureManagement(action, pressure);

  const total = clamp(
    possessionSafety * DECISION_SCORE_WEIGHTS.possessionSafety +
      progression * DECISION_SCORE_WEIGHTS.progression +
      spaceCreation * DECISION_SCORE_WEIGHTS.spaceCreation +
      defensiveBalance.score * DECISION_SCORE_WEIGHTS.defensiveBalance +
      futureOptions * DECISION_SCORE_WEIGHTS.futureOptions +
      pressureManagement * DECISION_SCORE_WEIGHTS.pressureManagement,
    0,
    100,
  );

  return {
    total,
    possessionSafety,
    progression,
    spaceCreation,
    defensiveBalance: defensiveBalance.score,
    futureOptions,
    pressureManagement,
  };
}

// HOLD não tem targetZone (sem deslocamento) → progressão neutra (50), nem boa nem ruim.
function computeProgression(ballCarrier: VirtualPlayer, action: TacticalAction): number {
  if (!action.targetZone) return 50;

  const fromThird = THIRD_ORDER_INDEX[getPitchZone(ballCarrier.position).third];
  const toThird = THIRD_ORDER_INDEX[action.targetZone.third];
  return clamp((toThird - fromThird) * 50 + 50, 0, 100);
}

function computeSpaceCreation(ballCarrier: VirtualPlayer, action: TacticalAction, regions: SpaceRegion[]): number {
  const zone = action.targetZone ?? getPitchZone(ballCarrier.position);
  const region = regions.find((candidate) => pitchZoneEquals(candidate.zone, zone));
  return region?.freeSpace ?? 0;
}

// Reaproveita evaluatePassingLanes a partir do jogador que ficaria com a bola após a ação
// (o alvo do passe, ou o próprio portador para CARRY/HOLD) para contar quantas continuações
// boas se abririam — não é uma previsão de posição futura, usa as posições atuais do estado.
function computeFutureOptions(
  gameState: DecisionContext['gameState'],
  ballCarrier: VirtualPlayer,
  action: TacticalAction,
): number {
  const referencePlayer = action.targetPlayerId
    ? gameState.userPlayers.find((player) => player.trackingId === action.targetPlayerId) ?? ballCarrier
    : ballCarrier;

  const otherTeammates = gameState.userPlayers.filter((player) => player.trackingId !== referencePlayer.trackingId);
  const lanes = evaluatePassingLanes(referencePlayer, otherTeammates, gameState.opponentPlayers);
  const goodOptions = lanes.filter((lane) => lane.score >= SAFE_PASS_SCORE_THRESHOLD).length;

  return clamp(goodOptions * FUTURE_OPTION_UNIT, 0, 100);
}

// Sem pressão (score baixo), nenhuma ação é "melhor em gerenciar pressão" que outra — não
// há pressão a gerenciar, então HOLD e qualquer ação ativa empatam perto de 100. Sob pressão
// alta, HOLD é mal avaliado (deveria ter agido) enquanto qualquer outra ação já resolve a
// pressão ao mover a bola/o jogador, então cai bem menos. Formulação anterior penalizava
// ações ativas mesmo sem nenhuma pressão real, enviesando o motor a sempre preferir HOLD —
// corrigido para só penalizar quando há pressão de fato a gerenciar.
function computePressureManagement(action: TacticalAction, pressure: PressureState): number {
  if (action.type === 'HOLD') {
    return clamp(100 - pressure.score, 0, 100);
  }
  return clamp(100 - pressure.score * 0.3, 0, 100);
}
