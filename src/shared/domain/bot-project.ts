export interface BotProjectMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

export type BotRuntimeStatus = 'inactive' | 'running' | 'paused' | 'error';

export const MAX_APP_MANAGED_RUNNING_BOTS = 1;
