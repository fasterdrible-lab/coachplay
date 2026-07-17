import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from './ipc-channels';
import { CaptureSessionManager } from './capture-session-manager';
import { StartCaptureParams } from './local-capture-controller';

export function registerIpcHandlers(manager: CaptureSessionManager, window: BrowserWindow): void {
  ipcMain.handle(IPC_CHANNELS.LIST_SOURCES, () => manager.listSources());

  ipcMain.handle(IPC_CHANNELS.START, (_event, params: StartCaptureParams) => manager.start(params));

  ipcMain.handle(IPC_CHANNELS.PAUSE, () => manager.pause());

  ipcMain.handle(IPC_CHANNELS.RESUME, () => manager.resume());

  ipcMain.handle(IPC_CHANNELS.STOP, (_event, errorMessage?: string) => manager.stop(errorMessage));

  ipcMain.handle(IPC_CHANNELS.GET_STATUS, () => manager.getStatus());

  ipcMain.handle(
    IPC_CHANNELS.SUBMIT_FRAME,
    async (_event, args: { buffer: ArrayBuffer; timestampMs: number }) => {
      await manager.submitFrame(Buffer.from(args.buffer), args.timestampMs);
    },
  );

  // Se a janela de origem sumir (usuário fechou o Remote Play), avisa o
  // renderer para exibir o aviso e encerrar a sessão com erro — ver
  // docs/REMOTE_PLAY_CAPTURE.md, requisito "detectar perda de sinal".
  const sourceWatcher = setInterval(async () => {
    const status = manager.getStatus();
    if (!status || status.status !== 'running' || !status.sourceName) return;

    const sources = await manager.listSources();
    const stillExists = sources.some((s) => s.name === status.sourceName);
    if (!stillExists) {
      await manager.stop('A janela de origem foi fechada ou perdeu o sinal');
      window.webContents.send(IPC_CHANNELS.SOURCE_LOST);
    }
  }, 3_000);

  window.on('closed', () => clearInterval(sourceWatcher));
}
