// Ver docs/tactical-engine-domain.md, seção 3 (PassingLane). Puramente geométrico —
// nunca calculado via IA generativa.
export interface PassingLane {
  fromPlayerId: string;
  toPlayerId: string;
  distance: number;
  obstructionRisk: number; // 0 (linha livre) a 100 (adversário bloqueando a trajetória)
  pressureRisk: number; // 0 a 100 — risco de o receptor ser pressionado ao receber
  progressionValue: number; // -100 (recuo) a 100 (progressão máxima em direção ao ataque)
  score: number; // 0 a 100 — nota geral da linha de passe
}
