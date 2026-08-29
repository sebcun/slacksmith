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

interface BlockActionBody {
  user?: { id?: string };
  channel?: { id?: string };
  message?: { ts?: string; text?: string };
}

interface BlockButtonAction {
  type: string;
  action_id?: string;
  text?: { text?: string };
}

export class SlackSocketRuntime {
  private app: App | null = null;
  private readonly abortController = new AbortController();
  private scheduledTimers: NodeJS.Timeout[] = [];

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
    this.clearScheduledTimers();

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
    const buttonTriggers = triggerNodes.filter((node) => node.typeId === 'button-clicked');
    const scheduledTriggers = triggerNodes.filter((node) => node.typeId === 'scheduled');

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

    if (buttonTriggers.length > 0) {
      this.app.action(/.+/, async ({ action, ack, body, client }) => {
        await ack();

        const buttonAction = action as BlockButtonAction;
        if (buttonAction.type !== 'button' || !buttonAction.action_id) {
          return;
        }

        const actionId = buttonAction.action_id;
        const matchingTriggers = buttonTriggers.filter(
          (triggerNode) => this.getButtonActionId(triggerNode) === actionId,
        );

        if (matchingTriggers.length === 0) {
          return;
        }

        const actionBody = body as BlockActionBody;
        const userId = actionBody.user?.id ?? '';
        const channelId = actionBody.channel?.id ?? '';
        const messageTs = actionBody.message?.ts;
        const buttonLabel = buttonAction.text?.text ?? actionId;

        this.logger.info('slack', `Button "${actionId}" clicked in ${channelId}`, {
          details: { userId, actionId },
        });

        for (const triggerNode of matchingTriggers) {
          await this.runFlow(
            {
              triggerNodeId: triggerNode.id,
              type: 'button-clicked',
              channelId,
              userId,
              text: actionBody.message?.text ?? '',
              messageTs,
              buttonActionId: actionId,
              buttonLabel,
            },
            client,
          );
        }
      });
    }

    if (scheduledTriggers.length > 0) {
      for (const triggerNode of scheduledTriggers) {
        this.registerScheduledTrigger(triggerNode);
      }
    }
  }

  private clearScheduledTimers(): void {
    for (const timer of this.scheduledTimers) {
      clearInterval(timer);
    }

    this.scheduledTimers = [];
  }

  private getButtonActionId(triggerNode: FlowNode): string {
    const raw = triggerNode.config.actionId;
    return typeof raw === 'string' ? raw.trim() : '';
  }

  private getScheduledIntervalMs(triggerNode: FlowNode): number {
    const rawInterval = triggerNode.config.interval;
    const intervalValue =
      typeof rawInterval === 'number'
        ? rawInterval
        : Number(typeof rawInterval === 'string' ? rawInterval.trim() : rawInterval);

    if (!Number.isFinite(intervalValue) || intervalValue <= 0) {
      throw new Error(`Scheduled trigger "${triggerNode.name}" needs an interval greater than 0.`);
    }

    const unit = typeof triggerNode.config.unit === 'string' ? triggerNode.config.unit : 'minutes';

    switch (unit) {
      case 'seconds':
        return Math.max(1000, Math.round(intervalValue * 1000));
      case 'hours':
        return Math.max(1000, Math.round(intervalValue * 60 * 60 * 1000));
      case 'minutes':
      default:
        return Math.max(1000, Math.round(intervalValue * 60 * 1000));
    }
  }

  private registerScheduledTrigger(triggerNode: FlowNode): void {
    if (!this.app) {
      return;
    }

    let intervalMs: number;

    try {
      intervalMs = this.getScheduledIntervalMs(triggerNode);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid scheduled trigger configuration.';
      this.logger.warn('runtime', message, {
        nodeId: triggerNode.id,
        nodeName: triggerNode.name,
      });
      return;
    }

    this.logger.info('runtime', `Scheduled trigger "${triggerNode.name}" every ${intervalMs}ms`, {
      nodeId: triggerNode.id,
      nodeName: triggerNode.name,
    });

    const timer = setInterval(() => {
      if (this.abortController.signal.aborted || !this.app) {
        return;
      }

      const scheduledAt = new Date().toISOString();

      void this.runFlow(
        {
          triggerNodeId: triggerNode.id,
          type: 'scheduled',
          channelId: '',
          userId: '',
          text: '',
          scheduledAt,
        },
        this.app.client,
      );
    }, intervalMs);

    this.scheduledTimers.push(timer);
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
