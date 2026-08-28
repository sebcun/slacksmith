import type { ProjectCanvases } from '../domain/flow-graph';

export interface GetProjectCanvasesRequest {
  projectId: string;
}

export interface SaveProjectCanvasesRequest {
  projectId: string;
  canvases: ProjectCanvases;
}

export type GetProjectCanvasesResponse = ProjectCanvases;

export type SaveProjectCanvasesResponse = ProjectCanvases;

export type FlowStorageErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'INVALID_GRAPH'
  | 'IO_ERROR';

export class FlowStorageError extends Error {
  readonly code: FlowStorageErrorCode;

  constructor(code: FlowStorageErrorCode, message: string) {
    super(message);
    this.name = 'FlowStorageError';
    this.code = code;
  }
}
