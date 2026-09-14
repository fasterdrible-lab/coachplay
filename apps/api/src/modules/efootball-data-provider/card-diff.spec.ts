import { diffCard } from './card-diff';

const incoming = { externalId: 'c1', cardType: 'standard', version: '1.0', overallBase: 80, maxLevel: 99, position: 'CF' };

describe('diffCard', () => {
  it('retorna "created" quando não existe carta anterior', () => {
    expect(diffCard(null, incoming)).toBe('created');
  });

  it('retorna "unchanged" quando os campos versionados são idênticos', () => {
    const existing = { cardType: 'standard', version: '1.0', overallBase: 80, maxLevel: 99, position: 'CF' };

    expect(diffCard(existing, incoming)).toBe('unchanged');
  });

  it('retorna "updated" quando overallBase muda', () => {
    const existing = { cardType: 'standard', version: '1.0', overallBase: 79, maxLevel: 99, position: 'CF' };

    expect(diffCard(existing, incoming)).toBe('updated');
  });

  it('retorna "updated" quando a posição muda', () => {
    const existing = { cardType: 'standard', version: '1.0', overallBase: 80, maxLevel: 99, position: 'RWF' };

    expect(diffCard(existing, incoming)).toBe('updated');
  });
});
