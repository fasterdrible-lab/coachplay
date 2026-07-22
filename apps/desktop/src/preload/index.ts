import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc-channels';
import { CaptureSourceInfo, StartCaptureParams } from '../main/local-capture-controller';
import { CaptureSessionSnapshot } from '../main/capture-session-state';
import { AuthenticatedUser, MatchSummary } from '../main/backend-client';

/**
 * Única porta entre o processo main (Node, acesso a arquivos/rede) e o
 * renderer (sandboxed, sem Node). Expõe só o necessário — nunca `ipcRenderer`
 * cru, para que o renderer não possa invocar canais arbitrários.
 */
contextBridge.exposeInMainWorld('coachPlay', {
  auth: {
    login: (email: string, password: string): Promise<AuthenticatedUser> =>
      ipcRenderer.invoke(IPC_CHANNELS.AUTH_LOGIN, { email, password }),
  },

  matches: {
    list: (): Promise<MatchSummary[]> => ipcRenderer.invoke(IPC_CHANNELS.LIST_MATCHES),

    create: (params: { title?: string; gameMode?: string; matchDate?: string }): Promise<MatchSummary> =>
      ipcRenderer.invoke(IPC_CHANNELS.CREATE_MATCH, params),
  },

  capture: {
    listSources: (): Promise<CaptureSourceInfo[]> => ipcRenderer.invoke(IPC_CHANNELS.LIST_SOURCES),

    start: (params: StartCaptureParams): Promise<CaptureSessionSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.START, params),

    pause: (): Promise<CaptureSessionSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.PAUSE),

    resume: (): Promise<CaptureSessionSnapshot> => ipcRenderer.invoke(IPC_CHANNELS.RESUME),

    stop: (errorMessage?: string): Promise<CaptureSessionSnapshot> =>
      ipcRenderer.invoke(IPC_CHANNELS.STOP, errorMessage),

    getStatus: (): Promise<CaptureSessionSnapshot | null> => ipcRenderer.invoke(IPC_CHANNELS.GET_STATUS),

    submitFrame: (buffer: ArrayBuffer, timestampMs: number): Promise<void> =>
      ipcRenderer.invoke(IPC_CHANNELS.SUBMIT_FRAME, { buffer, timestampMs }),

    onSourceLost: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on(IPC_CHANNELS.SOURCE_LOST, listener);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.SOURCE_LOST, listener);
    },
  },
});
