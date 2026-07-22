/**
 * Escolhe qual <video> da página é o player do Remote Play, sem depender de
 * um seletor CSS específico do Xbox (a marcação deles pode mudar a qualquer
 * momento e quebraria um seletor hardcoded). Heurística: entre os vídeos que
 * estão de fato tocando, o de maior área de exibição — é assim que a maioria
 * das extensões de captura de tela identificam o player principal da página.
 */
export interface VideoCandidate {
  clientWidth: number;
  clientHeight: number;
  readyState: number;
  paused: boolean;
}

const HAVE_CURRENT_DATA = 2;

export function pickBestVideoIndex(candidates: VideoCandidate[]): number {
  let bestIndex = -1;
  let bestArea = 0;

  for (let i = 0; i < candidates.length; i++) {
    const video = candidates[i];
    if (video.paused || video.readyState < HAVE_CURRENT_DATA) continue;

    const area = video.clientWidth * video.clientHeight;
    if (area > bestArea) {
      bestArea = area;
      bestIndex = i;
    }
  }

  return bestIndex;
}
