// Posição normalizada e independente de resolução de vídeo.
// x: 0.0 (canal esquerdo, visão do time do usuário) → 1.0 (canal direito)
// y: 0.0 (fundo da própria defesa) → 1.0 (fundo do ataque)
// Ver docs/tactical-engine-domain.md, seção 3 (PitchCoordinate).
export interface PitchCoordinate {
  x: number;
  y: number;
}

export function isValidPitchCoordinate(coordinate: PitchCoordinate): boolean {
  return (
    Number.isFinite(coordinate.x) &&
    Number.isFinite(coordinate.y) &&
    coordinate.x >= 0 &&
    coordinate.x <= 1 &&
    coordinate.y >= 0 &&
    coordinate.y <= 1
  );
}
