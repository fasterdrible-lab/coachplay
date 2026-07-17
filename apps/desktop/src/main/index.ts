import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { CaptureSessionManager } from './capture-session-manager';
import { BackendClient } from './backend-client';
import { registerIpcHandlers } from './ipc-handlers';
import { createLocalCaptureServer } from './local-server';

const LOCAL_SERVER_PORT = 47_813; // porta fixa e alta, só em 127.0.0.1
const BACKEND_BASE_URL = process.env.COACH_PLAY_API_URL ?? 'http://localhost:3001/api/v1';

function createWindow(): BrowserWindow {
  const window = new BrowserWindow({
    width: 1100,
    height: 720,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // false pois o preload usa módulos Node (contextBridge exige isso no Electron atual)
    },
  });

  window.loadFile(join(__dirname, '../renderer/index.html'));
  return window;
}

app.whenReady().then(() => {
  const backendClient = new BackendClient(BACKEND_BASE_URL);
  const manager = new CaptureSessionManager(backendClient);
  const window = createWindow();

  registerIpcHandlers(manager, window);

  const localServer = createLocalCaptureServer(manager);
  localServer.listen(LOCAL_SERVER_PORT, '127.0.0.1');

  window.on('closed', () => localServer.close());

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
