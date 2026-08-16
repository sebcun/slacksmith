import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type { OpenBotRequest } from '../../shared/ipc/runtime-contracts';
import { BotRuntimeError } from '../../shared/ipc/runtime-contracts';
import {
  closeBot,
  getRuntimeLogs,
  getRuntimeState,
  openBot,
  restartBot,
  startBot,
  stopBot,
} from '../runtime/bot-runtime-service';

function rethrowRuntimeError(error: unknown): never {
  if (error instanceof BotRuntimeError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new BotRuntimeError('START_FAILED', error.message);
  }

  throw new BotRuntimeError('START_FAILED', 'An unexpected runtime error occurred.');
}

export function registerRuntimeIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.RUNTIME_GET_STATE, async () => {
    return getRuntimeState();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_GET_LOGS, async () => {
    return getRuntimeLogs();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_OPEN_BOT, async (_event, request: OpenBotRequest) => {
    try {
      return await openBot(request.id);
    } catch (error) {
      rethrowRuntimeError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_CLOSE_BOT, async () => {
    return closeBot();
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_START_BOT, async () => {
    try {
      return await startBot();
    } catch (error) {
      rethrowRuntimeError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_STOP_BOT, async () => {
    try {
      return await stopBot();
    } catch (error) {
      rethrowRuntimeError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.RUNTIME_RESTART_BOT, async () => {
    try {
      return await restartBot();
    } catch (error) {
      rethrowRuntimeError(error);
    }
  });
}
