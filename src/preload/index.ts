import { contextBridge, ipcRenderer } from 'electron';

import type {
  CreateProjectRequest,
  DeleteProjectRequest,
  DuplicateProjectRequest,
  OpenProjectRequest,
  RenameProjectRequest,
} from '../shared/ipc/project-contracts';
import type { OpenBotRequest } from '../shared/ipc/runtime-contracts';

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
});
