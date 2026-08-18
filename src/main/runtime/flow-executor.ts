import type { WebClient } from '@slack/web-api';

import { getComponentDefinition } from '../../shared/domain/component-registry';
import {
  resolveVariableReferences,
  setScopedVariable,
  type VariableScope,
} from '../../shared/domain/variables';
import type { FlowEdge, FlowGraph, FlowNode } from '../../shared/domain/flow-graph';
import type { GlobalVariableStore } from '../storage/global-variable-store';
import type { RuntimeLogger } from './runtime-logger';
import { executeDataComponentHandler, resolveArrayValue, resolveConfigInteger, resolveConfigValue } from './data-component-handlers';
import type { FlowExecutionContext } from './flow-execution-context';
import { createTriggerVariables, type SlackTriggerPayload } from './trigger-context';

export type { FlowExecutionContext } from './flow-execution-context';

export interface NodeExecutionResult {
  outputPortId: string | null;
  terminate: boolean;
}

function createVariableScope(context: FlowExecutionContext): VariableScope {
  return {
    local: context.variables,
    global: context.globalVariableStore.getSnapshot(),
  };
}

function resolveConfigString(value: unknown, scope: VariableScope): string {
  const raw = value === undefined || value === null ? '' : String(value);
  return resolveVariableReferences(raw, scope);
}

function resolveConfigBoolean(value: unknown): boolean {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return Boolean(value);
}

function compareValues(left: string, operator: string, right: string): boolean {
  switch (operator) {
    case 'equals':
      return left === right;
    case 'not-equals':
      return left !== right;
    case 'contains':
      return left.includes(right);
    case 'not-contains':
      return !left.includes(right);
    case 'starts-with':
      return left.startsWith(right);
    case 'ends-with':
      return left.endsWith(right);
    case 'greater-than':
      return Number(left) > Number(right);
    case 'greater-than-or-equal':
      return Number(left) >= Number(right);
    case 'less-than':
      return Number(left) < Number(right);
    case 'less-than-or-equal':
      return Number(left) <= Number(right);
    default:
      return false;
  }
}

async function resolveDefaultSlackChannel(slackClient: WebClient): Promise<string> {
  const result = await slackClient.conversations.list({
    types: 'public_channel',
    exclude_archived: true,
    limit: 200,
  });

  const generalChannel = result.channels?.find(
    (channel: { is_general?: boolean; name?: string; id?: string }) =>
      channel.is_general || channel.name === 'general',
  );

  if (generalChannel?.id) {
    return generalChannel.id;
  }

  throw new Error('Could not find a default channel to send the message.');
}

async function resolveSendMessageChannel(
  configuredChannel: string,
  context: FlowExecutionContext,
): Promise<string> {
  if (configuredChannel.trim().length > 0) {
    return configuredChannel;
  }

  if (context.trigger.channelId.trim().length > 0) {
    return context.trigger.channelId;
  }

  const cachedDefaultChannel = context.variables.__defaultChannelId;
  if (typeof cachedDefaultChannel === 'string' && cachedDefaultChannel.trim().length > 0) {
    return cachedDefaultChannel;
  }

  const defaultChannel = await resolveDefaultSlackChannel(context.slackClient);
  context.variables.__defaultChannelId = defaultChannel;
  return defaultChannel;
}

function resolveMessageTimestamp(configuredTimestamp: string, context: FlowExecutionContext): string {
  if (configuredTimestamp.trim().length > 0) {
    return configuredTimestamp;
  }

  if (context.trigger.messageTs) {
    return context.trigger.messageTs;
  }

  throw new Error('No message timestamp available.');
}

function resolveTargetUser(configuredUser: string, context: FlowExecutionContext): string {
  if (configuredUser.trim().length > 0) {
    return configuredUser;
  }

  if (context.trigger.userId.trim().length > 0) {
    return context.trigger.userId;
  }

  throw new Error('No user ID available.');
}

function normalizeEmojiName(emoji: string): string {
  return emoji.replace(/^:+|:+$/g, '');
}

function findNextNode(
  graph: FlowGraph,
  nodeId: string,
  outputPortId: string,
): string | null {
  const edge = graph.edges.find(
    (candidate: FlowEdge) =>
      candidate.sourceNodeId === nodeId && candidate.sourcePortId === outputPortId,
  );

  return edge?.targetNodeId ?? null;
}

const MAX_LOOP_ITERATIONS = 10000;

async function executeFromNode(
  startNodeId: string | null,
  context: FlowExecutionContext,
): Promise<void> {
  if (!startNodeId) {
    return;
  }

  let currentNodeId: string | null = startNodeId;
  const visited = new Set<string>();

  while (currentNodeId && !context.abortSignal.aborted) {
    if (visited.has(currentNodeId)) {
      context.logger.warn('execution', 'Cycle detected in loop body; stopping iteration.', {
        nodeId: currentNodeId,
      });
      break;
    }

    visited.add(currentNodeId);

    const node = context.graph.nodes.find((candidate) => candidate.id === currentNodeId);

    if (!node) {
      context.logger.warn('execution', 'Loop body referenced a missing node.', {
        nodeId: currentNodeId,
      });
      break;
    }

    const result = await executeNode(node, context);

    if (result.terminate) {
      break;
    }

    if (!result.outputPortId) {
      break;
    }

    currentNodeId = findNextNode(context.graph, node.id, result.outputPortId);
  }
}

async function executeLoopBody(
  loopNode: FlowNode,
  context: FlowExecutionContext,
): Promise<void> {
  const bodyStartId = findNextNode(context.graph, loopNode.id, 'loop');
  await executeFromNode(bodyStartId, context);
}

function sleep(seconds: number, abortSignal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (abortSignal.aborted) {
      reject(new Error('Execution aborted'));
      return;
    }

    const timeout = setTimeout(() => {
      abortSignal.removeEventListener('abort', onAbort);
      resolve();
    }, seconds * 1000);

    const onAbort = (): void => {
      clearTimeout(timeout);
      reject(new Error('Execution aborted'));
    };

    abortSignal.addEventListener('abort', onAbort, { once: true });
  });
}

async function executeNode(
  node: FlowNode,
  context: FlowExecutionContext,
): Promise<NodeExecutionResult> {
  const definition = getComponentDefinition(node.typeId);

  if (!definition) {
    context.logger.warn('execution', `Unknown node type: ${node.typeId}`, {
      nodeId: node.id,
      nodeName: node.name,
    });
    return { outputPortId: 'out', terminate: false };
  }

  const handlerId = definition.execution.handlerId;
  const scope = createVariableScope(context);

  function fieldValue(fieldId: string): string {
    return resolveConfigString(node.config[fieldId], scope);
  }

  context.logger.info('execution', `Running ${node.name}`, {
    nodeId: node.id,
    nodeName: node.name,
    details: { handlerId },
  });

  try {
    switch (handlerId) {
      case 'action.send-message': {
        const configuredChannel = fieldValue('channel');
        const message = fieldValue('message');
        const channel = await resolveSendMessageChannel(configuredChannel, context);

        await context.slackClient.chat.postMessage({
          channel,
          text: message,
        });

        context.logger.info('execution', `Sent message to ${channel}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.reply': {
        const message = fieldValue('message');
        const alsoSendInChannel = resolveConfigBoolean(node.config.alsoSendInChannel);
        const channel = context.trigger.channelId;
        const threadTs = context.trigger.messageTs;

        if (!threadTs) {
          throw new Error('No message timestamp available to reply to.');
        }

        await context.slackClient.chat.postMessage({
          channel,
          text: message,
          thread_ts: threadTs,
          reply_broadcast: alsoSendInChannel,
        });

        context.logger.info(
          'execution',
          alsoSendInChannel
            ? `Replied in thread and posted to ${channel}`
            : `Replied in thread on ${channel}`,
          {
            nodeId: node.id,
            nodeName: node.name,
          },
        );
        break;
      }

      case 'action.add-reaction': {
        const emoji = fieldValue('emoji');
        const channel = context.trigger.channelId;
        const timestamp = context.trigger.messageTs;

        if (!timestamp) {
          throw new Error('No message timestamp available to add a reaction.');
        }

        await context.slackClient.reactions.add({
          channel,
          timestamp,
          name: normalizeEmojiName(emoji),
        });

        context.logger.info('execution', `Added reaction :${emoji}:`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.edit-message': {
        const timestamp = resolveMessageTimestamp(fieldValue('timestamp'), context);
        const channel = await resolveSendMessageChannel(fieldValue('channel'), context);
        const message = fieldValue('message');

        await context.slackClient.chat.update({
          channel,
          ts: timestamp,
          text: message,
        });

        context.logger.info('execution', `Edited message in ${channel}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.delete-message': {
        const timestamp = resolveMessageTimestamp(fieldValue('timestamp'), context);
        const channel = await resolveSendMessageChannel(fieldValue('channel'), context);

        await context.slackClient.chat.delete({
          channel,
          ts: timestamp,
        });

        context.logger.info('execution', `Deleted message in ${channel}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.send-ephemeral-message': {
        const user = resolveTargetUser(fieldValue('user'), context);
        const channel = await resolveSendMessageChannel(fieldValue('channel'), context);
        const message = fieldValue('message');

        await context.slackClient.chat.postEphemeral({
          channel,
          user,
          text: message,
        });

        context.logger.info('execution', `Sent ephemeral message to ${user} in ${channel}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.send-dm': {
        const user = fieldValue('user');
        const message = fieldValue('message');

        if (!user.trim()) {
          throw new Error('User ID is required to send a DM.');
        }

        const openResult = await context.slackClient.conversations.open({ users: user });
        const dmChannel = openResult.channel?.id;

        if (!dmChannel) {
          throw new Error('Could not open a DM channel with the specified user.');
        }

        await context.slackClient.chat.postMessage({
          channel: dmChannel,
          text: message,
        });

        context.logger.info('execution', `Sent DM to ${user}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.remove-reaction': {
        const emoji = fieldValue('emoji');
        const channel = context.trigger.channelId;
        const timestamp = context.trigger.messageTs;

        if (!timestamp) {
          throw new Error('No message timestamp available to remove a reaction.');
        }

        await context.slackClient.reactions.remove({
          channel,
          timestamp,
          name: normalizeEmojiName(emoji),
        });

        context.logger.info('execution', `Removed reaction :${emoji}:`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.set-channel-topic': {
        const channel = await resolveSendMessageChannel(fieldValue('channel'), context);
        const topic = fieldValue('topic');

        await context.slackClient.conversations.setTopic({
          channel,
          topic,
        });

        context.logger.info('execution', `Set topic for ${channel}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'action.create-channel': {
        const channelName = fieldValue('channelName');
        const isPrivate = resolveConfigBoolean(node.config.isPrivate);

        const result = await context.slackClient.conversations.create({
          name: channelName,
          is_private: isPrivate,
        });

        if (result.channel?.id) {
          context.variables.channelId = result.channel.id;
        }

        context.logger.info('execution', `Created channel ${channelName}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'data.get-user': {
        const userId = fieldValue('userId');
        const storeAs = fieldValue('storeAs');

        if (!storeAs.trim()) {
          throw new Error('Store as variable name is required.');
        }

        const result = await context.slackClient.users.info({ user: userId });
        const user = result.user;
        const storedValue =
          user?.real_name ?? user?.profile?.display_name ?? user?.name ?? userId;

        const target = setScopedVariable(scope, storeAs, storedValue);
        if (target === 'global') {
          context.globalVariableStore.scheduleSave();
        }

        context.logger.info('execution', `Stored user lookup in ${storeAs}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'data.store-variable': {
        const variableName = fieldValue('variableName').trim();
        const value = fieldValue('value');

        if (!variableName) {
          throw new Error('Variable name is required.');
        }

        const target = setScopedVariable(scope, variableName, value);
        if (target === 'global') {
          context.globalVariableStore.scheduleSave();
        }

        context.logger.info('execution', `Stored variable ${variableName}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'data.math':
      case 'data.random-number':
      case 'data.random-string':
      case 'data.date-time':
      case 'data.convert':
      case 'data.round-number':
      case 'data.string':
      case 'data.string-length':
      case 'data.string-replace':
      case 'data.string-split':
      case 'data.string-join':
      case 'data.string-contains':
      case 'data.string-case':
      case 'data.regex-match':
      case 'data.regex-replace':
      case 'data.array':
      case 'data.array-get':
      case 'data.array-set':
      case 'data.array-length':
      case 'data.array-add':
      case 'data.array-remove':
      case 'data.array-sort':
      case 'data.array-random-item': {
        await executeDataComponentHandler(handlerId, node, context);
        break;
      }

      case 'loop.for-each': {
        const arrayInput = resolveConfigValue(node.config.array, scope);
        const items = resolveArrayValue(arrayInput);
        const itemVariable = fieldValue('itemVariable').trim() || 'item';
        const indexVariable = fieldValue('indexVariable').trim() || 'index';

        context.logger.info('execution', `Looping over ${items.length} item(s)`, {
          nodeId: node.id,
          nodeName: node.name,
        });

        for (let index = 0; index < items.length; index += 1) {
          const itemTarget = setScopedVariable(scope, itemVariable, items[index]);
          const indexTarget = setScopedVariable(scope, indexVariable, index);
          if (itemTarget === 'global' || indexTarget === 'global') {
            context.globalVariableStore.scheduleSave();
          }
          await executeLoopBody(node, context);

          if (context.abortSignal.aborted) {
            break;
          }
        }

        return { outputPortId: 'done', terminate: false };
      }

      case 'loop.repeat': {
        const count = resolveConfigInteger(node.config.count, scope, 'count', 0);
        const indexVariable = fieldValue('indexVariable').trim() || 'index';

        context.logger.info('execution', `Repeating ${count} time(s)`, {
          nodeId: node.id,
          nodeName: node.name,
        });

        for (let index = 0; index < count; index += 1) {
          const indexTarget = setScopedVariable(scope, indexVariable, index);
          if (indexTarget === 'global') {
            context.globalVariableStore.scheduleSave();
          }
          await executeLoopBody(node, context);

          if (context.abortSignal.aborted) {
            break;
          }
        }

        return { outputPortId: 'done', terminate: false };
      }

      case 'loop.while': {
        const operator = fieldValue('operator');
        let iterations = 0;

        while (iterations < MAX_LOOP_ITERATIONS) {
          const currentScope = createVariableScope(context);
          const leftValue = resolveConfigString(node.config.leftValue, currentScope);
          const rightValue = resolveConfigString(node.config.rightValue, currentScope);

          if (!compareValues(leftValue, operator, rightValue)) {
            break;
          }

          iterations += 1;
          context.logger.info('execution', `While loop iteration ${iterations}`, {
            nodeId: node.id,
            nodeName: node.name,
          });

          await executeLoopBody(node, context);

          if (context.abortSignal.aborted) {
            break;
          }
        }

        if (iterations >= MAX_LOOP_ITERATIONS) {
          context.logger.warn('execution', 'While loop reached the maximum iteration limit.', {
            nodeId: node.id,
            nodeName: node.name,
          });
        }

        return { outputPortId: 'done', terminate: false };
      }

      case 'condition.if-else': {
        const leftValue = fieldValue('leftValue');
        const operator = fieldValue('operator');
        const rightValue = fieldValue('rightValue');
        const isTrue = compareValues(leftValue, operator, rightValue);

        context.logger.info('execution', `Condition evaluated to ${isTrue ? 'true' : 'false'}`, {
          nodeId: node.id,
          nodeName: node.name,
        });

        return { outputPortId: isTrue ? 'true' : 'false', terminate: false };
      }

      case 'utility.delay': {
        const secondsRaw = fieldValue('seconds');
        const seconds = Math.max(0, Number(secondsRaw));

        if (!Number.isFinite(seconds)) {
          throw new Error(`Invalid delay value: ${secondsRaw}`);
        }

        context.logger.info('execution', `Waiting ${seconds} second(s)`, {
          nodeId: node.id,
          nodeName: node.name,
        });

        await sleep(seconds, context.abortSignal);
        break;
      }

      case 'utility.log': {
        const message = fieldValue('message');
        const level = fieldValue('level') as 'info' | 'warn' | 'error';

        const logLevel = level === 'warn' || level === 'error' ? level : 'info';
        context.logger.log(logLevel, 'execution', message, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
      }

      case 'utility.stop-flow': {
        context.logger.info('execution', 'Flow stopped', {
          nodeId: node.id,
          nodeName: node.name,
        });
        return { outputPortId: null, terminate: true };
      }

      default:
        context.logger.warn('execution', `Handler not implemented: ${handlerId}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown execution error';
    context.logger.error('execution', message, {
      nodeId: node.id,
      nodeName: node.name,
    });
    throw error;
  }

  return { outputPortId: 'out', terminate: false };
}

export async function executeFlowFromTrigger(context: FlowExecutionContext): Promise<void> {
  const triggerNode = context.graph.nodes.find((node) => node.id === context.trigger.triggerNodeId);

  if (!triggerNode) {
    context.logger.error('execution', 'Trigger node not found in flow graph.', {
      nodeId: context.trigger.triggerNodeId,
    });
    return;
  }

  context.logger.info('trigger', `Flow started from ${triggerNode.name}`, {
    nodeId: triggerNode.id,
    nodeName: triggerNode.name,
    details: {
      triggerType: context.trigger.type,
      channelId: context.trigger.channelId,
      userId: context.trigger.userId,
    },
  });

  let currentNodeId = findNextNode(context.graph, triggerNode.id, 'out');

  if (!currentNodeId) {
    context.logger.warn('execution', 'Trigger has no connected steps.', {
      nodeId: triggerNode.id,
      nodeName: triggerNode.name,
    });
    return;
  }

  const visited = new Set<string>();

  while (currentNodeId && !context.abortSignal.aborted) {
    if (visited.has(currentNodeId)) {
      context.logger.warn('execution', 'Cycle detected; stopping flow.', {
        nodeId: currentNodeId,
      });
      break;
    }

    visited.add(currentNodeId);

    const node = context.graph.nodes.find((candidate) => candidate.id === currentNodeId);

    if (!node) {
      context.logger.warn('execution', 'Flow referenced a missing node.', {
        nodeId: currentNodeId,
      });
      break;
    }

    const result = await executeNode(node, context);

    if (result.terminate) {
      break;
    }

    if (!result.outputPortId) {
      break;
    }

    currentNodeId = findNextNode(context.graph, node.id, result.outputPortId);
  }

  context.logger.info('execution', 'Flow finished.', {
    nodeId: triggerNode.id,
    nodeName: triggerNode.name,
  });
}

export async function createFlowExecutionContext(
  graph: FlowGraph,
  trigger: SlackTriggerPayload,
  triggerNode: FlowNode,
  slackClient: WebClient,
  logger: RuntimeLogger,
  abortSignal: AbortSignal,
  globalVariableStore: GlobalVariableStore,
): Promise<FlowExecutionContext> {
  return {
    graph,
    trigger,
    variables: await createTriggerVariables(trigger, triggerNode, slackClient),
    globalVariableStore,
    slackClient,
    logger,
    abortSignal,
  };
}