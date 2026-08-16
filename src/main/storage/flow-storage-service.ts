import { promises as fs } from 'fs';
import path from 'path';

import {
  createEmptyFlowGraph,
  FLOW_FILE_NAME,
  FLOW_RELATIVE_DIR,
  isValidFlowGraph,
  parseFlowGraph,
  type FlowGraph,
} from '../../shared/domain/flow-graph';
import { PROJECT_FILE_NAME, type ProjectFile } from '../../shared/domain/project-file';
import { FlowStorageError } from '../../shared/ipc/flow-contracts';
import { findProjectById } from './project-storage-service';

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

async function touchProjectUpdatedAt(projectPath: string): Promise<void> {
  const projectFilePath = path.join(projectPath, PROJECT_FILE_NAME);

  if (!(await pathExists(projectFilePath))) {
    return;
  }

  try {
    const raw = await fs.readFile(projectFilePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ProjectFile).id !== 'string'
    ) {
      return;
    }

    const projectFile = parsed as ProjectFile;
    const updatedProjectFile: ProjectFile = {
      ...projectFile,
      updatedAt: new Date().toISOString(),
    };

    await fs.writeFile(
      projectFilePath,
      `${JSON.stringify(updatedProjectFile, null, 2)}\n`,
      'utf8',
    );
  } catch {
    // d
  }
}

export async function loadFlowGraph(projectId: string): Promise<FlowGraph> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new FlowStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  const flowPath = getFlowFilePath(project.path);

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

export async function saveFlowGraph(projectId: string, graph: FlowGraph): Promise<FlowGraph> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new FlowStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  if (!isValidFlowGraph(graph)) {
    throw new FlowStorageError('INVALID_GRAPH', 'Flow data is invalid.');
  }

  const flowDir = path.join(project.path, FLOW_RELATIVE_DIR);
  const flowPath = getFlowFilePath(project.path);

  try {
    await fs.mkdir(flowDir, { recursive: true });
    await fs.writeFile(flowPath, `${JSON.stringify(graph, null, 2)}\n`, 'utf8');
    await touchProjectUpdatedAt(project.path);
  } catch {
    throw new FlowStorageError('IO_ERROR', 'Unable to save the flow.');
  }

  return graph;
}
