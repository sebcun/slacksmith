import { promises as fs } from 'fs';
import path from 'path';

import {
  createEmptySlackConnectionSummary,
  isValidSlackConfigFile,
  SLACK_CONFIG_FILE_NAME,
  SLACK_CONFIG_RELATIVE_DIR,
  toSlackConnectionSummary,
  validateSlackCredentials,
  type SlackConfigFile,
  type SlackConnectionSummary,
  type SlackCredentials,
} from '../../shared/domain/slack-config';
import {
  SlackConnectionError,
} from '../../shared/ipc/slack-contracts';
import { findProjectById } from './project-storage-service';

interface SlackAuthTestResponse {
  ok: boolean;
  error?: string;
  team?: string;
  user?: string;
  user_id?: string;
}

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

async function readSlackConfigFile(projectPath: string): Promise<SlackConfigFile | null> {
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

async function writeSlackConfigFile(
  projectPath: string,
  config: SlackConfigFile,
): Promise<void> {
  const dataDir = path.join(projectPath, SLACK_CONFIG_RELATIVE_DIR);
  const configPath = getSlackConfigPath(projectPath);

  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
  } catch {
    throw new SlackConnectionError('IO_ERROR', 'Unable to save Slack credentials on disk.');
  }
}

async function removeSlackConfigFile(projectPath: string): Promise<void> {
  const configPath = getSlackConfigPath(projectPath);

  if (!(await pathExists(configPath))) {
    return;
  }

  try {
    await fs.unlink(configPath);
  } catch {
    throw new SlackConnectionError('IO_ERROR', 'Unable to remove Slack credentials.');
  }
}

async function resolveProjectPath(projectId: string): Promise<string> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new SlackConnectionError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  return project.path;
}

async function verifyBotToken(botToken: string): Promise<{
  teamName: string;
  botName: string;
  botUserId: string;
}> {
  let response: Response;

  try {
    response = await fetch('https://slack.com/api/auth.test', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${botToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch {
    throw new SlackConnectionError(
      'CONNECTION_FAILED',
      'Could not reach Slack. Check your internet connection and try again.',
    );
  }

  let payload: SlackAuthTestResponse;

  try {
    payload = (await response.json()) as SlackAuthTestResponse;
  } catch {
    throw new SlackConnectionError(
      'CONNECTION_FAILED',
      'Slack returned an unexpected response. Try again.',
    );
  }

  if (!payload.ok) {
    const message =
      payload.error === 'invalid_auth'
        ? 'Slack rejected the bot token. Check that it is correct and reinstall the app if needed.'
        : `Slack connection failed: ${payload.error ?? 'unknown error'}.`;

    throw new SlackConnectionError('CONNECTION_FAILED', message);
  }

  if (!payload.team || !payload.user || !payload.user_id) {
    throw new SlackConnectionError(
      'CONNECTION_FAILED',
      'Slack accepted the token but did not return workspace details.',
    );
  }

  return {
    teamName: payload.team,
    botName: payload.user,
    botUserId: payload.user_id,
  };
}

export async function loadSlackConfigForProject(projectId: string): Promise<SlackConfigFile | null> {
  const projectPath = await resolveProjectPath(projectId);
  return readSlackConfigFile(projectPath);
}

export async function getSlackConnection(projectId: string): Promise<SlackConnectionSummary> {
  const projectPath = await resolveProjectPath(projectId);
  const config = await readSlackConfigFile(projectPath);

  if (!config) {
    return createEmptySlackConnectionSummary();
  }

  return toSlackConnectionSummary(config);
}

export async function saveSlackConnection(
  projectId: string,
  input: SlackCredentials,
): Promise<SlackConnectionSummary> {
  const validation = validateSlackCredentials(input);

  if (!validation.ok) {
    throw new SlackConnectionError('INVALID_CREDENTIALS', validation.message);
  }

  const projectPath = await resolveProjectPath(projectId);
  const verification = await verifyBotToken(validation.credentials.botToken);

  const config: SlackConfigFile = {
    ...validation.credentials,
    teamName: verification.teamName,
    botName: verification.botName,
    botUserId: verification.botUserId,
    lastVerifiedAt: new Date().toISOString(),
  };

  await writeSlackConfigFile(projectPath, config);
  return toSlackConnectionSummary(config);
}

export async function clearSlackConnection(projectId: string): Promise<SlackConnectionSummary> {
  const projectPath = await resolveProjectPath(projectId);
  await removeSlackConfigFile(projectPath);
  return createEmptySlackConnectionSummary();
}

export function getSlackConnectionErrorMessage(error: unknown): string {
  if (error instanceof SlackConnectionError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected Slack connection error occurred.';
}
