import { contextBridge, ipcRenderer } from 'electron';

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
} from '../shared/ipc/project-contracts';
import type { OpenBotRequest } from '../shared/ipc/runtime-contracts';
import type {
  ClearSlackConnectionRequest,
  GetSlackConnectionRequest,
  SaveSlackConnectionRequest,
} from '../shared/ipc/slack-contracts';

const IPC_CHANNELS = {
  GET_APP_INFO: 'app:get-info',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_RENAME: 'projects:rename',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_DUPLICATE: 'projects:duplicate',
  RUNTIME_GET_STATE: 'runtime:get-state',
  RUNTIME_OPEN_BOT: 'runtime:open-bot',
  RUNTIME_CLOSE_BOT: 'runtime:close-bot',
  RUNTIME_START_BOT: 'runtime:start-bot',
  RUNTIME_STOP_BOT: 'runtime:stop-bot',
  RUNTIME_RESTART_BOT: 'runtime:restart-bot',
  RUNTIME_GET_LOGS: 'runtime:get-logs',
  FLOW_GET: 'flow:get',
  FLOW_SAVE: 'flow:save',
  SLACK_GET_CONNECTION: 'slack:get-connection',
  SLACK_SAVE_CONNECTION: 'slack:save-connection',
  SLACK_CLEAR_CONNECTION: 'slack:clear-connection',
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
  getRuntimeState: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_GET_STATE),
  openBot: (request: OpenBotRequest) => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_OPEN_BOT, request),
  closeBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_CLOSE_BOT),
  startBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_START_BOT),
  stopBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_STOP_BOT),
  restartBot: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_RESTART_BOT),
  getRuntimeLogs: () => ipcRenderer.invoke(IPC_CHANNELS.RUNTIME_GET_LOGS),
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
});
