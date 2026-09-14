import { PlayerBuildCardStat } from './player-build.types';

/**
 * Aproximação PRÓPRIA do CoachPlay para o "overall resultante" de uma alocação de pontos — a
 * Konami não publica a fórmula oficial de overall do eFootball, então este número NUNCA deve ser
 * apresentado como o valor exato que o jogo mostraria (ver docs/efootball-architecture.md,
 * "Regra de IA": cálculo determinístico próprio, nunca fonte de verdade sobre o jogo em si).
 * Fórmula: overallBase da carta (dado oficial) + média do ganho em todos os atributos
 * fornecidos, arredondada, limitada a 99 (teto universal do jogo).
 */
export function estimateOverall(
  overallBase: number,
  stats: PlayerBuildCardStat[],
  expectedAttributes: Record<string, number>,
): number {
  if (stats.length === 0) return overallBase;

  const totalDelta = stats.reduce(
    (sum, s) => sum + ((expectedAttributes[s.statKey] ?? s.baseValue) - s.baseValue),
    0,
  );
  const avgDelta = totalDelta / stats.length;

  return Math.min(99, Math.round(overallBase + avgDelta));
}
