import { DecisionContext } from './decision-context.type';
import { TacticalAction } from './tactical-action.type';
import { DecisionScore } from './decision-score.type';
import { VirtualPlayer } from './tactical-game-state.type';
import { evaluatePrincipleAdherence } from './principle-adherence.evaluator';
import { PitchChannel, PitchThird } from './pitch-zone';

function player(trackingId: string, team: 'user' | 'opponent', x: number, y: number): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence: 0.9 };
}

function buildContext(overrides: {
  userPlayers?: VirtualPlayer[];
  opponentPlayers?: VirtualPlayer[];
  possession?: DecisionContext['gameState']['possession'];
  ball?: DecisionContext['gameState']['ball'];
}): DecisionContext {
  const ballCarrier = player('u1', 'user', 0.5, 0.5);
  return {
    gameState: {
      matchId: 'match-1',
      timestampMs: 1000,
      possession: overrides.possession ?? 'user',
      ball: overrides.ball ?? null,
      userPlayers: overrides.userPlayers ?? [ballCarrier],
      opponentPlayers: overrides.opponentPlayers ?? [],
      controlledPlayerId: 'u1',
      confidence: 0.9,
    },
    ballCarrierId: 'u1',
  };
}

function action(overrides: Partial<TacticalAction> = {}): TacticalAction {
  return { type: 'PASS', estimatedRisk: 20, estimatedReward: 60, ...overrides };
}

function score(overrides: Partial<DecisionScore> = {}): DecisionScore {
  return {
    total: 50,
    possessionSafety: 50,
    progression: 50,
    spaceCreation: 50,
    defensiveBalance: 50,
    futureOptions: 50,
    pressureManagement: 50,
    ...overrides,
  };
}

function adherenceOf(results: ReturnType<typeof evaluatePrincipleAdherence>, id: string) {
  return results.find((result) => result.principleId === id)!.adhered;
}

describe('evaluatePrincipleAdherence', () => {
  it('CENTRAL_CONTROL: ação para corredor central com boa progressão → aderiu', () => {
    const context = buildContext({});
    const result = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL } }),
      score({ progression: 80 }),
    );
    expect(adherenceOf(result, 'CENTRAL_CONTROL')).toBe(true);
  });

  it('CENTRAL_CONTROL: ação para corredor lateral → violou, independente da progressão', () => {
    const context = buildContext({});
    const result = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.LEFT_CHANNEL } }),
      score({ progression: 90 }),
    );
    expect(adherenceOf(result, 'CENTRAL_CONTROL')).toBe(false);
  });

  it('CENTRAL_CONTROL: ação sem targetZone (HOLD) → não aplicável', () => {
    const context = buildContext({});
    const result = evaluatePrincipleAdherence(context, action({ type: 'HOLD', targetZone: undefined }), score());
    expect(adherenceOf(result, 'CENTRAL_CONTROL')).toBeNull();
  });

  it('PIECE_ACTIVITY: segue direto o componente pressureManagement do DecisionScore', () => {
    const context = buildContext({});
    const good = evaluatePrincipleAdherence(context, action(), score({ pressureManagement: 80 }));
    const bad = evaluatePrincipleAdherence(context, action(), score({ pressureManagement: 30 }));
    expect(adherenceOf(good, 'PIECE_ACTIVITY')).toBe(true);
    expect(adherenceOf(bad, 'PIECE_ACTIVITY')).toBe(false);
  });

  it('KING_SAFETY: segue direto o componente defensiveBalance do DecisionScore', () => {
    const context = buildContext({});
    const good = evaluatePrincipleAdherence(context, action(), score({ defensiveBalance: 70 }));
    const bad = evaluatePrincipleAdherence(context, action(), score({ defensiveBalance: 40 }));
    expect(adherenceOf(good, 'KING_SAFETY')).toBe(true);
    expect(adherenceOf(bad, 'KING_SAFETY')).toBe(false);
  });

  it('SPACE_EXPANSION: segue direto o componente spaceCreation do DecisionScore', () => {
    const context = buildContext({});
    const good = evaluatePrincipleAdherence(context, action(), score({ spaceCreation: 65 }));
    const bad = evaluatePrincipleAdherence(context, action(), score({ spaceCreation: 30 }));
    expect(adherenceOf(good, 'SPACE_EXPANSION')).toBe(true);
    expect(adherenceOf(bad, 'SPACE_EXPANSION')).toBe(false);
  });

  it('INITIATIVE: domínio territorial e posse do usuário → aderiu', () => {
    const context = buildContext({
      possession: 'user',
      userPlayers: [player('u1', 'user', 0.5, 0.8)],
      opponentPlayers: [player('o1', 'opponent', 0.6, 0.85)],
    });
    const result = evaluatePrincipleAdherence(context, action(), score());
    expect(adherenceOf(result, 'INITIATIVE')).toBe(true);
  });

  it('INITIATIVE: domínio territorial e posse do adversário → violou', () => {
    const context = buildContext({
      possession: 'opponent',
      userPlayers: [player('u1', 'user', 0.5, 0.1)],
      opponentPlayers: [player('o1', 'opponent', 0.6, 0.05)],
    });
    const result = evaluatePrincipleAdherence(context, action(), score());
    expect(adherenceOf(result, 'INITIATIVE')).toBe(false);
  });

  it('INITIATIVE: jogo equilibrado → não aplicável', () => {
    const context = buildContext({
      possession: 'contested',
      userPlayers: [player('u1', 'user', 0.5, 0.5)],
      opponentPlayers: [player('o1', 'opponent', 0.6, 0.5)],
    });
    const result = evaluatePrincipleAdherence(context, action(), score());
    expect(adherenceOf(result, 'INITIATIVE')).toBeNull();
  });

  it('PROPHYLAXIS: sem pressão real sobre o portador → não aplicável', () => {
    const context = buildContext({
      userPlayers: [player('u1', 'user', 0.5, 0.5)],
      opponentPlayers: [player('o1', 'opponent', 0.9, 0.9)],
    });
    const result = evaluatePrincipleAdherence(context, action(), score({ possessionSafety: 20 }));
    expect(adherenceOf(result, 'PROPHYLAXIS')).toBeNull();
  });

  it('PROPHYLAXIS: sob pressão alta, prioriza segurança de posse → aderiu/violou conforme possessionSafety', () => {
    const context = buildContext({
      userPlayers: [player('u1', 'user', 0.5, 0.5)],
      opponentPlayers: [player('o1', 'opponent', 0.5, 0.5)],
    });
    const good = evaluatePrincipleAdherence(context, action(), score({ possessionSafety: 80 }));
    const bad = evaluatePrincipleAdherence(context, action(), score({ possessionSafety: 30 }));
    expect(adherenceOf(good, 'PROPHYLAXIS')).toBe(true);
    expect(adherenceOf(bad, 'PROPHYLAXIS')).toBe(false);
  });

  it('OVERLOAD: nenhuma zona com vantagem numérica clara → não aplicável', () => {
    const context = buildContext({ userPlayers: [player('u1', 'user', 0.5, 0.5)], opponentPlayers: [] });
    const result = evaluatePrincipleAdherence(context, action(), score());
    expect(adherenceOf(result, 'OVERLOAD')).toBeNull();
  });

  it('OVERLOAD: ação mira a zona de sobrecarga → aderiu', () => {
    const context = buildContext({
      userPlayers: [player('u1', 'user', 0.5, 0.5), player('u2', 'user', 0.5, 0.5), player('u3', 'user', 0.5, 0.5)],
      opponentPlayers: [],
    });
    const result = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.MIDDLE_THIRD, channel: PitchChannel.CENTRAL_CHANNEL } }),
      score(),
    );
    expect(adherenceOf(result, 'OVERLOAD')).toBe(true);
  });

  it('OVERLOAD: existe sobrecarga em outra zona, mas a ação ignora e mira outra → violou', () => {
    const context = buildContext({
      userPlayers: [player('u1', 'user', 0.5, 0.5), player('u2', 'user', 0.5, 0.5), player('u3', 'user', 0.5, 0.5)],
      opponentPlayers: [],
    });
    const result = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.DEFENSIVE_THIRD, channel: PitchChannel.LEFT_CHANNEL } }),
      score(),
    );
    expect(adherenceOf(result, 'OVERLOAD')).toBe(false);
  });

  it('WEAKNESS_EXPLOITATION: fora do terço final → não aplicável', () => {
    const context = buildContext({});
    const result = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.MIDDLE_THIRD, channel: PitchChannel.CENTRAL_CHANNEL } }),
      score({ spaceCreation: 90 }),
    );
    expect(adherenceOf(result, 'WEAKNESS_EXPLOITATION')).toBeNull();
  });

  it('WEAKNESS_EXPLOITATION: terço final com espaço livre → aderiu; sem espaço → violou', () => {
    const context = buildContext({});
    const good = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL } }),
      score({ spaceCreation: 70 }),
    );
    const bad = evaluatePrincipleAdherence(
      context,
      action({ targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL } }),
      score({ spaceCreation: 30 }),
    );
    expect(adherenceOf(good, 'WEAKNESS_EXPLOITATION')).toBe(true);
    expect(adherenceOf(bad, 'WEAKNESS_EXPLOITATION')).toBe(false);
  });

  it('lança erro explícito quando ballCarrierId não corresponde a nenhum jogador do usuário', () => {
    const context = buildContext({ userPlayers: [] });
    expect(() => evaluatePrincipleAdherence(context, action(), score())).toThrow();
  });

  it('retorna exatamente os 8 princípios do catálogo, em ordem estável', () => {
    const context = buildContext({});
    const result = evaluatePrincipleAdherence(context, action(), score());
    expect(result).toHaveLength(8);
    expect(result.map((r) => r.principleId)).toEqual([
      'CENTRAL_CONTROL',
      'PIECE_ACTIVITY',
      'KING_SAFETY',
      'SPACE_EXPANSION',
      'INITIATIVE',
      'PROPHYLAXIS',
      'OVERLOAD',
      'WEAKNESS_EXPLOITATION',
    ]);
  });
});
