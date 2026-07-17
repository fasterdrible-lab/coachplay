import * as http from 'http';
import { LocalCaptureController } from './local-capture-controller';
import { InvalidTransitionError } from './capture-session-state';

const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function readJsonBody(req: http.IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1_000_000) reject(new Error('Corpo da requisição muito grande'));
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('JSON inválido'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) });
  res.end(payload);
}

/**
 * Servidor HTTP local (127.0.0.1 apenas) que expõe os endpoints
 * `/local/capture/*` descritos em docs/REMOTE_PLAY_CAPTURE.md.
 *
 * Só existe para desacoplar a UI (renderer) e ferramentas de diagnóstico da
 * lógica de captura em si (que fica atrás da interface LocalCaptureController).
 * Nunca escuta em outra interface além de loopback — qualquer requisição vinda
 * de fora é rejeitada mesmo que o bind falhe silenciosamente por algum motivo.
 */
export function createLocalCaptureServer(controller: LocalCaptureController): http.Server {
  const server = http.createServer(async (req, res) => {
    const remoteAddress = req.socket.remoteAddress ?? '';
    if (!LOOPBACK_ADDRESSES.has(remoteAddress)) {
      sendJson(res, 403, { error: 'Conexões externas não são permitidas' });
      return;
    }

    const url = new URL(req.url ?? '/', 'http://localhost');
    const { pathname } = url;

    try {
      if (req.method === 'GET' && pathname === '/local/capture/health') {
        return sendJson(res, 200, { status: 'ok' });
      }

      if (req.method === 'GET' && pathname === '/local/capture/sources') {
        const sources = await controller.listSources();
        return sendJson(res, 200, { sources });
      }

      if (req.method === 'POST' && pathname === '/local/capture/start') {
        const body = await readJsonBody(req);
        if (!body.sourceType || !body.sourceName) {
          return sendJson(res, 400, { error: 'sourceType e sourceName são obrigatórios' });
        }
        const snapshot = await controller.start(body as never);
        return sendJson(res, 200, snapshot);
      }

      if (req.method === 'POST' && pathname === '/local/capture/pause') {
        const snapshot = await controller.pause();
        return sendJson(res, 200, snapshot);
      }

      if (req.method === 'POST' && pathname === '/local/capture/stop') {
        const body = await readJsonBody(req);
        const snapshot = await controller.stop(body.errorMessage as string | undefined);
        return sendJson(res, 200, snapshot);
      }

      if (req.method === 'GET' && pathname === '/local/capture/preview') {
        return sendJson(res, 200, controller.getPreview());
      }

      sendJson(res, 404, { error: 'Rota não encontrada' });
    } catch (err) {
      if (err instanceof InvalidTransitionError) {
        return sendJson(res, 409, { error: err.message });
      }
      sendJson(res, 500, { error: (err as Error).message ?? 'Erro interno' });
    }
  });

  return server;
}
