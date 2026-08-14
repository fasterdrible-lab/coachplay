import { TacticalAction } from './tactical-action.type';
import { DecisionScore } from './decision-score.type';

// Ver docs/tactical-engine-domain.md — árvore de curto horizonte (Tarefa 16). `children` só
// existe para as `topActions` melhores ações de cada nível, até `depth` níveis — poda simples
// por construção, não busca combinatória completa (fora de escopo, ver Tarefa 40).
export interface DecisionTreeNode {
  action: TacticalAction;
  score: DecisionScore;
  children: DecisionTreeNode[];
}
