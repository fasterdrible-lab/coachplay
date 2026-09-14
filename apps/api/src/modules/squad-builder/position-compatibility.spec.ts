import { positionCompatibility } from './position-compatibility';

describe('positionCompatibility', () => {
  it('retorna 1 para posição exata', () => {
    expect(positionCompatibility('CB', 'CB')).toBe(1);
  });

  it('é case-insensitive', () => {
    expect(positionCompatibility('cb', 'CB')).toBe(1);
  });

  it('retorna 0.7 para mesmo grupo posicional, posição diferente', () => {
    expect(positionCompatibility('LWF', 'RWF')).toBe(0.7);
  });

  it('retorna 0 para grupos posicionais diferentes (zagueiro nunca é goleiro)', () => {
    expect(positionCompatibility('CB', 'GK')).toBe(0);
  });

  it('retorna 0 para posição desconhecida em vez de lançar erro', () => {
    expect(positionCompatibility('XX', 'CB')).toBe(0);
  });
});
