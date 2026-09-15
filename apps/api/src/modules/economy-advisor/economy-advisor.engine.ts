import { resolvePositionGroup } from '../player-build-engine/player-build-engine.config';
import { NEUTRAL_THRESHOLD, RECOMMENDATION_WEIGHTS, RECOMMENDED_THRESHOLD } from './economy-advisor.config';

export type EconomyRecommendationResult = 'RECOMMENDED' | 'NEUTRAL' | 'NOT_RECOMMENDED' | 'INSUFFICIENT_DATA';

export interface EconomyTarget {
  playerCardId: string;
  /** null = não verificado — REGRA: nunca inventar probabilidade de pack. */
  probability: number | null;
  overallBase: number;
  position: string;
}

export interface EconomyAdvisorInput {
  userCoins: number;
  packCost: number;
  targets: EconomyTarget[];
  ownedPlayerCardIds: string[];
  /** "needs" — grupos posicionais fracos do elenco (ex.: saída do Squad Builder, Tarefa 9).
   * Vazio = nenhuma necessidade conhecida, nunca assumida. */
  weakPositionGroups: string[];
}

export interface EconomyAdvisorResult {
  recommendation: EconomyRecommendationResult;
  teamNeedScore: number;
  duplicateRisk: number;
  expectedValue: number | null;
  coinRisk: number;
  recommendationScore: number | null;
  reasons: string[];
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function isNeeded(target: EconomyTarget, weakPositionGroups: string[]): boolean {
  try {
    return weakPositionGroups.includes(resolvePositionGroup(target.position));
  } catch {
    return false;
  }
}

/**
 * Motor determinístico do Economy Advisor (Tarefa 11) — sem IA. `teamNeedScore`/`duplicateRisk`
 * não dependem de probabilidade (informam mesmo sem odds); `expectedValue`/`recommendationScore`
 * exigem odds verificadas — sem elas, a recomendação é sempre INSUFFICIENT_DATA (Regra de dados:
 * nunca inventar probabilidade de pack).
 */
export function evaluatePack(input: EconomyAdvisorInput): EconomyAdvisorResult {
  if (input.targets.length === 0) {
    throw new Error('Pack sem nenhum jogador-alvo informado');
  }

  const teamNeedScore = average(input.targets.map((t) => (isNeeded(t, input.weakPositionGroups) ? 1 : 0)));
  const duplicateRisk = average(
    input.targets.map((t) => (input.ownedPlayerCardIds.includes(t.playerCardId) ? 1 : 0)),
  );
  const coinRisk = input.userCoins <= 0 ? 1 : Math.min(1, input.packCost / input.userCoins);
  const canAfford = input.userCoins >= input.packCost;

  const reasons: string[] = [];
  if (input.weakPositionGroups.length > 0) {
    reasons.push(`Necessidades do elenco: ${input.weakPositionGroups.join(', ')}`);
  }
  if (!canAfford) {
    reasons.push(`Custo do pack (${input.packCost}) maior que as moedas disponíveis (${input.userCoins})`);
  }

  const hasOdds = input.targets.some((t) => t.probability !== null);
  const validOdds = input.targets.every(
    (t) => t.probability === null || (Number.isFinite(t.probability) && t.probability! >= 0 && t.probability! <= 1),
  );

  if (!hasOdds) {
    reasons.push('Pack sem nenhuma probabilidade verificada');
    return {
      recommendation: 'INSUFFICIENT_DATA',
      teamNeedScore,
      duplicateRisk,
      expectedValue: null,
      coinRisk,
      recommendationScore: null,
      reasons,
    };
  }
  if (!validOdds) {
    reasons.push('Probabilidades do pack fora da faixa válida (0–1) — dado não confiável');
    return {
      recommendation: 'INSUFFICIENT_DATA',
      teamNeedScore,
      duplicateRisk,
      expectedValue: null,
      coinRisk,
      recommendationScore: null,
      reasons,
    };
  }

  const knownTargets = input.targets.filter((t) => t.probability !== null);
  const expectedValue = knownTargets.reduce(
    (sum, t) => sum + t.probability! * (t.overallBase / 99),
    0,
  );

  const recommendationScore = Math.max(
    0,
    Math.min(
      1,
      (RECOMMENDATION_WEIGHTS.teamNeed * teamNeedScore +
        RECOMMENDATION_WEIGHTS.expectedValue * Math.min(1, expectedValue) +
        RECOMMENDATION_WEIGHTS.coinSafety * (1 - coinRisk)) *
        (1 - duplicateRisk),
    ),
  );

  let recommendation: EconomyRecommendationResult;
  if (!canAfford) {
    recommendation = 'NOT_RECOMMENDED';
    reasons.push('Recomendação forçada para NOT_RECOMMENDED: moedas insuficientes para o custo do pack');
  } else if (recommendationScore >= RECOMMENDED_THRESHOLD) {
    recommendation = 'RECOMMENDED';
  } else if (recommendationScore >= NEUTRAL_THRESHOLD) {
    recommendation = 'NEUTRAL';
  } else {
    recommendation = 'NOT_RECOMMENDED';
  }

  if (duplicateRisk >= 0.5) {
    reasons.push('Alto risco de duplicar jogadores que o usuário já possui');
  }

  return { recommendation, teamNeedScore, duplicateRisk, expectedValue, coinRisk, recommendationScore, reasons };
}
