import { classifyDecisionScore } from './decision-classification';

describe('classifyDecisionScore', () => {
  it.each([
    [0, 'MAJOR_ERROR'],
    [19, 'MAJOR_ERROR'],
    [20, 'ERROR'],
    [39, 'ERROR'],
    [40, 'RISKY'],
    [59, 'RISKY'],
    [60, 'ACCEPTABLE'],
    [74, 'ACCEPTABLE'],
    [75, 'GOOD'],
    [89, 'GOOD'],
    [90, 'EXCELLENT'],
    [100, 'EXCELLENT'],
  ])('score %d → %s', (total, expected) => {
    expect(classifyDecisionScore(total)).toBe(expected);
  });

  it('valores fora de [0,100] não quebram (clamp implícito nas bordas)', () => {
    expect(classifyDecisionScore(-10)).toBe('MAJOR_ERROR');
    expect(classifyDecisionScore(150)).toBe('EXCELLENT');
  });
});
