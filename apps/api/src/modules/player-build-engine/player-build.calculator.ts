import {
  PLAYER_BUILD_ENGINE_CONFIG_VERSION,
  POSITION_STAT_PROFILES,
  STRATEGY_WEIGHTS,
  resolvePositionGroup,
} from './player-build-engine.config';
import { allocatePoints } from './allocation.engine';
import { PlayerBuildInput, PlayerBuildResult, StatGain } from './player-build.types';

function resolveWeights(input: PlayerBuildInput) {
  if (input.strategy === 'POSITION_OPTIMIZED') {
    return POSITION_STAT_PROFILES[resolvePositionGroup(input.position)];
  }
  return STRATEGY_WEIGHTS[input.strategy];
}

/** Exportado para reuso pelo módulo player-builds (Tarefa 6, comparador) — mede o quão adequado
 * um conjunto de atributos é para uma posição, independente de qual estratégia os gerou. */
export function computeRoleScoreForPosition(
  expectedAttributes: Record<string, number>,
  position: string,
): number {
  const profile = POSITION_STAT_PROFILES[resolvePositionGroup(position)];
  const entries = Object.entries(profile).filter(([key]) => key in expectedAttributes);
  if (entries.length === 0) return 0;

  const totalWeight = entries.reduce((sum, [, weight]) => sum + (weight ?? 0), 0);
  const weightedSum = entries.reduce(
    (sum, [key, weight]) => sum + (weight ?? 0) * expectedAttributes[key],
    0,
  );

  return Math.round(Math.min(100, Math.max(0, weightedSum / totalWeight)));
}

/**
 * Motor determinístico do Player Build Engine (Tarefa 5) — sem chamada de IA. Toda decisão de
 * "onde investir pontos" vem de player-build-engine.config.ts (algoritmo próprio do CoachPlay);
 * todo valor de atributo (base/máximo) vem de `stats`, sempre populado a partir de dado validado
 * (nunca inventado aqui). Mesma entrada sempre produz a mesma saída (sem Math.random/Date.now no
 * caminho de cálculo).
 */
export function computeBuild(input: PlayerBuildInput): PlayerBuildResult {
  if (!Number.isInteger(input.level) || input.level < 1 || input.level > input.playerCard.maxLevel) {
    throw new Error(
      `level inválido: ${input.level} (deve ser um inteiro entre 1 e ${input.playerCard.maxLevel})`,
    );
  }
  if (!Number.isInteger(input.availableProgressionPoints) || input.availableProgressionPoints < 0) {
    throw new Error(
      `availableProgressionPoints inválido: ${input.availableProgressionPoints} (deve ser um inteiro >= 0)`,
    );
  }
  if (input.stats.length === 0) {
    throw new Error(
      `PlayerCard "${input.playerCard.id}" não tem nenhum atributo importado — sem dado oficial, sem cálculo de build`,
    );
  }

  const weights = resolveWeights(input);
  const allocation = allocatePoints(input.stats, weights, input.availableProgressionPoints);

  const expectedAttributes: Record<string, number> = {};
  const gains: StatGain[] = [];

  for (const stat of input.stats) {
    const allocated = allocation[stat.statKey] ?? 0;
    const to = Math.min(stat.maxValue, stat.baseValue + allocated);
    expectedAttributes[stat.statKey] = to;
    if (allocated > 0) {
      gains.push({ statKey: stat.statKey, from: stat.baseValue, to, delta: to - stat.baseValue });
    }
  }

  gains.sort((a, b) => b.delta - a.delta || a.statKey.localeCompare(b.statKey));

  const totalPointsUsed = Object.values(allocation).reduce((sum, v) => sum + v, 0);
  const positionGroup = resolvePositionGroup(input.position);

  return {
    playerCardId: input.playerCard.id,
    strategy: input.strategy,
    position: input.position,
    level: input.level,
    totalPointsAvailable: input.availableProgressionPoints,
    totalPointsUsed,
    recommendedAllocation: allocation,
    expectedAttributes,
    roleScore: computeRoleScoreForPosition(expectedAttributes, input.position),
    explanationData: {
      strategy: input.strategy,
      position: input.position,
      positionGroup,
      desiredRole: input.desiredRole,
      userStyle: input.userStyle,
      prioritizedStats: Object.entries(weights)
        .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
        .map(([key]) => key),
      topGains: gains.slice(0, 5),
      engineVersion: PLAYER_BUILD_ENGINE_CONFIG_VERSION,
    },
  };
}
