import type { WebClient } from '@slack/web-api';

import type { FlowNode } from '../../shared/domain/flow-graph';

export type SlackTriggerType =
  | 'message-received'
  | 'slash-command'
  | 'user-joined-channel'
  | 'user-left-channel'
  | 'app-mention';

export interface SlackTriggerPayload {
  triggerNodeId: string;
  type: SlackTriggerType;
  channelId: string;
  userId: string;
  text: string;
  messageTs?: string;
  command?: string;
  responseUrl?: string;
}

export interface TriggerAuthorVariable {
  id: string;
  name: string;
}

export interface TriggerUserVariable {
  id: string;
  name: string;
}

export interface TriggerChannelVariable {
  id: string;
  name: string;
}

export interface TriggerMessageVariable {
  content: string;
  channel: TriggerChannelVariable;
  ts?: string;
}

function resolveConfigBoolean(value: unknown, defaultValue: boolean): boolean {
  if (value === undefined) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
}

async function fetchUser(
  userId: string,
  slackClient: WebClient,
): Promise<TriggerUserVariable> {
  try {
    const result = await slackClient.users.info({ user: userId });
    const user = result.user;
    const name =
      user?.real_name ?? user?.profile?.display_name ?? user?.name ?? userId;

    return {
      id: userId,
      name,
    };
  } catch {
    return {
      id: userId,
      name: userId,
    };
  }
}

async function fetchChannel(
  channelId: string,
  slackClient: WebClient,
): Promise<TriggerChannelVariable> {
  try {
    const result = await slackClient.conversations.info({ channel: channelId });
    const channelName = result.channel?.name;

    return {
      id: channelId,
      name: channelName ?? channelId,
    };
  } catch {
    return {
      id: channelId,
      name: channelId,
    };
  }
}

export async function createTriggerVariables(
  payload: SlackTriggerPayload,
  triggerNode: FlowNode,
  slackClient: WebClient,
): Promise<Record<string, unknown>> {
  const variables: Record<string, unknown> = {
    messageText: payload.text,
    channelId: payload.channelId,
    userId: payload.userId,
    command: payload.command ?? '',
  };

  const config = triggerNode.config;

  if (payload.type === 'slash-command') {
    const storeAuthor = resolveConfigBoolean(config.storeAuthor, true);
    const storeChannel = resolveConfigBoolean(config.storeChannel, true);

    if (storeAuthor) {
      variables.author = await fetchUser(payload.userId, slackClient);
    }

    if (storeChannel) {
      variables.channel = await fetchChannel(payload.channelId, slackClient);
    }
  }

  if (
    payload.type === 'user-joined-channel' ||
    payload.type === 'user-left-channel' ||
    payload.type === 'app-mention'
  ) {
    const storeUser = resolveConfigBoolean(config.storeUser, true);
    const storeChannel = resolveConfigBoolean(config.storeChannel, true);

    if (storeUser) {
      variables.user = await fetchUser(payload.userId, slackClient);
    }

    if (storeChannel) {
      variables.channel = await fetchChannel(payload.channelId, slackClient);
    }
  }

  if (payload.type === 'app-mention') {
    const storeMessage = resolveConfigBoolean(config.storeMessage, true);

    if (storeMessage) {
      const message: TriggerMessageVariable = {
        content: payload.text,
        channel:
          (variables.channel as TriggerChannelVariable | undefined) ??
          (await fetchChannel(payload.channelId, slackClient)),
      };

      if (payload.messageTs) {
        message.ts = payload.messageTs;
      }

      variables.message = message;
    }
  }

  if (payload.type === 'message-received') {
    const storeAuthor = resolveConfigBoolean(config.storeAuthor, true);
    const storeMessage = resolveConfigBoolean(config.storeMessage, true);

    if (storeAuthor) {
      variables.author = await fetchUser(payload.userId, slackClient);
    }

    if (storeMessage) {
      const channel = await fetchChannel(payload.channelId, slackClient);
      const message: TriggerMessageVariable = {
        content: payload.text,
        channel,
      };

      if (payload.messageTs) {
        message.ts = payload.messageTs;
      }

      variables.message = message;
    }
  }

  return variables;
}
