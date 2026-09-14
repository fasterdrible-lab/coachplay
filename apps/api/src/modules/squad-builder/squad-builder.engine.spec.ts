import { buildSquad, SquadCandidate } from './squad-builder.engine';
import { FORMATIONS } from './formations.catalog';

const F433 = FORMATIONS.find((f) => f.code === '4-3-3')!;

const mk = (id: string, position: string, overallBase = 80): SquadCandidate => ({
  userPlayerId: id,
  position,
  overallBase,
});

// Exatamente os 11 papéis do 4-3-3, 1 candidato ideal por slot.
const ELEVEN_EXACT: SquadCandidate[] = [
  mk('gk', 'GK'),
  mk('lb', 'LB'),
  mk('cb1', 'CB'),
  mk('cb2', 'CB'),
  mk('rb', 'RB'),
  mk('dm', 'DMF'),
  mk('cm1', 'CMF'),
  mk('cm2', 'CMF'),
  mk('lw', 'LWF'),
  mk('cf', 'CF'),
  mk('rw', 'RWF'),
];

describe('buildSquad — cenários de elenco (Tarefa 9)', () => {
  it('11 jogadores exatos: preenche as 11 posições, banco vazio, sem posições fracas', () => {
    const result = buildSquad(F433, ELEVEN_EXACT);

    expect(result.startingXI).toHaveLength(11);
    expect(result.bench).toHaveLength(0);
    expect(result.weakPositions).toHaveLength(0);
    expect(result.startingXI.every((s) => s.exactPosition)).toBe(true);
  });

  it('18 jogadores: 11 titulares + 7 no banco, sem sobreposição', () => {
    const extras = Array.from({ length: 7 }, (_, i) => mk(`extra-${i}`, 'CMF', 70));
    const result = buildSquad(F433, [...ELEVEN_EXACT, ...extras]);

    expect(result.startingXI).toHaveLength(11);
    expect(result.bench).toHaveLength(7);

    const starters = new Set(result.startingXI.map((s) => s.userPlayerId));
    expect(result.bench.every((id) => !starters.has(id))).toBe(true);
  });

  it('30 jogadores: nunca escala mais de 11, resto vai pro banco', () => {
    const extras = Array.from({ length: 19 }, (_, i) => mk(`extra-${i}`, 'CB', 60));
    const result = buildSquad(F433, [...ELEVEN_EXACT, ...extras]);

    expect(result.startingXI).toHaveLength(11);
    expect(result.bench).toHaveLength(19);
  });

  it('jogadores duplicados no array de entrada nunca são escalados duas vezes', () => {
    const result = buildSquad(F433, [...ELEVEN_EXACT, mk('gk', 'GK')]); // 'gk' duplicado

    const ids = result.startingXI.map((s) => s.userPlayerId);
    expect(new Set(ids).size).toBe(ids.length); // nenhum id repetido
    expect(result.startingXI).toHaveLength(11);
  });

  it('sem goleiro: a vaga de GK fica vazia, nunca preenchida por um jogador de linha', () => {
    const rosterSemGoleiro = ELEVEN_EXACT.filter((c) => c.position !== 'GK');
    const result = buildSquad(F433, rosterSemGoleiro);

    expect(result.startingXI.find((s) => s.slot === 'GK')).toBeUndefined();
    expect(result.weakPositions).toEqual(
      expect.arrayContaining([{ slot: 'GK', position: 'GK', reason: 'EMPTY' }]),
    );
    expect(result.startingXI).toHaveLength(10);
  });

  it('sem lateral: as vagas LB/RB ficam vazias', () => {
    const rosterSemLateral = ELEVEN_EXACT.filter((c) => c.position !== 'LB' && c.position !== 'RB');
    const result = buildSquad(F433, rosterSemLateral);

    const weakSlots = result.weakPositions.map((w) => w.slot);
    expect(weakSlots).toEqual(expect.arrayContaining(['LB', 'RB']));
    expect(result.startingXI).toHaveLength(9);
  });

  it('excesso de atacantes: só preenche a única vaga de CF, o resto vai pro banco (não invade LWF/RWF)', () => {
    const soAtacantes: SquadCandidate[] = Array.from({ length: 10 }, (_, i) => mk(`cf-${i}`, 'CF', 75));
    const result = buildSquad(F433, soAtacantes);

    const cfStarters = result.startingXI.filter((s) => s.position === 'CF');
    expect(cfStarters).toHaveLength(1);
    expect(result.bench).toHaveLength(9);
    // LWF/RWF exigem o grupo WF, não o grupo CF — ficam vazias, nunca preenchidas por um CF
    expect(result.weakPositions.map((w) => w.slot)).toEqual(expect.arrayContaining(['LWF', 'RWF']));
  });

  it('entre 3 candidatos pra 2 vagas de CB, escala os 2 de maior overall e deixa o mais fraco no banco', () => {
    const roster = [
      ...ELEVEN_EXACT.filter((c) => !c.userPlayerId.startsWith('cb')),
      mk('cb-fraco', 'CB', 60),
      mk('cb-medio', 'CB', 80),
      mk('cb-forte', 'CB', 95),
    ];
    const result = buildSquad(F433, roster);

    const cbStarters = result.startingXI.filter((s) => s.position === 'CB').map((s) => s.userPlayerId);
    expect(cbStarters.sort()).toEqual(['cb-forte', 'cb-medio']);
    expect(result.bench).toContain('cb-fraco');
  });

  it('é determinístico: mesma entrada produz sempre a mesma saída', () => {
    const a = buildSquad(F433, ELEVEN_EXACT);
    const b = buildSquad(F433, ELEVEN_EXACT);

    expect(a).toEqual(b);
  });
});

describe('buildSquad — guardas de segurança (nunca 12 jogadores, nunca 2 goleiros)', () => {
  it.each(FORMATIONS.map((f) => [f.code, f]))(
    '%s: nunca escala mais de 11 jogadores mesmo com elenco enorme',
    (_code, formation: any) => {
      const hugeRoster = Array.from({ length: 50 }, (_, i) => mk(`p-${i}`, 'CMF', 70 + (i % 20)));
      const result = buildSquad(formation, hugeRoster);

      expect(result.startingXI.length).toBeLessThanOrEqual(11);
    },
  );

  it.each(FORMATIONS.map((f) => [f.code, f]))(
    '%s: nunca escala 2 goleiros simultaneamente mesmo com vários GKs no elenco',
    (_code, formation: any) => {
      const manyGoalkeepers = [
        ...Array.from({ length: 5 }, (_, i) => mk(`gk-${i}`, 'GK', 70 + i)),
        ...ELEVEN_EXACT.filter((c) => c.position !== 'GK'),
      ];
      const result = buildSquad(formation, manyGoalkeepers);

      const gkCount = result.startingXI.filter((s) => s.position === 'GK').length;
      expect(gkCount).toBeLessThanOrEqual(1);
    },
  );
});
