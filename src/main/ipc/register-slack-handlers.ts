import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type {
  ClearSlackConnectionRequest,
  GetSlackConnectionRequest,
  SaveSlackConnectionRequest,
} from '../../shared/ipc/slack-contracts';
import { SlackConnectionError } from '../../shared/ipc/slack-contracts';
import {
  clearSlackConnection,
  getSlackConnection,
  getSlackConnectionErrorMessage,
  saveSlackConnection,
} from '../storage/slack-config-service';

function rethrowSlackConnectionError(error: unknown): never {
  if (error instanceof SlackConnectionError) {
    throw error;
  }

  throw new SlackConnectionError('IO_ERROR', getSlackConnectionErrorMessage(error));
}

export function registerSlackIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.SLACK_GET_CONNECTION,
    async (_event, request: GetSlackConnectionRequest) => {
      try {
        return await getSlackConnection(request.projectId);
      } catch (error) {
        rethrowSlackConnectionError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SLACK_SAVE_CONNECTION,
    async (_event, request: SaveSlackConnectionRequest) => {
      try {
        return await saveSlackConnection(request.projectId, request.credentials);
      } catch (error) {
        rethrowSlackConnectionError(error);
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.SLACK_CLEAR_CONNECTION,
    async (_event, request: ClearSlackConnectionRequest) => {
      try {
        return await clearSlackConnection(request.projectId);
      } catch (error) {
        rethrowSlackConnectionError(error);
      }
    },
  );
}
