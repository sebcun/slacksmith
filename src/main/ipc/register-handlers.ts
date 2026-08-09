import { app, ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { GetAppInfoResponse } from '../../shared/ipc/contracts';

export function registerIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.GET_APP_INFO, (): GetAppInfoResponse => {
    return {
      name: app.getName(),
      version: app.getVersion(),
      platform: process.platform,
    };
  });
}
