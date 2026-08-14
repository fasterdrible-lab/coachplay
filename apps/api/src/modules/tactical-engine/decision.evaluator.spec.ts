import { VirtualPlayer } from './tactical-game-state.type';
import { DecisionContext } from './decision-context.type';
import { evaluateDecision } from './decision.evaluator';
import { classifyDecisionScore } from './decision-classification';

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

describe('evaluateDecision', () => {
  it('critério de sucesso do plano: passe central bloqueado sob pressão é pior que a alternativa lateral segura', () => {
    // Portador no meio de campo, dois adversários pressionando; três opções: central
    // bloqueada, lateral segura, progressiva marcada de perto (risco médio-alto).
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const centralTarget = player('central', 'user', 0.5, 0.6); // à frente, mesmo canal, progressão abaixo do limiar de PROGRESSIVE_PASS
    const lateralTarget = player('lateral', 'user', 0.75, 0.52); // canal lateral, livre
    const progressiveTarget = player('progressive', 'user', 0.55, 0.75); // avanço maior, mas marcado

    const pressers = [player('p1', 'opponent', 0.52, 0.48), player('p2', 'opponent', 0.48, 0.52)];
    const blocker = player('blocker', 'opponent', 0.5, 0.58); // no meio do caminho até `central`
    const marker = player('marker', 'opponent', 0.56, 0.73); // colado em `progressive`

    const context = buildContext(
      carrier,
      [carrier, centralTarget, lateralTarget, progressiveTarget],
      [...pressers, blocker, marker],
    );

    const evaluation = evaluateDecision(context, { type: 'PASS', targetPlayerId: 'central' });

    expect(evaluation).not.toBeNull();
    expect(evaluation!.bestAlternative?.targetPlayerId).toBe('lateral');
    expect(evaluation!.actualScore.total).toBeLessThan(evaluation!.bestAlternativeScore!.total);
    expect(evaluation!.scoreDifference).toBeLessThan(0);
    expect(['RISKY', 'ERROR', 'MAJOR_ERROR']).toContain(evaluation!.classification);
  });

  it('retorna null quando a ação real não corresponde a nenhuma candidata gerada (sem confiança suficiente)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    // Nenhum companheiro em campo — "passe para X" não é uma candidata possível.
    expect(evaluateDecision(context, { type: 'PASS', targetPlayerId: 'nao-existe' })).toBeNull();
  });

  it('retorna null quando o ballCarrierId do contexto não existe no estado', () => {
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

    expect(evaluateDecision(context, { type: 'HOLD' })).toBeNull();
  });

  it('classification é sempre consistente com classifyDecisionScore(actualScore.total)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    const evaluation = evaluateDecision(context, { type: 'HOLD' });

    expect(evaluation!.classification).toBe(classifyDecisionScore(evaluation!.actualScore.total));
  });

  it('sem alternativas além da própria ação real: bestAlternative ainda cobre outras ações disponíveis (CARRY/HOLD)', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const context = buildContext(carrier, [carrier], []);

    const evaluation = evaluateDecision(context, { type: 'HOLD' });

    expect(evaluation!.bestAlternative?.type).toBe('CARRY');
  });

  it('quando a ação real já é a melhor disponível, scoreDifference é >= 0', () => {
    const carrier = player('carrier', 'user', 0.5, 0.5);
    const safeMate = player('mate', 'user', 0.75, 0.52);
    const context = buildContext(carrier, [carrier, safeMate], []);

    const evaluation = evaluateDecision(context, { type: 'SAFE_PASS', targetPlayerId: 'mate' });

    expect(evaluation!.scoreDifference).toBeGreaterThanOrEqual(0);
  });

  it('retorna null quando a confiança do estado é insuficiente, mesmo com candidata válida (Tarefa 29/30)', () => {
    const carrier: VirtualPlayer = { trackingId: 'carrier', team: 'user', position: { x: 0.5, y: 0.5 }, confidence: 0.3 };
    const context = buildContext(carrier, [carrier], []);

    expect(evaluateDecision(context, { type: 'HOLD' })).toBeNull();
  });
});
