/**
 * Contrato de mensagens entre popup, background e content script.
 * Mesmo princípio do ipc-channels.ts do apps/desktop: um único lugar pra
 * popup/content/background nunca divergirem sobre o formato.
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
  CONTENT_STOP_SAMPLING: 'content:stop-sampling',

  // content -> background (via chrome.runtime.sendMessage)
  CONTENT_FRAME: 'content:frame',
  CONTENT_VIDEO_NOT_FOUND: 'content:video-not-found',
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

export type CaptureSessionStatus = 'running' | 'paused' | 'stopped' | 'failed';

export interface CaptureSessionSnapshot {
  status: CaptureSessionStatus;
  startedAt: number | null;
  analysisFps: number;
  errorMessage: string | null;
}

export interface StartSamplingPayload {
  sessionStartedAt: number;
  analysisFps: number;
}

export interface ContentFramePayload {
  base64: string;
  elapsedMs: number;
}
