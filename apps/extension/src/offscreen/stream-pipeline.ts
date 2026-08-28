import { MESSAGE_TYPES } from '../shared/messages';
import type { FpsKind, OffscreenErrorPayload, OffscreenStartCapturePayload, OffscreenStatus } from '../shared/messages';
import { calculateOutputDimensions } from '../shared/frame-dimensions';
import { computeFrameSignature, hasFrameChanged } from '../shared/frame-diff';
import { FrameSampler } from '../shared/frame-sampler';
import { LatestFrameBuffer } from '../shared/backpressure-gate';
import { CaptureMetrics } from '../shared/capture-metrics';
import { metricsTickInterval } from '../shared/capture-config';
import { BackendClient, SessionExpiredError } from '../background/backend-client';

const backend = new BackendClient();

function log(prefix: string, ...args: unknown[]): void {
  console.log(prefix, ...args);
}

// Roda inteiramente dentro do offscreen document (não do service worker) — é o único jeito de
// manter um MediaStream/<video>/setInterval vivos continuamente sob Manifest V3, já que o
// service worker pode ser reciclado a qualquer momento de ociosidade.
export class StreamPipeline {
  private readonly videoEl: HTMLVideoElement;
  private stream: MediaStream | null = null;
  private processingIntervalId: ReturnType<typeof setInterval> | null = null;
  private rvfcHandle: number | null = null;
  private canvas: OffscreenCanvas | null = null;
  private ctx: OffscreenCanvasRenderingContext2D | null = null;
  private payload: OffscreenStartCapturePayload | null = null;
  private sampler: FrameSampler | null = null;
  private readonly gate = new LatestFrameBuffer<Blob>();
  private uploading = false;
  private lastSignature: number | null = null;
  private processingTick = 0;
  private paused = false;
  private readonly metrics = new CaptureMetrics();

  constructor() {
    this.videoEl = document.getElementById('sink') as HTMLVideoElement;
  }

  async start(payload: OffscreenStartCapturePayload): Promise<void> {
    await this.teardownStream();
    this.payload = payload;
    this.sampler = new FrameSampler(payload.fps.analysisFps);
    this.metrics.reset();
    this.metrics.setActiveProvider('tab-capture');
    this.lastSignature = null;
    this.paused = false;

    const constraints = {
      video: {
        mandatory: {
          chromeMediaSource: 'tab',
          chromeMediaSourceId: payload.streamId,
        },
        // Áudio nunca é capturado — o Coach Play só precisa da imagem.
      },
    } as unknown as MediaStreamConstraints;

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    this.stream = stream;
    this.videoEl.srcObject = stream;
    await this.videoEl.play();

    const track = stream.getVideoTracks()[0];
    track.addEventListener('ended', () => {
      log('[Coach Play][Stream]', 'Track de vídeo encerrada — avisando o background.');
      this.notifyStreamLost();
    });

    this.registerSourceFrameCallback();
    this.startProcessingInterval();
    log('[Coach Play][Stream]', 'tabCapture iniciado.', { sessionId: payload.sessionId });
  }

  pause(): void {
    this.paused = true;
    this.stopProcessingInterval();
    log('[Coach Play][Stream]', 'Pausado (stream mantido, processamento suspenso).');
  }

  resume(): void {
    if (!this.payload) return;
    this.paused = false;
    this.startProcessingInterval();
    log('[Coach Play][Stream]', 'Retomado.');
  }

  async stop(): Promise<void> {
    await this.teardownStream();
    log('[Coach Play][Stream]', 'Encerrado — recursos liberados.');
  }

  setTargetFps(kind: FpsKind, fps: number): void {
    if (!this.payload) return;
    if (kind === 'analysis') {
      this.sampler?.setTargetFps(fps);
      this.payload.fps.analysisFps = fps;
      log('[Coach Play][Sampler]', `analysisFps ajustado para ${fps}.`);
      return;
    }
    this.payload.fps.processingFps = fps;
    if (!this.paused) this.startProcessingInterval();
    log('[Coach Play][Sampler]', `processingFps ajustado para ${fps}.`);
  }

  queryStatus(): OffscreenStatus {
    return {
      active: this.stream !== null,
      sessionId: this.payload?.sessionId ?? null,
      state: this.stream === null ? null : this.paused ? 'paused' : 'running',
      metrics: this.stream === null ? null : this.metrics.snapshot(),
    };
  }

  // Camada "capture": conta cada frame que o vídeo de fato entrega, no ritmo nativo do
  // navegador (tipicamente a taxa da fonte) — independente do que a camada de processamento
  // decide fazer com eles.
  private registerSourceFrameCallback(): void {
    const video = this.videoEl as HTMLVideoElement & {
      requestVideoFrameCallback?: (cb: () => void) => number;
      cancelVideoFrameCallback?: (handle: number) => void;
    };
    if (typeof video.requestVideoFrameCallback !== 'function') return;
    const step = () => {
      this.metrics.recordCaptured();
      this.rvfcHandle = video.requestVideoFrameCallback!(step);
    };
    this.rvfcHandle = video.requestVideoFrameCallback(step);
  }

  private cancelSourceFrameCallback(): void {
    const video = this.videoEl as HTMLVideoElement & { cancelVideoFrameCallback?: (handle: number) => void };
    if (this.rvfcHandle !== null && typeof video.cancelVideoFrameCallback === 'function') {
      video.cancelVideoFrameCallback(this.rvfcHandle);
    }
    this.rvfcHandle = null;
  }

  // Camada "processing": no ritmo de processingFps, desenha o frame atual, decide se mudou o
  // suficiente pra valer a pena, e só então oferece o frame à camada "analysis" (FrameSampler).
  private startProcessingInterval(): void {
    this.stopProcessingInterval();
    if (!this.payload) return;
    const intervalMs = 1000 / Math.max(this.payload.fps.processingFps, 1);
    this.processingTick = 0;
    this.processingIntervalId = setInterval(() => this.processTick(), intervalMs);
  }

  private stopProcessingInterval(): void {
    if (this.processingIntervalId !== null) {
      clearInterval(this.processingIntervalId);
      this.processingIntervalId = null;
    }
  }

  private processTick(): void {
    if (!this.payload || !this.sampler) return;
    if (this.videoEl.videoWidth === 0 || this.videoEl.videoHeight === 0) return;

    const dims = calculateOutputDimensions(
      { width: this.videoEl.videoWidth, height: this.videoEl.videoHeight },
      { width: this.payload.maxWidth, height: this.payload.maxHeight },
    );

    if (!this.canvas || this.canvas.width !== dims.width || this.canvas.height !== dims.height) {
      this.canvas = new OffscreenCanvas(dims.width, dims.height);
      this.ctx = this.canvas.getContext('2d');
    }
    if (!this.ctx || !this.canvas) return;

    this.ctx.drawImage(this.videoEl, 0, 0, dims.width, dims.height);
    const imageData = this.ctx.getImageData(0, 0, dims.width, dims.height);
    const signature = computeFrameSignature(imageData);

    if (!hasFrameChanged(this.lastSignature, signature, this.payload.diffThreshold)) {
      this.metrics.recordDropped('diff-gate');
      return;
    }
    this.lastSignature = signature;
    this.metrics.recordProcessed();

    if (!this.sampler.shouldSample()) {
      this.metrics.recordDropped('sampler-skip');
    } else {
      void this.compressAndEnqueue();
    }

    this.processingTick++;
    const tickInterval = metricsTickInterval(this.payload.fps.processingFps);
    if (this.processingTick % tickInterval === 0) this.sendMetricsTick();
  }

  // Camada "analysis": comprime em JPEG e entrega ao gate de backpressure — nunca cria fila,
  // o frame mais novo sempre substitui o pendente ainda não enviado.
  private async compressAndEnqueue(): Promise<void> {
    if (!this.canvas || !this.payload) return;
    const blob = await this.canvas.convertToBlob({ type: 'image/jpeg', quality: this.payload.jpegQuality });
    const { droppedPrevious } = this.gate.push(blob);
    if (droppedPrevious) this.metrics.recordDropped('backpressure');
    if (!this.uploading) void this.pumpUpload();
  }

  private async pumpUpload(): Promise<void> {
    this.uploading = true;
    try {
      let blob = this.gate.drain();
      while (blob) {
        await this.uploadBlob(blob);
        blob = this.gate.drain();
      }
    } finally {
      this.uploading = false;
    }
  }

  // Upload direto do offscreen document — o blob JPEG vai como ArrayBuffer pro fetch, sem
  // precisar cruzar chrome.runtime.sendMessage (que não transporta ArrayBuffer de forma
  // confiável; ver shared/binary.ts, usado pelo provider de fallback que não tem essa saída).
  private async uploadBlob(blob: Blob): Promise<void> {
    if (!this.payload) return;
    const startedAt = Date.now();
    const elapsedMs = startedAt - this.payload.sessionStartedAt;
    try {
      const buffer = await blob.arrayBuffer();
      await backend.uploadFrame(this.payload.accessToken, this.payload.sessionId, buffer, elapsedMs, 'image/jpeg');
      this.metrics.recordUploaded(Date.now() - startedAt);
    } catch (err) {
      if (err instanceof SessionExpiredError) {
        log('[Coach Play][Upload]', 'Sessão expirou durante a captura — encerrando.', err.message);
        this.notifyError(err.message, true);
        await this.teardownStream();
        return;
      }
      log('[Coach Play][Upload]', 'Falha ao enviar frame:', err instanceof Error ? err.message : err);
    }
  }

  private sendMetricsTick(): void {
    const payload = this.metrics.snapshot();
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OFFSCREEN_METRICS_TICK, payload }).catch(() => {});
  }

  private notifyStreamLost(): void {
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OFFSCREEN_STREAM_LOST }).catch(() => {});
  }

  private notifyError(message: string, fatal: boolean): void {
    const payload: OffscreenErrorPayload = { message, fatal };
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.OFFSCREEN_ERROR, payload }).catch(() => {});
  }

  private async teardownStream(): Promise<void> {
    this.stopProcessingInterval();
    this.cancelSourceFrameCallback();
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    this.videoEl.srcObject = null;
    this.gate.drain();
    this.uploading = false;
  }
}
