import { VirtualPlayer } from './tactical-game-state.type';
import { DecisionContext } from './decision-context.type';
import { buildDecisionTree } from './decision-tree.evaluator';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

function buildContext(ballCarrier: VirtualPlayer, userPlayers: VirtualPlayer[], opponentPlayers: VirtualPlayer[]): DecisionContext {
  return {
    gameState: {
      matchId: 'match-1',
      timestampMs: 1000,
      possession: 'user',
      ball: ballCarrier.position,
      userPlayers,
      opponentPlayers,
      controlledPlayerId: ballCarrier.trackingId,
      confidence: 0.9,
    },
    ballCarrierId: ballCarrier.trackingId,
  };
}

describe('buildDecisionTree', () => {
  it('depth 0 retorna árvore vazia', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    expect(buildDecisionTree(context, 0)).toEqual([]);
  });

  it('cada nível tem no máximo topActions nós', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const mates = [
      player('m1', 'user', 0.6, 0.55),
      player('m2', 'user', 0.4, 0.55),
      player('m3', 'user', 0.55, 0.7),
      player('m4', 'user', 0.45, 0.3),
    ];
    const context = buildContext(carrier, [carrier, ...mates], []);

    const tree = buildDecisionTree(context, 2, 3);

    expect(tree.length).toBeLessThanOrEqual(3);
    for (const node of tree) {
      expect(node.children.length).toBeLessThanOrEqual(3);
    }
  });

  it('nós de cada nível vêm ordenados por score decrescente', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const mates = [player('m1', 'user', 0.6, 0.55), player('m2', 'user', 0.4, 0.3)];
    const context = buildContext(carrier, [carrier, ...mates], []);

    const tree = buildDecisionTree(context, 1, 5);

    for (let i = 1; i < tree.length; i++) {
      expect(tree[i - 1].score.total).toBeGreaterThanOrEqual(tree[i].score.total);
    }
  });

  it('profundidade respeitada: netos existem em depth=2 mas não em depth=1', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const mate = player('mate', 'user', 0.6, 0.55);
    const context = buildContext(carrier, [carrier, mate], []);

    const shallow = buildDecisionTree(context, 1, 3);
    const deeper = buildDecisionTree(context, 2, 3);

    expect(shallow.every((node) => node.children.length === 0)).toBe(true);
    expect(deeper.some((node) => node.children.length > 0)).toBe(true);
  });

  it('sem companheiros, ainda gera CARRY/HOLD como raízes (nunca lança)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    const tree = buildDecisionTree(context);
    expect(tree.map((node) => node.action.type).sort()).toEqual(['CARRY', 'HOLD']);
  });

  it('parâmetros padrão (depth=2, topActions=3) nunca geram mais que 3 + 3×3 = 12 nós', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const mates = [
      player('m1', 'user', 0.6, 0.55),
      player('m2', 'user', 0.4, 0.55),
      player('m3', 'user', 0.55, 0.7),
      player('m4', 'user', 0.45, 0.3),
      player('m5', 'user', 0.65, 0.4),
    ];
    const context = buildContext(carrier, [carrier, ...mates], []);

    const tree = buildDecisionTree(context);
    const totalNodes = tree.length + tree.reduce((sum, node) => sum + node.children.length, 0);

    expect(totalNodes).toBeLessThanOrEqual(12);
  });
});
