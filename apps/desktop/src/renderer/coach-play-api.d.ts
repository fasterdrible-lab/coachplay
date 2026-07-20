import type { CaptureSourceInfo, StartCaptureParams } from '../main/local-capture-controller';
import type { CaptureSessionSnapshot } from '../main/capture-session-state';
import type { AuthenticatedUser } from '../main/backend-client';

export interface CoachPlayAuthApi {
  login(email: string, password: string): Promise<AuthenticatedUser>;
}

export interface CoachPlayCaptureApi {
  listSources(): Promise<CaptureSourceInfo[]>;
  start(params: StartCaptureParams): Promise<CaptureSessionSnapshot>;
  pause(): Promise<CaptureSessionSnapshot>;
  resume(): Promise<CaptureSessionSnapshot>;
  stop(errorMessage?: string): Promise<CaptureSessionSnapshot>;
  getStatus(): Promise<CaptureSessionSnapshot | null>;
  submitFrame(buffer: ArrayBuffer, timestampMs: number): Promise<void>;
  onSourceLost(callback: () => void): () => void;
}

declare global {
  interface Window {
    coachPlay: {
      auth: CoachPlayAuthApi;
      capture: CoachPlayCaptureApi;
    };
  }
}
