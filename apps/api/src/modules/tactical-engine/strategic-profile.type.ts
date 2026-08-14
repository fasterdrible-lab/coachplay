import { StrategicPrincipleId } from './strategic-principle.type';

// Ver docs/tactical-engine-domain.md e TASKS.md (Fase 4, Tarefa 22) — perfil estratégico
// evolutivo do usuário, agregado a partir dos TacticalPattern (Tarefa 21) já detectados entre
// partidas. Não recalcula nada geométrico por si só; é uma leitura de alto nível dos padrões.
export interface StrategicProfile {
  // Princípios com padrão "_STRENGTH" — mais confiante primeiro.
  dominantPrinciples: StrategicPrincipleId[];
  // Princípios com padrão "_NEGLECTED" — mais severo primeiro, empate por confiança.
  neglectedPrinciples: StrategicPrincipleId[];
  // Soma de frequency de todos os padrões considerados — tamanho da amostra que sustenta o perfil.
  sampleSize: number;
}
