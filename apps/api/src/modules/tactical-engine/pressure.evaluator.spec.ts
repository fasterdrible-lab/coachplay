import { VirtualPlayer } from './tactical-game-state.type';
import { evaluatePressure } from './pressure.evaluator';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('evaluatePressure', () => {
  it('sem adversários: LOW, sem distância (null), score 0', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);

    const result = evaluatePressure(ballCarrier, []);

    expect(result).toEqual({ level: 'LOW', nearestOpponentDistance: null, opponentsWithinRadius: 0, score: 0 });
  });

  it('adversário muito distante: LOW, opponentsWithinRadius 0', () => {
    const ballCarrier = player('carrier', 'user', 0.1, 0.1);
    const farOpponent = player('opp', 'opponent', 0.9, 0.9);

    const result = evaluatePressure(ballCarrier, [farOpponent]);

    expect(result.level).toBe('LOW');
    expect(result.opponentsWithinRadius).toBe(0);
    expect(result.nearestOpponentDistance).toBeGreaterThan(0);
  });

  it('adversário colado no portador: CRITICAL, score alto', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const closeOpponent = player('opp', 'opponent', 0.505, 0.5);

    const result = evaluatePressure(ballCarrier, [closeOpponent]);

    expect(result.level).toBe('CRITICAL');
    expect(result.score).toBeGreaterThan(75);
    expect(result.opponentsWithinRadius).toBe(1);
  });

  it('múltiplos adversários dentro do raio aumentam a pressão em relação a apenas um', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const opponent = player('opp1', 'opponent', 0.6, 0.5);
    const secondOpponent = player('opp2', 'opponent', 0.5, 0.6);

    const withOne = evaluatePressure(ballCarrier, [opponent]);
    const withTwo = evaluatePressure(ballCarrier, [opponent, secondOpponent]);

    expect(withTwo.opponentsWithinRadius).toBeGreaterThanOrEqual(withOne.opponentsWithinRadius);
    expect(withTwo.score).toBeGreaterThanOrEqual(withOne.score);
  });

  it('usa a distância do adversário mais próximo, não a média', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const near = player('near', 'opponent', 0.51, 0.5);
    const far = player('far', 'opponent', 0.99, 0.99);

    const result = evaluatePressure(ballCarrier, [near, far]);

    expect(result.nearestOpponentDistance).toBeCloseTo(0.01);
  });
});
