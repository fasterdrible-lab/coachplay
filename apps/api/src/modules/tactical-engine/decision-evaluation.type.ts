import { TacticalAction } from './tactical-action.type';
import { DecisionScore } from './decision-score.type';
import { DecisionClassification } from './decision-classification';

// Ver docs/tactical-engine-domain.md (DecisionEvaluation). decision.evaluator.ts retorna
// `null` (não este tipo) quando a ação real não pode ser identificada com confiança — este
// tipo só existe para avaliações já confirmadas. `bestAlternative` fica `undefined` apenas
// quando não há nenhuma outra ação candidata além da própria ação real (ex.: sem companheiros
// em campo), não por falta de confiança.
export interface DecisionEvaluation {
  actualAction: TacticalAction;
  actualScore: DecisionScore;
  bestAlternative?: TacticalAction;
  bestAlternativeScore?: DecisionScore;
  scoreDifference: number;
  classification: DecisionClassification;
}
