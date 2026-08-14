import { DecisionContext } from './decision-context.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { evaluateConfidence } from './confidence.evaluator';

function player(trackingId: string, confidence: number): VirtualPlayer {
  return { trackingId, team: 'user', position: { x: 0.5, y: 0.5 }, confidence };
}

function buildContext(overrides: {
  gameStateConfidence?: number;
  userPlayers?: VirtualPlayer[];
  ballCarrierId?: string;
}): DecisionContext {
  return {
    gameState: {
      matchId: 'match-1',
      timestampMs: 1000,
      possession: 'user',
      ball: null,
      userPlayers: overrides.userPlayers ?? [player('carrier', 0.9)],
      opponentPlayers: [],
      confidence: overrides.gameStateConfidence ?? 0.9,
    },
    ballCarrierId: overrides.ballCarrierId ?? 'carrier',
  };
}

describe('evaluateConfidence', () => {
  it('usa o MENOR sinal entre snapshot, portador e alvo — nunca o mais otimista', () => {
    const context = buildContext({
      gameStateConfidence: 0.9,
      userPlayers: [player('carrier', 0.8), player('target', 0.6)],
    });

    const result = evaluateConfidence(context, 'target');

    expect(result.score).toBe(0.6);
  });

  it('score >= 0.5 é suficiente', () => {
    const context = buildContext({ gameStateConfidence: 0.5, userPlayers: [player('carrier', 0.5)] });

    expect(evaluateConfidence(context).sufficient).toBe(true);
  });

  it('score < 0.5 é insuficiente', () => {
    const context = buildContext({ gameStateConfidence: 0.9, userPlayers: [player('carrier', 0.49)] });

    expect(evaluateConfidence(context).sufficient).toBe(false);
  });

  it('sem targetPlayerId, ignora a confiança do alvo (não se aplica)', () => {
    const context = buildContext({
      gameStateConfidence: 0.9,
      userPlayers: [player('carrier', 0.9), player('target', 0.1)],
    });

    expect(evaluateConfidence(context).sufficient).toBe(true);
  });

  it('portador não encontrado no estado: usa só os sinais disponíveis, sem inventar', () => {
    const context = buildContext({ gameStateConfidence: 0.9, userPlayers: [], ballCarrierId: 'missing' });

    expect(evaluateConfidence(context).score).toBe(0.9);
  });

  it('nenhum sinal disponível: score 0, insuficiente', () => {
    const context: DecisionContext = {
      gameState: {
        matchId: 'match-1',
        timestampMs: 0,
        possession: 'unknown',
        ball: null,
        userPlayers: [],
        opponentPlayers: [],
        confidence: undefined as unknown as number,
      },
      ballCarrierId: 'missing',
    };

    const result = evaluateConfidence(context);
    expect(result.score).toBe(0);
    expect(result.sufficient).toBe(false);
  });
});
