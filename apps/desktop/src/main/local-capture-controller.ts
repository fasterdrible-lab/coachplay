import { CaptureSessionSnapshot, CaptureSourceType } from './capture-session-state';

export interface CaptureSourceInfo {
  id: string;
  name: string;
  type: CaptureSourceType;
  thumbnailDataUrl?: string;
}

export interface StartCaptureParams {
  sourceType: CaptureSourceType;
  sourceName: string;
  captureFps?: number;
  analysisFps?: number;
}

/**
 * Contrato entre o servidor HTTP local e a lógica real de captura.
 *
 * Existe como interface para permitir testar as rotas HTTP (local-server.spec.ts)
 * sem precisar de um processo Electron de verdade — em produção, quem implementa
 * isso é o CaptureSessionManager (capture-session-manager.ts), que fala com
 * `desktopCapturer` de verdade.
 */
export interface LocalCaptureController {
  listSources(): Promise<CaptureSourceInfo[]>;
  start(params: StartCaptureParams): Promise<CaptureSessionSnapshot>;
  pause(): Promise<CaptureSessionSnapshot>;
  stop(errorMessage?: string): Promise<CaptureSessionSnapshot>;
  getStatus(): CaptureSessionSnapshot | null;
  getPreview(): { hasFrame: boolean; framePath: string | null; timestampMs: number | null };
}
