import { promises as fs } from 'fs';
import path from 'path';

import {
  createEmptyFlowGraph,
  FLOW_FILE_NAME,
  FLOW_RELATIVE_DIR,
  parseFlowGraph,
  type FlowGraph,
} from '../../shared/domain/flow-graph';
import { FlowStorageError } from '../../shared/ipc/flow-contracts';

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getFlowFilePath(projectPath: string): string {
  return path.join(projectPath, FLOW_RELATIVE_DIR, FLOW_FILE_NAME);
}

export async function loadFlowGraphFromPath(projectPath: string): Promise<FlowGraph> {
  const flowPath = getFlowFilePath(projectPath);

  if (!(await pathExists(flowPath))) {
    return createEmptyFlowGraph();
  }

  try {
    const raw = await fs.readFile(flowPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);
    const graph = parseFlowGraph(parsed);

    if (!graph) {
      throw new FlowStorageError('INVALID_GRAPH', 'Saved flow data is invalid or corrupted.');
    }

    return graph;
  } catch (error) {
    if (error instanceof FlowStorageError) {
      throw error;
    }

    throw new FlowStorageError('IO_ERROR', 'Unable to read the saved flow.');
  }
}
