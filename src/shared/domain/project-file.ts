import type { BotProjectMetadata } from './bot-project';

export const PROJECT_FILE_NAME = 'project.json';

export const PROJECT_SUBDIRS = ['data', 'assets', 'logs'] as const;

export type ProjectFile = BotProjectMetadata;
