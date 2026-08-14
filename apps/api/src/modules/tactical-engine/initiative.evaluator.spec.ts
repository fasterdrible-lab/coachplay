import { VirtualPlayer } from './tactical-game-state.type';
import { evaluateInitiative } from './initiative.evaluator';

function player(trackingId: string, team: 'user' | 'opponent', y: number): VirtualPlayer {
  return { trackingId, team, position: { x: 0.5, y }, confidence: 0.9 };
}

describe('evaluateInitiative', () => {
  it('jogo concentrado no campo de ataque do usuário (posse do usuário) → iniciativa do usuário', () => {
    const userPlayers = [player('u1', 'user', 0.7), player('u2', 'user', 0.8)];
    const opponentPlayers = [player('o1', 'opponent', 0.75), player('o2', 'opponent', 0.85)];

    const result = evaluateInitiative('user', userPlayers, opponentPlayers);

    expect(result.holder).toBe('user');
    expect(result.territorialDominance).toBeGreaterThan(60);
  });

  it('adversário pressionando perto do gol do usuário (mesmo com usuário "avançado" em y) → iniciativa do adversário', () => {
    // Cenário que a diferença simples (avgUserY - avgOpponentY) classificaria erradamente como
    // neutro: usuário recuado e adversário ainda mais perto do gol do usuário — domínio real é
    // do adversário, não neutro.
    const userPlayers = [player('u1', 'user', 0.1)];
    const opponentPlayers = [player('o1', 'opponent', 0.05)];

    const result = evaluateInitiative('opponent', userPlayers, opponentPlayers);

    expect(result.holder).toBe('opponent');
    expect(result.territorialDominance).toBeLessThan(20);
  });

  it('posse desconhecida não trava o cálculo — usa fator neutro (50) e segue pela geometria', () => {
    const userPlayers = [player('u1', 'user', 0.5)];
    const opponentPlayers = [player('o1', 'opponent', 0.5)];

    const result = evaluateInitiative('unknown', userPlayers, opponentPlayers);

    expect(result.possessionFactor).toBe(50);
    expect(result.holder).toBe('neutral');
  });

  it('time sem nenhum jogador no estado é tratado como posicionamento neutro (0.5), não como 0', () => {
    const result = evaluateInitiative('contested', [], []);

    expect(result.territorialDominance).toBe(50);
  });

  it('score combina metade posse + metade território (posse total do usuário, território neutro)', () => {
    const result = evaluateInitiative('user', [], []);

    // possessionFactor=100 * 0.5 + territorialDominance=50 * 0.5 = 75
    expect(result.score).toBe(75);
  });
});
