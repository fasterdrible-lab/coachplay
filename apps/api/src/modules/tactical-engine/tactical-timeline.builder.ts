import { EvaluatedDecisionRecord } from './evaluated-decision-record.type';
import { TacticalTimelineEntry } from './tactical-timeline.type';
import { splitPrincipleAdherence } from './principle-adherence.type';

/**
 * Constrói a timeline de decisões de uma partida (Tarefa 26) — um item por
 * EvaluatedDecisionRecord, em ordem cronológica. Puramente uma projeção/ordenação, sem
 * recalcular nada; não muta a entrada.
 */
export function buildTacticalTimeline(records: EvaluatedDecisionRecord[]): TacticalTimelineEntry[] {
  return [...records]
    .sort((a, b) => a.timestampMs - b.timestampMs)
    .map((record) => ({
      timestampMs: record.timestampMs,
      actionType: record.action.type,
      classification: record.classification,
      scoreTotal: record.score.total,
      principlesViolated: splitPrincipleAdherence(record.principles).violated,
    }));
}
