import { FormationDef } from './formations.catalog';
import { positionCompatibility } from './position-compatibility';

export interface SquadCandidate {
  userPlayerId: string;
  position: string;
  overallBase: number;
}

export interface SquadSlotAssignment {
  slot: string;
  position: string;
  userPlayerId: string;
  score: number;
  exactPosition: boolean;
}

export interface SquadAlternative {
  slot: string;
  candidates: Array<{ userPlayerId: string; score: number }>;
}

export type WeakPositionReason = 'EMPTY' | 'OUT_OF_POSITION';

export interface WeakPosition {
  slot: string;
  position: string;
  reason: WeakPositionReason;
}

export interface BuildSquadResult {
  formationCode: string;
  startingXI: SquadSlotAssignment[];
  bench: string[];
  weakPositions: WeakPosition[];
  alternatives: SquadAlternative[];
}

function dedupeById(roster: SquadCandidate[]): SquadCandidate[] {
  const seen = new Map<string, SquadCandidate>();
  for (const candidate of roster) {
    if (!seen.has(candidate.userPlayerId)) seen.set(candidate.userPlayerId, candidate);
  }
  return [...seen.values()];
}

/**
 * Motor determinístico do Squad Builder (Tarefa 9) — sem IA. Slot a slot, na ordem do catálogo
 * da formação, escolhe o candidato disponível com maior score (compatibilidade de posição ×
 * overall); nunca reaproveita um jogador já escalado, nunca preenche um slot com um candidato de
 * grupo posicional incompatível (score 0 nunca é elegível). Como toda formação do catálogo tem
 * exatamente 11 slots e exatamente 1 slot GK, o resultado nunca escala mais de 11 jogadores nem
 * mais de 1 goleiro simultaneamente.
 */
export function buildSquad(formation: FormationDef, roster: SquadCandidate[]): BuildSquadResult {
  if (formation.slots.length !== 11) {
    throw new Error(`Formação "${formation.code}" inválida: esperava 11 posições, tem ${formation.slots.length}`);
  }

  const uniqueRoster = dedupeById(roster);
  const used = new Set<string>();
  const startingXI: SquadSlotAssignment[] = [];
  const weakPositions: WeakPosition[] = [];
  const alternatives: SquadAlternative[] = [];

  for (const slot of formation.slots) {
    const ranked = uniqueRoster
      .filter((c) => !used.has(c.userPlayerId))
      .map((c) => ({
        candidate: c,
        compat: positionCompatibility(c.position, slot.position),
        score: positionCompatibility(c.position, slot.position) * (0.5 + 0.5 * (c.overallBase / 99)),
      }))
      .filter((c) => c.compat > 0)
      .sort(
        (a, b) => b.score - a.score || a.candidate.userPlayerId.localeCompare(b.candidate.userPlayerId),
      );

    if (ranked.length === 0) {
      weakPositions.push({ slot: slot.slot, position: slot.position, reason: 'EMPTY' });
      alternatives.push({ slot: slot.slot, candidates: [] });
      continue;
    }

    const [best, ...rest] = ranked;
    used.add(best.candidate.userPlayerId);

    startingXI.push({
      slot: slot.slot,
      position: slot.position,
      userPlayerId: best.candidate.userPlayerId,
      score: best.score,
      exactPosition: best.compat === 1,
    });

    if (best.compat < 1) {
      weakPositions.push({ slot: slot.slot, position: slot.position, reason: 'OUT_OF_POSITION' });
    }

    alternatives.push({
      slot: slot.slot,
      candidates: rest.slice(0, 3).map((c) => ({ userPlayerId: c.candidate.userPlayerId, score: c.score })),
    });
  }

  const bench = uniqueRoster
    .filter((c) => !used.has(c.userPlayerId))
    .sort((a, b) => b.overallBase - a.overallBase || a.userPlayerId.localeCompare(b.userPlayerId))
    .map((c) => c.userPlayerId);

  return { formationCode: formation.code, startingXI, bench, weakPositions, alternatives };
}
