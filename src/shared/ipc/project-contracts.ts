import type { BotProjectMetadata } from '../domain/bot-project';

export interface BotProject extends BotProjectMetadata {
  path: string;
}

export interface CreateProjectRequest {
  name: string;
}

export type OpenProjectRequest =
  | { kind: 'id'; id: string }
  | { kind: 'path'; path: string }
  | { kind: 'dialog' };

export interface RenameProjectRequest {
  id: string;
  name: string;
}

export interface DeleteProjectRequest {
  id: string;
}

export type ListProjectsResponse = BotProject[];

export type CreateProjectResponse = BotProject;

export type OpenProjectResponse = BotProject;

export type RenameProjectResponse = BotProject;

export type DeleteProjectResponse = void;

export type ProjectErrorCode =
  | 'INVALID_NAME'
  | 'DUPLICATE_NAME'
  | 'PROJECT_NOT_FOUND'
  | 'INVALID_PROJECT'
  | 'IO_ERROR'
  | 'CANCELLED';

export class ProjectStorageError extends Error {
  readonly code: ProjectErrorCode;

  constructor(code: ProjectErrorCode, message: string) {
    super(message);
    this.name = 'ProjectStorageError';
    this.code = code;
  }
}
