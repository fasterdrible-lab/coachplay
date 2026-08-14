import { PatternObservation } from './tactical-pattern.type';
import { detectTacticalPatterns } from './tactical-pattern.detector';

function observation(
  principleId: PatternObservation['principleId'],
  adhered: boolean,
  occurredAt: string,
  matchId = 'match-1',
): PatternObservation {
  return { matchId, principleId, adhered, occurredAt: new Date(occurredAt) };
}

describe('detectTacticalPatterns', () => {
  it('amostra abaixo do mínimo (3) não gera nenhum padrão, mesmo com 100% de violação', () => {
    const observations = [
      observation('KING_SAFETY', false, '2026-08-01'),
      observation('KING_SAFETY', false, '2026-08-02'),
    ];

    expect(detectTacticalPatterns(observations)).toEqual([]);
  });

  it('violação recorrente (>=60%) com amostra suficiente vira padrão _NEGLECTED', () => {
    const observations = [
      observation('KING_SAFETY', false, '2026-08-01', 'match-1'),
      observation('KING_SAFETY', false, '2026-08-05', 'match-2'),
      observation('KING_SAFETY', true, '2026-08-10', 'match-3'),
    ];

    const patterns = detectTacticalPatterns(observations);

    expect(patterns).toHaveLength(1);
    expect(patterns[0]).toMatchObject({
      pattern: 'KING_SAFETY_NEGLECTED',
      frequency: 2,
      confidence: 67,
      severity: 'MEDIUM',
    });
    expect(patterns[0].firstDetectedAt).toEqual(new Date('2026-08-01'));
    expect(patterns[0].lastDetectedAt).toEqual(new Date('2026-08-05'));
  });

  it('violação quase total (>=85%) sobe a severidade para HIGH', () => {
    const observations = [
      ...Array.from({ length: 9 }, (_, i) => observation('KING_SAFETY', false, `2026-08-${10 + i}`)),
      observation('KING_SAFETY', true, '2026-08-20'),
    ];

    const patterns = detectTacticalPatterns(observations);

    expect(patterns[0].severity).toBe('HIGH');
    expect(patterns[0].confidence).toBe(90);
  });

  it('aderência muito consistente (>=85%) vira padrão _STRENGTH, sempre severidade LOW', () => {
    const observations = [
      ...Array.from({ length: 9 }, (_, i) => observation('SPACE_EXPANSION', true, `2026-08-${10 + i}`)),
      observation('SPACE_EXPANSION', false, '2026-08-20'),
    ];

    const patterns = detectTacticalPatterns(observations);

    expect(patterns[0]).toMatchObject({
      pattern: 'SPACE_EXPANSION_STRENGTH',
      frequency: 9,
      confidence: 90,
      severity: 'LOW',
    });
  });

  it('taxa mista (nem violação nem aderência consistentes) não gera padrão', () => {
    const observations = [
      observation('PIECE_ACTIVITY', true, '2026-08-01'),
      observation('PIECE_ACTIVITY', false, '2026-08-02'),
      observation('PIECE_ACTIVITY', true, '2026-08-03'),
      observation('PIECE_ACTIVITY', false, '2026-08-04'),
    ];

    expect(detectTacticalPatterns(observations)).toEqual([]);
  });

  it('agrupa por princípio de forma independente e ordena por confiança decrescente', () => {
    const observations = [
      // KING_SAFETY: 3/3 violado = 100%
      observation('KING_SAFETY', false, '2026-08-01'),
      observation('KING_SAFETY', false, '2026-08-02'),
      observation('KING_SAFETY', false, '2026-08-03'),
      // OVERLOAD: 2/3 violado = 67%
      observation('OVERLOAD', false, '2026-08-01'),
      observation('OVERLOAD', false, '2026-08-02'),
      observation('OVERLOAD', true, '2026-08-03'),
    ];

    const patterns = detectTacticalPatterns(observations);

    expect(patterns.map((p) => p.pattern)).toEqual(['KING_SAFETY_NEGLECTED', 'OVERLOAD_NEGLECTED']);
  });
});
