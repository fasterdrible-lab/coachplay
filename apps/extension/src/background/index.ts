import { MESSAGE_TYPES } from '../shared/messages';
import { sessionStore } from './session-store';
import { BackendClient, SessionExpiredError } from './backend-client';
import { captureManager } from './capture-manager';

const backend = new BackendClient();
const XBOX_REMOTE_PLAY_PATTERN = /^https:\/\/www\.xbox\.com\/.*\/play\//;

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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id || !tab.url || !XBOX_REMOTE_PLAY_PATTERN.test(tab.url)) {
    throw new Error('Abra a aba do Xbox Remote Play (xbox.com/.../play/...) e deixe-a ativa antes de iniciar.');
  }
  return captureManager.start(matchId, { id: tab.id, title: tab.title });
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case MESSAGE_TYPES.AUTH_LOGIN:
          sendResponse({ ok: true, data: await handleLogin(message.email, message.password) });
          break;
        case MESSAGE_TYPES.AUTH_STATUS:
          sendResponse({
            ok: true,
            data: { user: (await sessionStore.getAuth()).user, expiredReason: await sessionStore.takeAuthExpiredReason() },
          });
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
          sendResponse({ ok: true, data: await captureManager.pause() });
          break;
        case MESSAGE_TYPES.CAPTURE_RESUME:
          sendResponse({ ok: true, data: await captureManager.resume() });
          break;
        case MESSAGE_TYPES.CAPTURE_STOP:
          sendResponse({ ok: true, data: await captureManager.stop() });
          break;
        case MESSAGE_TYPES.CAPTURE_STATUS:
          sendResponse({ ok: true, data: await captureManager.getSnapshot() });
          break;
        default:
          sendResponse({ ok: false, error: `Mensagem desconhecida: ${message?.type}` });
      }
    } catch (err) {
      // Qualquer chamada interativa (listar partidas, iniciar captura, pausar...) que esbarre
      // num token expirado limpa o login aqui — CaptureManager/providers tratam separadamente
      // o caso de expirar em pleno upload de frame (ver VideoElementCaptureProvider.handleFrame
      // e StreamPipeline.uploadBlob), incluindo parar a captura. Efeito: a próxima abertura do
      // popup já mostra a tela de login com o motivo, em vez de repetir o mesmo erro a cada clique.
      if (err instanceof SessionExpiredError) await sessionStore.setAuthExpired(err.message);
      sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  })();

  return true; // mantém o canal aberto pra resposta assíncrona
});
