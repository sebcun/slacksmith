import { promises as fs } from 'fs';
import path from 'path';

import { PROJECT_FILE_NAME, type ProjectFile } from '../../shared/domain/project-file';
import { loadFlowGraphFromPath } from '../storage/flow-storage-path';
import { GlobalVariableStore } from '../storage/global-variable-store';
import { loadSlackConfigFromPath } from '../storage/slack-config-path';
import { RuntimeLogger } from './runtime-logger';
import { SlackSocketRuntime } from './slack-socket-runtime';

async function readProjectFile(projectPath: string): Promise<ProjectFile> {
  const projectFilePath = path.join(projectPath, PROJECT_FILE_NAME);

  try {
    const raw = await fs.readFile(projectFilePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed !== 'object' ||
      parsed === null ||
      typeof (parsed as ProjectFile).id !== 'string' ||
      typeof (parsed as ProjectFile).name !== 'string'
    ) {
      throw new Error('Project metadata is invalid.');
    }

    return parsed as ProjectFile;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to read project metadata.';
    throw new Error(message);
  }
}

export async function runStandaloneBot(projectPath: string): Promise<void> {
  const resolvedProjectPath = path.resolve(projectPath);
  const projectFile = await readProjectFile(resolvedProjectPath);
  const slackConfig = await loadSlackConfigFromPath(resolvedProjectPath);

  if (!slackConfig) {
    throw new Error('Connect this bot to Slack before starting it.');
  }

  const graph = await loadFlowGraphFromPath(resolvedProjectPath);
  const logger = new RuntimeLogger(resolvedProjectPath);
  logger.info('runtime', `Starting bot "${projectFile.name}" independently.`);

  const globalVariableStore = new GlobalVariableStore(resolvedProjectPath);
  await globalVariableStore.load();

  const session = new SlackSocketRuntime(
    slackConfig,
    graph,
    logger,
    globalVariableStore,
    (message) => {
      logger.error('runtime', message);
    },
  );

  let isShuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (isShuttingDown) {
      return;
    }

    isShuttingDown = true;
    console.log(`\nReceived ${signal}. Stopping bot...`);

    try {
      await session.stop();
      await globalVariableStore.flush();
    } finally {
      process.exit(0);
    }
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });

  await session.start();
  console.log(`Bot "${projectFile.name}" is running. Press Ctrl+C to stop.`);
}
