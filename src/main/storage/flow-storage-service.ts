import { promises as fs } from 'fs';
import path from 'path';

import {
  FLOW_FILE_NAME,
  FLOW_RELATIVE_DIR,
  isValidProjectCanvases,
  mergeCanvasGraphs,
  type FlowGraph,
  type ProjectCanvases,
} from '../../shared/domain/flow-graph';
import { PROJECT_FILE_NAME, type ProjectFile } from '../../shared/domain/project-file';
import { FlowStorageError } from '../../shared/ipc/flow-contracts';
import { findProjectById } from './project-storage-service';
import { loadProjectCanvasesFromPath } from './flow-storage-path';

export { loadFlowGraphFromPath, loadProjectCanvasesFromPath } from './flow-storage-path';

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
    //
  }
}

export async function loadProjectCanvases(projectId: string): Promise<ProjectCanvases> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new FlowStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  return loadProjectCanvasesFromPath(project.path);
}

export async function loadFlowGraph(projectId: string): Promise<FlowGraph> {
  const canvases = await loadProjectCanvases(projectId);
  return mergeCanvasGraphs(canvases.canvases);
}

export async function saveProjectCanvases(
  projectId: string,
  canvases: ProjectCanvases,
): Promise<ProjectCanvases> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new FlowStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  if (!isValidProjectCanvases(canvases)) {
    throw new FlowStorageError('INVALID_GRAPH', 'Flow data is invalid.');
  }

  const flowDir = path.join(project.path, FLOW_RELATIVE_DIR);
  const flowPath = getFlowFilePath(project.path);

  try {
    await fs.mkdir(flowDir, { recursive: true });
    await fs.writeFile(flowPath, `${JSON.stringify(canvases, null, 2)}\n`, 'utf8');
    await touchProjectUpdatedAt(project.path);
  } catch {
    throw new FlowStorageError('IO_ERROR', 'Unable to save the flow.');
  }

  return canvases;
}

/** @deprecated Use saveProjectCanvases instead. */
export async function saveFlowGraph(projectId: string, graph: FlowGraph): Promise<FlowGraph> {
  const existing = await loadProjectCanvases(projectId);
  const activeCanvas = existing.canvases.find((canvas) => canvas.id === existing.activeCanvasId);

  if (!activeCanvas) {
    throw new FlowStorageError('INVALID_GRAPH', 'Active canvas could not be found.');
  }

  activeCanvas.graph = graph;
  await saveProjectCanvases(projectId, existing);
  return graph;
}
