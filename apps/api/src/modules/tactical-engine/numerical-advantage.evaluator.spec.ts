import { VirtualPlayer } from './tactical-game-state.type';
import { evaluateNumericalAdvantage, evaluateNumericalAdvantageAroundBall } from './numerical-advantage.evaluator';
import { PitchChannel, PitchThird } from './pitch-zone';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

describe('evaluateNumericalAdvantage', () => {
  const zone = { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL };

  it('cenário do enunciado: 3 atacantes × 2 defensores → vantagem do usuário', () => {
    const userPlayers = [
      player('u1', 'user', 0.5, 0.85),
      player('u2', 'user', 0.52, 0.86),
      player('u3', 'user', 0.48, 0.84),
    ];
    const opponentPlayers = [player('o1', 'opponent', 0.5, 0.85), player('o2', 'opponent', 0.51, 0.86)];

    const result = evaluateNumericalAdvantage(zone, userPlayers, opponentPlayers);

    expect(result).toEqual({
      zone,
      userPlayers: 3,
      opponentPlayers: 2,
      difference: 1,
      advantage: 'user',
    });
  });

  it('contagens iguais → neutro', () => {
    const userPlayers = [player('u1', 'user', 0.5, 0.85)];
    const opponentPlayers = [player('o1', 'opponent', 0.51, 0.86)];

    expect(evaluateNumericalAdvantage(zone, userPlayers, opponentPlayers).advantage).toBe('neutral');
  });

  it('mais adversários → vantagem do adversário', () => {
    const userPlayers = [player('u1', 'user', 0.5, 0.85)];
    const opponentPlayers = [player('o1', 'opponent', 0.51, 0.86), player('o2', 'opponent', 0.49, 0.84)];

    const result = evaluateNumericalAdvantage(zone, userPlayers, opponentPlayers);
    expect(result.advantage).toBe('opponent');
    expect(result.difference).toBe(-1);
  });

  it('ignora jogadores fora da zona pedida', () => {
    const userPlayers = [player('u1', 'user', 0.5, 0.85), player('far', 'user', 0.1, 0.1)];

    const result = evaluateNumericalAdvantage(zone, userPlayers, []);
    expect(result.userPlayers).toBe(1);
  });
});

describe('evaluateNumericalAdvantageAroundBall', () => {
  it('conta jogadores em zonas adjacentes à bola, não só na zona exata', () => {
    const ball = { x: 0.5, y: 0.5 }; // centro do terço do meio
    // Jogador logo à esquerda, mesma linha — zona vizinha (LEFT_HALF_SPACE), não a mesma.
    const nearbyTeammate = player('u1', 'user', 0.35, 0.5);
    // Jogador no outro extremo do campo — fora da vizinhança 3×3.
    const farTeammate = player('far', 'user', 0.01, 0.01);

    const result = evaluateNumericalAdvantageAroundBall(ball, [nearbyTeammate, farTeammate], []);

    expect(result.userPlayers).toBe(1);
  });

  it('zona reportada é a zona da bola', () => {
    const ball = { x: 0.1, y: 0.1 };
    const result = evaluateNumericalAdvantageAroundBall(ball, [], []);
    expect(result.zone).toEqual({ third: PitchThird.DEFENSIVE_THIRD, channel: PitchChannel.LEFT_CHANNEL });
  });
});
