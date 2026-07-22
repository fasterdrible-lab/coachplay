import type { AuthenticatedUser, CaptureSessionStatus } from '../shared/messages';

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
  captureSessionId: string | null;
  captureTabId: number | null;
  captureStatus: CaptureSessionStatus | null;
  captureStartedAt: number | null;
  captureAnalysisFps: number | null;
  captureErrorMessage: string | null;
}

const DEFAULTS: StoredState = {
  accessToken: null,
  user: null,
  captureSessionId: null,
  captureTabId: null,
  captureStatus: null,
  captureStartedAt: null,
  captureAnalysisFps: null,
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

  async getCapture(): Promise<{
    sessionId: string | null;
    tabId: number | null;
    status: CaptureSessionStatus | null;
    startedAt: number | null;
    analysisFps: number | null;
    errorMessage: string | null;
  }> {
    const state = await getAll();
    return {
      sessionId: state.captureSessionId,
      tabId: state.captureTabId,
      status: state.captureStatus,
      startedAt: state.captureStartedAt,
      analysisFps: state.captureAnalysisFps,
      errorMessage: state.captureErrorMessage,
    };
  },

  async setCaptureStarted(params: {
    sessionId: string;
    tabId: number;
    startedAt: number;
    analysisFps: number;
  }): Promise<void> {
    await patch({
      captureSessionId: params.sessionId,
      captureTabId: params.tabId,
      captureStatus: 'running',
      captureStartedAt: params.startedAt,
      captureAnalysisFps: params.analysisFps,
      captureErrorMessage: null,
    });
  },

  async setCaptureStatus(status: CaptureSessionStatus, errorMessage: string | null = null): Promise<void> {
    await patch({ captureStatus: status, captureErrorMessage: errorMessage });
  },

  async clearCapture(): Promise<void> {
    await patch({
      captureSessionId: null,
      captureTabId: null,
      captureStatus: null,
      captureStartedAt: null,
      captureAnalysisFps: null,
      captureErrorMessage: null,
    });
  },
};
