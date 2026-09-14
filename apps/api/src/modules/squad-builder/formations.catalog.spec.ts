import { FORMATIONS } from './formations.catalog';

describe('FORMATIONS catalog', () => {
  it('inclui as 6 formações exigidas pela Tarefa 9', () => {
    const codes = FORMATIONS.map((f) => f.code).sort();
    expect(codes).toEqual(['3-4-3', '3-5-2', '4-2-1-3', '4-2-3-1', '4-3-3', '4-4-2'].sort());
  });

  it.each(FORMATIONS.map((f) => [f.code, f]))('%s tem exatamente 11 slots', (_code, formation: any) => {
    expect(formation.slots).toHaveLength(11);
  });

  it.each(FORMATIONS.map((f) => [f.code, f]))('%s tem exatamente 1 slot de goleiro', (_code, formation: any) => {
    const gkSlots = formation.slots.filter((s: any) => s.position === 'GK');
    expect(gkSlots).toHaveLength(1);
  });

  it.each(FORMATIONS.map((f) => [f.code, f]))('%s não repete o nome de nenhum slot', (_code, formation: any) => {
    const names = formation.slots.map((s: any) => s.slot);
    expect(new Set(names).size).toBe(names.length);
  });
});
