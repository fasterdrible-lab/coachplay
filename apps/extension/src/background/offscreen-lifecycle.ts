import { OFFSCREEN_ACK_TIMEOUT_MS } from '../shared/capture-config';

// Envelope padrão de resposta usado por todo o roteador de mensagens da extensão
// (ver background/index.ts e offscreen/offscreen.ts).
interface Envelope<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

export function sendToOffscreen<T>(
  type: string,
  payload?: unknown,
  timeoutMs: number = OFFSCREEN_ACK_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Offscreen document não respondeu a "${type}" a tempo.`));
    }, timeoutMs);

    chrome.runtime
      .sendMessage({ type, payload })
      .then((response: Envelope<T> | undefined) => {
        clearTimeout(timer);
        if (!response?.ok) {
          reject(new Error(response?.error ?? `Offscreen document recusou "${type}".`));
          return;
        }
        resolve(response.data as T);
      })
      .catch((err: unknown) => {
        clearTimeout(timer);
        reject(err instanceof Error ? err : new Error(String(err)));
      });
  });
}

const ALREADY_EXISTS_MESSAGE = 'Only a single offscreen document may be created';

export async function ensureOffscreenDocument(): Promise<void> {
  if (typeof chrome.offscreen.hasDocument === 'function') {
    const has = await chrome.offscreen.hasDocument();
    if (has) return;
  }
  try {
    await chrome.offscreen.createDocument({
      url: 'offscreen.html',
      reasons: [chrome.offscreen.Reason.USER_MEDIA],
      justification:
        'Processa o vídeo capturado da aba do Xbox Remote Play para enviar quadros de análise.',
    });
  } catch (err) {
    // Corrida legítima: dois handlers concorrentes tentando criar o mesmo offscreen document.
    // O document que "perdeu" a corrida já pode usar o que o outro criou.
    const text = err instanceof Error ? err.message : String(err);
    if (!text.includes(ALREADY_EXISTS_MESSAGE)) throw err;
  }
}

export async function closeOffscreenDocumentIfOpen(): Promise<void> {
  if (typeof chrome.offscreen.hasDocument === 'function') {
    const has = await chrome.offscreen.hasDocument();
    if (!has) return;
  }
  await chrome.offscreen.closeDocument().catch(() => {});
}
