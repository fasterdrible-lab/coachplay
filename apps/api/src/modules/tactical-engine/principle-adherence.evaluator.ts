import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { DecisionScore } from './decision-score.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { StrategicPrincipleId } from './strategic-principle.type';
import { PressureState } from './pressure-state.type';
import { InitiativeState } from './initiative.type';
import { NumericalAdvantage } from './numerical-advantage.type';
import { evaluatePressure } from './pressure.evaluator';
import { evaluateInitiative } from './initiative.evaluator';
import { detectOverloadOpportunities } from './overload-switch.evaluator';
import { PitchChannel, PitchThird, PitchZone, getPitchZone, pitchZoneEquals } from './pitch-zone';

// Limiares locais deste avaliador — julgam "boa o suficiente" a nota do componente correspondente
// do DecisionScore para considerar o princípio seguido. Não são os mesmos limiares de
// classificação de DecisionScore.total (decision-classification.ts): aqui cada julgamento é
// por componente individual, não pela nota agregada da ação.
const ADHERENCE_THRESHOLD = 60;
const CENTRAL_CHANNELS: ReadonlySet<PitchChannel> = new Set([
  PitchChannel.LEFT_HALF_SPACE,
  PitchChannel.CENTRAL_CHANNEL,
  PitchChannel.RIGHT_HALF_SPACE,
]);

interface PrincipleEvaluationContext {
  action: TacticalAction;
  score: DecisionScore;
  ballZone: PitchZone;
  pressure: PressureState;
  initiative: InitiativeState;
  overloadOpportunities: NumericalAdvantage[];
}

const PRINCIPLE_EVALUATORS: Record<StrategicPrincipleId, (ctx: PrincipleEvaluationContext) => boolean | null> = {
  CENTRAL_CONTROL: (ctx) => {
    if (!ctx.action.targetZone) return null;
    if (!CENTRAL_CHANNELS.has(ctx.action.targetZone.channel)) return false;
    return ctx.score.progression >= ADHERENCE_THRESHOLD;
  },
  PIECE_ACTIVITY: (ctx) => ctx.score.pressureManagement >= ADHERENCE_THRESHOLD,
  KING_SAFETY: (ctx) => ctx.score.defensiveBalance >= ADHERENCE_THRESHOLD,
  SPACE_EXPANSION: (ctx) => ctx.score.spaceCreation >= ADHERENCE_THRESHOLD,
  INITIATIVE: (ctx) => (ctx.initiative.holder === 'neutral' ? null : ctx.initiative.holder === 'user'),
  PROPHYLAXIS: (ctx) => {
    if (ctx.pressure.level === 'LOW' || ctx.pressure.level === 'MEDIUM') return null;
    return ctx.score.possessionSafety >= ADHERENCE_THRESHOLD;
  },
  OVERLOAD: (ctx) => {
    if (ctx.overloadOpportunities.length === 0) return null;
    const targetZone = ctx.action.targetZone ?? ctx.ballZone;
    return ctx.overloadOpportunities.some((opportunity) => pitchZoneEquals(opportunity.zone, targetZone));
  },
  WEAKNESS_EXPLOITATION: (ctx) => {
    if (!ctx.action.targetZone || ctx.action.targetZone.third !== PitchThird.ATTACKING_THIRD) return null;
    return ctx.score.spaceCreation >= ADHERENCE_THRESHOLD;
  },
};

/**
 * Julga, para UMA TacticalAction já pontuada (DecisionScore calculado por
 * decision-score.calculator.ts), quais princípios do catálogo (strategic-principle.type.ts,
 * Tarefa 18) ela segue, viola, ou para os quais não há julgamento aplicável no instante.
 * Determinístico — reusa avaliadores já existentes (pressão, iniciativa, sobrecarga) em vez de
 * recalcular geometria própria. Ordem estável: mesma ordem de STRATEGIC_PRINCIPLE_CATALOG.
 */
export function evaluatePrincipleAdherence(
  context: DecisionContext,
  action: TacticalAction,
  score: DecisionScore,
): PrincipleAdherence[] {
  const { gameState, ballCarrierId } = context;
  const ballCarrier = gameState.userPlayers.find((player) => player.trackingId === ballCarrierId);
  if (!ballCarrier) {
    throw new Error(`DecisionContext.ballCarrierId "${ballCarrierId}" não encontrado em gameState.userPlayers`);
  }

  const ballPosition = gameState.ball ?? ballCarrier.position;
  const ctx: PrincipleEvaluationContext = {
    action,
    score,
    ballZone: getPitchZone(ballPosition),
    pressure: evaluatePressure(ballCarrier, gameState.opponentPlayers),
    initiative: evaluateInitiative(gameState.possession, gameState.userPlayers, gameState.opponentPlayers),
    overloadOpportunities: detectOverloadOpportunities(gameState.userPlayers, gameState.opponentPlayers),
  };

  return (Object.keys(PRINCIPLE_EVALUATORS) as StrategicPrincipleId[]).map((principleId) => ({
    principleId,
    adhered: PRINCIPLE_EVALUATORS[principleId](ctx),
  }));
}
