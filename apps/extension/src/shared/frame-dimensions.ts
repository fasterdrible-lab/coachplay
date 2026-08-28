export interface Dimensions {
  width: number;
  height: number;
}

// Uma única escala aplicada aos dois eixos — nunca encolhe largura e altura de forma
// independente, então a proporção original é sempre preservada e o frame nunca distorce.
// Nunca amplia (scale é sempre <= 1): fontes menores que o máximo saem do jeito que entraram.
export function calculateOutputDimensions(source: Dimensions, max: Dimensions): Dimensions {
  if (source.width <= 0 || source.height <= 0) {
    return { width: max.width, height: max.height };
  }
  const scale = Math.min(1, max.width / source.width, max.height / source.height);
  return {
    width: Math.max(1, Math.round(source.width * scale)),
    height: Math.max(1, Math.round(source.height * scale)),
  };
}
