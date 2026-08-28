import { MESSAGE_TYPES, SetFpsPayload, OffscreenStartCapturePayload } from '../shared/messages';
import { StreamPipeline } from './stream-pipeline';

const pipeline = new StreamPipeline();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case MESSAGE_TYPES.OFFSCREEN_START_CAPTURE:
          await pipeline.start(message.payload as OffscreenStartCapturePayload);
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.OFFSCREEN_PAUSE_CAPTURE:
          pipeline.pause();
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.OFFSCREEN_RESUME_CAPTURE:
          pipeline.resume();
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.OFFSCREEN_STOP_CAPTURE:
          await pipeline.stop();
          sendResponse({ ok: true, data: null });
          break;
        case MESSAGE_TYPES.OFFSCREEN_SET_FPS: {
          const payload = message.payload as SetFpsPayload;
          pipeline.setTargetFps(payload.kind, payload.fps);
          sendResponse({ ok: true, data: null });
          break;
        }
        case MESSAGE_TYPES.OFFSCREEN_QUERY_STATUS:
          sendResponse({ ok: true, data: pipeline.queryStatus() });
          break;
        default:
          return;
      }
    } catch (err) {
      console.error('[Coach Play][Stream] Falha ao processar comando no offscreen document:', err);
      sendResponse({ ok: false, error: err instanceof Error ? err.message : 'Erro desconhecido' });
    }
  })();

  return true;
});
