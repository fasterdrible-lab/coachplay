import { getPitchZone } from './pitch-zone';
import { isValidPitchCoordinate } from './pitch-coordinate.type';
import {
  centralOverloadFixture,
  counterAttackThreeVsTwoFixture,
  fullSquadFixture,
  lowConfidenceStateFixture,
  pressuredCentralPassFixture,
  safeRecyclingFixture,
} from './tactical-fixtures';
import { DecisionContext } from './decision-context.type';

const FIXTURES: Array<[string, () => DecisionContext]> = [
  ['pressuredCentralPassFixture', pressuredCentralPassFixture],
  ['safeRecyclingFixture', safeRecyclingFixture],
  ['counterAttackThreeVsTwoFixture', counterAttackThreeVsTwoFixture],
  ['centralOverloadFixture', centralOverloadFixture],
  ['lowConfidenceStateFixture', lowConfidenceStateFixture],
  ['fullSquadFixture', fullSquadFixture],
];

describe('tactical-fixtures (dataset — Tarefa 34)', () => {
  it.each(FIXTURES)('%s: o portador da bola existe em userPlayers', (_name, build) => {
    const context = build();
    const carrier = context.gameState.userPlayers.find((p) => p.trackingId === context.ballCarrierId);
    expect(carrier).toBeDefined();
  });

  it.each(FIXTURES)('%s: todas as coordenadas de jogadores/bola são válidas ([0,1])', (_name, build) => {
    const context = build();
    const { userPlayers, opponentPlayers, ball } = context.gameState;

    for (const player of [...userPlayers, ...opponentPlayers]) {
      expect(isValidPitchCoordinate(player.position)).toBe(true);
      expect(() => getPitchZone(player.position)).not.toThrow();
    }
    if (ball) expect(isValidPitchCoordinate(ball)).toBe(true);
  });

  it('fullSquadFixture: 11 jogadores por time, adversário em formação espelhada', () => {
    const context = fullSquadFixture();

    expect(context.gameState.userPlayers).toHaveLength(11);
    expect(context.gameState.opponentPlayers).toHaveLength(11);
    // GK do usuário perto do próprio gol (y baixo); GK adversário perto do gol dele (y alto).
    expect(context.gameState.userPlayers[0].position.y).toBeLessThan(0.5);
    expect(context.gameState.opponentPlayers[0].position.y).toBeGreaterThan(0.5);
  });

  it('lowConfidenceStateFixture: confiança agregada fica abaixo do limiar (documentado no nome)', () => {
    const context = lowConfidenceStateFixture();
    const carrier = context.gameState.userPlayers[0];

    expect(carrier.confidence).toBeLessThan(0.5);
  });
});
