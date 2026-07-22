import { MESSAGE_TYPES, CaptureSessionSnapshot, StartSamplingPayload, ContentFramePayload } from '../shared/messages';
import { sessionStore } from './session-store';
import { BackendClient } from './backend-client';
import { base64ToArrayBuffer } from '../shared/binary';

const backend = new BackendClient();
const ANALYSIS_FPS = 1;
const CAPTURE_FPS = 2;
const XBOX_REMOTE_PLAY_PATTERN = /^https:\/\/www\.xbox\.com\/.*\/play\//;

async function buildSnapshot(): Promise<CaptureSessionSnapshot | null> {
  const capture = await sessionStore.getCapture();
  if (!capture.status) return null;
  return {
    status: capture.status,
    startedAt: capture.startedAt,
    analysisFps: capture.analysisFps ?? ANALYSIS_FPS,
    errorMessage: capture.errorMessage,
  };
}

async function handleLogin(email: string, password: string) {
  const { accessToken, user } = await backend.login(email, password);
  await sessionStore.setAuth(accessToken, user);
  return user;
}

async function handleLogout() {
  await sessionStore.clearAuth();
}

async function handleMatchesList() {
  const { accessToken } = await sessionStore.getAuth();
  if (!accessToken) throw new Error('Não autenticado.');
  return backend.listMatches(accessToken);
}

async function handleMatchesCreate(title?: string) {
  const { accessToken } = await sessionStore.getAuth();
  if (!accessToken) throw new Error('Não autenticado.');
  return backend.createMatch(accessToken, { title });
}

async function handleCaptureStart(matchId?: string) {
  const { accessToken } = await sessionStore.getAuth();
  if (!accessToken) throw new Error('Não autenticado — faça login antes de iniciar a captura.');

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !XBOX_REMOTE_PLAY_PATTERN.test(tab.url)) {
    throw new Error('Abra a aba do Xbox Remote Play (xbox.com/.../play/...) e deixe-a ativa antes de iniciar.');
  }

  const session = await backend.createCaptureSession(accessToken, {
    matchId,
    sourceType: 'window',
    sourceName: tab.title ?? 'Xbox Remote Play',
    captureFps: CAPTURE_FPS,
    analysisFps: ANALYSIS_FPS,
  });

  const startedAt = Date.now();
  await sessionStore.setCaptureStarted({
    sessionId: session.id,
    tabId: tab.id,
    startedAt,
    analysisFps: ANALYSIS_FPS,
  });

  const payload: StartSamplingPayload = { sessionStartedAt: startedAt, analysisFps: ANALYSIS_FPS };
  await chrome.tabs.sendMessage(tab.id, { type: MESSAGE_TYPES.CONTENT_START_SAMPLING, payload });

  return buildSnapshot();
}

async function handleCaptureTransition(action: 'pause' | 'resume' | 'stop', errorMessage?: string) {
  const { accessToken } = await sessionStore.getAuth();
  const capture = await sessionStore.getCapture();
  if (!accessToken || !capture.sessionId) throw new Error('Nenhuma sessão de captura ativa.');

  await backend.transitionSession(accessToken, capture.sessionId, action, errorMessage);

  if (action === 'pause') await sessionStore.setCaptureStatus('paused');
  if (action === 'resume') await sessionStore.setCaptureStatus('running');
  if (action === 'stop') {
    if (capture.tabId) {
      await chrome.tabs.sendMessage(capture.tabId, { type: MESSAGE_TYPES.CONTENT_STOP_SAMPLING }).catch(() => {});
    }
    await sessionStore.clearCapture();
    return null;
  }

  return buildSnapshot();
}

async function handleContentFrame(payload: ContentFramePayload) {
  const { accessToken } = await sessionStore.getAuth();
  const capture = await sessionStore.getCapture();
  if (!accessToken || !capture.sessionId || capture.status !== 'running') {
    console.warn('[Coach Play] Frame recebido sem sessão ativa — descartado.', {
      hasToken: !!accessToken,
      sessionId: capture.sessionId,
      status: capture.status,
    });
    return;
  }

  try {
    const buffer = base64ToArrayBuffer(payload.base64);
    await backend.uploadFrame(accessToken, capture.sessionId, buffer, payload.elapsedMs);
  } catch (err) {
    // Falha de rede não derruba a captura local — mesmo princípio do
    // CaptureSessionManager.submitFrame no apps/desktop: o próximo frame
    // tenta de novo, não vale a pena parar a sessão por uma falha pontual.
    console.error('[Coach Play] Falha ao enviar frame para a API:', err);
  }
}

async function handleContentVideoNotFound() {
  const capture = await sessionStore.getCapture();
  const { accessToken } = await sessionStore.getAuth();
  if (!accessToken || !capture.sessionId) return;

  await backend
    .transitionSession(accessToken, capture.sessionId, 'stop', 'O vídeo do Remote Play não foi encontrado na aba.')
    .catch(() => {});
  await sessionStore.setCaptureStatus('failed', 'O vídeo do Remote Play não foi encontrado na aba.');
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case MESSAGE_TYPES.AUTH_LOGIN:
          sendResponse({ ok: true, data: await handleLogin(message.email, message.password) });
          break;
        case MESSAGE_TYPES.AUTH_STATUS:
          sendResponse({ ok: true, data: (await sessionStore.getAuth()).user });
          break;
        case MESSAGE_TYPES.AUTH_LOGOUT:
          await handleLogout();
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.MATCHES_LIST:
          sendResponse({ ok: true, data: await handleMatchesList() });
          break;
        case MESSAGE_TYPES.MATCHES_CREATE:
          sendResponse({ ok: true, data: await handleMatchesCreate(message.title) });
          break;
        case MESSAGE_TYPES.CAPTURE_START:
          sendResponse({ ok: true, data: await handleCaptureStart(message.matchId) });
          break;
        case MESSAGE_TYPES.CAPTURE_PAUSE:
          sendResponse({ ok: true, data: await handleCaptureTransition('pause') });
          break;
        case MESSAGE_TYPES.CAPTURE_RESUME:
          sendResponse({ ok: true, data: await handleCaptureTransition('resume') });
          break;
        case MESSAGE_TYPES.CAPTURE_STOP:
          sendResponse({ ok: true, data: await handleCaptureTransition('stop') });
          break;
        case MESSAGE_TYPES.CAPTURE_STATUS:
          sendResponse({ ok: true, data: await buildSnapshot() });
          break;
        case MESSAGE_TYPES.CONTENT_FRAME:
          await handleContentFrame(message.payload as ContentFramePayload);
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.CONTENT_VIDEO_NOT_FOUND:
          await handleContentVideoNotFound();
          sendResponse({ ok: true, data: null });
          break;
        default:
          sendResponse({ ok: false, error: `Mensagem desconhecida: ${message?.type}` });
      }
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  })();

  return true; // mantém o canal aberto pra resposta assíncrona
});
