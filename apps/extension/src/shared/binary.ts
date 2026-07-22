/**
 * chrome.runtime.sendMessage não transfere ArrayBuffer de forma confiável entre
 * o content script (isolated world) e o service worker — o valor chega do outro
 * lado como um objeto genérico, e `new Blob([buffer])` silenciosamente serializa
 * isso como a string "[object Object]" em vez dos bytes reais (achado ao ver os
 * frames salvos em disco com 15 bytes de texto, não uma imagem). Convertendo
 * para base64 antes de mandar a mensagem, o valor vira uma string comum, que a
 * própria API de mensagens já serializa corretamente.
 */
const CHUNK_SIZE = 0x8000;

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK_SIZE) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK_SIZE));
  }
  return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}
