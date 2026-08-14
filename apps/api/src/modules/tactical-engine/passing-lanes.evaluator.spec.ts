import { VirtualPlayer } from './tactical-game-state.type';
import { evaluatePassingLanes } from './passing-lanes.evaluator';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('evaluatePassingLanes', () => {
  it('cenário do enunciado: passe seguro tem score maior que passe bloqueado', () => {
    // Portador no centro; um companheiro à frente com adversário exatamente no meio do
    // caminho (passe bloqueado); outro companheiro ao lado, sem ninguém na trajetória
    // (passe seguro).
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const blockedTarget = player('blocked', 'user', 0.5, 0.7);
    const safeTarget = player('safe', 'user', 0.75, 0.55);
    const blocker = player('blocker', 'opponent', 0.5, 0.6);

    const [best, worst] = evaluatePassingLanes(ballCarrier, [blockedTarget, safeTarget], [blocker]);

    expect(best.toPlayerId).toBe('safe');
    expect(worst.toPlayerId).toBe('blocked');
    expect(best.score).toBeGreaterThan(worst.score);
    expect(worst.obstructionRisk).toBeGreaterThan(0);
    expect(best.obstructionRisk).toBe(0);
  });

  it('exclui o próprio portador da lista de alvos', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const teammate = player('mate', 'user', 0.6, 0.6);

    const lanes = evaluatePassingLanes(ballCarrier, [ballCarrier, teammate], []);

    expect(lanes).toHaveLength(1);
    expect(lanes[0].toPlayerId).toBe('mate');
  });

  it('sem adversários, obstructionRisk e pressureRisk são zero', () => {
    const ballCarrier = player('carrier', 'user', 0.3, 0.3);
    const teammate = player('mate', 'user', 0.4, 0.4);

    const [lane] = evaluatePassingLanes(ballCarrier, [teammate], []);

    expect(lane.obstructionRisk).toBe(0);
    expect(lane.pressureRisk).toBe(0);
  });

  it('adversário fora do segmento (t fora de [0,1]) não gera obstrução', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const teammate = player('mate', 'user', 0.5, 0.6);
    // Adversário "atrás" do portador, não entre portador e receptor.
    const opponentBehind = player('opp', 'opponent', 0.5, 0.3);

    const [lane] = evaluatePassingLanes(ballCarrier, [teammate], [opponentBehind]);

    expect(lane.obstructionRisk).toBe(0);
  });

  it('progressionValue é positivo para passe em direção ao ataque e negativo para recuo', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const forward = player('forward', 'user', 0.5, 0.7);
    const backward = player('backward', 'user', 0.5, 0.3);

    const lanes = evaluatePassingLanes(ballCarrier, [forward, backward], []);
    const forwardLane = lanes.find((l) => l.toPlayerId === 'forward')!;
    const backwardLane = lanes.find((l) => l.toPlayerId === 'backward')!;

    expect(forwardLane.progressionValue).toBeGreaterThan(0);
    expect(backwardLane.progressionValue).toBeLessThan(0);
  });

  it('ordena por score decrescente', () => {
    const ballCarrier = player('carrier', 'user', 0.5, 0.5);
    const a = player('a', 'user', 0.5, 0.9);
    const b = player('b', 'user', 0.5, 0.55);
    const blocker = player('blocker', 'opponent', 0.5, 0.7);

    const lanes = evaluatePassingLanes(ballCarrier, [a, b], [blocker]);

    expect(lanes[0].score).toBeGreaterThanOrEqual(lanes[1].score);
  });
});
