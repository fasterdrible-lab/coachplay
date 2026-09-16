import { BuildStrategy } from '../player-build-engine/player-build-engine.config';

/** Já 100% resolvido (nomes, números) antes de chegar aqui — mesmo princípio do
 * `SquadCoachContext` (Tarefa 10): o AI Coach nunca recalcula a alocação do Player Build Engine
 * (Tarefa 5), só narra o resultado já pronto (Tarefa 14 — Ask Coach). */
export interface BuildCoachContext {
  playerName: string;
  position: string;
  strategy: BuildStrategy;
  level: number;
  roleScore: number;
  totalPointsUsed: number;
  totalPointsAvailable: number;
  prioritizedStats: string[];
  topGains: Array<{ statKey: string; delta: number }>;
}

export interface BuildCoachExplanation {
  explanation: string;
  modelUsed: string;
  /** USD, calculado a partir de `response.usage` do provedor que teve sucesso (Tarefa 20). */
  costEstimate: number;
}
