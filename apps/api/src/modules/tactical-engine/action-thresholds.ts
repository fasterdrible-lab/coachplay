// Limiares compartilhados entre o gerador de ações (action-generator.ts) e o cálculo do
// DecisionScore (decision-score.calculator.ts) — centralizados aqui para os dois nunca
// divergirem sobre o que conta como "passe seguro" ou "passe progressivo".
export const SAFE_PASS_SCORE_THRESHOLD = 70;
export const PROGRESSIVE_PASS_MIN_PROGRESSION = 15;
