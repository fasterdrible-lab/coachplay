// Cap de dicas por minuto por nível de intensidade de feedback (Fase 2 — captura em tempo real).
// Reaproveita UserPreferences.feedbackLevel (String, já existente, default "normal") em vez de criar
// um novo campo/enum. Esse campo hoje também é gravado por apps/web com valores em inglês
// (simple/normal/detailed) para outro propósito — profundidade do relatório pós-jogo — então os dois
// conjuntos de valores convivem aqui via alias, para não quebrar preferências já salvas até a
// nomenclatura ser reconciliada em apps/web (fora do escopo desta rodada).
const TIPS_PER_MINUTE: Record<string, number> = {
  silencioso: 0,
  leve: 1,
  normal: 3,
  intensivo: 6,
  // aliases legados de apps/web (profundidade de relatório, não cadência de dica ao vivo)
  simple: 1,
  detailed: 6,
};

const DEFAULT_TIPS_PER_MINUTE = 3;

export function getTipsPerMinuteCap(feedbackLevel: string | null | undefined): number {
  if (!feedbackLevel) return DEFAULT_TIPS_PER_MINUTE;
  return TIPS_PER_MINUTE[feedbackLevel] ?? DEFAULT_TIPS_PER_MINUTE;
}
