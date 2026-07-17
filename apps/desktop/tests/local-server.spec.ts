import type { AddressInfo } from 'net';
import { createLocalCaptureServer } from '../src/main/local-server';
import { CaptureSessionSnapshot } from '../src/main/capture-session-state';
import { LocalCaptureController } from '../src/main/local-capture-controller';

function makeFakeController(overrides: Partial<LocalCaptureController> = {}): LocalCaptureController {
  const runningSnapshot: CaptureSessionSnapshot = {
    status: 'running',
    sourceType: 'window',
    sourceName: 'Xbox',
    captureFps: 2,
    analysisFps: 1,
    startedAt: Date.now(),
    endedAt: null,
    errorMessage: null,
  };

  return {
    listSources: async () => [{ id: 'win-1', name: 'Xbox', type: 'window' }],
    start: async () => runningSnapshot,
    pause: async () => ({ ...runningSnapshot, status: 'paused' }),
    stop: async () => ({ ...runningSnapshot, status: 'stopped', endedAt: Date.now() }),
    getStatus: () => runningSnapshot,
    getPreview: () => ({ hasFrame: true, framePath: '/tmp/frame.png', timestampMs: Date.now() }),
    ...overrides,
  };
}

describe('local capture server', () => {
  let server: ReturnType<typeof createLocalCaptureServer>;
  let baseUrl: string;

  function start(controller: LocalCaptureController) {
    server = createLocalCaptureServer(controller);
    return new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => {
        const { port } = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  }

  afterEach(() => {
    server?.close();
  });

  it('GET /local/capture/health responde ok', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/health`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ status: 'ok' });
  });

  it('GET /local/capture/sources delega para o controller', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/sources`);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sources).toEqual([{ id: 'win-1', name: 'Xbox', type: 'window' }]);
  });

  it('POST /local/capture/start exige sourceType e sourceName', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    expect(res.status).toBe(400);
  });

  it('POST /local/capture/start retorna o snapshot da sessão iniciada', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceType: 'window', sourceName: 'Xbox' }),
    });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.status).toBe('running');
  });

  it('retorna 409 quando o controller lança InvalidTransitionError', async () => {
    const { InvalidTransitionError } = await import('../src/main/capture-session-state');
    await start(
      makeFakeController({
        pause: async () => {
          throw new InvalidTransitionError('stopped', 'paused');
        },
      }),
    );

    const res = await fetch(`${baseUrl}/local/capture/pause`, { method: 'POST' });

    expect(res.status).toBe(409);
  });

  it('GET /local/capture/preview retorna o último frame', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/preview`);
    const body = await res.json();

    expect(body.hasFrame).toBe(true);
    expect(body.framePath).toBe('/tmp/frame.png');
  });

  it('responde 404 para rota desconhecida', async () => {
    await start(makeFakeController());

    const res = await fetch(`${baseUrl}/local/capture/unknown`);

    expect(res.status).toBe(404);
  });
});
