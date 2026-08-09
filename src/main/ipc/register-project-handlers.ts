import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type {
  CreateProjectRequest,
  DeleteProjectRequest,
  OpenProjectRequest,
  RenameProjectRequest,
} from '../../shared/ipc/project-contracts';
import { ProjectStorageError } from '../../shared/ipc/project-contracts';
import {
  createProject,
  deleteProject,
  getProjectStorageErrorMessage,
  listProjects,
  openProject,
  renameProject,
} from '../storage/project-storage-service';

function rethrowProjectStorageError(error: unknown): never {
  if (error instanceof ProjectStorageError) {
    throw error;
  }

  throw new ProjectStorageError('IO_ERROR', getProjectStorageErrorMessage(error));
}

export function registerProjectIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PROJECTS_LIST, async () => {
    try {
      return await listProjects();
    } catch (error) {
      rethrowProjectStorageError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_CREATE, async (_event, request: CreateProjectRequest) => {
    try {
      return await createProject(request.name);
    } catch (error) {
      rethrowProjectStorageError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_OPEN, async (_event, request: OpenProjectRequest) => {
    try {
      return await openProject(request);
    } catch (error) {
      rethrowProjectStorageError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_RENAME, async (_event, request: RenameProjectRequest) => {
    try {
      return await renameProject(request.id, request.name);
    } catch (error) {
      rethrowProjectStorageError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.PROJECTS_DELETE, async (_event, request: DeleteProjectRequest) => {
    try {
      await deleteProject(request.id);
    } catch (error) {
      rethrowProjectStorageError(error);
    }
  });
}
