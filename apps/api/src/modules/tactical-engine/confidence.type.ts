// Ver TASKS.md (Fase 7, Tarefa 29) — sistema de confiança do motor: agrega os sinais de
// confiança que TacticalGameState/VirtualPlayer já carregam (nunca inventados — ver
// docs/tactical-engine-domain.md, PlayerPosition/BallPosition) numa única decisão de "confiança
// suficiente para avaliar". Base do anti-falso-positivo (Tarefa 30, ver decision.evaluator.ts).
export interface EngineConfidence {
  // 0-1 — o MENOR entre os sinais agregados (nunca otimista: o elo mais fraco da cadeia decide).
  score: number;
  sufficient: boolean;
}
