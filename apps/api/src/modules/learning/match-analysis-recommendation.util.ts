/**
 * Integração com Match Analysis (Tarefa 15) — mapa das 4 categorias agregadas que
 * `ReportsService.getSummary` (módulo `reports`, EA FC hoje) já calcula a partir de partidas
 * REAIS analisadas (`attack`/`defense`/`passing`/`decision`) pro título do módulo da Academia
 * (Tarefa 12) mais relacionado. Deliberadamente só usa essa agregação — nunca uma correlação
 * fina (ex.: "zagueiro sai de posição com frequência"), que exigiria detecção real de posição de
 * jogador/bola, algo que não existe em nenhum lugar do projeto hoje (ver
 * docs/tactical-engine-current-state.md e docs/efootball-architecture.md, risco 3).
 */
export const MATCH_CATEGORY_TO_MODULE_TITLE: Record<string, string> = {
  attack: 'Finalização',
  defense: 'Defesa',
  passing: 'Passe',
  decision: 'Movimentação',
};

export function mapWorstCategoryToModuleTitle(worstCategory: string): string | null {
  return MATCH_CATEGORY_TO_MODULE_TITLE[worstCategory] ?? null;
}
