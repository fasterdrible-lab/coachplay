import { MESSAGE_TYPES, StartSamplingPayload, ContentFramePayload } from '../shared/messages';
import { pickBestVideoIndex, VideoCandidate } from '../shared/video-picker';
import { arrayBufferToBase64 } from '../shared/binary';

// Estado compartilhado em `window` (não variável de módulo) — sobrevive a reinjeções deste
// script na MESMA página (declarativa do manifest + sob demanda de background/index.ts, ou
// múltiplas chamadas sob demanda). `intervalId` guardado aqui permite que uma nova injeção
// PARE o intervalo de uma injeção anterior mesmo que essa anterior pertença a uma versão já
// invalidada da extensão — clearInterval só precisa do ID numérico do timer, isso é 100% API
// da página, nunca passa pelo `chrome.runtime` (que é o que fica inutilizável quando a
// extensão é recarregada). Achado real ao validar: um script de antes de um reload da
// extensão ficava "zumbi" na aba, seu setInterval nunca parava sozinho, gerando "Extension
// context invalidated" a cada tick pra sempre — e a versão anterior deste guard (um booleano
// simples) chegava a IMPEDIR a reinjeção nova de sequer começar a rodar.
const globalState = window as unknown as {
  __coachPlayIntervalId?: ReturnType<typeof setInterval>;
  __coachPlayListenerRegistered?: boolean;
};

if (globalState.__coachPlayIntervalId !== undefined) {
  clearInterval(globalState.__coachPlayIntervalId);
  globalState.__coachPlayIntervalId = undefined;
}

initContentScript();

function initContentScript(): void {
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

  // chrome.runtime.sendMessage sempre retorna uma Promise (sem callback) — se a extensão foi
  // recarregada/atualizada enquanto este script ainda capturava, ela rejeita com "Extension
  // context invalidated.". Nesse caso específico não adianta tentar de novo no próximo tick:
  // para o intervalo desta instância e avisa uma vez só, em vez de logar o mesmo erro a cada
  // frame pra sempre. Só fechar e reabrir a aba reinjeta um script com contexto vivo de novo.
  function sendMessageSafely(message: unknown): void {
    chrome.runtime.sendMessage(message).catch((err: unknown) => {
      const text = err instanceof Error ? err.message : String(err);
      if (text.includes('Extension context invalidated')) {
        console.warn(
          '[Coach Play] A extensão foi recarregada/atualizada — parando esta captura. ' +
            'Feche e reabra a aba do Xbox para continuar.',
        );
        stopSampling();
        return;
      }
      console.error('[Coach Play] Falha ao enviar mensagem para o background:', err);
    });
  }

  function captureFrame(): void {
    const video = findBestVideo();
    if (!video) {
      console.warn('[Coach Play] Nenhum <video> tocando encontrado na página — frame não capturado.');
      sendMessageSafely({ type: MESSAGE_TYPES.CONTENT_VIDEO_NOT_FOUND });
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
      sendMessageSafely({ type: MESSAGE_TYPES.CONTENT_FRAME, payload });
    }, 'image/png');
  }

  function startSampling(payload: StartSamplingPayload): void {
    stopSampling();
    sessionStartedAt = payload.sessionStartedAt;
    const intervalMs = 1000 / Math.max(payload.analysisFps, 1);
    intervalId = setInterval(captureFrame, intervalMs);
    globalState.__coachPlayIntervalId = intervalId;
  }

  function stopSampling(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
      globalState.__coachPlayIntervalId = undefined;
    }
  }

  // Só registra o listener de mensagens uma vez por página — se a injeção declarativa (manifest)
  // e a sob demanda (background/index.ts, ao clicar "Iniciar") coexistirem na mesma página
  // "viva" (contexto de extensão válido em ambas), evita que a mesma mensagem seja processada
  // duas vezes. Não impede a limpeza do intervalo zumbi feita acima — essa já aconteceu antes
  // deste ponto, incondicionalmente.
  if (!globalState.__coachPlayListenerRegistered) {
    globalState.__coachPlayListenerRegistered = true;
    chrome.runtime.onMessage.addListener((message) => {
      if (message?.type === MESSAGE_TYPES.CONTENT_START_SAMPLING) {
        startSampling(message.payload as StartSamplingPayload);
      }
      if (message?.type === MESSAGE_TYPES.CONTENT_STOP_SAMPLING) {
        stopSampling();
      }
    });
  }
}
