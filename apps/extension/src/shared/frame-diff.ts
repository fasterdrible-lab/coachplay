// Assinatura barata de um frame: média estridada dos bytes RGBA (não pixel-a-pixel completo) —
// suficiente pra detectar "tela praticamente parada" sem custar caro a cada tick de processamento.
export function computeFrameSignature(frame: { data: Uint8ClampedArray | Uint8Array }): number {
  const { data } = frame;
  if (data.length === 0) return 0;
  let sum = 0;
  const step = data.length % 4 === 0 ? 4 : 1;
  let count = 0;
  for (let i = 0; i < data.length; i += step) {
    sum += data[i];
    count++;
  }
  return count === 0 ? 0 : sum / count;
}

export function hasFrameChanged(previous: number | null, current: number, threshold: number): boolean {
  if (previous === null) return true;
  return Math.abs(current - previous) >= threshold;
}
