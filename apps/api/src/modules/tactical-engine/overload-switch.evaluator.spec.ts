import { VirtualPlayer } from './tactical-game-state.type';
import { detectOverloadOpportunities, evaluateSwitchOpportunity } from './overload-switch.evaluator';
import { PitchChannel, PitchThird } from './pitch-zone';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('detectOverloadOpportunities', () => {
  it('reporta só zonas com vantagem do usuário >= 2 (cenário 3x1 no ataque)', () => {
    const userPlayers = [
      player('u1', 'user', 0.5, 0.85),
      player('u2', 'user', 0.52, 0.86),
      player('u3', 'user', 0.48, 0.84),
    ];
    const opponentPlayers = [player('o1', 'opponent', 0.5, 0.85)];

    const opportunities = detectOverloadOpportunities(userPlayers, opponentPlayers);

    expect(opportunities).toHaveLength(1);
    expect(opportunities[0]).toMatchObject({
      zone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL },
      userPlayers: 3,
      opponentPlayers: 1,
      difference: 2,
      advantage: 'user',
    });
  });

  it('vantagem de apenas 1 jogador não é reportada como oportunidade', () => {
    const userPlayers = [player('u1', 'user', 0.5, 0.5), player('u2', 'user', 0.52, 0.5)];
    const opponentPlayers = [player('o1', 'opponent', 0.5, 0.5)];

    expect(detectOverloadOpportunities(userPlayers, opponentPlayers)).toEqual([]);
  });

  it('ordena por diferença decrescente quando há mais de uma zona explorável', () => {
    const userPlayers = [
      // Zona A (ataque/central): 2x0 (diferença 2)
      player('a1', 'user', 0.5, 0.85),
      player('a2', 'user', 0.52, 0.86),
      // Zona B (defesa/esquerda): 3x0 (diferença 3)
      player('b1', 'user', 0.1, 0.1),
      player('b2', 'user', 0.11, 0.1),
      player('b3', 'user', 0.12, 0.1),
    ];

    const opportunities = detectOverloadOpportunities(userPlayers, []);

    expect(opportunities[0].difference).toBe(3);
    expect(opportunities[1].difference).toBe(2);
  });
});

describe('evaluateSwitchOpportunity', () => {
  it('lado esquerdo sobrecarregado de adversários, lado direito livre → alto valor de troca de lado', () => {
    const ball = { x: 0.1, y: 0.5 };
    const userPlayers = [
      player('u-left', 'user', 0.1, 0.5),
      player('u-right-1', 'user', 0.9, 0.5),
      player('u-right-2', 'user', 0.92, 0.52),
      player('u-right-3', 'user', 0.88, 0.48),
    ];
    const opponentPlayers = [
      player('o-left-1', 'opponent', 0.1, 0.5),
      player('o-left-2', 'opponent', 0.12, 0.52),
      player('o-left-3', 'opponent', 0.08, 0.48),
      player('o-right', 'opponent', 0.9, 0.5),
    ];

    const result = evaluateSwitchOpportunity(ball, userPlayers, opponentPlayers);

    expect(result.currentChannel).toBe(PitchChannel.LEFT_CHANNEL);
    expect(result.targetChannel).toBe(PitchChannel.RIGHT_CHANNEL);
    expect(result.currentSideAdvantage.difference).toBe(-2);
    expect(result.targetSideAdvantage.difference).toBe(2);
    expect(result.value).toBe(100);
  });

  it('bola no centro do campo (espelho de si mesma) → value neutro (50)', () => {
    const ball = { x: 0.5, y: 0.5 };

    const result = evaluateSwitchOpportunity(ball, [], []);

    expect(result.currentChannel).toBe(result.targetChannel);
    expect(result.value).toBe(50);
  });
});
