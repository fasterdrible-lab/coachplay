// Configuração central e versionada dos pesos do DecisionScore (Tarefa 13). Nenhum peso de
// agregação por ação vive espalhado em outro arquivo — só os 6 componentes abaixo, somando
// exatamente 1.0 (validado em decision-score.config.spec.ts). Alterar um peso aqui é uma
// mudança de produto (recalibra a nota de toda decisão já registrada) — deve subir a versão.
// Fórmula completa documentada em docs/tactical-engine-scoring.md (Tarefa 38).
export const DECISION_SCORE_CONFIG_VERSION = '1.0.0';

export const DECISION_SCORE_WEIGHTS = {
  possessionSafety: 0.25,
  progression: 0.2,
  spaceCreation: 0.15,
  defensiveBalance: 0.2,
  futureOptions: 0.1,
  pressureManagement: 0.1,
} as const;
