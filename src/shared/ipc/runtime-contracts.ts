import type { BotRuntimeStatus } from '../domain/bot-project';
import type { RuntimeLogEntry } from '../domain/runtime-log';
import type { BotProject } from './project-contracts';

export interface BotRuntimeState {
  activeProject: BotProject | null;
  status: BotRuntimeStatus;
  lastError: string | null;
}

export interface OpenBotRequest {
  id: string;
}

export type GetRuntimeStateResponse = BotRuntimeState;

export type OpenBotResponse = BotRuntimeState;

export type CloseBotResponse = BotRuntimeState;

export type StartBotResponse = BotRuntimeState;

export type StopBotResponse = BotRuntimeState;

export type RestartBotResponse = BotRuntimeState;

export type GetRuntimeLogsResponse = RuntimeLogEntry[];

export type RuntimeErrorCode =
  | 'PROJECT_NOT_FOUND'
  | 'ALREADY_OPEN'
  | 'NOT_OPEN'
  | 'ALREADY_RUNNING'
  | 'NOT_RUNNING'
  | 'SLACK_NOT_CONFIGURED'
  | 'START_FAILED';

export class BotRuntimeError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(code: RuntimeErrorCode, message: string) {
    super(message);
    this.name = 'BotRuntimeError';
    this.code = code;
  }
}
