import { MESSAGE_TYPES, ContentFramePayload, FpsKind, StartSamplingPayload } from '../../shared/messages';
import { base64ToArrayBuffer } from '../../shared/binary';
import { VIDEO_NOT_FOUND_GRACE_TICKS } from '../../shared/capture-config';
import { BackendClient, SessionExpiredError } from '../backend-client';
import type { CaptureProvider, CaptureProviderEvents, CaptureStartParams } from './types';

// Fallback: desenha o <video> encontrado na página num canvas via content script (o mecanismo
// original da extensão). Só é tentado se o TabCaptureProvider não estiver disponível ou falhar.
export class VideoElementCaptureProvider implements CaptureProvider {
  readonly id = 'video-element' as const;
  private tabId: number | null = null;
  private events: CaptureProviderEvents | null = null;
  private consecutiveMisses = 0;
  private accessToken = '';
  private sessionId = '';

  constructor(private readonly backend: BackendClient) {}

  private onRuntimeMessage = (message: { type?: string; payload?: unknown }, sender: chrome.runtime.MessageSender): void => {
    if (this.tabId === null || sender.tab?.id !== this.tabId || !this.events) return;

    if (message?.type === MESSAGE_TYPES.CONTENT_FRAME) {
      void this.handleFrame(message.payload as ContentFramePayload);
    }
    if (message?.type === MESSAGE_TYPES.CONTENT_VIDEO_NOT_FOUND) {
      this.consecutiveMisses++;
      if (this.consecutiveMisses >= VIDEO_NOT_FOUND_GRACE_TICKS) {
        this.events.onProviderUnavailable('O vídeo do Remote Play não foi encontrado na aba.');
      }
    }
    if (message?.type === MESSAGE_TYPES.CONTENT_VIDEO_FOUND) {
      this.consecutiveMisses = 0;
    }
  };

  private async handleFrame(payload: ContentFramePayload): Promise<void> {
    if (!this.events) return;
    const startedAt = Date.now();
    try {
      const buffer = base64ToArrayBuffer(payload.base64);
      await this.backend.uploadFrame(this.accessToken, this.sessionId, buffer, payload.elapsedMs);
      this.events.onFrameUploaded(Date.now() - startedAt);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        this.events.onFatalError(err.message);
        return;
      }
      console.error('[Coach Play][Upload] Falha ao enviar frame (modo alternativo):', err);
      this.events.onFrameDropped('backpressure');
    }
  }

  async isSupported(): Promise<boolean> {
    return true;
  }

  async start(params: CaptureStartParams, events: CaptureProviderEvents): Promise<void> {
    this.tabId = params.tabId;
    this.accessToken = params.accessToken;
    this.sessionId = params.sessionId;
    this.events = events;
    this.consecutiveMisses = 0;

    await chrome.scripting.executeScript({ target: { tabId: params.tabId }, files: ['content.js'] });
    chrome.runtime.onMessage.addListener(this.onRuntimeMessage);

    const payload: StartSamplingPayload = {
      sessionStartedAt: params.sessionStartedAt,
      analysisFps: params.fps.analysisFps,
    };
    await chrome.tabs.sendMessage(params.tabId, { type: MESSAGE_TYPES.CONTENT_START_SAMPLING, payload });
  }

  async pause(): Promise<void> {
    if (this.tabId === null) return;
    await chrome.tabs.sendMessage(this.tabId, { type: MESSAGE_TYPES.CONTENT_PAUSE_SAMPLING }).catch(() => {});
  }

  async resume(): Promise<void> {
    if (this.tabId === null) return;
    await chrome.tabs.sendMessage(this.tabId, { type: MESSAGE_TYPES.CONTENT_RESUME_SAMPLING }).catch(() => {});
  }

  async stop(): Promise<void> {
    if (this.tabId !== null) {
      await chrome.tabs.sendMessage(this.tabId, { type: MESSAGE_TYPES.CONTENT_STOP_SAMPLING }).catch(() => {});
    }
    chrome.runtime.onMessage.removeListener(this.onRuntimeMessage);
    this.tabId = null;
    this.events = null;
  }

  setTargetFps(kind: FpsKind, fps: number): void {
    if (kind !== 'analysis' || this.tabId === null) return;
    const payload: StartSamplingPayload = { sessionStartedAt: Date.now(), analysisFps: fps };
    chrome.tabs.sendMessage(this.tabId, { type: MESSAGE_TYPES.CONTENT_START_SAMPLING, payload }).catch(() => {});
  }
}
