import { BrowserWindow } from 'electron';
import path from 'path';

import { IPC_CHANNELS } from '../shared/ipc/channels';
import { getRuntimeState } from './runtime/bot-runtime-service';

let logsWindow: BrowserWindow | null = null;

export function getLogsWindow(): BrowserWindow | null {
  if (logsWindow?.isDestroyed()) {
    logsWindow = null;
  }

  return logsWindow;
}

export function sendLogsUpdated(): void {
  const window = getLogsWindow();

  if (window && !window.isDestroyed()) {
    window.webContents.send(IPC_CHANNELS.RUNTIME_LOGS_UPDATED);
  }
}

export function openLogsWindow(): void {
  const state = getRuntimeState();

  if (!state.activeProject) {
    return;
  }

  const existingWindow = getLogsWindow();

  if (existingWindow) {
    existingWindow.focus();
    return;
  }

  const projectName = state.activeProject.name;

  logsWindow = new BrowserWindow({
    width: 720,
    height: 480,
    minWidth: 420,
    minHeight: 280,
    title: `Bot Logs — ${projectName}`,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  logsWindow.once('ready-to-show', () => {
    logsWindow?.show();
  });

  void logsWindow.loadFile(path.join(__dirname, '../renderer/index.html'), {
    query: { view: 'logs' },
  });

  logsWindow.on('closed', () => {
    logsWindow = null;
  });
}

export function closeLogsWindow(): void {
  const window = getLogsWindow();

  if (window) {
    window.close();
  }

  logsWindow = null;
}
