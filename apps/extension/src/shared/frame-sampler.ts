export interface Clock {
  now(): number;
}

const realClock: Clock = { now: () => Date.now() };

// Decide, independentemente do tick de processamento, se já passou tempo suficiente pra admitir
// mais um frame na camada de análise (analysisFps) — é o que separa "processado localmente" de
// "enviado pra API".
export class FrameSampler {
  private targetFps: number;
  private lastSampledAt: number | null = null;
  private readonly clock: Clock;

  constructor(targetFps: number, clock: Clock = realClock) {
    this.targetFps = Math.max(targetFps, 0.001);
    this.clock = clock;
  }

  setTargetFps(fps: number): void {
    this.targetFps = Math.max(fps, 0.001);
  }

  shouldSample(): boolean {
    const now = this.clock.now();
    const minIntervalMs = 1000 / this.targetFps;
    if (this.lastSampledAt === null || now - this.lastSampledAt >= minIntervalMs) {
      this.lastSampledAt = now;
      return true;
    }
    return false;
  }

  reset(): void {
    this.lastSampledAt = null;
  }
}
