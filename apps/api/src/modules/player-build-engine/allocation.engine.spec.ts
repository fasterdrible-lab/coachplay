import { allocatePoints } from './allocation.engine';

describe('allocatePoints', () => {
  const stats = [
    { statKey: 'dribbling', baseValue: 60, maxValue: 99 },
    { statKey: 'speed', baseValue: 60, maxValue: 99 },
    { statKey: 'finishing', baseValue: 60, maxValue: 99 },
  ];

  it('nunca aloca mais pontos do que o orçamento disponível', () => {
    const allocation = allocatePoints(stats, { dribbling: 3, speed: 1, finishing: 1 }, 20);

    const used = Object.values(allocation).reduce((s, v) => s + v, 0);
    expect(used).toBeLessThanOrEqual(20);
  });

  it('nunca ultrapassa o headroom (maxValue - baseValue) de um atributo', () => {
    const tightStats = [{ statKey: 'dribbling', baseValue: 97, maxValue: 99 }];
    const allocation = allocatePoints(tightStats, { dribbling: 1 }, 50);

    expect(allocation.dribbling).toBe(2); // headroom = 99-97 = 2, resto fica sem uso
  });

  it('ignora atributos com peso zero/ausente mesmo com headroom livre', () => {
    const allocation = allocatePoints(stats, { dribbling: 1 }, 10);

    expect(allocation.speed).toBe(0);
    expect(allocation.finishing).toBe(0);
    expect(allocation.dribbling).toBe(10);
  });

  it('distribui proporcionalmente entre atributos de mesmo peso', () => {
    const allocation = allocatePoints(stats, { dribbling: 1, speed: 1, finishing: 1 }, 9);

    expect(allocation).toEqual({ dribbling: 3, speed: 3, finishing: 3 });
  });

  it('é determinístico: mesma entrada produz sempre a mesma saída', () => {
    const a = allocatePoints(stats, { dribbling: 3, speed: 1, finishing: 1 }, 17);
    const b = allocatePoints(stats, { dribbling: 3, speed: 1, finishing: 1 }, 17);

    expect(a).toEqual(b);
  });

  it('lança erro para orçamento negativo', () => {
    expect(() => allocatePoints(stats, { dribbling: 1 }, -5)).toThrow();
  });

  it('retorna 0 para todos quando o orçamento é 0', () => {
    const allocation = allocatePoints(stats, { dribbling: 1, speed: 1 }, 0);

    expect(allocation.dribbling).toBe(0);
    expect(allocation.speed).toBe(0);
  });
});
