import { clamp, euclideanDistance, perpendicularDistance, projectionParameter } from './geometry.util';

describe('clamp', () => {
  it.each([
    [5, 0, 10, 5],
    [-1, 0, 10, 0],
    [15, 0, 10, 10],
  ])('clamp(%d, %d, %d) = %d', (value, min, max, expected) => {
    expect(clamp(value, min, max)).toBe(expected);
  });
});

describe('euclideanDistance', () => {
  it('calcula distância entre dois pontos', () => {
    expect(euclideanDistance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it('retorna 0 para o mesmo ponto', () => {
    expect(euclideanDistance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 })).toBe(0);
  });
});

describe('projectionParameter', () => {
  it('t=0 no ponto de origem', () => {
    expect(projectionParameter({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 })).toBe(0);
  });

  it('t=1 no ponto de destino', () => {
    expect(projectionParameter({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0 })).toBe(1);
  });

  it('t=0.5 no meio do segmento', () => {
    expect(projectionParameter({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.5);
  });

  it('t fora de [0,1] quando o ponto projeta além das extremidades', () => {
    expect(projectionParameter({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeCloseTo(2);
    expect(projectionParameter({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: -1, y: 0 })).toBeCloseTo(-1);
  });

  it('retorna 0 quando from e to coincidem (segmento degenerado)', () => {
    expect(projectionParameter({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.9, y: 0.1 })).toBe(0);
  });
});

describe('perpendicularDistance', () => {
  it('retorna 0 para ponto sobre a reta', () => {
    expect(perpendicularDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0 })).toBeCloseTo(0);
  });

  it('calcula distância perpendicular correta para reta horizontal', () => {
    expect(perpendicularDistance({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0.5, y: 0.3 })).toBeCloseTo(0.3);
  });

  it('calcula distância perpendicular correta para reta vertical', () => {
    expect(perpendicularDistance({ x: 0.2, y: 0 }, { x: 0.2, y: 1 }, { x: 0.5, y: 0.5 })).toBeCloseTo(0.3);
  });

  it('cai para distância euclidiana quando from e to coincidem', () => {
    expect(perpendicularDistance({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 })).toBeCloseTo(0.3);
  });
});
