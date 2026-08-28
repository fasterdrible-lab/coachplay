export type FrameDropReason = 'diff-gate' | 'sampler-skip' | 'backpressure';

export interface CaptureMetricsSnapshot {
  framesCaptured: number;
  framesProcessed: number;
  framesUploaded: number;
  framesDropped: { diffGate: number; samplerSkip: number; backpressure: number };
  uploadLatencyMsAvg: number;
  uploadLatencyMsLast: number;
  restartCount: number;
  activeProvider: string | null;
}

function emptySnapshot(): CaptureMetricsSnapshot {
  return {
    framesCaptured: 0,
    framesProcessed: 0,
    framesUploaded: 0,
    framesDropped: { diffGate: 0, samplerSkip: 0, backpressure: 0 },
    uploadLatencyMsAvg: 0,
    uploadLatencyMsLast: 0,
    restartCount: 0,
    activeProvider: null,
  };
}

export class CaptureMetrics {
  private snap: CaptureMetricsSnapshot = emptySnapshot();
  private latencySum = 0;

  recordCaptured(): void {
    this.snap.framesCaptured++;
  }

  recordProcessed(): void {
    this.snap.framesProcessed++;
  }

  recordUploaded(latencyMs: number): void {
    this.snap.framesUploaded++;
    this.latencySum += latencyMs;
    this.snap.uploadLatencyMsLast = latencyMs;
    this.snap.uploadLatencyMsAvg = this.latencySum / this.snap.framesUploaded;
  }

  recordDropped(reason: FrameDropReason): void {
    if (reason === 'diff-gate') this.snap.framesDropped.diffGate++;
    if (reason === 'sampler-skip') this.snap.framesDropped.samplerSkip++;
    if (reason === 'backpressure') this.snap.framesDropped.backpressure++;
  }

  recordRestart(): void {
    this.snap.restartCount++;
  }

  setActiveProvider(id: string | null): void {
    this.snap.activeProvider = id;
  }

  snapshot(): CaptureMetricsSnapshot {
    return { ...this.snap, framesDropped: { ...this.snap.framesDropped } };
  }

  reset(): void {
    this.snap = emptySnapshot();
    this.latencySum = 0;
  }
}
