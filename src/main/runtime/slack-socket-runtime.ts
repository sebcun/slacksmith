import { App, LogLevel } from '@slack/bolt';
import type { WebClient } from '@slack/web-api';

import { getComponentDefinition } from '../../shared/domain/component-registry';
import type { FlowGraph, FlowNode } from '../../shared/domain/flow-graph';
import type { SlackConfigFile } from '../../shared/domain/slack-config';
import type { GlobalVariableStore } from '../storage/global-variable-store';
import {
  createFlowExecutionContext,
  executeFlowFromTrigger,
} from './flow-executor';
import type { RuntimeLogger } from './runtime-logger';
import type { SlackTriggerPayload } from './trigger-context';

interface GenericSlackEvent {
  subtype?: string;
  bot_id?: string;
  user?: string;
  channel?: string;
  text?: string;
  ts?: string;
}

export class SlackSocketRuntime {
  private app: App | null = null;
  private readonly abortController = new AbortController();

  constructor(
    private readonly slackConfig: SlackConfigFile,
    private readonly graph: FlowGraph,
    private readonly logger: RuntimeLogger,
    private readonly globalVariableStore: GlobalVariableStore,
    private readonly onFatalError: (message: string) => void,
  ) {}

  async start(): Promise<void> {
    const triggerNodes = this.graph.nodes.filter((node) => {
      const definition = getComponentDefinition(node.typeId);
      return definition?.execution.isTrigger === true;
    });

    if (triggerNodes.length === 0) {
      throw new Error('Add at least one trigger node before starting the bot.');
    }

    this.app = new App({
      token: this.slackConfig.botToken,
      appToken: this.slackConfig.appToken,
      socketMode: true,
      signingSecret: this.slackConfig.signingSecret,
      botUserId: this.slackConfig.botUserId,
      logLevel: LogLevel.ERROR,
    });

    this.registerTriggerHandlers(triggerNodes);

    try {
      await this.app.start();
      this.logger.info('runtime', `Connected to Slack workspace ${this.slackConfig.teamName}.`);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to connect to Slack via Socket Mode.';
      this.onFatalError(message);
      throw error;
    }
  }

  async stop(): Promise<void> {
    this.abortController.abort();

    if (this.app) {
      try {
        await this.app.stop();
      } catch {
        // Ignore shutdown errors.
      }

      this.app = null;
    }

    this.logger.info('runtime', 'Bot runtime stopped.');
  }

  private registerTriggerHandlers(triggerNodes: FlowNode[]): void {
    if (!this.app) {
      return;
    }

    const messageTriggers = triggerNodes.filter((node) => node.typeId === 'message-received');
    const slashTriggers = triggerNodes.filter((node) => node.typeId === 'slash-command');
    const joinedTriggers = triggerNodes.filter((node) => node.typeId === 'user-joined-channel');
    const leftTriggers = triggerNodes.filter((node) => node.typeId === 'user-left-channel');
    const mentionTriggers = triggerNodes.filter((node) => node.typeId === 'app-mention');

    if (messageTriggers.length > 0) {
      this.app.message(async ({ message, client }) => {
        const slackEvent = message as GenericSlackEvent;

        if (slackEvent.subtype || slackEvent.bot_id) {
          return;
        }

        if (!slackEvent.user || slackEvent.user === this.slackConfig.botUserId) {
          return;
        }

        const channelId = slackEvent.channel ?? '';
        const text = slackEvent.text ?? '';

        this.logger.info('slack', `Message received in ${channelId}`, {
          details: {
            userId: slackEvent.user,
            textPreview: text.length > 80 ? `${text.slice(0, 79)}…` : text,
          },
        });

        for (const triggerNode of messageTriggers) {
          await this.runFlow(
            {
              triggerNodeId: triggerNode.id,
              type: 'message-received',
              channelId,
              userId: slackEvent.user,
              text,
              messageTs: slackEvent.ts,
            },
            client,
          );
        }
      });
    }

    for (const triggerNode of slashTriggers) {
      const commandName = this.getSlashCommandName(triggerNode);

      if (!commandName) {
        this.logger.warn('runtime', `Slash command trigger "${triggerNode.name}" has no command name.`, {
          nodeId: triggerNode.id,
          nodeName: triggerNode.name,
        });
        continue;
      }

      this.app.command(`/${commandName}`, async ({ command, ack, client }) => {
        await ack();

        await this.runFlow(
          {
            triggerNodeId: triggerNode.id,
            type: 'slash-command',
            channelId: command.channel_id,
            userId: command.user_id,
            text: command.text,
            command: command.command,
            responseUrl: command.response_url,
          },
          client,
        );
      });
    }

    if (joinedTriggers.length > 0) {
      this.app.event('member_joined_channel', async ({ event, client }) => {
        const channelId = event.channel ?? '';
        const userId = event.user ?? '';

        if (!channelId || !userId) {
          return;
        }

        this.logger.info('slack', `User joined channel ${channelId}`, {
          details: { userId },
        });

        for (const triggerNode of joinedTriggers) {
          await this.runFlow(
            {
              triggerNodeId: triggerNode.id,
              type: 'user-joined-channel',
              channelId,
              userId,
              text: '',
            },
            client,
          );
        }
      });
    }

    if (leftTriggers.length > 0) {
      this.app.event('member_left_channel', async ({ event, client }) => {
        const channelId = event.channel ?? '';
        const userId = event.user ?? '';

        if (!channelId || !userId) {
          return;
        }

        this.logger.info('slack', `User left channel ${channelId}`, {
          details: { userId },
        });

        for (const triggerNode of leftTriggers) {
          await this.runFlow(
            {
              triggerNodeId: triggerNode.id,
              type: 'user-left-channel',
              channelId,
              userId,
              text: '',
            },
            client,
          );
        }
      });
    }

    if (mentionTriggers.length > 0) {
      this.app.event('app_mention', async ({ event, client }) => {
        if (event.bot_id || !event.user || event.user === this.slackConfig.botUserId) {
          return;
        }

        const channelId = event.channel ?? '';
        const text = event.text ?? '';

        this.logger.info('slack', `App mentioned in ${channelId}`, {
          details: {
            userId: event.user,
            textPreview: text.length > 80 ? `${text.slice(0, 79)}…` : text,
          },
        });

        for (const triggerNode of mentionTriggers) {
          await this.runFlow(
            {
              triggerNodeId: triggerNode.id,
              type: 'app-mention',
              channelId,
              userId: event.user,
              text,
              messageTs: event.ts,
            },
            client,
          );
        }
      });
    }
  }

  private getSlashCommandName(triggerNode: FlowNode): string {
    const raw = triggerNode.config.command;
    const command = typeof raw === 'string' ? raw.trim().replace(/^\//, '') : '';
    return command;
  }

  private async runFlow(payload: SlackTriggerPayload, client: WebClient): Promise<void> {
    if (this.abortController.signal.aborted || !this.app) {
      return;
    }

    const triggerNode = this.graph.nodes.find((node) => node.id === payload.triggerNodeId);

    if (!triggerNode) {
      this.logger.error('execution', 'Trigger node not found in flow graph.', {
        nodeId: payload.triggerNodeId,
      });
      return;
    }

    try {
      const context = await createFlowExecutionContext(
        this.graph,
        payload,
        triggerNode,
        client,
        this.logger,
        this.abortController.signal,
        this.globalVariableStore,
      );

      await executeFlowFromTrigger(context);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Flow execution failed.';
      this.logger.error('execution', message, {
        nodeId: payload.triggerNodeId,
        details: { triggerType: payload.type },
      });
    }
  }
}
