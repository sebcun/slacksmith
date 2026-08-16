import type { WebClient } from '@slack/web-api';

import { getComponentDefinition } from '../../shared/domain/component-registry';
import { resolveVariableReferences } from '../../shared/domain/variables';
import type { FlowEdge, FlowGraph, FlowNode } from '../../shared/domain/flow-graph';
import type { RuntimeLogger } from './runtime-logger';
import { createTriggerVariables, type SlackTriggerPayload } from './trigger-context';

export interface FlowExecutionContext {
  graph: FlowGraph;
  trigger: SlackTriggerPayload;
  variables: Record<string, unknown>;
  slackClient: WebClient;
  logger: RuntimeLogger;
  abortSignal: AbortSignal;
}

export interface NodeExecutionResult {
  outputPortId: string | null;
  terminate: boolean;
}

function resolveConfigString(
  value: unknown,
  variables: Record<string, unknown>,
  supportsVariables: boolean,
): string {
  const raw = value === undefined || value === null ? '' : String(value);

  if (!supportsVariables) {
    return raw;
  }

  return resolveVariableReferences(raw, variables);
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
  const fieldMap = new Map(definition.fields.map((field) => [field.id, field]));

  function fieldValue(fieldId: string): string {
    const field = fieldMap.get(fieldId);
    return resolveConfigString(
      node.config[fieldId],
      context.variables,
      field?.supportsVariables ?? false,
    );
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
          name: emoji.replace(/^:+|:+$/g, ''),
        });

        context.logger.info('execution', `Added reaction :${emoji}:`, {
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

        context.variables[storeAs] = storedValue;

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

        context.variables[variableName] = value;

        context.logger.info('execution', `Stored variable ${variableName}`, {
          nodeId: node.id,
          nodeName: node.name,
        });
        break;
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

      case 'condition.channel-match': {
        const channel = fieldValue('channel');
        const matches = channel.trim().length > 0 && channel === context.trigger.channelId;

        context.logger.info('execution', `Channel match ${matches ? 'matched' : 'did not match'}`, {
          nodeId: node.id,
          nodeName: node.name,
        });

        return { outputPortId: matches ? 'match' : 'no-match', terminate: false };
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

export function createFlowExecutionContext(
  graph: FlowGraph,
  trigger: SlackTriggerPayload,
  slackClient: WebClient,
  logger: RuntimeLogger,
  abortSignal: AbortSignal,
): FlowExecutionContext {
  return {
    graph,
    trigger,
    variables: createTriggerVariables(trigger),
    slackClient,
    logger,
    abortSignal,
  };
}