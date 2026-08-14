import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { DecisionEvaluation } from './decision-evaluation.type';
import { DecisionScore } from './decision-score.type';
import { generateActions } from './action-generator';
import { calculateDecisionScore } from './decision-score.calculator';
import { classifyDecisionScore } from './decision-classification';
import { evaluateConfidence } from './confidence.evaluator';

// O chamador só precisa dizer QUAL ação foi escolhida (tipo + alvo) — nunca fornece
// estimatedRisk/estimatedReward, que são sempre recalculados pela geometria do motor
// (evita o "actualAction" divergir de como generateActions() pontuaria a mesma ação).
export type ActualActionSelector = Pick<TacticalAction, 'type' | 'targetPlayerId'>;

/**
 * Compara a ação realmente escolhida pelo usuário com a melhor alternativa disponível no
 * mesmo DecisionContext.
 *
 * Retorna `null` quando `actual` não corresponde a nenhuma ação candidata gerada por
 * `generateActions(context)` — implementação direta da regra do plano original (Tarefa 15/30,
 * ver docs/tactical-engine-domain.md — PlayerDecision): sem confiança suficiente para
 * identificar a ação real dentre as candidatas conhecidas, não gerar avaliação conclusiva em
 * vez de inventar uma.
 *
 * Também retorna `null` quando a confiança agregada do estado é insuficiente (Tarefa 29/30, ver
 * confidence.evaluator.ts) — mesmo quando a ação É reconhecida como candidata válida, um
 * snapshot/jogador de baixa confiança não deveria sustentar uma classificação (EXCELLENT vs.
 * MAJOR_ERROR, por exemplo) que o usuário vai ler como fato.
 */
export function evaluateDecision(context: DecisionContext, actual: ActualActionSelector): DecisionEvaluation | null {
  const candidates = generateActions(context);
  const actualAction = candidates.find((candidate) => isSameAction(candidate, actual));
  if (!actualAction) return null;

  if (!evaluateConfidence(context, actualAction.targetPlayerId).sufficient) return null;

  const actualScore = calculateDecisionScore(context, actualAction);
  const classification = classifyDecisionScore(actualScore.total);

  const alternatives = candidates.filter((candidate) => candidate !== actualAction);
  const best = alternatives.reduce<{ action: TacticalAction; score: DecisionScore } | undefined>((top, candidate) => {
    const score = calculateDecisionScore(context, candidate);
    return !top || score.total > top.score.total ? { action: candidate, score } : top;
  }, undefined);

  return {
    actualAction,
    actualScore,
    bestAlternative: best?.action,
    bestAlternativeScore: best?.score,
    scoreDifference: best ? actualScore.total - best.score.total : 0,
    classification,
  };
}

function isSameAction(a: TacticalAction, b: ActualActionSelector): boolean {
  return a.type === b.type && a.targetPlayerId === b.targetPlayerId;
}
