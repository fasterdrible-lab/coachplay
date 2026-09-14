import { estimateOverall } from './overall.util';

describe('estimateOverall', () => {
  const stats = [
    { statKey: 'dribbling', baseValue: 60, maxValue: 99 },
    { statKey: 'speed', baseValue: 60, maxValue: 99 },
  ];

  it('retorna overallBase quando não há ganho em nenhum atributo', () => {
    expect(estimateOverall(80, stats, { dribbling: 60, speed: 60 })).toBe(80);
  });

  it('soma a média de ganho ao overallBase', () => {
    // ganho médio = (10 + 0) / 2 = 5
    expect(estimateOverall(80, stats, { dribbling: 70, speed: 60 })).toBe(85);
  });

  it('nunca ultrapassa 99', () => {
    expect(estimateOverall(97, stats, { dribbling: 99, speed: 99 })).toBe(99);
  });
});
