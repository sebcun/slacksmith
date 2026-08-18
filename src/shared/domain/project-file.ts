import type { BotProjectMetadata } from './bot-project';

export const PROJECT_FILE_NAME = 'project.json';

export const PROJECT_SUBDIRS = ['data', 'assets', 'logs'] as const;

export const PROJECT_RUNTIME_DIR_NAME = 'runtime';

export const PROJECT_RUNTIME_SCRIPT_NAME = 'run-bot.js';

export const PROJECT_PACKAGE_FILE_NAME = 'package.json';

export type ProjectFile = BotProjectMetadata;
