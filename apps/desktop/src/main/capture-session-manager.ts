import { desktopCapturer } from 'electron';
import { writeFile, mkdir, rm } from 'fs/promises';
import { join } from 'path';
import { app } from 'electron';
import { CaptureSessionState, CaptureSourceType } from './capture-session-state';
import { FrameBuffer } from './frame-buffer';
import { BackendClient } from './backend-client';
import {
  CaptureSourceInfo,
  LocalCaptureController,
  StartCaptureParams,
} from './local-capture-controller';

/**
 * Implementação real do LocalCaptureController, usando `desktopCapturer` do
 * Electron (processo main) e o `BackendClient` para persistir a sessão em
 * apps/api.
 *
 * A captura de pixels em si (getUserMedia) acontece no renderer — este
 * manager só decide QUAL fonte pode ser capturada, mantém o estado da sessão,
 * e recebe os frames já extraídos via IPC (submitFrame) para bufferizar,
 * gravar em disco temporário e enviar ao backend por amostragem.
 */
export class CaptureSessionManager implements LocalCaptureController {
  private state = new CaptureSessionState();
  private readonly frameBuffer = new FrameBuffer(30_000);
  private backendSessionId: string | null = null;
  private tempDir: string | null = null;
  private lastFrame: { framePath: string; timestampMs: number } | null = null;

  constructor(private readonly backendClient: BackendClient) {}

  async listSources(): Promise<CaptureSourceInfo[]> {
    const sources = await desktopCapturer.getSources({
      types: ['window', 'screen'],
      thumbnailSize: { width: 320, height: 180 },
    });

    return sources.map((s) => ({
      id: s.id,
      name: s.name,
      type: (s.id.startsWith('screen') ? 'monitor' : 'window') as CaptureSourceType,
      thumbnailDataUrl: s.thumbnail.toDataURL(),
    }));
  }

  async start(params: StartCaptureParams) {
    // Confirma consentimento implícito: a UI só chama start() depois da tela
    // de consentimento ser aceita (ver ConsentScreen.tsx) — a garantia técnica
    // aqui é que nenhuma captura de pixels começa antes deste método rodar.
    //
    // CaptureSessionState é de uso único (stopped/failed são terminais) — uma
    // nova captura após o fim da anterior precisa de uma instância nova, senão
    // start() nunca mais sai de "starting" -> "running" (ver validação manual
    // que encontrou esse bug: encerrar uma sessão travava qualquer captura
    // seguinte até reiniciar o app inteiro).
    const previousStatus = this.state.getSnapshot().status;
    if (previousStatus === 'stopped' || previousStatus === 'failed') {
      this.state = new CaptureSessionState();
      this.lastFrame = null;
    }

    const session = await this.backendClient.createCaptureSession({
      matchId: params.matchId,
      sourceType: params.sourceType,
      sourceName: params.sourceName,
      captureFps: params.captureFps,
      analysisFps: params.analysisFps,
    });
    this.backendSessionId = session.id;

    this.tempDir = join(app.getPath('temp'), 'coach-play', session.id);
    await mkdir(this.tempDir, { recursive: true });

    this.state.start({
      type: params.sourceType,
      name: params.sourceName,
      captureFps: params.captureFps,
      analysisFps: params.analysisFps,
    });
    return this.state.getSnapshot();
  }

  async pause() {
    if (this.backendSessionId) await this.backendClient.transitionSession(this.backendSessionId, 'pause');
    this.state.pause();
    return this.state.getSnapshot();
  }

  async resume() {
    if (this.backendSessionId) await this.backendClient.transitionSession(this.backendSessionId, 'resume');
    this.state.resume();
    return this.state.getSnapshot();
  }

  async stop(errorMessage?: string) {
    if (this.backendSessionId) {
      await this.backendClient.transitionSession(this.backendSessionId, 'stop', errorMessage);
    }
    if (errorMessage) this.state.fail(errorMessage);
    else this.state.stop();

    await this.discardTempFrames();
    return this.state.getSnapshot();
  }

  getStatus() {
    // Antes do primeiro start() o estado fica em "starting" — trata como
    // "nenhuma sessão ainda" em vez de expor esse estado interno na UI.
    const snapshot = this.state.getSnapshot();
    return snapshot.status === 'starting' ? null : snapshot;
  }

  getPreview() {
    return {
      hasFrame: this.lastFrame !== null,
      framePath: this.lastFrame?.framePath ?? null,
      timestampMs: this.lastFrame?.timestampMs ?? null,
    };
  }

  /**
   * Recebe um frame já extraído pelo renderer (PNG) via IPC, grava no diretório
   * temporário da sessão, guarda no buffer circular e amostra para envio ao
   * backend — nem todo frame capturado sobe (ver Plano de processamento local).
   */
  async submitFrame(pngBuffer: Buffer, timestampMs: number): Promise<void> {
    if (!this.tempDir || !this.backendSessionId) return;

    const framePath = join(this.tempDir, `${timestampMs}.png`);
    await writeFile(framePath, pngBuffer);
    this.lastFrame = { framePath, timestampMs };

    const evicted = this.frameBuffer.push({ timestampMs, filePath: framePath });
    await Promise.all(evicted.map((f) => rm(f.filePath, { force: true })));

    try {
      await this.backendClient.uploadFrame(this.backendSessionId, framePath, timestampMs);
    } catch {
      // Falha de rede não derruba a captura local — o frame continua no
      // buffer/disco temporário e o próximo envio tenta de novo.
    }
  }

  private async discardTempFrames(): Promise<void> {
    const remaining = this.frameBuffer.clear();
    await Promise.all(remaining.map((f) => rm(f.filePath, { force: true })));
    if (this.tempDir) await rm(this.tempDir, { recursive: true, force: true }).catch(() => {});
  }
}
