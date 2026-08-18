import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { AppStateReport } from '../../shared/ipc/menu-contracts';
import {
  refreshOpenRecentMenu,
  updateApplicationMenuState,
} from '../menu/application-menu';

export function registerMenuIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.APP_REPORT_STATE, (_event, state: AppStateReport) => {
    updateApplicationMenuState(state);
  });

  ipcMain.handle(IPC_CHANNELS.MENU_REFRESH_RECENT, async () => {
    await refreshOpenRecentMenu();
  });
}
