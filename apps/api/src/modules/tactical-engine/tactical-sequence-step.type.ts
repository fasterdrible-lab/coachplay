import { TacticalAction } from './tactical-action.type';
import { PressureLevel } from './pressure-state.type';
import { DecisionClassification } from './decision-classification';

// Uma decisão já avaliada, na ordem em que aconteceu — entrada de detectTacticalSequences().
// Monta-se a partir de uma série de DecisionEvaluation (Tarefa 15) + PressureState (Tarefa 8)
// do mesmo instante, não é produzido diretamente por nenhum avaliador.
export interface TacticalSequenceStep {
  timestampMs: number;
  action: TacticalAction;
  pressureLevel: PressureLevel;
  classification: DecisionClassification;
}
