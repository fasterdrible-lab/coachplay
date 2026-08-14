import { TacticalActionType } from './tactical-action.type';
import { PressureLevel } from './pressure-state.type';
import { DecisionClassification } from './decision-classification';
import { TacticalSequence, TacticalSequenceType } from './tactical-sequence.type';
import { TacticalSequenceStep } from './tactical-sequence-step.type';
import { PitchChannel } from './pitch-zone';

const MIN_CIRCULATION_STEPS = 3;
const MIN_PROGRESSION_STEPS = 2;

const PRESSURE_LEVEL_ORDER: Record<PressureLevel, number> = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };
const CENTRAL_CHANNELS: ReadonlySet<PitchChannel> = new Set([
  PitchChannel.LEFT_HALF_SPACE,
  PitchChannel.CENTRAL_CHANNEL,
  PitchChannel.RIGHT_HALF_SPACE,
]);
const SAFE_TYPES: ReadonlySet<TacticalActionType> = new Set(['PASS', 'SAFE_PASS', 'RECYCLE']);
const PROGRESSIVE_TYPES: ReadonlySet<TacticalActionType> = new Set(['PROGRESSIVE_PASS', 'CARRY']);
const NEGATIVE_CLASSIFICATIONS: ReadonlySet<DecisionClassification> = new Set(['ERROR', 'MAJOR_ERROR']);
const POSITIVE_CLASSIFICATIONS: ReadonlySet<DecisionClassification> = new Set(['GOOD', 'EXCELLENT']);

/**
 * Detecta padrões táticos reconhecíveis numa sequência ORDENADA (por timestamp) de decisões já
 * avaliadas de uma mesma partida. Determinístico — nenhuma IA generativa envolvida. Só
 * sequências relevantes são retornadas (Tarefa 17: "persistir somente sequências relevantes").
 */
export function detectTacticalSequences(steps: TacticalSequenceStep[]): TacticalSequence[] {
  return [
    ...detectSwitchOfPlay(steps),
    ...detectCirculationUnderPressure(steps),
    ...detectCentralProgression(steps),
    ...detectPressureEscape(steps),
    ...detectDangerousLoss(steps),
  ].sort((a, b) => a.startTimestampMs - b.startTimestampMs);
}

function detectSwitchOfPlay(steps: TacticalSequenceStep[]): TacticalSequence[] {
  return steps
    .filter((step) => step.action.type === 'SWITCH_SIDE')
    .map((step) => buildSequence('SWITCH_OF_PLAY', step, step, 1, 'Mudança de corredor de jogo detectada.'));
}

function detectCirculationUnderPressure(steps: TacticalSequenceStep[]): TacticalSequence[] {
  return detectRuns(
    steps,
    (step) =>
      SAFE_TYPES.has(step.action.type) &&
      PRESSURE_LEVEL_ORDER[step.pressureLevel] >= PRESSURE_LEVEL_ORDER.MEDIUM &&
      !NEGATIVE_CLASSIFICATIONS.has(step.classification),
    MIN_CIRCULATION_STEPS,
    'CIRCULATION_UNDER_PRESSURE',
    'Circulação de bola segura mantida mesmo sob pressão adversária.',
  );
}

function detectCentralProgression(steps: TacticalSequenceStep[]): TacticalSequence[] {
  return detectRuns(
    steps,
    (step) =>
      PROGRESSIVE_TYPES.has(step.action.type) &&
      !!step.action.targetZone &&
      CENTRAL_CHANNELS.has(step.action.targetZone.channel),
    MIN_PROGRESSION_STEPS,
    'CENTRAL_PROGRESSION',
    'Progressão sustentada pelo corredor central.',
  );
}

function detectPressureEscape(steps: TacticalSequenceStep[]): TacticalSequence[] {
  const sequences: TacticalSequence[] = [];

  for (let i = 1; i < steps.length; i++) {
    const previous = steps[i - 1];
    const current = steps[i];
    const wasUnderPressure = PRESSURE_LEVEL_ORDER[previous.pressureLevel] >= PRESSURE_LEVEL_ORDER.HIGH;
    const escaped = PRESSURE_LEVEL_ORDER[current.pressureLevel] <= PRESSURE_LEVEL_ORDER.MEDIUM;
    const goodDecision = POSITIVE_CLASSIFICATIONS.has(previous.classification);

    if (wasUnderPressure && escaped && goodDecision) {
      sequences.push(buildSequence('PRESSURE_ESCAPE', previous, current, 2, 'Saída de pressão bem-sucedida.'));
    }
  }

  return sequences;
}

function detectDangerousLoss(steps: TacticalSequenceStep[]): TacticalSequence[] {
  return steps
    .filter(
      (step) =>
        NEGATIVE_CLASSIFICATIONS.has(step.classification) &&
        PRESSURE_LEVEL_ORDER[step.pressureLevel] >= PRESSURE_LEVEL_ORDER.HIGH,
    )
    .map((step) => buildSequence('DANGEROUS_LOSS', step, step, 1, 'Perda de posse perigosa sob pressão alta.'));
}

// Percorre `steps` procurando trechos contíguos maximais que satisfazem `predicate`, com
// comprimento mínimo `minLength`. Um único passe pela lista — O(n).
function detectRuns(
  steps: TacticalSequenceStep[],
  predicate: (step: TacticalSequenceStep) => boolean,
  minLength: number,
  type: TacticalSequenceType,
  description: string,
): TacticalSequence[] {
  const sequences: TacticalSequence[] = [];
  let runStart = -1;

  for (let i = 0; i <= steps.length; i++) {
    const matches = i < steps.length && predicate(steps[i]);

    if (matches && runStart === -1) {
      runStart = i;
    } else if (!matches && runStart !== -1) {
      const runLength = i - runStart;
      if (runLength >= minLength) {
        sequences.push(buildSequence(type, steps[runStart], steps[i - 1], runLength, description));
      }
      runStart = -1;
    }
  }

  return sequences;
}

function buildSequence(
  type: TacticalSequenceType,
  start: TacticalSequenceStep,
  end: TacticalSequenceStep,
  decisionCount: number,
  description: string,
): TacticalSequence {
  return {
    type,
    startTimestampMs: start.timestampMs,
    endTimestampMs: end.timestampMs,
    decisionCount,
    description,
  };
}
