import { app, Menu, shell, type MenuItemConstructorOptions } from 'electron';

import type { ThemeSummary } from '../../shared/domain/theme-colors';
import type { AppStateReport } from '../../shared/ipc/menu-contracts';
import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { BotProject } from '../../shared/ipc/project-contracts';
import { listProjects } from '../storage/project-storage-service';
import {
  ensureDefaultThemes,
  getActiveThemeId,
  listThemes,
  setActiveThemeId,
} from '../storage/theme-service';
import { getThemesRoot } from '../storage/theme-paths';
import { openLogsWindow } from '../logs-window';
import { getMainWindow } from '../window';

const RECENT_PROJECTS_LIMIT = 10;

let currentAppState: AppStateReport = {
  page: 'home',
  hasActiveProject: false,
  runtimeStatus: 'inactive',
};

function sendMenuAction(action: import('../../shared/ipc/menu-contracts').MenuAction): void {
  const mainWindow = getMainWindow();
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(IPC_CHANNELS.MENU_ACTION, action);
  }
}

function buildRecentProjectsSubmenu(projects: BotProject[]): MenuItemConstructorOptions[] {
  const recentProjects = projects.slice(0, RECENT_PROJECTS_LIMIT);

  if (recentProjects.length === 0) {
    return [
      {
        id: 'file-open-recent-placeholder',
        label: 'No Recent Projects',
        enabled: false,
      },
    ];
  }

  return recentProjects.map((project) => ({
    id: `file-open-recent-${project.id}`,
    label: project.name,
    click: () => {
      sendMenuAction({ type: 'file:open-recent', projectId: project.id });
    },
  }));
}

function buildThemesSubmenu(
  themes: ThemeSummary[],
  activeThemeId: string,
): MenuItemConstructorOptions[] {
  if (themes.length === 0) {
    return [
      {
        id: 'theme-list-placeholder',
        label: 'No Themes',
        enabled: false,
      },
    ];
  }

  return themes.map((theme) => ({
    id: `theme-select-${theme.id}`,
    label: theme.name,
    type: 'radio',
    checked: theme.id === activeThemeId,
    click: () => {
      void handleThemeSelect(theme.id);
    },
  }));
}

async function handleThemeSelect(themeId: string): Promise<void> {
  await setActiveThemeId(themeId);
  sendMenuAction({ type: 'theme:select', themeId });
  await refreshApplicationMenu();
}

async function handleOpenThemeDirectory(): Promise<void> {
  await ensureDefaultThemes();
  await shell.openPath(getThemesRoot());
  await refreshApplicationMenu();
}

function buildThemeSubmenu(
  themes: ThemeSummary[],
  activeThemeId: string,
): MenuItemConstructorOptions[] {
  return [
    {
      id: 'theme-themes',
      label: 'Themes',
      submenu: buildThemesSubmenu(themes, activeThemeId),
    },
    { type: 'separator' },
    {
      id: 'theme-open-directory',
      label: 'Open Theme Directory',
      click: () => {
        void handleOpenThemeDirectory();
      },
    },
  ];
}

function buildMenuTemplate(
  recentProjects: BotProject[],
  themes: ThemeSummary[],
  activeThemeId: string,
): MenuItemConstructorOptions[] {
  const isMac = process.platform === 'darwin';

  const fileSubmenu: MenuItemConstructorOptions[] = [
    {
      id: 'file-open',
      label: 'Open…',
      accelerator: 'CmdOrCtrl+O',
      click: () => {
        sendMenuAction({ type: 'file:open' });
      },
    },
    {
      id: 'file-open-recent',
      label: 'Open Recent',
      submenu: buildRecentProjectsSubmenu(recentProjects),
    },
    { type: 'separator' },
    {
      id: 'file-save',
      label: 'Save',
      accelerator: 'CmdOrCtrl+S',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'file:save' });
      },
    },
    {
      id: 'file-save-as',
      label: 'Save As…',
      accelerator: 'CmdOrCtrl+Shift+S',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'file:save-as' });
      },
    },
    { type: 'separator' },
    {
      id: 'file-close',
      label: 'Close',
      accelerator: 'CmdOrCtrl+W',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'file:close' });
      },
    },
  ];

  if (!isMac) {
    fileSubmenu.push({ type: 'separator' });
    fileSubmenu.push({ role: 'quit', label: 'Exit' });
  }

  const botSubmenu: MenuItemConstructorOptions[] = [
    {
      id: 'bot-run',
      label: 'Run Bot',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'bot:run' });
      },
    },
    {
      id: 'bot-run-independently',
      label: 'Run Bot Independently',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'bot:run-independently' });
      },
    },
    {
      id: 'bot-stop',
      label: 'Stop Bot',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'bot:stop' });
      },
    },
    {
      id: 'bot-restart',
      label: 'Restart Bot',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'bot:restart' });
      },
    },
    { type: 'separator' },
    {
      id: 'bot-open-logs',
      label: 'Open Logs',
      enabled: false,
      click: () => {
        openLogsWindow();
      },
    },
    { type: 'separator' },
    {
      id: 'bot-slack-settings',
      label: 'Manage Slack Settings',
      enabled: false,
      click: () => {
        sendMenuAction({ type: 'bot:slack-settings' });
      },
    },
  ];

  const template: MenuItemConstructorOptions[] = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push(
    {
      label: 'File',
      submenu: fileSubmenu,
    },
    {
      label: 'Bot',
      submenu: botSubmenu,
    },
    {
      label: 'Theme',
      submenu: buildThemeSubmenu(themes, activeThemeId),
    },
  );

  if (isMac) {
    template.push({
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    });
  }

  return template;
}

function setMenuItemEnabled(id: string, enabled: boolean): void {
  const menu = Menu.getApplicationMenu();
  const item = menu?.getMenuItemById(id);
  if (item) {
    item.enabled = enabled;
  }
}

function updateBotMenuState(state: AppStateReport): void {
  const hasProject = state.hasActiveProject;
  const isRunning =
    state.runtimeStatus === 'running' ||
    state.runtimeStatus === 'paused' ||
    state.runtimeStatus === 'error';

  setMenuItemEnabled('file-save', hasProject);
  setMenuItemEnabled('file-save-as', hasProject);
  setMenuItemEnabled('file-close', hasProject);

  setMenuItemEnabled('bot-run', hasProject && !isRunning);
  setMenuItemEnabled('bot-run-independently', hasProject);
  setMenuItemEnabled('bot-stop', hasProject && isRunning);
  setMenuItemEnabled('bot-restart', hasProject && isRunning);
  setMenuItemEnabled('bot-open-logs', hasProject);
  setMenuItemEnabled('bot-slack-settings', hasProject);
}

function setApplicationMenuFromTemplate(template: MenuItemConstructorOptions[]): void {
  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
  updateBotMenuState(currentAppState);
}

export async function refreshApplicationMenu(): Promise<void> {
  const [projects, themes, activeThemeId] = await Promise.all([
    listProjects(),
    listThemes(),
    getActiveThemeId(),
  ]);
  setApplicationMenuFromTemplate(buildMenuTemplate(projects, themes, activeThemeId));
}

export async function refreshOpenRecentMenu(): Promise<void> {
  await refreshApplicationMenu();
}

export function updateApplicationMenuState(state: AppStateReport): void {
  currentAppState = state;
  updateBotMenuState(state);
}

export function createApplicationMenu(): void {
  void refreshApplicationMenu();
}

export function getCurrentAppState(): AppStateReport {
  return currentAppState;
}

export async function onProjectsChanged(): Promise<void> {
  await refreshApplicationMenu();
}
