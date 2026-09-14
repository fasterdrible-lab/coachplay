import { resolvePositionGroup } from '../player-build-engine/player-build-engine.config';

/**
 * 1   = posição exata (candidato joga exatamente na posição do slot)
 * 0.7 = mesmo grupo posicional, posição diferente (ex.: LWF numa vaga RWF)
 * 0   = grupos diferentes — NUNCA escala fora do grupo posicional (garante que um zagueiro
 *       nunca preenche a vaga de goleiro, por exemplo)
 */
export function positionCompatibility(candidatePosition: string, slotPosition: string): number {
  if (candidatePosition.toUpperCase() === slotPosition.toUpperCase()) return 1;

  try {
    return resolvePositionGroup(candidatePosition) === resolvePositionGroup(slotPosition) ? 0.7 : 0;
  } catch {
    // Posição não reconhecida pelo catálogo (dado de import malformado) — nunca escala.
    return 0;
  }
}
