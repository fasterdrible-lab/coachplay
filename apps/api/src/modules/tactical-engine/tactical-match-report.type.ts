import { DecisionClassification } from './decision-classification';
import { StrategicPrincipleId } from './strategic-principle.type';
import { TacticalSequence } from './tactical-sequence.type';

export interface PrincipleFrequency {
  principleId: StrategicPrincipleId;
  count: number;
}

// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 5, Tarefa 25) — relatório pós-jogo do
// Tactical Engine, agregando as decisões avaliadas de UMA partida. Complementa (não substitui)
// o MatchReport existente (reports.service.ts) — MatchReport.decisionScore hoje vem de erros
// sintéticos de categoria "decisao"/"posicionamento" (ver
// docs/tactical-engine-current-state.md, seção 4); a integração dos dois relatórios fica para
// quando existir uma fonte real de TacticalGameState (fora do escopo desta fase).
export interface TacticalMatchReport {
  matchId: string;
  decisionCount: number;
  averageDecisionScore: number | null; // null quando decisionCount === 0 — nunca inventa 0
  classificationBreakdown: Record<DecisionClassification, number>;
  principlesFollowed: PrincipleFrequency[]; // ordenado por count decrescente
  principlesViolated: PrincipleFrequency[]; // ordenado por count decrescente
  sequences: TacticalSequence[];
}
