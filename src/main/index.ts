import { app, BrowserWindow } from 'electron';
import path from 'path';

import { registerFlowIpcHandlers } from './ipc/register-flow-handlers';
import { registerIpcHandlers } from './ipc/register-handlers';
import { registerMenuIpcHandlers } from './ipc/register-menu-handlers';
import { registerProjectIpcHandlers } from './ipc/register-project-handlers';
import { registerRuntimeIpcHandlers } from './ipc/register-runtime-handlers';
import { registerSlackIpcHandlers } from './ipc/register-slack-handlers';
import { createApplicationMenu } from './menu/application-menu';
import { closeBot } from './runtime/bot-runtime-service';
import { setMainWindow } from './window';

function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1024,
    height: 768,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  setMainWindow(mainWindow);

  mainWindow.on('closed', () => {
    setMainWindow(null);
  });

  return mainWindow;
}

app.whenReady().then(() => {
  registerIpcHandlers();
  registerProjectIpcHandlers();
  registerRuntimeIpcHandlers();
  registerSlackIpcHandlers();
  registerFlowIpcHandlers();
  registerMenuIpcHandlers();
  createWindow();
  createApplicationMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
      createApplicationMenu();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  void closeBot();
});
