import type { FlowGraph } from '../domain/flow-graph';

export interface GetFlowGraphRequest {
  projectId: string;
}

export interface SaveFlowGraphRequest {
  projectId: string;
  graph: FlowGraph;
}

export type GetFlowGraphResponse = FlowGraph;

export type SaveFlowGraphResponse = FlowGraph;

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
