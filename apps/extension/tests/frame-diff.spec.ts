import { computeFrameSignature, hasFrameChanged } from '../src/shared/frame-diff';

describe('computeFrameSignature', () => {
  it('retorna 0 para dados vazios', () => {
    expect(computeFrameSignature({ data: new Uint8ClampedArray(0) })).toBe(0);
  });

  it('calcula uma média estridada sobre o canal R de dados RGBA', () => {
    // 2 pixels RGBA: (10, x, x, x) e (20, x, x, x) -> média do canal R = 15
    const data = new Uint8ClampedArray([10, 1, 2, 3, 20, 4, 5, 6]);
    expect(computeFrameSignature({ data })).toBe(15);
  });

  it('produz assinaturas diferentes para frames visualmente diferentes', () => {
    const dark = new Uint8ClampedArray([0, 0, 0, 255, 0, 0, 0, 255]);
    const bright = new Uint8ClampedArray([255, 0, 0, 255, 255, 0, 0, 255]);
    expect(computeFrameSignature({ data: dark })).not.toBe(computeFrameSignature({ data: bright }));
  });
});

describe('hasFrameChanged', () => {
  it('é sempre true quando não há frame anterior (primeiro frame)', () => {
    expect(hasFrameChanged(null, 123, 8)).toBe(true);
  });

  it('é false para uma diferença abaixo do threshold', () => {
    expect(hasFrameChanged(100, 105, 8)).toBe(false);
  });

  it('é true para uma diferença igual ou acima do threshold', () => {
    expect(hasFrameChanged(100, 108, 8)).toBe(true);
    expect(hasFrameChanged(100, 120, 8)).toBe(true);
  });

  it('funciona simetricamente (aumento ou queda de brilho)', () => {
    expect(hasFrameChanged(100, 92, 8)).toBe(true);
    expect(hasFrameChanged(100, 93, 8)).toBe(false);
  });
});
