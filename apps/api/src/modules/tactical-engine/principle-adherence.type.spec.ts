import { PrincipleAdherence, splitPrincipleAdherence } from './principle-adherence.type';

function adherence(principleId: PrincipleAdherence['principleId'], adhered: boolean | null): PrincipleAdherence {
  return { principleId, adhered };
}

describe('splitPrincipleAdherence', () => {
  it('separa seguidos (true) de violados (false)', () => {
    const result = splitPrincipleAdherence([
      adherence('KING_SAFETY', true),
      adherence('OVERLOAD', false),
      adherence('SPACE_EXPANSION', true),
    ]);

    expect(result.followed).toEqual(['KING_SAFETY', 'SPACE_EXPANSION']);
    expect(result.violated).toEqual(['OVERLOAD']);
  });

  it('descarta null (princípio não aplicável) — nunca conta como seguido nem violado', () => {
    const result = splitPrincipleAdherence([adherence('PROPHYLAXIS', null), adherence('INITIATIVE', null)]);

    expect(result.followed).toEqual([]);
    expect(result.violated).toEqual([]);
  });

  it('lista vazia produz listas vazias', () => {
    expect(splitPrincipleAdherence([])).toEqual({ followed: [], violated: [] });
  });
});
