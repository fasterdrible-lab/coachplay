import { pickBestVideoIndex, VideoCandidate } from '../src/shared/video-picker';

function video(overrides: Partial<VideoCandidate> = {}): VideoCandidate {
  return { clientWidth: 640, clientHeight: 360, readyState: 2, paused: false, ...overrides };
}

describe('pickBestVideoIndex', () => {
  it('retorna -1 quando não há nenhum vídeo', () => {
    expect(pickBestVideoIndex([])).toBe(-1);
  });

  it('ignora vídeos pausados', () => {
    const candidates = [video({ paused: true }), video({ clientWidth: 100, clientHeight: 100 })];
    expect(pickBestVideoIndex(candidates)).toBe(1);
  });

  it('ignora vídeos sem dados prontos (readyState abaixo de HAVE_CURRENT_DATA)', () => {
    const candidates = [video({ readyState: 1 }), video({ clientWidth: 320, clientHeight: 180 })];
    expect(pickBestVideoIndex(candidates)).toBe(1);
  });

  it('escolhe o vídeo de maior área entre os que estão tocando', () => {
    const candidates = [
      video({ clientWidth: 320, clientHeight: 180 }),
      video({ clientWidth: 1280, clientHeight: 720 }),
      video({ clientWidth: 640, clientHeight: 360 }),
    ];
    expect(pickBestVideoIndex(candidates)).toBe(1);
  });

  it('retorna -1 quando nenhum candidato está tocando de verdade', () => {
    const candidates = [video({ paused: true }), video({ readyState: 0 })];
    expect(pickBestVideoIndex(candidates)).toBe(-1);
  });
});
