import { similarity } from './string-similarity.util';

describe('similarity', () => {
  it('retorna 1 para strings idênticas', () => {
    expect(similarity('kvaratskhelia', 'kvaratskhelia')).toBe(1);
  });

  it('retorna 0 para strings vazias comparadas', () => {
    expect(similarity('', '')).toBe(1);
  });

  it('penaliza poucas trocas de caractere proporcionalmente ao tamanho', () => {
    const score = similarity('khvicha kvaratskhelia', 'khv1cha kvara7skhelia');
    expect(score).toBeGreaterThan(0.85);
    expect(score).toBeLessThan(1);
  });

  it('retorna score baixo para strings bem diferentes', () => {
    expect(similarity('kvaratskhelia', 'zzzzzzzzzzzzz')).toBeLessThan(0.2);
  });
});
