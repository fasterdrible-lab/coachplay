import { computeBuild } from './player-build.calculator';
import { buildFixtureStats } from './player-build-fixtures';
import { BuildStrategy, STAT_KEYS } from './player-build-engine.config';
import { PlayerBuildInput } from './player-build.types';

const playerCard = { id: 'card-1', overallBase: 80, maxLevel: 99 };

function baseInput(overrides: Partial<PlayerBuildInput> = {}): PlayerBuildInput {
  return {
    playerCard,
    stats: buildFixtureStats(),
    level: 50,
    position: 'CF',
    strategy: 'POSITION_OPTIMIZED',
    availableProgressionPoints: 30,
    ...overrides,
  };
}

describe('computeBuild', () => {
  const positions: Array<{ label: string; position: string }> = [
    { label: 'ponta', position: 'LWF' },
    { label: 'centroavante', position: 'CF' },
    { label: 'meia', position: 'CMF' },
    { label: 'volante', position: 'DMF' },
    { label: 'zagueiro', position: 'CB' },
    { label: 'lateral', position: 'LB' },
    { label: 'goleiro', position: 'GK' },
  ];

  const strategies: BuildStrategy[] = [
    'MAX_OVERALL',
    'BALANCED',
    'DRIBBLER',
    'FINISHER',
    'SPEED',
    'PASSER',
    'DEFENSIVE',
    'POSITION_OPTIMIZED',
  ];

  it.each(positions)('$label ($position): resultado sempre dentro do limite de pontos', ({ position }) => {
    for (const strategy of strategies) {
      const result = computeBuild(baseInput({ position, strategy, availableProgressionPoints: 40 }));

      expect(result.totalPointsUsed).toBeLessThanOrEqual(result.totalPointsAvailable);
      expect(
        Object.values(result.recommendedAllocation).reduce((sum, v) => sum + v, 0),
      ).toBeLessThanOrEqual(40);
    }
  });

  it.each(positions)('$label ($position): nenhum atributo ultrapassa o limite permitido (maxValue)', ({ position }) => {
    const stats = buildFixtureStats();
    const maxByKey = new Map(stats.map((s) => [s.statKey, s.maxValue]));

    for (const strategy of strategies) {
      const result = computeBuild(baseInput({ position, strategy, stats, availableProgressionPoints: 500 }));

      for (const key of STAT_KEYS) {
        expect(result.expectedAttributes[key]).toBeLessThanOrEqual(maxByKey.get(key)!);
      }
    }
  });

  it.each(positions)('$label ($position): mesma entrada produz sempre a mesma saída', ({ position }) => {
    const input = baseInput({ position, strategy: 'POSITION_OPTIMIZED', availableProgressionPoints: 33 });

    const a = computeBuild(input);
    const b = computeBuild(input);

    expect(a).toEqual(b);
  });

  it('MAX_OVERALL não é necessariamente igual a POSITION_OPTIMIZED', () => {
    const maxOverall = computeBuild(baseInput({ position: 'CB', strategy: 'MAX_OVERALL', availableProgressionPoints: 30 }));
    const positionOptimized = computeBuild(
      baseInput({ position: 'CB', strategy: 'POSITION_OPTIMIZED', availableProgressionPoints: 30 }),
    );

    expect(maxOverall.recommendedAllocation).not.toEqual(positionOptimized.recommendedAllocation);
  });

  it('roleScore fica sempre entre 0 e 100', () => {
    for (const { position } of positions) {
      const result = computeBuild(baseInput({ position, strategy: 'POSITION_OPTIMIZED' }));
      expect(result.roleScore).toBeGreaterThanOrEqual(0);
      expect(result.roleScore).toBeLessThanOrEqual(100);
    }
  });

  it('lança erro para level fora do intervalo [1, maxLevel]', () => {
    expect(() => computeBuild(baseInput({ level: 0 }))).toThrow();
    expect(() => computeBuild(baseInput({ level: 100 }))).toThrow();
  });

  it('lança erro para availableProgressionPoints negativo', () => {
    expect(() => computeBuild(baseInput({ availableProgressionPoints: -1 }))).toThrow();
  });

  it('lança erro quando a carta não tem nenhum atributo importado (sem dado, sem cálculo)', () => {
    expect(() => computeBuild(baseInput({ stats: [] }))).toThrow();
  });

  it('lança erro para posição desconhecida', () => {
    expect(() => computeBuild(baseInput({ position: 'XX' }))).toThrow();
  });
});
