import { StrategicPrincipleId } from './strategic-principle.type';

// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 4, Tarefa 18) — julgamento de aderência
// de UMA decisão a UM princípio do catálogo, produzido por principle-adherence.evaluator.ts.
export interface PrincipleAdherence {
  principleId: StrategicPrincipleId;
  // true = a decisão seguiu o princípio; false = violou; null = o princípio não estava em jogo
  // neste instante (ex.: PROPHYLAXIS sem pressão real a neutralizar) ou faltou dado suficiente
  // para concluir (ex.: CENTRAL_CONTROL numa ação HOLD, sem targetZone) — nunca inventado, mesma
  // regra de "sem confiança suficiente, não concluir" já aplicada em decision.evaluator.ts.
  adhered: boolean | null;
}

/**
 * Separa uma lista de PrincipleAdherence (ver evaluatePrincipleAdherence) em seguidos/violados,
 * descartando os `null` (princípio não aplicável — nunca contado como seguido nem violado).
 * Reusado tanto por AiCoachService.explainDecision (Fase 5, Tarefa 23-24) quanto por
 * tactical-match-report.builder.ts (Tarefa 25).
 */
export function splitPrincipleAdherence(
  adherences: PrincipleAdherence[],
): { followed: StrategicPrincipleId[]; violated: StrategicPrincipleId[] } {
  const followed: StrategicPrincipleId[] = [];
  const violated: StrategicPrincipleId[] = [];

  for (const adherence of adherences) {
    if (adherence.adhered === true) followed.push(adherence.principleId);
    else if (adherence.adhered === false) violated.push(adherence.principleId);
  }

  return { followed, violated };
}
