import { TacticalActionType } from './tactical-action.type';
import { DecisionClassification } from './decision-classification';
import { StrategicPrincipleId } from './strategic-principle.type';

// Ver TASKS.md (Fase 5, Tarefa 26) — equivalente estruturado da timeline "Lances da partida" já
// exibida em apps/web (match report page), mas alimentada pelo Tactical Engine em vez de
// DetectedError sintético. Um item por decisão avaliada, em ordem cronológica.
export interface TacticalTimelineEntry {
  timestampMs: number;
  actionType: TacticalActionType;
  classification: DecisionClassification;
  scoreTotal: number;
  principlesViolated: StrategicPrincipleId[];
}
