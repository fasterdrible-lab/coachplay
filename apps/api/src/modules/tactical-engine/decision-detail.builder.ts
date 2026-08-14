import { DecisionEvaluation } from './decision-evaluation.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { TacticalDecisionFeedback } from './tactical-decision-feedback.type';
import { DecisionDetail } from './decision-detail.type';

/**
 * Monta o DecisionDetail canônico de uma decisão (Tarefa 27) — composição trivial, sem lógica
 * própria: existe para que todo consumidor (relatório, timeline, futuro endpoint) monte o mesmo
 * formato exato, em vez de cada um remontar o objeto à mão.
 */
export function buildDecisionDetail(
  timestampMs: number,
  evaluation: DecisionEvaluation,
  principles: PrincipleAdherence[],
  feedback?: TacticalDecisionFeedback,
): DecisionDetail {
  return { timestampMs, evaluation, principles, feedback };
}
