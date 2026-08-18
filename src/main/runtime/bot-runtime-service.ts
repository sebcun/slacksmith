import type { BotRuntimeStatus } from '../../shared/domain/bot-project';
import { MAX_APP_MANAGED_RUNNING_BOTS } from '../../shared/domain/bot-project';
import type { RuntimeLogEntry } from '../../shared/domain/runtime-log';
import type { BotProject } from '../../shared/ipc/project-contracts';
import {
  BotRuntimeError,
  type BotRuntimeState,
} from '../../shared/ipc/runtime-contracts';
import { loadFlowGraph } from '../storage/flow-storage-service';
import { GlobalVariableStore } from '../storage/global-variable-store';
import { findProjectById } from '../storage/project-storage-service';
import { loadSlackConfigForProject } from '../storage/slack-config-service';
import { closeLogsWindow, sendLogsUpdated } from '../logs-window';
import { syncProjectRuntimeFiles } from './project-runtime-sync';
import { RuntimeLogger } from './runtime-logger';
import { SlackSocketRuntime } from './slack-socket-runtime';

let activeProject: BotProject | null = null;
let status: BotRuntimeStatus = 'inactive';
let lastError: string | null = null;
let activeSession: SlackSocketRuntime | null = null;
let activeLogger: RuntimeLogger | null = null;
let activeGlobalVariableStore: GlobalVariableStore | null = null;

function attachLoggerNotifications(logger: RuntimeLogger): void {
  logger.onChange(() => {
    sendLogsUpdated();
  });
}

function createRuntimeState(): BotRuntimeState {
  return {
    activeProject,
    status,
    lastError,
  };
}

function setErrorState(message: string): void {
  lastError = message;
  status = 'error';
}

async function stopExecution(): Promise<void> {
  if (activeSession) {
    await activeSession.stop();
    activeSession = null;
  }

  if (activeGlobalVariableStore) {
    await activeGlobalVariableStore.flush();
    activeGlobalVariableStore = null;
  }

  if (status !== 'error') {
    status = 'inactive';
  }
}

export function getRuntimeState(): BotRuntimeState {
  return createRuntimeState();
}

export function getRuntimeLogs(): RuntimeLogEntry[] {
  return activeLogger?.getEntries() ?? [];
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
    await closeBot();
  }

  if (MAX_APP_MANAGED_RUNNING_BOTS !== 1) {
    throw new BotRuntimeError('ALREADY_OPEN', 'Only one bot can be open at a time.');
  }

  activeProject = project;
  status = 'inactive';
  lastError = null;
  activeLogger = new RuntimeLogger(project.path);
  attachLoggerNotifications(activeLogger);

  try {
    await syncProjectRuntimeFiles(project.path, project.name);
  } catch {
    // Runtime files are optional until the user runs the bot independently.
  }

  return createRuntimeState();
}

export async function startBot(): Promise<BotRuntimeState> {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status === 'running') {
    throw new BotRuntimeError('ALREADY_RUNNING', 'Bot is already running.');
  }

  const slackConfig = await loadSlackConfigForProject(activeProject.id);

  if (!slackConfig) {
    throw new BotRuntimeError(
      'SLACK_NOT_CONFIGURED',
      'Connect this bot to Slack before starting it.',
    );
  }

  let graph;

  try {
    graph = await loadFlowGraph(activeProject.id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load the saved flow.';
    throw new BotRuntimeError('START_FAILED', message);
  }

  if (!activeLogger) {
    activeLogger = new RuntimeLogger(activeProject.path);
    attachLoggerNotifications(activeLogger);
  } else {
    activeLogger.clear();
  }

  lastError = null;
  activeLogger.info('runtime', `Starting bot "${activeProject.name}".`);

  const globalVariableStore = new GlobalVariableStore(activeProject.path);
  await globalVariableStore.load();
  activeGlobalVariableStore = globalVariableStore;

  const session = new SlackSocketRuntime(
    slackConfig,
    graph,
    activeLogger,
    globalVariableStore,
    (message) => {
      setErrorState(message);
    },
  );

  try {
    await session.start();
  } catch (error) {
    activeSession = null;
    const message =
      error instanceof Error ? error.message : 'Failed to start the bot runtime.';
    setErrorState(message);
    activeLogger.error('runtime', message);
    throw new BotRuntimeError('START_FAILED', message);
  }

  activeSession = session;
  status = 'running';

  return createRuntimeState();
}

export async function stopBot(): Promise<BotRuntimeState> {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status !== 'running' && status !== 'paused' && status !== 'error') {
    throw new BotRuntimeError('NOT_RUNNING', 'Bot is not running.');
  }

  await stopExecution();
  lastError = null;
  status = 'inactive';
  activeLogger?.info('runtime', 'Bot stopped.');

  return createRuntimeState();
}

export async function restartBot(): Promise<BotRuntimeState> {
  if (!activeProject) {
    throw new BotRuntimeError('NOT_OPEN', 'No bot is open.');
  }

  if (status === 'running' || status === 'paused' || status === 'error') {
    await stopExecution();
    lastError = null;
    status = 'inactive';
  }

  return startBot();
}

export async function closeBot(): Promise<BotRuntimeState> {
  if (status === 'running' || status === 'paused' || status === 'error') {
    await stopExecution();
  }

  closeLogsWindow();

  activeProject = null;
  status = 'inactive';
  lastError = null;
  activeLogger = null;

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
