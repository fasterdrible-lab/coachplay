import { StrategicPrincipleId } from './strategic-principle.type';

// Ver docs/tactical-engine-domain.md (TacticalPattern) e TASKS.md (Fase 4, Tarefa 21) —
// recorrência de um mesmo tipo de decisão/princípio através de MÚLTIPLAS partidas do mesmo
// usuário. Diferente de TacticalSequence (Fase 3, Tarefa 17): aquela é uma sequência local
// dentro de UMA partida, esta é agregada entre partidas.
export type TacticalPatternSeverity = 'LOW' | 'MEDIUM' | 'HIGH';

// Uma observação de aderência a um princípio (ver PrincipleAdherence, principle-adherence.type.ts)
// já resolvida (adhered !== null) em um instante de uma partida específica — entrada de
// detectTacticalPatterns(). Observações com adhered === null (princípio não aplicável) não geram
// entrada aqui: um padrão nunca é construído a partir da ausência de julgamento.
export interface PatternObservation {
  matchId: string;
  occurredAt: Date;
  principleId: StrategicPrincipleId;
  adhered: boolean;
}

export interface TacticalPattern {
  // Identificador estável do padrão: "<principleId>_NEGLECTED" (violação recorrente) ou
  // "<principleId>_STRENGTH" (aderência recorrente). Nunca "<principleId>" sozinho — um padrão
  // sempre descreve uma DIREÇÃO (força ou fraqueza), nunca só "este princípio apareceu".
  pattern: string;
  frequency: number;
  confidence: number; // 0-100 — consistência da direção dominante (taxa de violação/aderência)
  severity: TacticalPatternSeverity;
  firstDetectedAt: Date;
  lastDetectedAt: Date;
}
