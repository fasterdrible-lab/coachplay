import { VirtualPlayer } from './tactical-game-state.type';
import { DecisionContext } from './decision-context.type';
import { generateActions } from './action-generator';

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

describe('generateActions', () => {
  it('retorna [] quando ballCarrierId não existe em userPlayers', () => {
    const context: DecisionContext = {
      gameState: {
        matchId: 'match-1',
        timestampMs: 0,
        possession: 'user',
        ball: null,
        userPlayers: [],
        opponentPlayers: [],
        confidence: 0.5,
      },
      ballCarrierId: 'missing',
    };

    expect(generateActions(context)).toEqual([]);
  });

  it('sempre inclui CARRY e HOLD, mesmo sem companheiros', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    const actions = generateActions(context);
    expect(actions.map((a) => a.type)).toEqual(expect.arrayContaining(['CARRY', 'HOLD']));
  });

  it('gera SWITCH_SIDE para companheiro do lado oposto do campo', () => {
    const carrier = player('carrier', 'user', 0.15, 0.5); // canal esquerdo
    const rightMate = player('right', 'user', 0.85, 0.5); // canal direito
    const context = buildContext(carrier, [carrier, rightMate], []);

    const actions = generateActions(context);
    const switchAction = actions.find((a) => a.targetPlayerId === 'right');
    expect(switchAction?.type).toBe('SWITCH_SIDE');
  });

  it('gera RECYCLE para passe de recuo (progressão negativa)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const backTeammate = player('back', 'user', 0.5, 0.2); // atrás do portador, mesmo canal
    const context = buildContext(carrier, [carrier, backTeammate], []);

    const actions = generateActions(context);
    const recycle = actions.find((a) => a.targetPlayerId === 'back');
    expect(recycle?.type).toBe('RECYCLE');
  });

  it('gera PROGRESSIVE_PASS para passe de forte avanço sem obstrução', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const forwardTeammate = player('forward', 'user', 0.55, 0.8); // à frente, mesmo lado (não SWITCH_SIDE)
    const context = buildContext(carrier, [carrier, forwardTeammate], []);

    const actions = generateActions(context);
    const progressive = actions.find((a) => a.targetPlayerId === 'forward');
    expect(progressive?.type).toBe('PROGRESSIVE_PASS');
  });

  it('CARRY tem risco maior e recompensa menor quando o portador está sob pressão', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const closeOpponent = player('opp', 'opponent', 0.505, 0.5);
    const context = buildContext(carrier, [carrier], [closeOpponent]);
    const contextNoPressure = buildContext(carrier, [carrier], []);

    const carryUnderPressure = generateActions(context).find((a) => a.type === 'CARRY')!;
    const carryFree = generateActions(contextNoPressure).find((a) => a.type === 'CARRY')!;

    expect(carryUnderPressure.estimatedRisk).toBeGreaterThan(carryFree.estimatedRisk);
    expect(carryUnderPressure.estimatedReward).toBeLessThan(carryFree.estimatedReward);
  });
});
