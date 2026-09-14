export interface StatHeadroom {
  statKey: string;
  baseValue: number;
  maxValue: number;
}

/**
 * Aloca pontos de progressão entre atributos de forma proporcional aos pesos, 1 ponto por vez
 * (round-robin ponderado: a cada rodada, o ponto vai para o atributo com menor razão
 * (alocado+1)/peso, empate por ordem alfabética da chave — determinístico e sem ponto flutuante
 * acumulando erro). Nunca aloca além do headroom (maxValue - baseValue) de cada atributo nem
 * além do total de pontos disponível; se todo headroom elegível se esgota antes de gastar todos
 * os pontos, o restante fica sem uso (nunca "empresta" de um atributo fora do peso da estratégia).
 */
export function allocatePoints(
  stats: StatHeadroom[],
  weights: Partial<Record<string, number>>,
  availablePoints: number,
): Record<string, number> {
  if (availablePoints < 0) {
    throw new Error('availablePoints não pode ser negativo');
  }

  const allocation: Record<string, number> = {};
  const headroom = new Map<string, number>();

  for (const stat of stats) {
    allocation[stat.statKey] = 0;
    const room = Math.max(0, stat.maxValue - stat.baseValue);
    const weight = weights[stat.statKey] ?? 0;
    if (room > 0 && weight > 0) {
      headroom.set(stat.statKey, room);
    }
  }

  let remaining = Math.floor(availablePoints);

  while (remaining > 0 && headroom.size > 0) {
    let bestKey: string | null = null;
    let bestRatio = Infinity;

    for (const key of headroom.keys()) {
      const weight = weights[key]!;
      const ratio = (allocation[key] + 1) / weight;
      if (ratio < bestRatio || (ratio === bestRatio && (bestKey === null || key < bestKey))) {
        bestRatio = ratio;
        bestKey = key;
      }
    }

    // bestKey nunca é null aqui: headroom.size > 0 garante ao menos uma chave candidata
    allocation[bestKey as string] += 1;
    remaining -= 1;

    const room = headroom.get(bestKey as string)!;
    if (allocation[bestKey as string] >= room) {
      headroom.delete(bestKey as string);
    }
  }

  return allocation;
}
