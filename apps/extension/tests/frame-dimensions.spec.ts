import { calculateOutputDimensions } from '../src/shared/frame-dimensions';

const MAX = { width: 1280, height: 720 };

describe('calculateOutputDimensions', () => {
  it('reduz 1920x1080 (16:9) para 1280x720 preservando a proporção', () => {
    expect(calculateOutputDimensions({ width: 1920, height: 1080 }, MAX)).toEqual({ width: 1280, height: 720 });
  });

  it('reduz 2560x1440 (16:9) para 1280x720 preservando a proporção', () => {
    expect(calculateOutputDimensions({ width: 2560, height: 1440 }, MAX)).toEqual({ width: 1280, height: 720 });
  });

  it('não amplia uma fonte menor que o máximo', () => {
    expect(calculateOutputDimensions({ width: 640, height: 360 }, MAX)).toEqual({ width: 640, height: 360 });
  });

  it('preserva a proporção de uma fonte que não é 16:9 (nunca distorce)', () => {
    // 4:3 (1600x1200) -> limitado pela altura (720), não pela largura
    const result = calculateOutputDimensions({ width: 1600, height: 1200 }, MAX);
    const sourceRatio = 1600 / 1200;
    const resultRatio = result.width / result.height;
    expect(resultRatio).toBeCloseTo(sourceRatio, 2);
    expect(result.height).toBe(720);
    expect(result.width).toBeLessThanOrEqual(MAX.width);
  });

  it('trata dimensões de origem inválidas (0 ou negativas) caindo pro tamanho máximo', () => {
    expect(calculateOutputDimensions({ width: 0, height: 0 }, MAX)).toEqual(MAX);
    expect(calculateOutputDimensions({ width: -10, height: 100 }, MAX)).toEqual(MAX);
  });

  it('nunca retorna dimensões menores que 1px', () => {
    const result = calculateOutputDimensions({ width: 100000, height: 1 }, MAX);
    expect(result.width).toBeGreaterThanOrEqual(1);
    expect(result.height).toBeGreaterThanOrEqual(1);
  });
});
