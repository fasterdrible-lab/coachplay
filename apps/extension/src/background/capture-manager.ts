import { BackendClient } from './backend-client';
import { sessionStore } from './session-store';
import { TabCaptureProvider } from './providers/tab-capture-provider';
import { VideoElementCaptureProvider } from './providers/video-element-provider';
import { CaptureSessionState } from '../shared/capture-state-machine';
import { CaptureMetrics } from '../shared/capture-metrics';
import { getBackoffDelayMs } from '../shared/reconnect-backoff';
import {
  DEFAULT_FPS_TIERS,
  DEFAULT_JPEG_QUALITY,
  DEFAULT_MAX_WIDTH,
  DEFAULT_MAX_HEIGHT,
  DEFAULT_DIFF_THRESHOLD,
} from '../shared/capture-config';
import type { CaptureSessionSnapshot } from '../shared/messages';
import type { CaptureProvider, CaptureProviderEvents, CaptureStartParams } from './providers/types';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectAndStart(
  providers: CaptureProvider[],
  params: CaptureStartParams,
  events: CaptureProviderEvents,
): Promise<{ provider: CaptureProvider; index: number }> {
  const failures: string[] = [];
  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    try {
      const supported = await provider.isSupported();
      if (!supported) {
        failures.push(`${provider.id}: não suportado neste contexto.`);
        continue;
      }
      await provider.start(params, events);
      return { provider, index: i };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failures.push(`${provider.id}: ${message}`);
    }
  }
  throw new Error(`Nenhum provider de captura disponível. ${failures.join(' | ')}`);
}

export interface CaptureManagerDeps {
  // Injeção só pra testes — o singleton real (ver o fim deste arquivo) usa os defaults, que
  // batem em chrome.tabCapture/chrome.offscreen/chrome.scripting de verdade.
  providers?: CaptureProvider[];
  backend?: BackendClient;
  store?: typeof sessionStore;
}

export class CaptureManager {
  private readonly backend: BackendClient;
  private readonly store: typeof sessionStore;
  private readonly providers: CaptureProvider[];
  private readonly metrics = new CaptureMetrics();
  private state = new CaptureSessionState();
  private activeProvider: CaptureProvider | null = null;
  private currentParams: CaptureStartParams | null = null;
  private triedProviders = new Set<string>();
  private reconnecting = false;
  private providerEventsRef: CaptureProviderEvents | null = null;
  private rehydratedPromise: Promise<void> | null = null;

  constructor(deps: CaptureManagerDeps = {}) {
    this.backend = deps.backend ?? new BackendClient();
    this.store = deps.store ?? sessionStore;
    this.providers = deps.providers ?? [new TabCaptureProvider(), new VideoElementCaptureProvider(this.backend)];
  }

  private buildEvents(): CaptureProviderEvents {
    return {
      onFrameUploaded: (latencyMs) => this.metrics.recordUploaded(latencyMs),
      onFrameDropped: (reason) => this.metrics.recordDropped(reason),
      onStreamLost: () => {
        void this.handleStreamLost();
      },
      onProviderUnavailable: (reason) => {
        void this.handleProviderUnavailable(reason);
      },
      onFatalError: (reason) => {
        void this.handleFatalError(reason);
      },
    };
  }

  private async persistSnapshot(): Promise<void> {
    if (!this.currentParams) return;
    const snap = this.state.getSnapshot();
    await this.store.setCaptureRuntime({
      state: snap.state,
      provider: this.activeProvider?.id ?? null,
      errorMessage: snap.errorMessage,
    });
  }

  private buildSnapshot(): CaptureSessionSnapshot | null {
    if (!this.currentParams) return null;
    const snap = this.state.getSnapshot();
    return {
      state: snap.state,
      provider: this.activeProvider?.id ?? null,
      startedAt: this.currentParams.sessionStartedAt,
      fps: this.currentParams.fps,
      errorMessage: snap.errorMessage,
      metrics: this.metrics.snapshot(),
    };
  }

  async getSnapshot(): Promise<CaptureSessionSnapshot | null> {
    await this.ensureRehydrated();
    return this.buildSnapshot();
  }

  /**
   * Roda uma única vez por (re)início do service worker, antes do primeiro handler de
   * mensagem relacionado à captura. Necessário porque o offscreen document SOBREVIVE à
   * reciclagem do service worker (MV3 mata o SW após ~30s ocioso, mas não mexe no offscreen
   * document) — sem isso, um restart do SW no meio de uma captura via tabCapture perde todo o
   * estado em memória (CaptureManager, state machine) enquanto o pipeline offscreen continua
   * rodando sozinho, dessincronizado do chrome.storage.session.
   */
  private ensureRehydrated(): Promise<void> {
    if (!this.rehydratedPromise) this.rehydratedPromise = this.rehydrate();
    return this.rehydratedPromise;
  }

  private async rehydrate(): Promise<void> {
    if (this.currentParams) return;
    const capture = await this.store.getCapture();
    if (!capture.sessionId || !capture.provider || !capture.tabId || !capture.startedAt || !capture.fps) return;
    const { accessToken } = await this.store.getAuth();
    if (!accessToken) return;

    const params: CaptureStartParams = {
      tabId: capture.tabId,
      sessionId: capture.sessionId,
      accessToken,
      sessionStartedAt: capture.startedAt,
      fps: capture.fps,
      jpegQuality: DEFAULT_JPEG_QUALITY,
      maxWidth: DEFAULT_MAX_WIDTH,
      maxHeight: DEFAULT_MAX_HEIGHT,
      diffThreshold: DEFAULT_DIFF_THRESHOLD,
    };

    const tabCaptureProvider = this.providers.find((p) => p.id === 'tab-capture');
    if (capture.provider === 'tab-capture' && tabCaptureProvider instanceof TabCaptureProvider) {
      const status = await tabCaptureProvider.queryStatus();
      if (status?.active && status.sessionId === capture.sessionId) {
        this.currentParams = params;
        this.state = new CaptureSessionState();
        this.state.begin();
        this.state.markRunning();
        if (capture.state === 'paused') this.state.pause();
        this.providerEventsRef = this.buildEvents();
        tabCaptureProvider.reattachEvents(this.providerEventsRef);
        this.activeProvider = tabCaptureProvider;
        this.triedProviders = new Set(['tab-capture']);
        this.metrics.setActiveProvider('tab-capture');
        console.info('[Coach Play][Capture] Reanexado ao pipeline offscreen (tabCapture) após reinício do service worker.');
        return;
      }
      console.warn('[Coach Play][Capture] Offscreen document não encontrado ao reidratar — tratando como stream perdido.');
    }

    const videoElementProvider = this.providers.find((p) => p.id === 'video-element');
    if (!videoElementProvider) return;
    this.currentParams = params;
    this.state = new CaptureSessionState();
    this.state.begin();
    this.state.markRunning();
    if (capture.state === 'paused') this.state.pause();
    this.providerEventsRef = this.buildEvents();
    this.activeProvider = videoElementProvider;
    this.triedProviders = new Set(['video-element']);
    this.metrics.setActiveProvider('video-element');
    await videoElementProvider.start(params, this.providerEventsRef).catch((err) => {
      console.error('[Coach Play][Capture] Falha ao reanexar o provider de fallback:', err);
    });
  }

  async start(matchId: string | undefined, tab: { id: number; title?: string }): Promise<CaptureSessionSnapshot | null> {
    await this.ensureRehydrated();
    const { accessToken } = await this.store.getAuth();
    if (!accessToken) throw new Error('Não autenticado — faça login antes de iniciar a captura.');
    if (!tab?.id) throw new Error('Aba inválida.');

    const session = await this.backend.createCaptureSession(accessToken, {
      matchId,
      sourceType: 'window',
      sourceName: tab.title ?? 'Xbox Remote Play',
      captureFps: DEFAULT_FPS_TIERS.processingFps,
      analysisFps: DEFAULT_FPS_TIERS.analysisFps,
    });

    const startedAt = Date.now();
    const params: CaptureStartParams = {
      tabId: tab.id,
      sessionId: session.id,
      accessToken,
      sessionStartedAt: startedAt,
      fps: DEFAULT_FPS_TIERS,
      jpegQuality: DEFAULT_JPEG_QUALITY,
      maxWidth: DEFAULT_MAX_WIDTH,
      maxHeight: DEFAULT_MAX_HEIGHT,
      diffThreshold: DEFAULT_DIFF_THRESHOLD,
    };

    this.currentParams = params;
    this.metrics.reset();
    this.state = new CaptureSessionState();
    this.state.begin();
    this.triedProviders = new Set();
    this.providerEventsRef = this.buildEvents();

    const { provider } = await selectAndStart(this.providers, params, this.providerEventsRef);
    this.activeProvider = provider;
    this.triedProviders.add(provider.id);
    this.metrics.setActiveProvider(provider.id);
    this.state.markRunning();
    console.info(`[Coach Play][Capture] Captura iniciada. Provider ativo: ${provider.id}.`);

    await this.store.setCaptureStarted({
      sessionId: session.id,
      tabId: tab.id,
      startedAt,
      provider: provider.id,
      fps: params.fps,
    });

    return this.buildSnapshot();
  }

  async pause(): Promise<CaptureSessionSnapshot | null> {
    await this.ensureRehydrated();
    if (!this.activeProvider || !this.currentParams) throw new Error('Nenhuma sessão de captura ativa.');
    await this.backend.transitionSession(this.currentParams.accessToken, this.currentParams.sessionId, 'pause');
    this.state.pause();
    await this.activeProvider.pause();
    await this.persistSnapshot();
    return this.buildSnapshot();
  }

  async resume(): Promise<CaptureSessionSnapshot | null> {
    await this.ensureRehydrated();
    if (!this.activeProvider || !this.currentParams) throw new Error('Nenhuma sessão de captura ativa.');
    await this.backend.transitionSession(this.currentParams.accessToken, this.currentParams.sessionId, 'resume');
    this.state.resume();
    await this.activeProvider.resume();
    await this.persistSnapshot();
    return this.buildSnapshot();
  }

  async stop(): Promise<null> {
    await this.ensureRehydrated();
    if (!this.currentParams) throw new Error('Nenhuma sessão de captura ativa.');
    this.state.requestStop();
    await this.backend
      .transitionSession(this.currentParams.accessToken, this.currentParams.sessionId, 'stop')
      .catch(() => {});
    if (this.activeProvider) await this.activeProvider.stop().catch(() => {});
    this.state.markStopped();
    this.activeProvider = null;
    this.currentParams = null;
    this.providerEventsRef = null;
    await this.store.clearCapture();
    return null;
  }

  private async handleStreamLost(): Promise<void> {
    if (this.reconnecting || !this.activeProvider || !this.currentParams || !this.providerEventsRef) return;
    if (!this.state.isActive()) return;

    this.reconnecting = true;
    const provider = this.activeProvider;
    const lostFromState = this.state.getSnapshot().state;
    console.warn(`[Coach Play][Stream] Stream perdido (provider "${provider.id}", estado "${lostFromState}") — tentando reconectar.`);
    this.state.markStreamLost();
    await this.persistSnapshot();

    try {
      for (let attempt = 0; ; attempt++) {
        const delay = getBackoffDelayMs(attempt);
        if (delay === null) break;
        await sleep(delay);
        try {
          await provider.start(this.currentParams, this.providerEventsRef);
          this.state.markReconnected();
          this.metrics.recordRestart();
          await this.persistSnapshot();
          console.info(`[Coach Play][Stream] Reconectado com "${provider.id}" na tentativa ${attempt + 1}.`);
          return;
        } catch (err) {
          console.warn(`[Coach Play][Stream] Tentativa ${attempt + 1} de reconexão falhou:`, err);
        }
      }
      await this.attemptFallbackThenFail(provider.id, 'Não foi possível reconectar o stream de captura.');
    } finally {
      this.reconnecting = false;
    }
  }

  private async handleProviderUnavailable(reason: string): Promise<void> {
    if (!this.activeProvider || !this.state.isActive()) return;
    console.warn(`[Coach Play][Capture] Provider "${this.activeProvider.id}" indisponível: ${reason}`);
    await this.attemptFallbackThenFail(this.activeProvider.id, reason);
  }

  private async handleFatalError(reason: string): Promise<void> {
    if (!this.activeProvider || !this.state.isActive()) return;
    console.error(`[Coach Play][Capture] Erro fatal do provider "${this.activeProvider.id}": ${reason}`);
    await this.attemptFallbackThenFail(this.activeProvider.id, reason);
  }

  /**
   * Sessão só falha se TODOS os providers disponíveis falharem: tenta trocar pro provider
   * alternativo (ainda não usado nesta sessão) uma vez antes de desistir de vez.
   */
  private async attemptFallbackThenFail(fromProviderId: string, reason: string): Promise<void> {
    if (!this.currentParams || !this.providerEventsRef) return;
    const alternate = this.providers.find((p) => p.id !== fromProviderId && !this.triedProviders.has(p.id));

    if (alternate) {
      this.triedProviders.add(alternate.id);
      try {
        if (this.activeProvider) await this.activeProvider.stop().catch(() => {});
        await alternate.start(this.currentParams, this.providerEventsRef);
        this.activeProvider = alternate;
        this.metrics.setActiveProvider(alternate.id);
        this.metrics.recordRestart();
        // Só transiciona via markReconnected() se a máquina de estado realmente está em
        // "reconnecting" (caso do backoff de handleStreamLost esgotado antes de cair aqui) —
        // handleProviderUnavailable/handleFatalError chamam este método com o estado ainda em
        // running/paused, e markReconnected() nesses estados seria uma transição inválida.
        if (this.state.getSnapshot().state === 'reconnecting') {
          this.state.markReconnected();
        }
        await this.persistSnapshot();
        console.info(`[Coach Play][Capture] Provider trocado para "${alternate.id}" após falha de "${fromProviderId}".`);
        return;
      } catch (err) {
        console.error(`[Coach Play][Capture] Fallback para "${alternate.id}" também falhou:`, err);
      }
    }

    await this.failSession(reason);
  }

  private async failSession(reason: string): Promise<void> {
    console.error(`[Coach Play][Capture] Sessão encerrada por falha: ${reason}`);
    if (this.state.isActive() || this.state.getSnapshot().state === 'reconnecting') {
      try {
        this.state.markReconnectFailed(reason);
      } catch {
        // já pode ter transicionado por outro caminho — ver fail() logo abaixo.
      }
    }
    try {
      this.state.fail(reason);
    } catch {
      // idem.
    }
    if (this.activeProvider) await this.activeProvider.stop().catch(() => {});
    if (this.currentParams) {
      await this.backend
        .transitionSession(this.currentParams.accessToken, this.currentParams.sessionId, 'stop', reason)
        .catch(() => {});
    }
    await this.store.setCaptureRuntime({ state: 'failed', provider: this.activeProvider?.id ?? null, errorMessage: reason });
    this.activeProvider = null;
  }
}

export const captureManager = new CaptureManager();
