import { FrameSampler, Clock } from '../src/shared/frame-sampler';

class FakeClock implements Clock {
  current = 0;
  now(): number {
    return this.current;
  }
  advance(ms: number): void {
    this.current += ms;
  }
}

describe('FrameSampler', () => {
  it('sempre amostra a primeira chamada', () => {
    const clock = new FakeClock();
    const sampler = new FrameSampler(1, clock);
    expect(sampler.shouldSample()).toBe(true);
  });

  it('rejeita chamadas dentro do intervalo mínimo (1000/fps)', () => {
    const clock = new FakeClock();
    const sampler = new FrameSampler(1, clock); // 1000ms de intervalo mínimo
    expect(sampler.shouldSample()).toBe(true);

    clock.advance(500);
    expect(sampler.shouldSample()).toBe(false);

    clock.advance(400);
    expect(sampler.shouldSample()).toBe(false);
  });

  it('volta a amostrar depois que o intervalo elapsed', () => {
    const clock = new FakeClock();
    const sampler = new FrameSampler(2, clock); // 500ms de intervalo mínimo
    expect(sampler.shouldSample()).toBe(true);

    clock.advance(499);
    expect(sampler.shouldSample()).toBe(false);

    clock.advance(1);
    expect(sampler.shouldSample()).toBe(true);
  });

  it('setTargetFps altera o intervalo imediatamente', () => {
    const clock = new FakeClock();
    const sampler = new FrameSampler(1, clock); // 1000ms
    expect(sampler.shouldSample()).toBe(true);

    sampler.setTargetFps(10); // 100ms
    clock.advance(100);
    expect(sampler.shouldSample()).toBe(true);
  });

  it('reset() esquece o último timestamp amostrado', () => {
    const clock = new FakeClock();
    const sampler = new FrameSampler(1, clock);
    expect(sampler.shouldSample()).toBe(true);
    clock.advance(1);
    expect(sampler.shouldSample()).toBe(false);

    sampler.reset();
    expect(sampler.shouldSample()).toBe(true);
  });
});
