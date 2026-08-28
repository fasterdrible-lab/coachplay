import type { AuthenticatedUser, CaptureProviderId } from '../shared/messages';
import type { CaptureState } from '../shared/capture-state-machine';
import type { FpsTiers } from '../shared/capture-config';

/**
 * chrome.storage.session (não chrome.storage.local!): fica só em memória do
 * navegador, nunca é gravado em disco, e some ao fechar o Chrome — mesmo
 * princípio de privacidade do apps/desktop (token só em memória do processo
 * main). É necessário porque o service worker do Manifest V3 é reciclado a
 * qualquer momento de ociosidade; uma variável de módulo comum se perderia a
 * cada reinício, mas chrome.storage.session sobrevive a esses reinícios
 * dentro da mesma sessão do navegador.
 */
interface StoredState {
  accessToken: string | null;
  user: AuthenticatedUser | null;
  // Motivo pelo qual o login foi limpo à força (ex.: token de acesso expirou em pleno
  // meio de uma captura — ver SessionExpiredError em backend-client.ts). Lido uma única
  // vez pelo popup (takeAuthExpiredReason) e então descartado, pra não ficar exibindo a
  // mesma mensagem depois que o usuário já logou de novo.
  authExpiredReason: string | null;
  captureSessionId: string | null;
  captureTabId: number | null;
  captureState: CaptureState | null;
  captureProvider: CaptureProviderId | null;
  captureStartedAt: number | null;
  captureFps: FpsTiers | null;
  captureErrorMessage: string | null;
}

const DEFAULTS: StoredState = {
  accessToken: null,
  user: null,
  authExpiredReason: null,
  captureSessionId: null,
  captureTabId: null,
  captureState: null,
  captureProvider: null,
  captureStartedAt: null,
  captureFps: null,
  captureErrorMessage: null,
};

async function getAll(): Promise<StoredState> {
  const stored = (await chrome.storage.session.get(DEFAULTS)) as StoredState;
  return { ...DEFAULTS, ...stored };
}

async function patch(update: Partial<StoredState>): Promise<void> {
  await chrome.storage.session.set(update);
}

export const sessionStore = {
  getAll,

  async getAuth(): Promise<{ accessToken: string | null; user: AuthenticatedUser | null }> {
    const { accessToken, user } = await getAll();
    return { accessToken, user };
  },

  async setAuth(accessToken: string, user: AuthenticatedUser): Promise<void> {
    await patch({ accessToken, user });
  },

  async clearAuth(): Promise<void> {
    await patch({ accessToken: null, user: null });
  },

  // Chamado quando uma chamada autenticada volta com 401 em pleno uso (o access token do
  // Coach Play dura só 15min — ver JWT_ACCESS_EXPIRES_IN — e esta extensão ainda não tem
  // como renovar silenciosamente: o refresh_token é um cookie SameSite=Strict, nunca
  // enviado por um fetch originado de chrome-extension://). Limpa o login (força a tela de
  // login na próxima abertura do popup) e guarda o motivo pra exibir lá.
  async setAuthExpired(reason: string): Promise<void> {
    await patch({ accessToken: null, user: null, authExpiredReason: reason });
  },

  async takeAuthExpiredReason(): Promise<string | null> {
    const { authExpiredReason } = await getAll();
    if (authExpiredReason) await patch({ authExpiredReason: null });
    return authExpiredReason;
  },

  async getCapture(): Promise<{
    sessionId: string | null;
    tabId: number | null;
    state: CaptureState | null;
    provider: CaptureProviderId | null;
    startedAt: number | null;
    fps: FpsTiers | null;
    errorMessage: string | null;
  }> {
    const state = await getAll();
    return {
      sessionId: state.captureSessionId,
      tabId: state.captureTabId,
      state: state.captureState,
      provider: state.captureProvider,
      startedAt: state.captureStartedAt,
      fps: state.captureFps,
      errorMessage: state.captureErrorMessage,
    };
  },

  async setCaptureStarted(params: {
    sessionId: string;
    tabId: number;
    startedAt: number;
    provider: CaptureProviderId;
    fps: FpsTiers;
  }): Promise<void> {
    await patch({
      captureSessionId: params.sessionId,
      captureTabId: params.tabId,
      captureState: 'running',
      captureProvider: params.provider,
      captureStartedAt: params.startedAt,
      captureFps: params.fps,
      captureErrorMessage: null,
    });
  },

  // Atualiza só o estado/provider/erro de uma sessão já iniciada (pause/resume/reconnect/fail) —
  // não mexe em sessionId/tabId/startedAt/fps, que não mudam depois do início.
  async setCaptureRuntime(update: {
    state: CaptureState;
    provider: CaptureProviderId | null;
    errorMessage: string | null;
  }): Promise<void> {
    await patch({
      captureState: update.state,
      captureProvider: update.provider,
      captureErrorMessage: update.errorMessage,
    });
  },

  async clearCapture(): Promise<void> {
    await patch({
      captureSessionId: null,
      captureTabId: null,
      captureState: null,
      captureProvider: null,
      captureStartedAt: null,
      captureFps: null,
      captureErrorMessage: null,
    });
  },
};
