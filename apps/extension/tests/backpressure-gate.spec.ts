import { LatestFrameBuffer } from '../src/shared/backpressure-gate';

describe('LatestFrameBuffer', () => {
  it('drain() de um gate vazio retorna null', () => {
    const gate = new LatestFrameBuffer<string>();
    expect(gate.drain()).toBeNull();
    expect(gate.hasPending).toBe(false);
  });

  it('push seguido de drain devolve o mesmo frame', () => {
    const gate = new LatestFrameBuffer<string>();
    const { droppedPrevious } = gate.push('frame-1');
    expect(droppedPrevious).toBe(false);
    expect(gate.hasPending).toBe(true);
    expect(gate.drain()).toBe('frame-1');
    expect(gate.hasPending).toBe(false);
  });

  it('empurrar um novo frame antes de drenar descarta o anterior e mantém só o mais novo', () => {
    const gate = new LatestFrameBuffer<string>();
    gate.push('frame-1');
    const { droppedPrevious } = gate.push('frame-2');

    expect(droppedPrevious).toBe(true);
    expect(gate.dropped).toBe(1);
    expect(gate.drain()).toBe('frame-2');
  });

  it('conta múltiplos descartes corretamente', () => {
    const gate = new LatestFrameBuffer<number>();
    gate.push(1);
    gate.push(2);
    gate.push(3);
    expect(gate.dropped).toBe(2);
    expect(gate.drain()).toBe(3);
    expect(gate.dropped).toBe(2);
  });

  it('nunca mantém mais de um slot pendente (máximo 1 upload pendente)', () => {
    const gate = new LatestFrameBuffer<number>();
    for (let i = 0; i < 10; i++) gate.push(i);
    expect(gate.drain()).toBe(9);
    expect(gate.drain()).toBeNull();
  });
});
