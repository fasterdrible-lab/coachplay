export interface FpsTiers {
  sourceFps: number;
  processingFps: number;
  analysisFps: number;
}

export const DEFAULT_FPS_TIERS: FpsTiers = {
  sourceFps: 30,
  processingFps: 5,
  analysisFps: 1,
};

export const DEFAULT_JPEG_QUALITY = 0.8;
export const DEFAULT_MAX_WIDTH = 1280;
export const DEFAULT_MAX_HEIGHT = 720;
export const DEFAULT_DIFF_THRESHOLD = 8;

// Quantos ticks seguidos sem <video> o fallback DOM tolera antes de considerar o provider
// indisponível — ausência de vídeo deixou de significar falha imediata da sessão.
export const VIDEO_NOT_FOUND_GRACE_TICKS = 5;

export const RECONNECT_BACKOFF_MS = [500, 1000, 2000];

export const OFFSCREEN_ACK_TIMEOUT_MS = 5000;

// Frequência (em processingTicks) com que o offscreen document reporta métricas ao background —
// nunca a cada frame, só o suficiente pra dev/telemetria acompanhar sem gerar ruído.
export function metricsTickInterval(processingFps: number): number {
  return Math.max(1, Math.round(processingFps * 2));
}
