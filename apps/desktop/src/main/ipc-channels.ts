/**
 * Contrato de canais IPC entre main e renderer.
 * Mantido em um único lugar para o preload e os handlers nunca divergirem.
 */
export const IPC_CHANNELS = {
  LIST_SOURCES: 'capture:list-sources',
  START: 'capture:start',
  PAUSE: 'capture:pause',
  RESUME: 'capture:resume',
  STOP: 'capture:stop',
  GET_STATUS: 'capture:get-status',
  SUBMIT_FRAME: 'capture:submit-frame',
  SOURCE_LOST: 'capture:source-lost', // main -> renderer (evento, não invoke)
} as const;
