import { MESSAGE_TYPES, StartSamplingPayload, ContentFramePayload } from '../shared/messages';
import { pickBestVideoIndex, VideoCandidate } from '../shared/video-picker';
import { arrayBufferToBase64 } from '../shared/binary';

const ANALYSIS_MAX_WIDTH = 1280;
const ANALYSIS_MAX_HEIGHT = 720;

let intervalId: ReturnType<typeof setInterval> | null = null;
let sessionStartedAt = 0;

function findBestVideo(): HTMLVideoElement | null {
  const videos = Array.from(document.querySelectorAll('video'));
  const candidates: VideoCandidate[] = videos.map((v) => ({
    clientWidth: v.clientWidth,
    clientHeight: v.clientHeight,
    readyState: v.readyState,
    paused: v.paused,
  }));

  const index = pickBestVideoIndex(candidates);
  return index === -1 ? null : videos[index];
}

function captureFrame(): void {
  const video = findBestVideo();
  if (!video) {
    console.warn('[Coach Play] Nenhum <video> tocando encontrado na página — frame não capturado.');
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CONTENT_VIDEO_NOT_FOUND });
    return;
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.min(video.videoWidth, ANALYSIS_MAX_WIDTH) || ANALYSIS_MAX_WIDTH;
  canvas.height = Math.min(video.videoHeight, ANALYSIS_MAX_HEIGHT) || ANALYSIS_MAX_HEIGHT;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.error('[Coach Play] Não foi possível obter o contexto 2D do canvas.');
    return;
  }

  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  } catch (err) {
    console.error('[Coach Play] Falha ao desenhar o frame do vídeo no canvas:', err);
    return;
  }

  canvas.toBlob(async (blob) => {
    if (!blob) {
      console.error('[Coach Play] canvas.toBlob retornou vazio — frame descartado.');
      return;
    }
    const buffer = await blob.arrayBuffer();
    // Decorrido desde o início da sessão, não Date.now() — mesma correção
    // aplicada no apps/desktop (ver CHANGELOG 0.35.0): o backend guarda isso
    // numa coluna Int32, um epoch absoluto estoura esse limite.
    const elapsedMs = Date.now() - sessionStartedAt;
    // base64, não o ArrayBuffer cru — ver shared/binary.ts para o motivo.
    const payload: ContentFramePayload = { base64: arrayBufferToBase64(buffer), elapsedMs };
    chrome.runtime.sendMessage({ type: MESSAGE_TYPES.CONTENT_FRAME, payload });
  }, 'image/png');
}

function startSampling(payload: StartSamplingPayload): void {
  stopSampling();
  sessionStartedAt = payload.sessionStartedAt;
  const intervalMs = 1000 / Math.max(payload.analysisFps, 1);
  intervalId = setInterval(captureFrame, intervalMs);
}

function stopSampling(): void {
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === MESSAGE_TYPES.CONTENT_START_SAMPLING) {
    startSampling(message.payload as StartSamplingPayload);
  }
  if (message?.type === MESSAGE_TYPES.CONTENT_STOP_SAMPLING) {
    stopSampling();
  }
});
