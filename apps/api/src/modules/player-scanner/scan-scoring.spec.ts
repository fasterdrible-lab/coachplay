import { computeFinalConfidence, decideScanOutcome, scoreCard, scoreNameMatch } from './scan-scoring';

describe('scoreNameMatch', () => {
  it('pontua alto para nome completo e legível', () => {
    expect(scoreNameMatch(['khvicha', 'kvaratskhelia'], 'khvicha kvaratskhelia')).toBeGreaterThan(0.95);
  });

  it('usa bônus de substring para nome cortado', () => {
    expect(scoreNameMatch(['ratskhelia'], 'khvicha kvaratskhelia')).toBeGreaterThanOrEqual(0.75);
  });

  it('retorna 0 para tokens vazios', () => {
    expect(scoreNameMatch([], 'khvicha kvaratskhelia')).toBe(0);
  });

  it('ignora rótulo de tipo de carta (ex.: "EPIC") capturado junto do nome pelo OCR', () => {
    const score = scoreNameMatch(['khvicha', 'kvaratskhelia', 'epic'], 'khvicha kvaratskhelia');
    expect(score).toBe(1);
  });
});

describe('scoreCard', () => {
  it('aumenta o score quando o overall extraído bate exatamente', () => {
    const base = scoreCard(0.8, { overallBase: 89 }, { nameTokens: [] });
    const boosted = scoreCard(0.8, { overallBase: 89 }, { overallGuess: 89, nameTokens: [] });

    expect(boosted).toBeGreaterThan(base);
  });

  it('reduz o score quando o overall extraído diverge muito', () => {
    const base = scoreCard(0.8, { overallBase: 89 }, { nameTokens: [] });
    const penalized = scoreCard(0.8, { overallBase: 89 }, { overallGuess: 60, nameTokens: [] });

    expect(penalized).toBeLessThan(base);
  });
});

describe('computeFinalConfidence', () => {
  it('retorna confiança 0 sem candidatos', () => {
    expect(computeFinalConfidence(0.9, [])).toEqual({ confidence: 0, ambiguous: false });
  });

  it('não marca ambíguo quando só há 1 candidato', () => {
    const result = computeFinalConfidence(0.95, [{ playerCardId: 'c1', playerId: 'p1', score: 0.95 }]);

    expect(result.ambiguous).toBe(false);
    expect(result.confidence).toBeCloseTo(0.9025, 4);
  });

  it('marca ambíguo e penaliza quando 2 candidatos ficam próximos (várias versões/carta duplicada)', () => {
    const result = computeFinalConfidence(0.9, [
      { playerCardId: 'c1', playerId: 'p1', score: 0.9 },
      { playerCardId: 'c2', playerId: 'p1', score: 0.88 },
    ]);

    expect(result.ambiguous).toBe(true);
  });

  it('não marca ambíguo quando o 2º candidato está bem atrás', () => {
    const result = computeFinalConfidence(0.9, [
      { playerCardId: 'c1', playerId: 'p1', score: 0.95 },
      { playerCardId: 'c2', playerId: 'p2', score: 0.3 },
    ]);

    expect(result.ambiguous).toBe(false);
  });
});

describe('decideScanOutcome', () => {
  it('identifica automaticamente acima de 0.90', () => {
    expect(decideScanOutcome(0.95)).toBe('AUTO_IDENTIFIED');
  });

  it('pede confirmação entre 0.60 e 0.90', () => {
    expect(decideScanOutcome(0.75)).toBe('NEEDS_CONFIRMATION');
    expect(decideScanOutcome(0.6)).toBe('NEEDS_CONFIRMATION');
  });

  it('pede nova imagem abaixo de 0.60', () => {
    expect(decideScanOutcome(0.59)).toBe('NEEDS_NEW_IMAGE');
    expect(decideScanOutcome(0)).toBe('NEEDS_NEW_IMAGE');
  });
});
