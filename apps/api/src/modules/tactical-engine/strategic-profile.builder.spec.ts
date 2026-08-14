import { TacticalPattern } from './tactical-pattern.type';
import { buildStrategicProfile } from './strategic-profile.builder';

function pattern(overrides: Partial<TacticalPattern> & Pick<TacticalPattern, 'pattern'>): TacticalPattern {
  return {
    frequency: 5,
    confidence: 80,
    severity: 'MEDIUM',
    firstDetectedAt: new Date('2026-08-01'),
    lastDetectedAt: new Date('2026-08-10'),
    ...overrides,
  };
}

describe('buildStrategicProfile', () => {
  it('separa padrões _NEGLECTED em neglectedPrinciples e _STRENGTH em dominantPrinciples', () => {
    const profile = buildStrategicProfile([
      pattern({ pattern: 'KING_SAFETY_NEGLECTED' }),
      pattern({ pattern: 'SPACE_EXPANSION_STRENGTH' }),
    ]);

    expect(profile.neglectedPrinciples).toEqual(['KING_SAFETY']);
    expect(profile.dominantPrinciples).toEqual(['SPACE_EXPANSION']);
  });

  it('ordena neglectedPrinciples por severidade decrescente, empate por confiança', () => {
    const profile = buildStrategicProfile([
      pattern({ pattern: 'PIECE_ACTIVITY_NEGLECTED', severity: 'MEDIUM', confidence: 90 }),
      pattern({ pattern: 'KING_SAFETY_NEGLECTED', severity: 'HIGH', confidence: 70 }),
      pattern({ pattern: 'OVERLOAD_NEGLECTED', severity: 'MEDIUM', confidence: 95 }),
    ]);

    expect(profile.neglectedPrinciples).toEqual(['KING_SAFETY', 'OVERLOAD', 'PIECE_ACTIVITY']);
  });

  it('ordena dominantPrinciples por confiança decrescente', () => {
    const profile = buildStrategicProfile([
      pattern({ pattern: 'CENTRAL_CONTROL_STRENGTH', confidence: 88 }),
      pattern({ pattern: 'INITIATIVE_STRENGTH', confidence: 95 }),
    ]);

    expect(profile.dominantPrinciples).toEqual(['INITIATIVE', 'CENTRAL_CONTROL']);
  });

  it('sampleSize soma frequency de todos os padrões considerados', () => {
    const profile = buildStrategicProfile([
      pattern({ pattern: 'KING_SAFETY_NEGLECTED', frequency: 4 }),
      pattern({ pattern: 'SPACE_EXPANSION_STRENGTH', frequency: 9 }),
    ]);

    expect(profile.sampleSize).toBe(13);
  });

  it('lista vazia de padrões produz um perfil vazio, não erro', () => {
    expect(buildStrategicProfile([])).toEqual({ dominantPrinciples: [], neglectedPrinciples: [], sampleSize: 0 });
  });
});
