import { CaptureSessionState, InvalidTransitionError } from '../src/main/capture-session-state';

describe('CaptureSessionState', () => {
  it('começa em "starting" e vai para "running" ao iniciar', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'window', name: 'Xbox' });

    expect(state.getSnapshot().status).toBe('running');
    expect(state.getSnapshot().sourceName).toBe('Xbox');
  });

  it('permite pausar e retomar uma sessão em execução', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'monitor', name: 'Monitor 1' });

    state.pause();
    expect(state.getSnapshot().status).toBe('paused');

    state.resume();
    expect(state.getSnapshot().status).toBe('running');
  });

  it('rejeita retomar uma sessão que já está em execução', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'window', name: 'Xbox' });

    expect(() => state.resume()).toThrow(InvalidTransitionError);
  });

  it('rejeita pausar uma sessão que ainda não começou', () => {
    const state = new CaptureSessionState();

    expect(() => state.pause()).toThrow(InvalidTransitionError);
  });

  it('marca endedAt ao parar', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'window', name: 'Xbox' });

    state.stop();

    const snapshot = state.getSnapshot();
    expect(snapshot.status).toBe('stopped');
    expect(snapshot.endedAt).not.toBeNull();
  });

  it('registra a mensagem de erro ao falhar (ex.: janela fechada)', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'window', name: 'Xbox' });

    state.fail('Janela do Remote Play foi fechada');

    const snapshot = state.getSnapshot();
    expect(snapshot.status).toBe('failed');
    expect(snapshot.errorMessage).toBe('Janela do Remote Play foi fechada');
  });

  it('não permite nenhuma transição a partir de um estado terminal (stopped)', () => {
    const state = new CaptureSessionState();
    state.start({ type: 'window', name: 'Xbox' });
    state.stop();

    expect(() => state.pause()).toThrow(InvalidTransitionError);
    expect(() => state.resume()).toThrow(InvalidTransitionError);
  });

  it('isActive() é verdadeiro apenas em running/paused', () => {
    const state = new CaptureSessionState();
    expect(state.isActive()).toBe(false);

    state.start({ type: 'region', name: 'Recorte manual' });
    expect(state.isActive()).toBe(true);

    state.pause();
    expect(state.isActive()).toBe(true);

    state.stop();
    expect(state.isActive()).toBe(false);
  });
});
