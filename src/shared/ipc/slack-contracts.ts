import type { SlackConnectionSummary, SlackCredentials } from '../domain/slack-config';

export interface GetSlackConnectionRequest {
  projectId: string;
}

export interface SaveSlackConnectionRequest {
  projectId: string;
  credentials: SlackCredentials;
}

export interface ClearSlackConnectionRequest {
  projectId: string;
}

export type GetSlackConnectionResponse = SlackConnectionSummary;

export type SaveSlackConnectionResponse = SlackConnectionSummary;

export type ClearSlackConnectionResponse = SlackConnectionSummary;

export type SlackConnectionErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'INVALID_CREDENTIALS'
  | 'CONNECTION_FAILED'
  | 'NOT_CONFIGURED'
  | 'IO_ERROR';

export class SlackConnectionError extends Error {
  readonly code: SlackConnectionErrorCode;

  constructor(code: SlackConnectionErrorCode, message: string) {
    super(message);
    this.name = 'SlackConnectionError';
    this.code = code;
  }
}
