import { TacticalAction } from './tactical-action.type';
import { PressureLevel } from './pressure-state.type';
import { DecisionScore } from './decision-score.type';
import { DecisionClassification } from './decision-classification';
import { PrincipleAdherence } from './principle-adherence.type';

// Ver TASKS.md (Fase 5, Tarefas 25-27) — uma decisão já avaliada (DecisionEvaluation, Fase 3) e
// julgada quanto a princípios (PrincipleAdherence, Fase 4), num instante conhecido da partida.
// É a entrada comum dos três builders de saída da Fase 5 (relatório, timeline, detalhe de
// decisão) — cada um lê só os campos que precisa, sem recalcular nada. Superconjunto de
// TacticalSequenceStep (Fase 3): quem já monta um TacticalSequenceStep por decisão pode montar
// este tipo com os mesmos dados, só acrescentando score/principles.
export interface EvaluatedDecisionRecord {
  timestampMs: number;
  action: TacticalAction;
  pressureLevel: PressureLevel;
  score: DecisionScore;
  classification: DecisionClassification;
  principles: PrincipleAdherence[];
}
