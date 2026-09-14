import { computeRoleScoreForPosition } from '../player-build-engine/player-build.calculator';
import { PlayerBuildCardStat } from '../player-build-engine/player-build.types';
import { resolvePositionGroup } from '../player-build-engine/player-build-engine.config';
import { estimateOverall } from '../player-build-engine/overall.util';
import { InvalidBuildError, PointsExceededError, IncompatiblePositionError } from './build-comparator.errors';
import { AppliedBuildSide, AttributeComparison, BuildComparisonResult, RawBuildInput } from './build-comparator.types';

export interface CompareBuildsParams {
  cardId: string;
  overallBase: number;
  stats: PlayerBuildCardStat[];
  position: string;
  cardPositions: string[];
  buildA: RawBuildInput;
  buildB: RawBuildInput;
}

function assertPositionCompatible(position: string, cardPositions: string[]): void {
  const targetGroup = resolvePositionGroup(position);
  const compatible = cardPositions.some((p) => resolvePositionGroup(p) === targetGroup);
  if (!compatible) {
    throw new IncompatiblePositionError(
      `Posição "${position}" incompatível com esta carta (posições da carta: ${cardPositions.join(', ')})`,
    );
  }
}

function applyAllocation(
  overallBase: number,
  stats: PlayerBuildCardStat[],
  position: string,
  input: RawBuildInput,
): AppliedBuildSide {
  if (!Number.isInteger(input.availableProgressionPoints) || input.availableProgressionPoints < 0) {
    throw new InvalidBuildError(
      `availableProgressionPoints inválido: ${input.availableProgressionPoints}`,
    );
  }

  const statByKey = new Map(stats.map((s) => [s.statKey, s]));
  const totalPointsUsed = Object.values(input.allocation).reduce((sum, v) => sum + v, 0);

  if (totalPointsUsed > input.availableProgressionPoints) {
    throw new PointsExceededError(
      `Build usa ${totalPointsUsed} pontos, mas só ${input.availableProgressionPoints} estão disponíveis`,
    );
  }

  const attributes: Record<string, number> = {};
  for (const stat of stats) attributes[stat.statKey] = stat.baseValue;

  for (const [statKey, points] of Object.entries(input.allocation)) {
    const stat = statByKey.get(statKey);
    if (!stat) {
      throw new InvalidBuildError(`Atributo "${statKey}" não existe nesta carta`);
    }
    if (!Number.isInteger(points) || points < 0) {
      throw new InvalidBuildError(`Alocação inválida para "${statKey}": ${points}`);
    }

    const value = stat.baseValue + points;
    if (value > stat.maxValue) {
      throw new InvalidBuildError(
        `Alocação para "${statKey}" ultrapassa o limite da carta (${value} > ${stat.maxValue})`,
      );
    }
    attributes[statKey] = value;
  }

  return {
    overall: estimateOverall(overallBase, stats, attributes),
    attributes,
    roleScore: computeRoleScoreForPosition(attributes, position),
    totalPointsUsed,
    totalPointsAvailable: input.availableProgressionPoints,
  };
}

function compareAttributes(a: Record<string, number>, b: Record<string, number>): AttributeComparison[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  return [...keys]
    .sort()
    .map((statKey) => ({ statKey, a: a[statKey] ?? 0, b: b[statKey] ?? 0, delta: (b[statKey] ?? 0) - (a[statKey] ?? 0) }));
}

/** Frases curtas e determinísticas (nunca geradas por IA) — a narrativa mais rica (ex.: "a Build
 * CoachPlay tem overall menor, porém atributos mais adequados") é responsabilidade do AI Coach
 * (Tarefas 10/14), que consome estes fatos, nunca os recalcula. */
function buildAdvantagesAndDisadvantages(
  buildA: AppliedBuildSide,
  buildB: AppliedBuildSide,
  attributes: AttributeComparison[],
): { advantages: string[]; disadvantages: string[] } {
  const advantages: string[] = [];
  const disadvantages: string[] = [];

  if (buildB.overall > buildA.overall) {
    advantages.push(`Overall maior (${buildB.overall} vs ${buildA.overall})`);
  } else if (buildB.overall < buildA.overall) {
    disadvantages.push(`Overall menor (${buildB.overall} vs ${buildA.overall})`);
  }

  if (buildB.roleScore > buildA.roleScore) {
    advantages.push(`Melhor encaixe na função (roleScore ${buildB.roleScore} vs ${buildA.roleScore})`);
  } else if (buildB.roleScore < buildA.roleScore) {
    disadvantages.push(`Pior encaixe na função (roleScore ${buildB.roleScore} vs ${buildA.roleScore})`);
  }

  for (const attr of attributes) {
    if (attr.delta > 0) advantages.push(`${attr.statKey} maior (${attr.b} vs ${attr.a})`);
    else if (attr.delta < 0) disadvantages.push(`${attr.statKey} menor (${attr.b} vs ${attr.a})`);
  }

  return { advantages, disadvantages };
}

/**
 * Comparador determinístico de builds (Tarefa 6) — sem chamada de IA. buildA/buildB são
 * alocações já definidas (não gera estratégias novas; isso é o player-build-engine/Tarefa 5).
 */
export function compareBuilds(params: CompareBuildsParams): BuildComparisonResult {
  assertPositionCompatible(params.position, params.cardPositions);

  const buildA = applyAllocation(params.overallBase, params.stats, params.position, params.buildA);
  const buildB = applyAllocation(params.overallBase, params.stats, params.position, params.buildB);
  const attributes = compareAttributes(buildA.attributes, buildB.attributes);
  const { advantages, disadvantages } = buildAdvantagesAndDisadvantages(buildA, buildB, attributes);

  return {
    cardId: params.cardId,
    position: params.position,
    buildA,
    buildB,
    attributes,
    advantages,
    disadvantages,
  };
}
