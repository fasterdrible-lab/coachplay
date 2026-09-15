import { evaluatePack, EconomyAdvisorInput, EconomyTarget } from './economy-advisor.engine';

const target = (overrides: Partial<EconomyTarget> = {}): EconomyTarget => ({
  playerCardId: 'card-1',
  probability: 0.3,
  overallBase: 85,
  position: 'RB',
  ...overrides,
});

const baseInput = (overrides: Partial<EconomyAdvisorInput> = {}): EconomyAdvisorInput => ({
  userCoins: 1000,
  packCost: 500,
  targets: [target()],
  ownedPlayerCardIds: [],
  weakPositionGroups: [],
  ...overrides,
});

describe('evaluatePack — Tarefa 11 (Economy Advisor)', () => {
  it('usuário sem Coins: recomendação forçada para NOT_RECOMMENDED', () => {
    const result = evaluatePack(baseInput({ userCoins: 0, packCost: 500 }));

    expect(result.recommendation).toBe('NOT_RECOMMENDED');
    expect(result.coinRisk).toBe(1);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('moedas')]));
  });

  it('usuário já possui os principais jogadores do pack: duplicateRisk alto derruba a recomendação', () => {
    const input = baseInput({
      targets: [target({ playerCardId: 'card-1' }), target({ playerCardId: 'card-2' })],
      ownedPlayerCardIds: ['card-1', 'card-2'],
    });

    const result = evaluatePack(input);

    expect(result.duplicateRisk).toBe(1);
    expect(result.recommendation).toBe('NOT_RECOMMENDED');
  });

  it('necessidade alta gera score maior do que necessidade baixa (mesmo pack, mesmo elenco)', () => {
    const necessidadeAlta = evaluatePack(baseInput({ weakPositionGroups: ['FB'] })); // RB pertence ao grupo FB
    const necessidadeBaixa = evaluatePack(baseInput({ weakPositionGroups: ['CF'] })); // não bate com RB

    expect(necessidadeAlta.teamNeedScore).toBe(1);
    expect(necessidadeBaixa.teamNeedScore).toBe(0);
    expect(necessidadeAlta.recommendationScore!).toBeGreaterThan(necessidadeBaixa.recommendationScore!);
  });

  it('pack sem odds: recommendation = INSUFFICIENT_DATA (nunca inventa probabilidade)', () => {
    const result = evaluatePack(baseInput({ targets: [target({ probability: null })] }));

    expect(result.recommendation).toBe('INSUFFICIENT_DATA');
    expect(result.expectedValue).toBeNull();
    expect(result.recommendationScore).toBeNull();
  });

  it('odds inválidas (fora de 0-1): recommendation = INSUFFICIENT_DATA', () => {
    const negativa = evaluatePack(baseInput({ targets: [target({ probability: -0.2 })] }));
    const maiorQueUm = evaluatePack(baseInput({ targets: [target({ probability: 1.5 })] }));

    expect(negativa.recommendation).toBe('INSUFFICIENT_DATA');
    expect(maiorQueUm.recommendation).toBe('INSUFFICIENT_DATA');
  });

  it('odds inválidas em QUALQUER alvo invalida o pack inteiro (não ignora silenciosamente)', () => {
    const result = evaluatePack(
      baseInput({
        targets: [target({ playerCardId: 'card-1', probability: 0.3 }), target({ playerCardId: 'card-2', probability: 2 })],
      }),
    );

    expect(result.recommendation).toBe('INSUFFICIENT_DATA');
  });

  it('pack acessível, sem duplicata, com necessidade e boas odds: RECOMMENDED', () => {
    const result = evaluatePack(
      baseInput({
        userCoins: 1000,
        packCost: 200,
        targets: [target({ probability: 0.8, overallBase: 90 })],
        weakPositionGroups: ['FB'],
      }),
    );

    expect(result.recommendation).toBe('RECOMMENDED');
  });

  it('lança erro para pack sem nenhum jogador-alvo', () => {
    expect(() => evaluatePack(baseInput({ targets: [] }))).toThrow();
  });

  it('é determinístico: mesma entrada produz sempre a mesma saída', () => {
    const input = baseInput();
    expect(evaluatePack(input)).toEqual(evaluatePack(input));
  });
});
