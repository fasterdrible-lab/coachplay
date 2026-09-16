import { computeContentHash } from './content-hash.util';

describe('computeContentHash', () => {
  it('mesmo conteúdo produz o mesmo hash', () => {
    expect(computeContentHash('Segure R2 para passe de calcanhar')).toBe(
      computeContentHash('Segure R2 para passe de calcanhar'),
    );
  });

  it('conteúdo diferente produz hash diferente', () => {
    expect(computeContentHash('até 5 habilidades adicionais')).not.toBe(
      computeContentHash('até 6 habilidades adicionais'),
    );
  });

  it('produz um hex de 64 caracteres (sha256)', () => {
    expect(computeContentHash('qualquer texto')).toMatch(/^[0-9a-f]{64}$/);
  });
});
