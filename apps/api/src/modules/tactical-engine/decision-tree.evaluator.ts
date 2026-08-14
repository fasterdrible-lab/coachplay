import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { DecisionTreeNode } from './decision-tree.type';
import { generateActions } from './action-generator';
import { calculateDecisionScore } from './decision-score.calculator';

const DEFAULT_DEPTH = 2;
const DEFAULT_TOP_ACTIONS = 3;

/**
 * Constrói uma árvore de decisão de horizonte curto: para cada nível, avalia só as
 * `topActions` melhores ações candidatas (poda simples, evita explosão combinatória —
 * `topActions^depth` nós no máximo, 9 com os parâmetros padrão).
 *
 * Limitação deliberada (ver docs/tactical-engine-current-state.md e Tarefa 40): o motor não
 * simula reação real do adversário nem física do jogo. O "próximo estado" de cada nível
 * reaproveita o MESMO TacticalGameState, só trocando quem é o portador da bola para o alvo da
 * ação (quando a ação tem `targetPlayerId`) — suficiente para avaliar continuações de
 * passe/condução sem inventar posições novas, mas não é uma previsão real de como a defesa
 * adversária se reorganizaria.
 */
export function buildDecisionTree(
  context: DecisionContext,
  depth: number = DEFAULT_DEPTH,
  topActions: number = DEFAULT_TOP_ACTIONS,
): DecisionTreeNode[] {
  if (depth <= 0) return [];

  const scored = generateActions(context)
    .map((action) => ({ action, score: calculateDecisionScore(context, action) }))
    .sort((a, b) => b.score.total - a.score.total)
    .slice(0, topActions);

  return scored.map(({ action, score }) => ({
    action,
    score,
    children: buildDecisionTree(nextContext(context, action), depth - 1, topActions),
  }));
}

function nextContext(context: DecisionContext, action: TacticalAction): DecisionContext {
  return {
    gameState: context.gameState,
    ballCarrierId: action.targetPlayerId ?? context.ballCarrierId,
  };
}
