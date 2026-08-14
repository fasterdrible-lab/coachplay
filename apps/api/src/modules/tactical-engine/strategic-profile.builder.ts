import { TacticalPattern, TacticalPatternSeverity } from './tactical-pattern.type';
import { StrategicPrincipleId } from './strategic-principle.type';
import { StrategicProfile } from './strategic-profile.type';

// Sufixos usados por tactical-pattern.detector.ts (Tarefa 21) — únicas duas formas de
// TacticalPattern.pattern que este builder reconhece. Qualquer outro formato é ignorado (nunca
// lançado como erro: um padrão de origem futura/desconhecida simplesmente não entra no perfil).
const NEGLECTED_SUFFIX = '_NEGLECTED';
const STRENGTH_SUFFIX = '_STRENGTH';

const SEVERITY_RANK: Record<TacticalPatternSeverity, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };

/**
 * Agrega TacticalPattern (Tarefa 21) num StrategicProfile (Tarefa 22) — puramente uma leitura
 * de alto nível dos padrões já detectados, sem recalcular geometria/decisão. Determinístico.
 */
export function buildStrategicProfile(patterns: TacticalPattern[]): StrategicProfile {
  const neglectedPatterns = patterns
    .filter((pattern) => pattern.pattern.endsWith(NEGLECTED_SUFFIX))
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] || b.confidence - a.confidence);

  const strengthPatterns = patterns
    .filter((pattern) => pattern.pattern.endsWith(STRENGTH_SUFFIX))
    .sort((a, b) => b.confidence - a.confidence);

  return {
    neglectedPrinciples: neglectedPatterns.map((pattern) => stripSuffix(pattern.pattern, NEGLECTED_SUFFIX)),
    dominantPrinciples: strengthPatterns.map((pattern) => stripSuffix(pattern.pattern, STRENGTH_SUFFIX)),
    sampleSize: patterns.reduce((sum, pattern) => sum + pattern.frequency, 0),
  };
}

function stripSuffix(pattern: string, suffix: string): StrategicPrincipleId {
  return pattern.slice(0, pattern.length - suffix.length) as StrategicPrincipleId;
}
