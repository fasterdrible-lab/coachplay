import { VirtualPlayer, TacticalGameState } from './tactical-game-state.type';
import { DecisionContext } from './decision-context.type';

// Ver TASKS.md (Fase 7, Tarefa 34) — dataset de fixtures reutilizável entre specs e testes de
// integração/performance. Só código de apoio a teste (nenhum arquivo de produção importa este
// módulo) — os cenários abaixo espelham os já usados isoladamente em specs de fases anteriores
// (decision.evaluator.spec.ts, defensive-balance.evaluator.spec.ts,
// overload-switch.evaluator.spec.ts); specs existentes NÃO foram migradas para reduzir esta
// mudança a um dataset novo, sem tocar suítes já passando — consumidores novos (ex.: os testes
// de integração desta mesma fase) devem preferir este arquivo em vez de duplicar builders.

export function buildVirtualPlayer(
  trackingId: string,
  team: 'user' | 'opponent',
  x: number,
  y: number,
  confidence = 0.9,
): VirtualPlayer {
  return { trackingId, team, position: { x, y }, confidence };
}

export function buildDecisionContext(
  ballCarrier: VirtualPlayer,
  userPlayers: VirtualPlayer[],
  opponentPlayers: VirtualPlayer[],
  overrides: Partial<Omit<TacticalGameState, 'userPlayers' | 'opponentPlayers'>> = {},
): DecisionContext {
  return {
    gameState: {
      matchId: overrides.matchId ?? 'fixture-match',
      timestampMs: overrides.timestampMs ?? 0,
      possession: overrides.possession ?? 'user',
      ball: overrides.ball !== undefined ? overrides.ball : ballCarrier.position,
      userPlayers,
      opponentPlayers,
      controlledPlayerId: overrides.controlledPlayerId ?? ballCarrier.trackingId,
      confidence: overrides.confidence ?? 0.9,
    },
    ballCarrierId: ballCarrier.trackingId,
  };
}

/**
 * Passe central bloqueado sob pressão × alternativa lateral livre — o "critério de sucesso"
 * descrito em docs/tactical-engine-domain.md, também usado (independentemente) em
 * decision.evaluator.spec.ts.
 */
export function pressuredCentralPassFixture(): DecisionContext {
  const carrier = buildVirtualPlayer('carrier', 'user', 0.5, 0.5);
  const centralTarget = buildVirtualPlayer('central', 'user', 0.5, 0.6);
  const lateralTarget = buildVirtualPlayer('lateral', 'user', 0.75, 0.52);
  const progressiveTarget = buildVirtualPlayer('progressive', 'user', 0.55, 0.75);
  const pressers = [buildVirtualPlayer('p1', 'opponent', 0.52, 0.48), buildVirtualPlayer('p2', 'opponent', 0.48, 0.52)];
  const blocker = buildVirtualPlayer('blocker', 'opponent', 0.5, 0.58);
  const marker = buildVirtualPlayer('marker', 'opponent', 0.56, 0.73);

  return buildDecisionContext(
    carrier,
    [carrier, centralTarget, lateralTarget, progressiveTarget],
    [...pressers, blocker, marker],
  );
}

/** Reciclagem segura no próprio campo, sem pressão nenhuma — DefensiveSafetyScore alto. */
export function safeRecyclingFixture(): DecisionContext {
  const carrier = buildVirtualPlayer('carrier', 'user', 0.3, 0.2);
  const teammates = [
    buildVirtualPlayer('gk', 'user', 0.5, 0.05),
    buildVirtualPlayer('cb1', 'user', 0.35, 0.15),
    buildVirtualPlayer('cb2', 'user', 0.65, 0.15),
    buildVirtualPlayer('rb', 'user', 0.5, 0.22),
  ];

  return buildDecisionContext(carrier, [carrier, ...teammates], []);
}

/** Contra-ataque adversário 3×2 — DefensiveSafetyScore baixo, superioridade numérica do adversário. */
export function counterAttackThreeVsTwoFixture(): DecisionContext {
  const carrier = buildVirtualPlayer('carrier', 'user', 0.5, 0.85);
  const support = buildVirtualPlayer('support', 'user', 0.6, 0.8);
  const opponents = [
    buildVirtualPlayer('o1', 'opponent', 0.4, 0.9),
    buildVirtualPlayer('o2', 'opponent', 0.55, 0.92),
    buildVirtualPlayer('o3', 'opponent', 0.6, 0.88),
  ];

  return buildDecisionContext(carrier, [carrier, support], opponents);
}

/** Sobrecarga numérica clara no último terço central (3×1 do usuário). */
export function centralOverloadFixture(): DecisionContext {
  const carrier = buildVirtualPlayer('carrier', 'user', 0.5, 0.85);
  const teammates = [buildVirtualPlayer('u2', 'user', 0.52, 0.86), buildVirtualPlayer('u3', 'user', 0.48, 0.84)];
  const opponent = buildVirtualPlayer('o1', 'opponent', 0.5, 0.85);

  return buildDecisionContext(carrier, [carrier, ...teammates], [opponent]);
}

/** Estado com confiança abaixo do limiar mínimo (Tarefa 29/30) — o motor deve se recusar a
 * concluir qualquer avaliação a partir daqui. */
export function lowConfidenceStateFixture(): DecisionContext {
  const carrier = buildVirtualPlayer('carrier', 'user', 0.5, 0.5, 0.2);
  return buildDecisionContext(carrier, [carrier], [], { confidence: 0.9 });
}

// Formação genérica 4-4-2 (11 posições, GK incluído) — usada só para dar volume realista de
// jogadores aos testes de integração/performance (Tarefas 31-33); a disposição tática exata não
// importa para esses testes, só a contagem.
const FORMATION_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 0.5, y: 0.05 },
  { x: 0.2, y: 0.2 },
  { x: 0.4, y: 0.18 },
  { x: 0.6, y: 0.18 },
  { x: 0.8, y: 0.2 },
  { x: 0.15, y: 0.45 },
  { x: 0.4, y: 0.42 },
  { x: 0.6, y: 0.42 },
  { x: 0.85, y: 0.45 },
  { x: 0.4, y: 0.7 },
  { x: 0.6, y: 0.7 },
];

function buildFormation(team: 'user' | 'opponent'): VirtualPlayer[] {
  return FORMATION_POSITIONS.map((position, index) => buildVirtualPlayer(`${team}-${index}`, team, position.x, position.y));
}

/**
 * Elenco completo (11×11), times em formações espelhadas (o adversário defende do lado oposto
 * do mesmo eixo y — ver docs/tactical-engine-domain.md, PitchCoordinate). Portador da bola é um
 * dos atacantes do usuário.
 */
export function fullSquadFixture(): DecisionContext {
  const userPlayers = buildFormation('user');
  const opponentPlayers = buildFormation('opponent').map((player) => ({
    ...player,
    position: { x: player.position.x, y: 1 - player.position.y },
  }));
  const carrier = userPlayers[9];

  return buildDecisionContext(carrier, userPlayers, opponentPlayers);
}
