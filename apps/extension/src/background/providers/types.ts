import type { CaptureProviderId, FpsKind } from '../../shared/messages';
import type { FpsTiers } from '../../shared/capture-config';
import type { FrameDropReason } from '../../shared/capture-metrics';

export interface CaptureStartParams {
  tabId: number;
  sessionId: string;
  accessToken: string;
  sessionStartedAt: number;
  fps: FpsTiers;
  jpegQuality: number;
  maxWidth: number;
  maxHeight: number;
  diffThreshold: number;
}

// CaptureManager injeta essas callbacks em qualquer provider — o resto da extensão nunca
// precisa saber como os pixels foram obtidos, só reage a estes eventos.
export interface CaptureProviderEvents {
  onFrameUploaded(latencyMs: number): void;
  onFrameDropped(reason: FrameDropReason): void;
  onStreamLost(): void;
  onProviderUnavailable(reason: string): void;
  onFatalError(reason: string): void;
}

export interface CaptureProvider {
  readonly id: CaptureProviderId;
  isSupported(): Promise<boolean>;
  start(params: CaptureStartParams, events: CaptureProviderEvents): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setTargetFps(kind: FpsKind, fps: number): void;
}
