import { CaptureSessionState, InvalidCaptureTransitionError } from '../src/shared/capture-state-machine';

describe('CaptureSessionState', () => {
  it('percorre o ciclo feliz completo: idle -> starting -> running -> paused -> running -> stopping -> stopped', () => {
    const state = new CaptureSessionState();
    expect(state.getSnapshot().state).toBe('idle');

    state.begin();
    expect(state.getSnapshot().state).toBe('starting');

    state.markRunning();
    expect(state.getSnapshot().state).toBe('running');

    state.pause();
    expect(state.getSnapshot().state).toBe('paused');

    state.resume();
    expect(state.getSnapshot().state).toBe('running');

    state.requestStop();
    expect(state.getSnapshot().state).toBe('stopping');

    state.markStopped();
    expect(state.getSnapshot().state).toBe('stopped');
  });

  it('permite reiniciar depois de stopped ou failed', () => {
    const state = new CaptureSessionState();
    state.begin();
    state.markStartFailed('deu ruim');
    expect(state.getSnapshot().state).toBe('failed');
    expect(state.getSnapshot().errorMessage).toBe('deu ruim');

    state.begin();
    expect(state.getSnapshot().state).toBe('starting');
    expect(state.getSnapshot().errorMessage).toBeNull();
  });

  it.each([
    ['idle', 'running'],
    ['stopped', 'paused'],
    ['failed', 'running'],
    ['idle', 'paused'],
  ] as const)('rejeita a transição inválida %s -> %s', (from, to) => {
    const state = new CaptureSessionState();
    if (from === 'stopped') {
      state.begin();
      state.markRunning();
      state.requestStop();
      state.markStopped();
    }
    if (from === 'failed') {
      state.begin();
      state.markStartFailed('x');
    }
    if (from === 'idle') {
      // já começa idle
    }

    expect(() => {
      switch (to) {
        case 'running':
          state.markRunning();
          break;
        case 'paused':
          state.pause();
          break;
      }
    }).toThrow(InvalidCaptureTransitionError);
  });

  it('markStreamLost/markReconnected preserva "running" quando perdido a partir de running', () => {
    const state = new CaptureSessionState();
    state.begin();
    state.markRunning();

    state.markStreamLost();
    expect(state.getSnapshot().state).toBe('reconnecting');

    state.markReconnected();
    expect(state.getSnapshot().state).toBe('running');
  });

  it('markStreamLost/markReconnected preserva "paused" quando perdido a partir de paused', () => {
    const state = new CaptureSessionState();
    state.begin();
    state.markRunning();
    state.pause();

    state.markStreamLost();
    expect(state.getSnapshot().state).toBe('reconnecting');

    state.markReconnected();
    expect(state.getSnapshot().state).toBe('paused');
  });

  it('markReconnectFailed move para failed com a mensagem', () => {
    const state = new CaptureSessionState();
    state.begin();
    state.markRunning();
    state.markStreamLost();

    state.markReconnectFailed('sem internet');
    expect(state.getSnapshot()).toEqual({ state: 'failed', errorMessage: 'sem internet' });
  });

  it('requestStop a partir de idle é um no-op (nunca há nada rodando pra parar)', () => {
    const state = new CaptureSessionState();
    state.requestStop();
    expect(state.getSnapshot().state).toBe('idle');
  });

  it('isActive só é true em running/paused/reconnecting', () => {
    const state = new CaptureSessionState();
    expect(state.isActive()).toBe(false);
    state.begin();
    expect(state.isActive()).toBe(false);
    state.markRunning();
    expect(state.isActive()).toBe(true);
    state.pause();
    expect(state.isActive()).toBe(true);
    state.markStreamLost();
    expect(state.isActive()).toBe(true);
    state.markReconnectFailed('x');
    expect(state.isActive()).toBe(false);
  });
});
