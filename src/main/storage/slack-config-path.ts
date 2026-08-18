import { promises as fs } from 'fs';
import path from 'path';

import {
  isValidSlackConfigFile,
  SLACK_CONFIG_FILE_NAME,
  SLACK_CONFIG_RELATIVE_DIR,
  type SlackConfigFile,
} from '../../shared/domain/slack-config';

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function getSlackConfigPath(projectPath: string): string {
  return path.join(projectPath, SLACK_CONFIG_RELATIVE_DIR, SLACK_CONFIG_FILE_NAME);
}

export async function loadSlackConfigFromPath(projectPath: string): Promise<SlackConfigFile | null> {
  const configPath = getSlackConfigPath(projectPath);

  if (!(await pathExists(configPath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(configPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isValidSlackConfigFile(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}
