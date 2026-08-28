// Buffer de um único slot: no máximo 1 upload pendente por vez. Se um novo frame chega antes do
// anterior ter sido drenado (ainda em upload), o anterior é descartado — o Coach Play precisa do
// frame mais recente, não de uma fila atrasada.
export class LatestFrameBuffer<T> {
  private slot: T | null = null;
  private droppedCount = 0;

  push(frame: T): { droppedPrevious: boolean } {
    const droppedPrevious = this.slot !== null;
    if (droppedPrevious) this.droppedCount++;
    this.slot = frame;
    return { droppedPrevious };
  }

  drain(): T | null {
    const frame = this.slot;
    this.slot = null;
    return frame;
  }

  get dropped(): number {
    return this.droppedCount;
  }

  get hasPending(): boolean {
    return this.slot !== null;
  }
}
