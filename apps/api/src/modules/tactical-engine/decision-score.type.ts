// Ver docs/tactical-engine-domain.md (DecisionScore) e docs/tactical-engine-scoring.md
// (Tarefa 38, fórmula completa e auditável). Todos os campos são 0-100.
export interface DecisionScore {
  total: number;
  possessionSafety: number;
  progression: number;
  spaceCreation: number;
  defensiveBalance: number;
  futureOptions: number;
  pressureManagement: number;
}
