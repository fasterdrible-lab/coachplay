// Ver docs/tactical-engine-scoring.md (Tarefa 38) para a tabela completa e exemplos.
// Termos técnicos internamente — tradução para PT-BR na UI fica a cargo do frontend/ai-coach
// (Tarefa 14 do plano original).
export type DecisionClassification = 'EXCELLENT' | 'GOOD' | 'ACCEPTABLE' | 'RISKY' | 'ERROR' | 'MAJOR_ERROR';

const THRESHOLDS: ReadonlyArray<{ upTo: number; classification: DecisionClassification }> = [
  { upTo: 19, classification: 'MAJOR_ERROR' },
  { upTo: 39, classification: 'ERROR' },
  { upTo: 59, classification: 'RISKY' },
  { upTo: 74, classification: 'ACCEPTABLE' },
  { upTo: 89, classification: 'GOOD' },
  { upTo: 100, classification: 'EXCELLENT' },
];

/** Classifica um DecisionScore.total (0-100) em uma das 6 faixas do plano original. */
export function classifyDecisionScore(total: number): DecisionClassification {
  return (THRESHOLDS.find((threshold) => total <= threshold.upTo) ?? THRESHOLDS[THRESHOLDS.length - 1]).classification;
}
