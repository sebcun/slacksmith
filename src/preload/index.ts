import { contextBridge, ipcRenderer } from 'electron';

import type {
  CreateProjectRequest,
  DeleteProjectRequest,
  OpenProjectRequest,
  RenameProjectRequest,
} from '../shared/ipc/project-contracts';

const IPC_CHANNELS = {
  GET_APP_INFO: 'app:get-info',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_RENAME: 'projects:rename',
  PROJECTS_DELETE: 'projects:delete',
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
});
