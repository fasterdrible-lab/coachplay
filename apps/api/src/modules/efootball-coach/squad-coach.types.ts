export interface SquadCoachStartingPlayer {
  slot: string;
  position: string;
  playerName: string;
  overallBase: number;
}

export type SquadCoachWeakReason = 'EMPTY' | 'OUT_OF_POSITION';

export interface SquadCoachWeakPosition {
  slot: string;
  position: string;
  reason: SquadCoachWeakReason;
}

/** Já 100% resolvido (nomes, contagens) antes de chegar aqui — o AI Coach nunca consulta o
 * banco nem recalcula nada do Squad Builder, só narra o que já foi decidido (Tarefa 9). */
export interface SquadCoachContext {
  formationCode: string;
  startingXI: SquadCoachStartingPlayer[];
  weakPositions: SquadCoachWeakPosition[];
  rosterCompositionByGroup: Record<string, number>;
}

export interface SquadCoachExplanation {
  explanation: string;
  modelUsed: string;
  /** USD, calculado a partir de `response.usage` do provedor que teve sucesso (Tarefa 20). */
  costEstimate: number;
}
