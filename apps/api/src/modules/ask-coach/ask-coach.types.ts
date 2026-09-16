export type AskCoachIntent =
  | 'PLAYER_SEARCH'
  | 'BUILD_RECOMMENDATION'
  | 'SQUAD_ADVICE'
  | 'ECONOMY_ADVICE'
  | 'LEARNING_RECOMMENDATION'
  | 'UNKNOWN';

export interface AskCoachAnswer {
  intent: AskCoachIntent;
  answer: string;
  /** null quando a resposta é 100% determinística (sem chamada de IA) ou quando a IA falhou e a
   * resposta veio de um fallback determinístico. */
  modelUsed: string | null;
  /** USD (Tarefa 20 — controle de custo de IA) — sempre 0 quando `modelUsed` é null (nenhuma
   * chamada de IA foi feita ou nenhuma teve sucesso). */
  costEstimate: number;
}
