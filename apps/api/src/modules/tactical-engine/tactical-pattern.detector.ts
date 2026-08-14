import { PatternObservation, TacticalPattern, TacticalPatternSeverity } from './tactical-pattern.type';
import { StrategicPrincipleId } from './strategic-principle.type';

// Amostra mínima de observações do mesmo princípio (entre partidas) para sequer considerar um
// padrão — evita apontar "recorrência" a partir de 1-2 instantes isolados.
const MIN_SAMPLE_SIZE = 3;
// Taxa de violação (0-1) a partir da qual um princípio recorrentemente negligenciado vira
// padrão "_NEGLECTED".
const NEGLECT_RATE_THRESHOLD = 0.6;
// Taxa de aderência (0-1) a partir da qual um princípio consistentemente seguido vira padrão
// "_STRENGTH" — mais exigente que o limiar de negligência: um ponto forte precisa de mais
// consistência para ser destacado do que um problema precisa para ser sinalizado.
const STRENGTH_RATE_THRESHOLD = 0.85;
// Acima desta taxa de violação, a severidade do padrão "_NEGLECTED" sobe de MEDIUM para HIGH.
const HIGH_SEVERITY_RATE = 0.85;

/**
 * Detecta padrões táticos recorrentes de UM usuário através de MÚLTIPLAS partidas (Tarefa 21),
 * a partir de observações de aderência a princípios já resolvidas (adhered !== null — ver
 * PatternObservation). Puramente determinístico, sem IA generativa. Só padrões com amostra e
 * consistência suficientes são retornados — "sem confiança suficiente, não apontar padrão",
 * mesma regra já aplicada em decision.evaluator.ts (Tarefa 15/30).
 */
export function detectTacticalPatterns(observations: PatternObservation[]): TacticalPattern[] {
  const byPrinciple = groupByPrinciple(observations);
  const patterns: TacticalPattern[] = [];

  for (const [principleId, group] of byPrinciple) {
    if (group.length < MIN_SAMPLE_SIZE) continue;

    const violations = group.filter((observation) => !observation.adhered);
    const violationRate = violations.length / group.length;
    const adherenceRate = 1 - violationRate;

    if (violationRate >= NEGLECT_RATE_THRESHOLD) {
      patterns.push(buildPattern(`${principleId}_NEGLECTED`, violations, violationRate, severityFromRate(violationRate)));
    } else if (adherenceRate >= STRENGTH_RATE_THRESHOLD) {
      const adherences = group.filter((observation) => observation.adhered);
      patterns.push(buildPattern(`${principleId}_STRENGTH`, adherences, adherenceRate, 'LOW'));
    }
  }

  return patterns.sort((a, b) => b.confidence - a.confidence || a.pattern.localeCompare(b.pattern));
}

function groupByPrinciple(observations: PatternObservation[]): Map<StrategicPrincipleId, PatternObservation[]> {
  const groups = new Map<StrategicPrincipleId, PatternObservation[]>();
  for (const observation of observations) {
    const group = groups.get(observation.principleId) ?? [];
    group.push(observation);
    groups.set(observation.principleId, group);
  }
  return groups;
}

function severityFromRate(rate: number): TacticalPatternSeverity {
  return rate >= HIGH_SEVERITY_RATE ? 'HIGH' : 'MEDIUM';
}

function buildPattern(
  pattern: string,
  contributing: PatternObservation[],
  rate: number,
  severity: TacticalPatternSeverity,
): TacticalPattern {
  const timestamps = contributing.map((observation) => observation.occurredAt.getTime());

  return {
    pattern,
    frequency: contributing.length,
    confidence: Math.round(rate * 100),
    severity,
    firstDetectedAt: new Date(Math.min(...timestamps)),
    lastDetectedAt: new Date(Math.max(...timestamps)),
  };
}
