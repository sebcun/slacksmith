import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';

import type {
  GetFlowGraphRequest,
  SaveFlowGraphRequest,
} from '../shared/ipc/flow-contracts';
import type {
  CreateProjectRequest,
  DeleteProjectRequest,
  DuplicateProjectRequest,
  OpenProjectRequest,
  RenameProjectRequest,
  SaveProjectAsRequest,
} from '../shared/ipc/project-contracts';
import type { OpenBotRequest, RunBotIndependentlyRequest } from '../shared/ipc/runtime-contracts';
import type {
  ClearSlackConnectionRequest,
  GetSlackConnectionRequest,
  SaveSlackConnectionRequest,
} from '../shared/ipc/slack-contracts';
import type { AppStateReport, MenuAction } from '../shared/ipc/menu-contracts';
import type { SetActiveThemeRequest } from '../shared/ipc/theme-contracts';

const IPC_CHANNELS = {
  GET_APP_INFO: 'app:get-info',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_RENAME: 'projects:rename',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_DUPLICATE: 'projects:duplicate',
  PROJECTS_SAVE_AS: 'projects:save-as',
  RUNTIME_GET_STATE: 'runtime:get-state',
  RUNTIME_OPEN_BOT: 'runtime:open-bot',
  RUNTIME_CLOSE_BOT: 'runtime:close-bot',
  RUNTIME_START_BOT: 'runtime:start-bot',
  RUNTIME_STOP_BOT: 'runtime:stop-bot',
  RUNTIME_RESTART_BOT: 'runtime:restart-bot',
  RUNTIME_RUN_INDEPENDENTLY: 'runtime:run-independently',
  RUNTIME_GET_LOGS: 'runtime:get-logs',
  RUNTIME_LOGS_UPDATED: 'runtime:logs-updated',
  FLOW_GET: 'flow:get',
  FLOW_SAVE: 'flow:save',
  SLACK_GET_CONNECTION: 'slack:get-connection',
  SLACK_SAVE_CONNECTION: 'slack:save-connection',
  SLACK_CLEAR_CONNECTION: 'slack:clear-connection',
  MENU_ACTION: 'menu:action',
  APP_REPORT_STATE: 'app:report-state',
  MENU_REFRESH_RECENT: 'menu:refresh-recent',
  THEMES_LIST: 'themes:list',
  THEMES_GET_ACTIVE: 'themes:get-active',
  THEMES_SET_ACTIVE: 'themes:set-active',
  THEMES_GET_COLORS: 'themes:get-colors',
  THEMES_GET_ACTIVE_COLORS: 'themes:get-active-colors',
} as const;

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke(IPC_CHANNELS.GET_APP_INFO),
  listProjects: () => ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_LIST),
  createProject: (request: CreateProjectRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_CREATE, request),
  openProject: (request: OpenProjectRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_OPEN, request),
  renameProject: (request: RenameProjectRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_RENAME, request),
  deleteProject: (request: DeleteProjectRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DELETE, request),
  duplicateProject: (request: DuplicateProjectRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_DUPLICATE, request),
  saveProjectAs: (request: SaveProjectAsRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.PROJECTS_SAVE_AS, request),
  getRuntimeState: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_GET_STATE),
  openBot: (request: OpenBotRequest) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_OPEN_BOT, request),
  closeBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_CLOSE_BOT),
  startBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_START_BOT),
  stopBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_STOP_BOT),
  restartBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_RESTART_BOT),
  runBotIndependently: (request: RunBotIndependentlyRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_RUN_INDEPENDENTLY, request),
  getRuntimeLogs: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_GET_LOGS),
  onRuntimeLogsUpdated: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on(IPC_CHANNELS.RUNTIME_LOGS_UPDATED, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.RUNTIME_LOGS_UPDATED, listener);
    };
  },
  getFlowGraph: (request: GetFlowGraphRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.FLOW_GET, request),
  saveFlowGraph: (request: SaveFlowGraphRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.FLOW_SAVE, request),
  getSlackConnection: (request: GetSlackConnectionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.SLACK_GET_CONNECTION, request),
  saveSlackConnection: (request: SaveSlackConnectionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.SLACK_SAVE_CONNECTION, request),
  clearSlackConnection: (request: ClearSlackConnectionRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.SLACK_CLEAR_CONNECTION, request),
  onMenuAction: (callback: (action: MenuAction) => void) => {
    const listener = (_event: IpcRendererEvent, action: MenuAction) => {
      callback(action);
    };
    ipcRenderer.on(IPC_CHANNELS.MENU_ACTION, listener);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.MENU_ACTION, listener);
    };
  },
  reportAppState: (state: AppStateReport) =>
    ipcRenderer.invoke(IPC_CHANNELS.APP_REPORT_STATE, state),
  refreshRecentProjectsMenu: () => ipcRenderer.invoke(IPC_CHANNELS.MENU_REFRESH_RECENT),
  listThemes: () => ipcRenderer.invoke(IPC_CHANNELS.THEMES_LIST),
  getActiveTheme: () => ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET_ACTIVE),
  setActiveTheme: (request: SetActiveThemeRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.THEMES_SET_ACTIVE, request),
  getThemeColors: (request: { themeId: string }) =>
    ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET_COLORS, request),
  getActiveThemeColors: () => ipcRenderer.invoke(IPC_CHANNELS.THEMES_GET_ACTIVE_COLORS),
});
