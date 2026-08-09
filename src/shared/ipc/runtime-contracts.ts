import type { BotRuntimeStatus } from '../domain/bot-project';
import type { BotProject } from './project-contracts';

export interface BotRuntimeState {
  activeProject: BotProject | null;
  status: BotRuntimeStatus;
}

export interface OpenBotRequest {
  id: string;
}

export type GetRuntimeStateResponse = BotRuntimeState;

export type OpenBotResponse = BotRuntimeState;

export type CloseBotResponse = BotRuntimeState;

export type RuntimeErrorCode = 'PROJECT_NOT_FOUND' | 'ALREADY_OPEN';

export class BotRuntimeError extends Error {
  readonly code: RuntimeErrorCode;

  constructor(code: RuntimeErrorCode, message: string) {
    super(message);
    this.name = 'BotRuntimeError';
    this.code = code;
  }
}
