import { VirtualPlayer } from './tactical-game-state.type';
import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { calculateDecisionScore } from './decision-score.calculator';
import { DECISION_SCORE_WEIGHTS } from './decision-score.config';
import { PitchChannel, PitchThird } from './pitch-zone';

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

const HOLD: TacticalAction = { type: 'HOLD', estimatedRisk: 0, estimatedReward: 0 };

describe('calculateDecisionScore', () => {
  it('lança erro quando ballCarrierId não existe no estado', () => {
    const context = buildContext(player('c', 'user', 0.5, 0.5), [], []);
    expect(() => calculateDecisionScore(context, HOLD)).toThrow(/ballCarrierId/);
  });

  it('total é a soma ponderada exata dos 6 componentes (pesos de decision-score.config.ts)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    const score = calculateDecisionScore(context, HOLD);

    const expectedTotal =
      score.possessionSafety * DECISION_SCORE_WEIGHTS.possessionSafety +
      score.progression * DECISION_SCORE_WEIGHTS.progression +
      score.spaceCreation * DECISION_SCORE_WEIGHTS.spaceCreation +
      score.defensiveBalance * DECISION_SCORE_WEIGHTS.defensiveBalance +
      score.futureOptions * DECISION_SCORE_WEIGHTS.futureOptions +
      score.pressureManagement * DECISION_SCORE_WEIGHTS.pressureManagement;

    expect(score.total).toBeCloseTo(expectedTotal);
  });

  it('total nunca sai de [0, 100]', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const swarmedByOpponents = Array.from({ length: 8 }, (_, i) => player(`o${i}`, 'opponent', 0.5 + i * 0.001, 0.5));
    const context = buildContext(carrier, [carrier], swarmedByOpponents);

    const score = calculateDecisionScore(context, HOLD);
    expect(score.total).toBeGreaterThanOrEqual(0);
    expect(score.total).toBeLessThanOrEqual(100);
  });

  it('HOLD sob pressão alta tem pressureManagement pior que HOLD sem pressão', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const closeOpponent = player('opp', 'opponent', 0.505, 0.5);

    const underPressure = calculateDecisionScore(buildContext(carrier, [carrier], [closeOpponent]), HOLD);
    const noPressure = calculateDecisionScore(buildContext(carrier, [carrier], []), HOLD);

    expect(underPressure.pressureManagement).toBeLessThan(noPressure.pressureManagement);
  });

  it('sob pressão alta, uma ação que não seja HOLD gerencia melhor a pressão que HOLD', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const closeOpponent = player('opp', 'opponent', 0.505, 0.5);
    const context = buildContext(carrier, [carrier], [closeOpponent]);

    const pass: TacticalAction = { type: 'SAFE_PASS', targetPlayerId: 'x', estimatedRisk: 10, estimatedReward: 80 };

    const holdScore = calculateDecisionScore(context, HOLD);
    const passScore = calculateDecisionScore(context, pass);

    expect(passScore.pressureManagement).toBeGreaterThan(holdScore.pressureManagement);
  });

  it('ação com targetZone no terço de ataque tem progression maior que no terço defensivo', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5); // terço do meio
    const context = buildContext(carrier, [carrier], []);

    const forward: TacticalAction = {
      type: 'PROGRESSIVE_PASS',
      targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL },
      estimatedRisk: 20,
      estimatedReward: 70,
    };
    const backward: TacticalAction = {
      type: 'RECYCLE',
      targetZone: { third: PitchThird.DEFENSIVE_THIRD, channel: PitchChannel.CENTRAL_CHANNEL },
      estimatedRisk: 5,
      estimatedReward: 30,
    };

    const forwardScore = calculateDecisionScore(context, forward);
    const backwardScore = calculateDecisionScore(context, backward);

    expect(forwardScore.progression).toBeGreaterThan(backwardScore.progression);
  });

  it('HOLD (sem targetZone) tem progression neutra (50)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);
    expect(calculateDecisionScore(context, HOLD).progression).toBe(50);
  });

  it('futureOptions aumenta com mais companheiros bem posicionados para receber o próximo passe', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const mate = player('mate', 'user', 0.6, 0.55);
    const extraMate = player('mate2', 'user', 0.4, 0.55);

    const passToMate: TacticalAction = { type: 'SAFE_PASS', targetPlayerId: 'mate', estimatedRisk: 10, estimatedReward: 80 };

    const fewOptions = calculateDecisionScore(buildContext(carrier, [carrier, mate], []), passToMate);
    const moreOptions = calculateDecisionScore(buildContext(carrier, [carrier, mate, extraMate], []), passToMate);

    expect(moreOptions.futureOptions).toBeGreaterThanOrEqual(fewOptions.futureOptions);
  });
});
