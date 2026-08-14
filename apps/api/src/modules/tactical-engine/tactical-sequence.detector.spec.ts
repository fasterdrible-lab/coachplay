import { TacticalAction } from './tactical-action.type';
import { TacticalSequenceStep } from './tactical-sequence-step.type';
import { detectTacticalSequences } from './tactical-sequence.detector';
import { PitchChannel, PitchThird } from './pitch-zone';

function step(overrides: Partial<TacticalSequenceStep> & { timestampMs: number }): TacticalSequenceStep {
  const action: TacticalAction = { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 80 };
  return {
    action,
    pressureLevel: 'LOW',
    classification: 'GOOD',
    ...overrides,
  } as TacticalSequenceStep;
}

describe('detectTacticalSequences', () => {
  it('lista vazia não detecta nada', () => {
    expect(detectTacticalSequences([])).toEqual([]);
  });

  it('detecta SWITCH_OF_PLAY para cada ação SWITCH_SIDE', () => {
    const steps = [
      step({ timestampMs: 1000, action: { type: 'SWITCH_SIDE', estimatedRisk: 10, estimatedReward: 60 } }),
      step({ timestampMs: 2000, action: { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 60 } }),
    ];

    const sequences = detectTacticalSequences(steps);
    expect(sequences).toHaveLength(1);
    expect(sequences[0]).toMatchObject({ type: 'SWITCH_OF_PLAY', startTimestampMs: 1000, endTimestampMs: 1000, decisionCount: 1 });
  });

  it('detecta CIRCULATION_UNDER_PRESSURE em uma sequência de 3+ passes seguros sob pressão média+', () => {
    const steps = [
      step({ timestampMs: 1000, pressureLevel: 'MEDIUM', action: { type: 'SAFE_PASS', estimatedRisk: 10, estimatedReward: 60 } }),
      step({ timestampMs: 2000, pressureLevel: 'HIGH', action: { type: 'RECYCLE', estimatedRisk: 10, estimatedReward: 60 } }),
      step({ timestampMs: 3000, pressureLevel: 'MEDIUM', action: { type: 'PASS', estimatedRisk: 10, estimatedReward: 60 } }),
    ];

    const sequences = detectTacticalSequences(steps);
    const circulation = sequences.find((s) => s.type === 'CIRCULATION_UNDER_PRESSURE');
    expect(circulation).toMatchObject({ startTimestampMs: 1000, endTimestampMs: 3000, decisionCount: 3 });
  });

  it('não detecta CIRCULATION_UNDER_PRESSURE com apenas 2 passes seguros (abaixo do mínimo)', () => {
    const steps = [
      step({ timestampMs: 1000, pressureLevel: 'MEDIUM' }),
      step({ timestampMs: 2000, pressureLevel: 'MEDIUM' }),
    ];

    expect(detectTacticalSequences(steps).some((s) => s.type === 'CIRCULATION_UNDER_PRESSURE')).toBe(false);
  });

  it('um ERRO no meio interrompe a sequência de circulação (não conta como run contínuo)', () => {
    const steps = [
      step({ timestampMs: 1000, pressureLevel: 'MEDIUM' }),
      step({ timestampMs: 2000, pressureLevel: 'MEDIUM', classification: 'ERROR' }),
      step({ timestampMs: 3000, pressureLevel: 'MEDIUM' }),
    ];

    expect(detectTacticalSequences(steps).some((s) => s.type === 'CIRCULATION_UNDER_PRESSURE')).toBe(false);
  });

  it('detecta CENTRAL_PROGRESSION em 2+ ações progressivas seguidas pelo corredor central', () => {
    const progressiveAction: TacticalAction = {
      type: 'PROGRESSIVE_PASS',
      estimatedRisk: 20,
      estimatedReward: 70,
      targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.CENTRAL_CHANNEL },
    };
    const steps = [
      step({ timestampMs: 1000, action: progressiveAction }),
      step({ timestampMs: 2000, action: { ...progressiveAction, type: 'CARRY' } }),
    ];

    const sequences = detectTacticalSequences(steps);
    expect(sequences.some((s) => s.type === 'CENTRAL_PROGRESSION')).toBe(true);
  });

  it('não detecta CENTRAL_PROGRESSION quando o corredor-alvo não é central', () => {
    const wideAction: TacticalAction = {
      type: 'PROGRESSIVE_PASS',
      estimatedRisk: 20,
      estimatedReward: 70,
      targetZone: { third: PitchThird.ATTACKING_THIRD, channel: PitchChannel.RIGHT_CHANNEL },
    };
    const steps = [step({ timestampMs: 1000, action: wideAction }), step({ timestampMs: 2000, action: wideAction })];

    expect(detectTacticalSequences(steps).some((s) => s.type === 'CENTRAL_PROGRESSION')).toBe(false);
  });

  it('detecta PRESSURE_ESCAPE quando uma boa decisão sob pressão alta é seguida de queda de pressão', () => {
    const steps = [
      step({ timestampMs: 1000, pressureLevel: 'CRITICAL', classification: 'GOOD' }),
      step({ timestampMs: 1500, pressureLevel: 'LOW', classification: 'ACCEPTABLE' }),
    ];

    const sequences = detectTacticalSequences(steps);
    expect(sequences.some((s) => s.type === 'PRESSURE_ESCAPE')).toBe(true);
  });

  it('não detecta PRESSURE_ESCAPE se a decisão sob pressão foi ruim', () => {
    const steps = [
      step({ timestampMs: 1000, pressureLevel: 'CRITICAL', classification: 'ERROR' }),
      step({ timestampMs: 1500, pressureLevel: 'LOW' }),
    ];

    expect(detectTacticalSequences(steps).some((s) => s.type === 'PRESSURE_ESCAPE')).toBe(false);
  });

  it('detecta DANGEROUS_LOSS quando um erro grave ocorre sob pressão alta', () => {
    const steps = [step({ timestampMs: 1000, pressureLevel: 'HIGH', classification: 'MAJOR_ERROR' })];

    const sequences = detectTacticalSequences(steps);
    expect(sequences).toContainEqual(
      expect.objectContaining({ type: 'DANGEROUS_LOSS', startTimestampMs: 1000, endTimestampMs: 1000 }),
    );
  });

  it('não detecta DANGEROUS_LOSS quando o erro ocorre sob pressão baixa', () => {
    const steps = [step({ timestampMs: 1000, pressureLevel: 'LOW', classification: 'MAJOR_ERROR' })];

    expect(detectTacticalSequences(steps).some((s) => s.type === 'DANGEROUS_LOSS')).toBe(false);
  });

  it('resultado final vem ordenado por startTimestampMs crescente', () => {
    const steps = [
      step({ timestampMs: 5000, pressureLevel: 'HIGH', classification: 'MAJOR_ERROR' }),
      step({ timestampMs: 1000, action: { type: 'SWITCH_SIDE', estimatedRisk: 10, estimatedReward: 60 } }),
    ];

    const sequences = detectTacticalSequences(steps);
    for (let i = 1; i < sequences.length; i++) {
      expect(sequences[i].startTimestampMs).toBeGreaterThanOrEqual(sequences[i - 1].startTimestampMs);
    }
  });
});
