import { DecisionEvaluation } from './decision-evaluation.type';
import { PrincipleAdherence } from './principle-adherence.type';
import { TacticalDecisionFeedback } from './tactical-decision-feedback.type';

// Ver TASKS.md (Fase 5, Tarefa 27) — objeto canônico de UMA decisão, combinando o resultado do
// motor (DecisionEvaluation, Fase 3) com o julgamento de princípios (PrincipleAdherence, Fase
// 4) e, opcionalmente, a explicação em texto gerada por IA (TacticalDecisionFeedback, Tarefa
// 24) — pensado para um futuro endpoint de detalhe de decisão (ver "sem controller ainda" em
// docs/tactical-engine-domain.md; este tipo só define o formato, não expõe rota nenhuma).
export interface DecisionDetail {
  timestampMs: number;
  evaluation: DecisionEvaluation;
  principles: PrincipleAdherence[];
  // Ausente quando a explicação em texto ainda não foi gerada (custa uma chamada de IA — ver
  // AiCoachService.explainDecision) ou quando falhou (best-effort, nunca bloqueia o detalhe).
  feedback?: TacticalDecisionFeedback;
}
