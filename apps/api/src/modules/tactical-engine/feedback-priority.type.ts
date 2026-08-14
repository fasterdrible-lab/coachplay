// Ver TASKS.md (Fase 6, Tarefa 28) — prioridade de uma decisão já avaliada/classificada (Fase
// 3) para efeito de feedback AO VIVO, durante a partida. Diferente do relatório pós-jogo (Fase
// 5), que cobre TODAS as decisões: ao vivo, só o que exige atenção imediata interrompe o
// jogador — feedback de rotina fica reservado para o pós-jogo.
export type FeedbackPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

// Última entrega de feedback ao vivo de UMA sessão — estado que o CHAMADOR precisa manter entre
// avaliações (nunca este módulo: o motor não acopla a nenhuma fonte real de estado/sessão, ver
// docs/tactical-engine-current-state.md). Passado explicitamente a cada chamada.
export interface LastFeedbackDelivery {
  priority: FeedbackPriority;
  atMs: number;
}
