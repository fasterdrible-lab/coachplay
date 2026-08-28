import type { CaptureState } from './capture-state-machine';
import type { CaptureMetricsSnapshot } from './capture-metrics';
import type { FpsTiers } from './capture-config';

/**
 * Contrato de mensagens entre popup, background, content script e offscreen document.
 * Mesmo princípio do ipc-channels.ts do apps/desktop: um único lugar pra ninguém divergir
 * sobre o formato.
 */
export const MESSAGE_TYPES = {
  // popup -> background
  AUTH_LOGIN: 'auth:login',
  AUTH_STATUS: 'auth:status',
  AUTH_LOGOUT: 'auth:logout',
  MATCHES_LIST: 'matches:list',
  MATCHES_CREATE: 'matches:create',
  CAPTURE_START: 'capture:start',
  CAPTURE_PAUSE: 'capture:pause',
  CAPTURE_RESUME: 'capture:resume',
  CAPTURE_STOP: 'capture:stop',
  CAPTURE_STATUS: 'capture:status',

  // background -> content (via chrome.tabs.sendMessage)
  CONTENT_START_SAMPLING: 'content:start-sampling',
  CONTENT_PAUSE_SAMPLING: 'content:pause-sampling',
  CONTENT_RESUME_SAMPLING: 'content:resume-sampling',
  CONTENT_STOP_SAMPLING: 'content:stop-sampling',

  // content -> background (via chrome.runtime.sendMessage)
  CONTENT_FRAME: 'content:frame',
  CONTENT_VIDEO_NOT_FOUND: 'content:video-not-found',
  CONTENT_VIDEO_FOUND: 'content:video-found',

  // background <-> offscreen (via chrome.runtime.sendMessage)
  OFFSCREEN_START_CAPTURE: 'offscreen:start-capture',
  OFFSCREEN_PAUSE_CAPTURE: 'offscreen:pause-capture',
  OFFSCREEN_RESUME_CAPTURE: 'offscreen:resume-capture',
  OFFSCREEN_STOP_CAPTURE: 'offscreen:stop-capture',
  OFFSCREEN_SET_FPS: 'offscreen:set-fps',
  OFFSCREEN_QUERY_STATUS: 'offscreen:query-status',
  OFFSCREEN_STREAM_LOST: 'offscreen:stream-lost',
  OFFSCREEN_METRICS_TICK: 'offscreen:metrics-tick',
  OFFSCREEN_ERROR: 'offscreen:error',
} as const;

export interface AuthenticatedUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

export interface MatchSummary {
  id: string;
  title: string | null;
  gameMode: string | null;
  createdAt: string;
}

// Identifica qual CaptureProvider está ativo — usado no snapshot pro popup mostrar a origem
// ("captura direta da aba" vs "modo alternativo") e no CaptureManager pra controlar fallback.
export type CaptureProviderId = 'tab-capture' | 'video-element';

export interface CaptureSessionSnapshot {
  state: CaptureState;
  provider: CaptureProviderId | null;
  startedAt: number | null;
  fps: FpsTiers;
  errorMessage: string | null;
  metrics: CaptureMetricsSnapshot;
}

export interface StartSamplingPayload {
  sessionStartedAt: number;
  analysisFps: number;
}

export interface ContentFramePayload {
  base64: string;
  elapsedMs: number;
}

export type FpsKind = 'processing' | 'analysis';

export interface SetFpsPayload {
  kind: FpsKind;
  fps: number;
}

export interface OffscreenStartCapturePayload {
  streamId: string;
  sessionId: string;
  accessToken: string;
  sessionStartedAt: number;
  fps: FpsTiers;
  jpegQuality: number;
  maxWidth: number;
  maxHeight: number;
  diffThreshold: number;
}

export interface OffscreenStatus {
  active: boolean;
  sessionId: string | null;
  state: 'running' | 'paused' | null;
  metrics: CaptureMetricsSnapshot | null;
}

export interface OffscreenErrorPayload {
  message: string;
  fatal: boolean;
}
