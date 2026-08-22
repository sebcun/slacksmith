import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { SetActiveThemeRequest } from '../../shared/ipc/theme-contracts';
import {
  ensureDefaultThemes,
  getActiveThemeColors,
  getActiveThemeId,
  getThemeColors,
  listThemes,
  setActiveThemeId,
} from '../storage/theme-service';

export function registerThemeIpcHandlers(): void {
  void ensureDefaultThemes();

  ipcMain.handle(IPC_CHANNELS.THEMES_LIST, async () => {
    const themes = await listThemes();
    return { themes };
  });

  ipcMain.handle(IPC_CHANNELS.THEMES_GET_ACTIVE, async () => {
    const themeId = await getActiveThemeId();
    return { themeId };
  });

  ipcMain.handle(IPC_CHANNELS.THEMES_SET_ACTIVE, async (_event, request: SetActiveThemeRequest) => {
    const themeId = await setActiveThemeId(request.themeId);
    return { themeId };
  });

  ipcMain.handle(IPC_CHANNELS.THEMES_GET_COLORS, async (_event, request: { themeId: string }) => {
    const theme = await getThemeColors(request.themeId);
    return {
      themeId: request.themeId,
      name: theme.name,
      colors: theme.colors,
    };
  });

  ipcMain.handle(IPC_CHANNELS.THEMES_GET_ACTIVE_COLORS, async () => {
    const activeTheme = await getActiveThemeColors();
    return {
      themeId: activeTheme.themeId,
      name: activeTheme.name,
      colors: activeTheme.colors,
    };
  });
}
