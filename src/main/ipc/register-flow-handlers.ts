import { ipcMain } from 'electron';

import { IPC_CHANNELS } from '../../shared/ipc/channels';
import type {
  GetFlowGraphRequest,
  SaveFlowGraphRequest,
} from '../../shared/ipc/flow-contracts';
import { FlowStorageError } from '../../shared/ipc/flow-contracts';
import { loadFlowGraph, saveFlowGraph } from '../storage/flow-storage-service';

function rethrowFlowStorageError(error: unknown): never {
  if (error instanceof FlowStorageError) {
    throw error;
  }

  if (error instanceof Error) {
    throw new FlowStorageError('IO_ERROR', error.message);
  }

  throw new FlowStorageError('IO_ERROR', 'An unexpected flow storage error occurred.');
}

export function registerFlowIpcHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.FLOW_GET, async (_event, request: GetFlowGraphRequest) => {
    try {
      return await loadFlowGraph(request.projectId);
    } catch (error) {
      rethrowFlowStorageError(error);
    }
  });

  ipcMain.handle(IPC_CHANNELS.FLOW_SAVE, async (_event, request: SaveFlowGraphRequest) => {
    try {
      return await saveFlowGraph(request.projectId, request.graph);
    } catch (error) {
      rethrowFlowStorageError(error);
    }
  });
}
