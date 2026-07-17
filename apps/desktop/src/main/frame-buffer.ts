/**
 * Buffer circular dos últimos N segundos de frames capturados.
 *
 * Objetivo (ver docs/REMOTE_PLAY_CAPTURE.md — Plano de processamento local):
 * quando um evento relevante for detectado (Fase 2+), o sistema precisa dos
 * frames de alguns segundos antes e depois — não faz sentido guardar tudo
 * indefinidamente, então o buffer descarta o mais antigo automaticamente.
 */

export interface BufferedFrame {
  timestampMs: number;
  filePath: string;
}

export class FrameBuffer {
  private frames: BufferedFrame[] = [];

  constructor(private readonly retentionMs: number = 30_000) {}

  push(frame: BufferedFrame): BufferedFrame[] {
    this.frames.push(frame);
    return this.evictOlderThan(frame.timestampMs - this.retentionMs);
  }

  private evictOlderThan(cutoffMs: number): BufferedFrame[] {
    const evicted: BufferedFrame[] = [];
    while (this.frames.length > 0 && this.frames[0].timestampMs < cutoffMs) {
      evicted.push(this.frames.shift()!);
    }
    return evicted;
  }

  /** Frames dentro de [timestampMs - beforeMs, timestampMs + afterMs] — usado para gerar um VideoSegment em torno de um evento. */
  getWindow(timestampMs: number, beforeMs: number, afterMs: number): BufferedFrame[] {
    const start = timestampMs - beforeMs;
    const end = timestampMs + afterMs;
    return this.frames.filter((f) => f.timestampMs >= start && f.timestampMs <= end);
  }

  clear(): BufferedFrame[] {
    const all = this.frames;
    this.frames = [];
    return all;
  }

  size(): number {
    return this.frames.length;
  }
}
