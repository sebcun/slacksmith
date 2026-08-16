export type SlackTriggerType = 'message-received' | 'slash-command';

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

export function createTriggerVariables(payload: SlackTriggerPayload): Record<string, unknown> {
  return {
    messageText: payload.text,
    channelId: payload.channelId,
    userId: payload.userId,
    command: payload.command ?? '',
  };
}
