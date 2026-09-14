import { validateRecord } from './validate';

describe('validateRecord', () => {
  const validRecord = {
    externalId: 'p1',
    name: 'Fixture Player',
    cards: [
      { externalId: 'c1', cardType: 'standard', version: '1.0', overallBase: 80, maxLevel: 99, position: 'CF' },
    ],
  };

  it('aceita um registro bem formado', () => {
    expect(validateRecord(validRecord)).toEqual({ valid: true, errors: [] });
  });

  it('rejeita overallBase fora da faixa 1-99', () => {
    const invalid = { ...validRecord, cards: [{ ...validRecord.cards[0], overallBase: 150 }] };

    const result = validateRecord(invalid);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('rejeita registro sem nenhuma carta', () => {
    const invalid = { ...validRecord, cards: [] };

    expect(validateRecord(invalid).valid).toBe(false);
  });

  it('rejeita registro sem nome', () => {
    const invalid = { ...validRecord, name: '' };

    expect(validateRecord(invalid).valid).toBe(false);
  });
});
