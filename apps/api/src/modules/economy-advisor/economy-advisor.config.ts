// Limiares versionados do Economy Advisor (Tarefa 11) — algoritmo próprio do CoachPlay, nunca
// a fórmula/probabilidade real de pack (a Konami/o eFootball não publica isso). Alterar aqui é
// uma mudança de produto.
export const ECONOMY_ADVISOR_CONFIG_VERSION = '1.0.0';

export const RECOMMENDED_THRESHOLD = 0.6;
export const NEUTRAL_THRESHOLD = 0.35;

export const RECOMMENDATION_WEIGHTS = {
  teamNeed: 0.4,
  expectedValue: 0.3,
  coinSafety: 0.3,
} as const;
