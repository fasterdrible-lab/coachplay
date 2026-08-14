import { EvaluatedDecisionRecord } from './evaluated-decision-record.type';
import { PrincipleFrequency, TacticalMatchReport } from './tactical-match-report.type';
import { DecisionClassification } from './decision-classification';
import { StrategicPrincipleId } from './strategic-principle.type';
import { splitPrincipleAdherence } from './principle-adherence.type';
import { detectTacticalSequences } from './tactical-sequence.detector';

const CLASSIFICATIONS: DecisionClassification[] = ['EXCELLENT', 'GOOD', 'ACCEPTABLE', 'RISKY', 'ERROR', 'MAJOR_ERROR'];

/**
 * Agrega EvaluatedDecisionRecord (uma decisão já avaliada + julgada quanto a princípios) de UMA
 * partida num TacticalMatchReport (Tarefa 25). Puramente determinístico — reusa
 * detectTacticalSequences (Fase 3) para as sequências, sem duplicar a lógica.
 */
export function buildTacticalMatchReport(matchId: string, records: EvaluatedDecisionRecord[]): TacticalMatchReport {
  const classificationBreakdown = buildEmptyBreakdown();
  const followedCounts = new Map<StrategicPrincipleId, number>();
  const violatedCounts = new Map<StrategicPrincipleId, number>();

  for (const record of records) {
    classificationBreakdown[record.classification] += 1;

    const { followed, violated } = splitPrincipleAdherence(record.principles);
    for (const principleId of followed) followedCounts.set(principleId, (followedCounts.get(principleId) ?? 0) + 1);
    for (const principleId of violated) violatedCounts.set(principleId, (violatedCounts.get(principleId) ?? 0) + 1);
  }

  const sequences = detectTacticalSequences(
    records.map((record) => ({
      timestampMs: record.timestampMs,
      action: record.action,
      pressureLevel: record.pressureLevel,
      classification: record.classification,
    })),
  );

  return {
    matchId,
    decisionCount: records.length,
    averageDecisionScore: records.length === 0 ? null : round1(average(records.map((record) => record.score.total))),
    classificationBreakdown,
    principlesFollowed: toSortedFrequencies(followedCounts),
    principlesViolated: toSortedFrequencies(violatedCounts),
    sequences,
  };
}

function buildEmptyBreakdown(): Record<DecisionClassification, number> {
  return CLASSIFICATIONS.reduce(
    (breakdown, classification) => ({ ...breakdown, [classification]: 0 }),
    {} as Record<DecisionClassification, number>,
  );
}

function toSortedFrequencies(counts: Map<StrategicPrincipleId, number>): PrincipleFrequency[] {
  return [...counts.entries()]
    .map(([principleId, count]) => ({ principleId, count }))
    .sort((a, b) => b.count - a.count);
}

function average(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}
