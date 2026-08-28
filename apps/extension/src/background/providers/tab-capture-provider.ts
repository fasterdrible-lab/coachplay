import { MESSAGE_TYPES } from '../../shared/messages';
import type { FpsKind, OffscreenErrorPayload, OffscreenStartCapturePayload, OffscreenStatus } from '../../shared/messages';
import { sendToOffscreen, ensureOffscreenDocument, closeOffscreenDocumentIfOpen } from '../offscreen-lifecycle';
import type { CaptureProvider, CaptureProviderEvents, CaptureStartParams } from './types';

// Provider principal: captura a aba inteira via chrome.tabCapture, sem depender de nenhum
// <video> exposto pela página do Xbox Remote Play. O trabalho contínuo (stream, canvas,
// compressão) roda no offscreen document — este provider só coordena, do service worker.
export class TabCaptureProvider implements CaptureProvider {
  readonly id = 'tab-capture' as const;
  private events: CaptureProviderEvents | null = null;

  private onOffscreenMessage = (message: { type?: string; payload?: unknown }): void => {
    if (!this.events) return;
    switch (message?.type) {
      case MESSAGE_TYPES.OFFSCREEN_STREAM_LOST:
        this.events.onStreamLost();
        break;
      case MESSAGE_TYPES.OFFSCREEN_ERROR: {
        const payload = message.payload as OffscreenErrorPayload;
        if (payload.fatal) this.events.onFatalError(payload.message);
        else this.events.onProviderUnavailable(payload.message);
        break;
      }
      default:
        break;
    }
  };

  async isSupported(): Promise<boolean> {
    return (
      typeof chrome.tabCapture?.getMediaStreamId === 'function' &&
      typeof chrome.offscreen?.createDocument === 'function'
    );
  }

  async start(params: CaptureStartParams, events: CaptureProviderEvents): Promise<void> {
    const streamId = await new Promise<string>((resolve, reject) => {
      chrome.tabCapture.getMediaStreamId({ targetTabId: params.tabId }, (id) => {
        if (chrome.runtime.lastError || !id) {
          reject(new Error(chrome.runtime.lastError?.message ?? 'Falha ao obter o streamId de tabCapture.'));
          return;
        }
        resolve(id);
      });
    });

    await ensureOffscreenDocument();

    const payload: OffscreenStartCapturePayload = {
      streamId,
      sessionId: params.sessionId,
      accessToken: params.accessToken,
      sessionStartedAt: params.sessionStartedAt,
      fps: params.fps,
      jpegQuality: params.jpegQuality,
      maxWidth: params.maxWidth,
      maxHeight: params.maxHeight,
      diffThreshold: params.diffThreshold,
    };

    this.events = events;
    chrome.runtime.onMessage.addListener(this.onOffscreenMessage);
    try {
      await sendToOffscreen(MESSAGE_TYPES.OFFSCREEN_START_CAPTURE, payload);
    } catch (err) {
      chrome.runtime.onMessage.removeListener(this.onOffscreenMessage);
      this.events = null;
      throw err;
    }
  }

  async pause(): Promise<void> {
    await sendToOffscreen(MESSAGE_TYPES.OFFSCREEN_PAUSE_CAPTURE);
  }

  async resume(): Promise<void> {
    await sendToOffscreen(MESSAGE_TYPES.OFFSCREEN_RESUME_CAPTURE);
  }

  async stop(): Promise<void> {
    await sendToOffscreen(MESSAGE_TYPES.OFFSCREEN_STOP_CAPTURE).catch(() => {});
    chrome.runtime.onMessage.removeListener(this.onOffscreenMessage);
    this.events = null;
    await closeOffscreenDocumentIfOpen();
  }

  setTargetFps(kind: FpsKind, fps: number): void {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OFFSCREEN_SET_FPS, payload: { kind, fps } }).catch(() => {});
  }

  /**
   * Usado só por CaptureManager.rehydrate() pra saber, depois de um restart do service worker,
   * se o offscreen document ainda está vivo e capturando a mesma sessão — sem isso o SW
   * reiniciado não tem como saber que já existe um pipeline rodando sozinho.
   */
  async queryStatus(): Promise<OffscreenStatus | null> {
    if (typeof chrome.offscreen.hasDocument === 'function') {
      const has = await chrome.offscreen.hasDocument();
      if (!has) return null;
    }
    return sendToOffscreen<OffscreenStatus>(MESSAGE_TYPES.OFFSCREEN_QUERY_STATUS).catch(() => null);
  }

  reattachEvents(events: CaptureProviderEvents): void {
    this.events = events;
    chrome.runtime.onMessage.addListener(this.onOffscreenMessage);
  }

  onMetricsTick(handler: (payload: unknown) => void): void {
    chrome.runtime.onMessage.addListener((message: { type?: string; payload?: unknown }) => {
      if (message?.type === MESSAGE_TYPES.OFFSCREEN_METRICS_TICK) {
        handler(message.payload);
      }
    });
  }
}
