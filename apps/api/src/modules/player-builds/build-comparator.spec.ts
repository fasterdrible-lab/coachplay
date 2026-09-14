import { compareBuilds } from './build-comparator';
import { InvalidBuildError, IncompatiblePositionError, PointsExceededError } from './build-comparator.errors';

const stats = [
  { statKey: 'finishing', baseValue: 70, maxValue: 99 },
  { statKey: 'offensive_awareness', baseValue: 70, maxValue: 99 },
  { statKey: 'speed', baseValue: 70, maxValue: 99 },
];

const baseParams = {
  cardId: 'card-1',
  overallBase: 80,
  stats,
  position: 'CF',
  cardPositions: ['CF'],
};

describe('compareBuilds', () => {
  it('builds iguais: nenhuma vantagem ou desvantagem', () => {
    const result = compareBuilds({
      ...baseParams,
      buildA: { allocation: { finishing: 5 }, availableProgressionPoints: 10 },
      buildB: { allocation: { finishing: 5 }, availableProgressionPoints: 10 },
    });

    expect(result.advantages).toEqual([]);
    expect(result.disadvantages).toEqual([]);
    expect(result.attributes.every((a) => a.delta === 0)).toBe(true);
    expect(result.buildA.overall).toBe(result.buildB.overall);
  });

  it('builds diferentes: build com mais pontos em finishing tem vantagem em finishing, overall e roleScore', () => {
    const result = compareBuilds({
      ...baseParams,
      buildA: { allocation: { finishing: 2 }, availableProgressionPoints: 10 },
      buildB: { allocation: { finishing: 10 }, availableProgressionPoints: 10 },
    });

    expect(result.advantages).toEqual(
      expect.arrayContaining([
        expect.stringContaining('Overall maior'),
        expect.stringContaining('finishing maior'),
      ]),
    );
    expect(result.disadvantages).toEqual([]);
    expect(result.buildB.attributes.finishing).toBeGreaterThan(result.buildA.attributes.finishing);
  });

  it('build inválida: alocação em atributo que não existe na carta', () => {
    expect(() =>
      compareBuilds({
        ...baseParams,
        buildA: { allocation: { finishing: 5 }, availableProgressionPoints: 10 },
        buildB: { allocation: { does_not_exist: 5 }, availableProgressionPoints: 10 },
      }),
    ).toThrow(InvalidBuildError);
  });

  it('build inválida: alocação ultrapassa o maxValue do atributo', () => {
    expect(() =>
      compareBuilds({
        ...baseParams,
        buildA: { allocation: { finishing: 5 }, availableProgressionPoints: 100 },
        buildB: { allocation: { finishing: 100 }, availableProgressionPoints: 100 },
      }),
    ).toThrow(InvalidBuildError);
  });

  it('pontos acima do permitido: soma da alocação excede availableProgressionPoints', () => {
    expect(() =>
      compareBuilds({
        ...baseParams,
        buildA: { allocation: { finishing: 5 }, availableProgressionPoints: 10 },
        buildB: { allocation: { finishing: 5, speed: 5, offensive_awareness: 5 }, availableProgressionPoints: 10 },
      }),
    ).toThrow(PointsExceededError);
  });

  it('posição incompatível: posição pedida não pertence às posições da carta', () => {
    expect(() =>
      compareBuilds({
        ...baseParams,
        position: 'GK',
        cardPositions: ['CF'],
        buildA: { allocation: {}, availableProgressionPoints: 10 },
        buildB: { allocation: {}, availableProgressionPoints: 10 },
      }),
    ).toThrow(IncompatiblePositionError);
  });

  it('posição compatível via posição secundária da carta', () => {
    const result = compareBuilds({
      ...baseParams,
      position: 'SS',
      cardPositions: ['CF', 'SS'],
      buildA: { allocation: {}, availableProgressionPoints: 10 },
      buildB: { allocation: {}, availableProgressionPoints: 10 },
    });

    expect(result.position).toBe('SS');
  });
});
