import type { BotRuntimeStatus } from '../../shared/domain/bot-project';
import { MAX_APP_MANAGED_RUNNING_BOTS } from '../../shared/domain/bot-project';
import type { BotProject } from '../../shared/ipc/project-contracts';
import {
  BotRuntimeError,
  type BotRuntimeState,
} from '../../shared/ipc/runtime-contracts';
import { findProjectById } from '../storage/project-storage-service';

let activeProject: BotProject | null = null;
let status: BotRuntimeStatus = 'inactive';

function createRuntimeState(): BotRuntimeState {
  return {
    activeProject,
    status,
  };
}

function stopExecution(): void {
  status = 'inactive';
}

export function getRuntimeState(): BotRuntimeState {
  return createRuntimeState();
}

export async function openBot(projectId: string): Promise<BotRuntimeState> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new BotRuntimeError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  if (activeProject?.id === projectId) {
    return createRuntimeState();
  }

  if (activeProject !== null) {
    closeBot();
  }

  if (MAX_APP_MANAGED_RUNNING_BOTS !== 1) {
    throw new BotRuntimeError('ALREADY_OPEN', 'Only one bot can be open at a time.');
  }

  activeProject = project;
  status = 'inactive';

  return createRuntimeState();
}

export function startBot(): BotRuntimeState {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status === 'running') {
    throw new BotRuntimeError('ALREADY_RUNNING', 'Bot is already running.');
  }

  status = 'running';

  return createRuntimeState();
}

export function stopBot(): BotRuntimeState {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status !== 'running' && status !== 'paused' && status !== 'error') {
    throw new BotRuntimeError('NOT_RUNNING', 'Bot is not running.');
  }

  stopExecution();

  return createRuntimeState();
}

export function restartBot(): BotRuntimeState {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status === 'running' || status === 'paused' || status === 'error') {
    stopExecution();
  }

  status = 'running';

  return createRuntimeState();
}

export function closeBot(): BotRuntimeState {
  if (status === 'running' || status === 'paused' || status === 'error') {
    stopExecution();
  }

  activeProject = null;
  status = 'inactive';

  return createRuntimeState();
}

export function isBotActive(projectId: string): boolean {
  return activeProject?.id === projectId;
}

export function syncActiveProject(project: BotProject): void {
  if (activeProject?.id === project.id) {
    activeProject = project;
  }
}
