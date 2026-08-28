import { CaptureManager } from '../src/background/capture-manager';
import type { CaptureProvider, CaptureProviderEvents } from '../src/background/providers/types';
import type { BackendClient } from '../src/background/backend-client';
import type { sessionStore } from '../src/background/session-store';

function makeProvider(id: 'tab-capture' | 'video-element', overrides: Partial<CaptureProvider> = {}): CaptureProvider {
  return {
    id,
    isSupported: jest.fn().mockResolvedValue(true),
    start: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn().mockResolvedValue(undefined),
    resume: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
    setTargetFps: jest.fn(),
    ...overrides,
  };
}

function makeBackend(): BackendClient {
  return {
    login: jest.fn(),
    listMatches: jest.fn(),
    createMatch: jest.fn(),
    createCaptureSession: jest.fn().mockResolvedValue({ id: 'session-1', status: 'running' }),
    transitionSession: jest.fn().mockResolvedValue({ id: 'session-1', status: 'running' }),
    uploadFrame: jest.fn(),
  } as unknown as BackendClient;
}

function makeStore(): typeof sessionStore {
  return {
    getAll: jest.fn(),
    getAuth: jest.fn().mockResolvedValue({ accessToken: 'token-123', user: null }),
    setAuth: jest.fn(),
    clearAuth: jest.fn(),
    setAuthExpired: jest.fn(),
    takeAuthExpiredReason: jest.fn(),
    getCapture: jest.fn().mockResolvedValue({
      sessionId: null,
      tabId: null,
      state: null,
      provider: null,
      startedAt: null,
      fps: null,
      errorMessage: null,
    }),
    setCaptureStarted: jest.fn(),
    setCaptureRuntime: jest.fn(),
    clearCapture: jest.fn(),
  } as unknown as typeof sessionStore;
}

function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const TAB = { id: 42, title: 'Xbox Remote Play' };

describe('CaptureManager', () => {
  it('usa o provider primário quando ele funciona', async () => {
    const tabCapture = makeProvider('tab-capture');
    const videoElement = makeProvider('video-element');
    const manager = new CaptureManager({ providers: [tabCapture, videoElement], backend: makeBackend(), store: makeStore() });

    const snapshot = await manager.start(undefined, TAB);

    expect(tabCapture.start).toHaveBeenCalledTimes(1);
    expect(videoElement.start).not.toHaveBeenCalled();
    expect(snapshot?.state).toBe('running');
    expect(snapshot?.provider).toBe('tab-capture');
  });

  it('cai para o fallback quando o provider primário não é suportado', async () => {
    const tabCapture = makeProvider('tab-capture', { isSupported: jest.fn().mockResolvedValue(false) });
    const videoElement = makeProvider('video-element');
    const manager = new CaptureManager({ providers: [tabCapture, videoElement], backend: makeBackend(), store: makeStore() });

    const snapshot = await manager.start(undefined, TAB);

    expect(tabCapture.start).not.toHaveBeenCalled();
    expect(videoElement.start).toHaveBeenCalledTimes(1);
    expect(snapshot?.provider).toBe('video-element');
  });

  it('rejeita start() quando todos os providers falham', async () => {
    const tabCapture = makeProvider('tab-capture', { start: jest.fn().mockRejectedValue(new Error('sem tabCapture')) });
    const videoElement = makeProvider('video-element', { start: jest.fn().mockRejectedValue(new Error('sem video')) });
    const manager = new CaptureManager({ providers: [tabCapture, videoElement], backend: makeBackend(), store: makeStore() });

    await expect(manager.start(undefined, TAB)).rejects.toThrow(/Nenhum provider de captura dispon/);
  });

  it('pause/resume/stop chamam o provider ativo e o backend.transitionSession', async () => {
    const tabCapture = makeProvider('tab-capture');
    const backend = makeBackend();
    const manager = new CaptureManager({ providers: [tabCapture, makeProvider('video-element')], backend, store: makeStore() });
    await manager.start(undefined, TAB);

    await manager.pause();
    expect(tabCapture.pause).toHaveBeenCalledTimes(1);
    expect(backend.transitionSession).toHaveBeenCalledWith('token-123', 'session-1', 'pause');

    await manager.resume();
    expect(tabCapture.resume).toHaveBeenCalledTimes(1);
    expect(backend.transitionSession).toHaveBeenCalledWith('token-123', 'session-1', 'resume');

    await manager.stop();
    expect(tabCapture.stop).toHaveBeenCalledTimes(1);
    expect(backend.transitionSession).toHaveBeenCalledWith('token-123', 'session-1', 'stop');
  });

  it('handleProviderUnavailable troca para o provider alternativo uma única vez antes de falhar', async () => {
    const tabCapture = makeProvider('tab-capture');
    const videoElement = makeProvider('video-element');
    const manager = new CaptureManager({ providers: [tabCapture, videoElement], backend: makeBackend(), store: makeStore() });
    await manager.start(undefined, TAB);

    // Captura o objeto de eventos que o CaptureManager passou ao provider ativo, para simular o
    // provider reportando indisponibilidade — mesmo mecanismo real usado por TabCaptureProvider
    // ao receber um OFFSCREEN_ERROR não fatal.
    const events = (tabCapture.start as jest.Mock).mock.calls[0][1] as CaptureProviderEvents;

    events.onProviderUnavailable('stream caiu');
    await flushPromises(); // handleProviderUnavailable roda fire-and-forget dentro do events builder

    expect(videoElement.start).toHaveBeenCalledTimes(1);
    expect(tabCapture.stop).toHaveBeenCalledTimes(1);

    const snapshot = await manager.getSnapshot();
    expect(snapshot?.provider).toBe('video-element');
    expect(snapshot?.state).toBe('running');
  });

  it('quando o provider alternativo também falha, a sessão termina failed (nunca tenta um terceiro)', async () => {
    const tabCapture = makeProvider('tab-capture');
    const videoElement = makeProvider('video-element', { start: jest.fn().mockRejectedValue(new Error('sem video')) });
    const backend = makeBackend();
    const manager = new CaptureManager({ providers: [tabCapture, videoElement], backend, store: makeStore() });
    await manager.start(undefined, TAB);

    const events = (tabCapture.start as jest.Mock).mock.calls[0][1] as CaptureProviderEvents;
    events.onFatalError('stream morreu de vez');
    await flushPromises();

    expect(videoElement.start).toHaveBeenCalledTimes(1);
    const snapshot = await manager.getSnapshot();
    expect(snapshot?.state).toBe('failed');
    expect(snapshot?.errorMessage).toBe('stream morreu de vez');
    expect(backend.transitionSession).toHaveBeenCalledWith('token-123', 'session-1', 'stop', 'stream morreu de vez');
  });
});
