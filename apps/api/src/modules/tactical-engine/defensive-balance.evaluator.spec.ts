import { VirtualPlayer } from './tactical-game-state.type';
import { evaluateDefensiveBalance } from './defensive-balance.evaluator';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('evaluateDefensiveBalance', () => {
  it('cenário "reciclagem segura": vários jogadores atrás da bola, nenhum adversário livre à frente → score alto', () => {
    const ball = { x: 0.5, y: 0.5 };
    const userPlayers = [
      player('gk', 'user', 0.5, 0.05),
      player('cb1', 'user', 0.4, 0.2),
      player('cb2', 'user', 0.6, 0.2),
      player('dm', 'user', 0.5, 0.4),
    ];
    const opponentPlayers = [player('st', 'opponent', 0.5, 0.52)];

    const result = evaluateDefensiveBalance(ball, userPlayers, opponentPlayers);

    expect(result.playersBehindBall).toBe(4);
    expect(result.freeOpponents).toBe(0);
    expect(result.advantage).toBe('user');
    expect(result.score).toBeGreaterThan(75);
  });

  it('cenário "contra-ataque 3x2": poucos jogadores atrás da bola, adversários livres à frente → score baixo', () => {
    const ball = { x: 0.5, y: 0.7 }; // bola avançada — poucos jogadores do usuário atrás dela
    const userPlayers = [player('cb1', 'user', 0.4, 0.3), player('cb2', 'user', 0.6, 0.3)];
    const opponentPlayers = [
      player('st1', 'opponent', 0.3, 0.85),
      player('st2', 'opponent', 0.5, 0.9),
      player('st3', 'opponent', 0.7, 0.85),
    ];

    const result = evaluateDefensiveBalance(ball, userPlayers, opponentPlayers);

    expect(result.playersBehindBall).toBe(2);
    expect(result.freeOpponents).toBe(3);
    expect(result.advantage).toBe('opponent');
    expect(result.score).toBeLessThan(40);
  });

  it('adversário à frente marcado por um jogador próximo não conta como livre', () => {
    const ball = { x: 0.5, y: 0.5 };
    const userPlayers = [player('marker', 'user', 0.5, 0.45)];
    const markedOpponent = player('st', 'opponent', 0.5, 0.55);

    const result = evaluateDefensiveBalance(ball, userPlayers, [markedOpponent]);

    expect(result.freeOpponents).toBe(0);
  });

  it('sem jogadores atrás da bola, defensiveWidth é 0 (sem NaN/Infinity)', () => {
    const ball = { x: 0.5, y: 0.1 };
    const result = evaluateDefensiveBalance(ball, [], [player('st', 'opponent', 0.5, 0.5)]);

    expect(result.playersBehindBall).toBe(0);
    expect(result.defensiveWidth).toBe(0);
    expect(Number.isFinite(result.score)).toBe(true);
  });

  it('contagens iguais de jogadores atrás/adversários à frente → neutro', () => {
    const ball = { x: 0.5, y: 0.5 };
    const userPlayers = [player('cb', 'user', 0.5, 0.3)];
    const opponentPlayers = [player('st', 'opponent', 0.9, 0.9)];

    expect(evaluateDefensiveBalance(ball, userPlayers, opponentPlayers).advantage).toBe('neutral');
  });
});
