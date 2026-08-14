import { DecisionClassification } from './decision-classification';
import { StrategicPrincipleId } from './strategic-principle.type';

// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 5, Tarefa 24) — "novo formato de
// feedback": diferente do texto solto de CoachFeedback.message (Fase 2, ver
// ai-coach.service.ts/generateEventFeedback), este formato SEMPRE carrega, ao lado do texto
// gerado por IA, os campos estruturados e determinísticos que o sustentam (classificação,
// diferença de nota, princípios seguidos/violados) — o texto explica, nunca decide; quem decide
// é sempre o motor (ver docs/tactical-engine-current-state.md, risco 4: "nenhum novo consumo de
// IA generativa pode calcular score"). Produzido por AiCoachService.explainDecision()
// (ai-coach.service.ts, Tarefa 23) a partir de um DecisionEvaluation (Fase 3) + suas
// PrincipleAdherence (Fase 4) já resolvidas.
export interface TacticalDecisionFeedback {
  explanation: string;
  classification: DecisionClassification;
  scoreDifference: number;
  principlesFollowed: StrategicPrincipleId[];
  principlesViolated: StrategicPrincipleId[];
}
