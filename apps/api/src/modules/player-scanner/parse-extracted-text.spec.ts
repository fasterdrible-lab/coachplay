import { parseExtractedText } from './parse-extracted-text';

describe('parseExtractedText', () => {
  it('extrai tokens de nome e overall de um texto legível', () => {
    const result = parseExtractedText('KHVICHA KVARATSKHELIA 89 STANDARD');

    expect(result.nameTokens).toEqual(expect.arrayContaining(['khvicha', 'kvaratskhelia']));
    expect(result.overallGuess).toBe(89);
  });

  it('funciona com texto parcial (nome cortado)', () => {
    const result = parseExtractedText('...RATSKHELIA');

    expect(result.nameTokens).toEqual(['ratskhelia']);
  });

  it('ignora números fora da faixa 40-99 como overall', () => {
    const result = parseExtractedText('KVARA 7');

    expect(result.overallGuess).toBeUndefined();
  });

  it('retorna tokens vazios para texto sem letras (falso positivo evitado na origem)', () => {
    const result = parseExtractedText('### 12 ###');

    expect(result.nameTokens).toEqual([]);
  });
});
