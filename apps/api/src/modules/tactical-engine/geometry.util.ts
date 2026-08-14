import { PitchCoordinate } from './pitch-coordinate.type';

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function euclideanDistance(a: PitchCoordinate, b: PitchCoordinate): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/**
 * Parâmetro t da projeção de `point` sobre a reta que passa por `from`→`to`.
 * t=0 é `from`, t=1 é `to`. Fora de [0,1] o ponto projetado cai fora do segmento
 * (útil para decidir se um adversário está "entre" o passador e o receptor).
 */
export function projectionParameter(from: PitchCoordinate, to: PitchCoordinate, point: PitchCoordinate): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return 0;
  return ((point.x - from.x) * dx + (point.y - from.y) * dy) / lengthSquared;
}

/** Distância perpendicular de `point` até a reta (infinita) que passa por `from`→`to`. */
export function perpendicularDistance(from: PitchCoordinate, to: PitchCoordinate, point: PitchCoordinate): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return euclideanDistance(from, point);
  const cross = dx * (point.y - from.y) - dy * (point.x - from.x);
  return Math.abs(cross) / length;
}
