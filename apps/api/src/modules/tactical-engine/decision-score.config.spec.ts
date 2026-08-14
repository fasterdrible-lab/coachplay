import { DECISION_SCORE_WEIGHTS } from './decision-score.config';

describe('DECISION_SCORE_WEIGHTS', () => {
  it('soma exatamente 1.0 — garante que o total do DecisionScore fica em 0-100', () => {
    const sum = Object.values(DECISION_SCORE_WEIGHTS).reduce((total, weight) => total + weight, 0);
    expect(sum).toBeCloseTo(1.0);
  });

  it('todos os pesos são positivos', () => {
    expect(Object.values(DECISION_SCORE_WEIGHTS).every((weight) => weight > 0)).toBe(true);
  });
});
