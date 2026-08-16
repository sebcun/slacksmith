export const SLACK_CONFIG_FILE_NAME = 'slack-config.json';

export const SLACK_CONFIG_RELATIVE_DIR = 'data';

export interface SlackCredentials {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

export interface SlackConfigFile extends SlackCredentials {
  teamName: string;
  botName: string;
  botUserId: string;
  lastVerifiedAt: string;
}

export interface SlackConnectionSummary {
  configured: boolean;
  teamName?: string;
  botName?: string;
  botUserId?: string;
  botTokenMasked?: string;
  appTokenMasked?: string;
  signingSecretMasked?: string;
  lastVerifiedAt?: string;
}

export interface SlackCredentialValidationResult {
  ok: true;
  credentials: SlackCredentials;
}

export interface SlackCredentialValidationError {
  ok: false;
  field?: keyof SlackCredentials;
  message: string;
}

export type SlackCredentialValidation =
  | SlackCredentialValidationResult
  | SlackCredentialValidationError;

const BOT_TOKEN_PREFIX = 'xoxb-';
const APP_TOKEN_PREFIX = 'xapp-';
const MIN_SIGNING_SECRET_LENGTH = 8;

export function maskSecret(value: string): string {
  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return '';
  }

  if (trimmed.length <= 8) {
    return '••••••••';
  }

  const prefixLength = trimmed.startsWith(BOT_TOKEN_PREFIX)
    ? BOT_TOKEN_PREFIX.length
    : trimmed.startsWith(APP_TOKEN_PREFIX)
      ? APP_TOKEN_PREFIX.length
      : 0;

  const prefix = trimmed.slice(0, prefixLength);
  const suffix = trimmed.slice(-4);

  return `${prefix}${'•'.repeat(8)}${suffix}`;
}

export function toSlackConnectionSummary(config: SlackConfigFile): SlackConnectionSummary {
  return {
    configured: true,
    teamName: config.teamName,
    botName: config.botName,
    botUserId: config.botUserId,
    botTokenMasked: maskSecret(config.botToken),
    appTokenMasked: maskSecret(config.appToken),
    signingSecretMasked: maskSecret(config.signingSecret),
    lastVerifiedAt: config.lastVerifiedAt,
  };
}

export function createEmptySlackConnectionSummary(): SlackConnectionSummary {
  return { configured: false };
}

export function validateSlackCredentials(input: SlackCredentials): SlackCredentialValidation {
  const botToken = input.botToken.trim();
  const appToken = input.appToken.trim();
  const signingSecret = input.signingSecret.trim();

  if (botToken.length === 0) {
    return { ok: false, field: 'botToken', message: 'Bot token is required.' };
  }

  if (!botToken.startsWith(BOT_TOKEN_PREFIX)) {
    return {
      ok: false,
      field: 'botToken',
      message: 'Bot token must start with xoxb-.',
    };
  }

  if (appToken.length === 0) {
    return { ok: false, field: 'appToken', message: 'App token is required.' };
  }

  if (!appToken.startsWith(APP_TOKEN_PREFIX)) {
    return {
      ok: false,
      field: 'appToken',
      message: 'App token must start with xapp-.',
    };
  }

  if (signingSecret.length === 0) {
    return {
      ok: false,
      field: 'signingSecret',
      message: 'Signing secret is required.',
    };
  }

  if (signingSecret.length < MIN_SIGNING_SECRET_LENGTH) {
    return {
      ok: false,
      field: 'signingSecret',
      message: 'Signing secret looks too short.',
    };
  }

  return {
    ok: true,
    credentials: {
      botToken,
      appToken,
      signingSecret,
    },
  };
}

export function isValidSlackConfigFile(value: unknown): value is SlackConfigFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;

  return (
    typeof record.botToken === 'string' &&
    typeof record.appToken === 'string' &&
    typeof record.signingSecret === 'string' &&
    typeof record.teamName === 'string' &&
    typeof record.botName === 'string' &&
    typeof record.botUserId === 'string' &&
    typeof record.lastVerifiedAt === 'string'
  );
}
