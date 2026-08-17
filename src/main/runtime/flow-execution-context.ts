import type { WebClient } from '@slack/web-api';

import type { FlowGraph } from '../../shared/domain/flow-graph';
import type { GlobalVariableStore } from '../storage/global-variable-store';
import type { RuntimeLogger } from './runtime-logger';
import type { SlackTriggerPayload } from './trigger-context';

export interface FlowExecutionContext {
  graph: FlowGraph;
  trigger: SlackTriggerPayload;
  variables: Record<string, unknown>;
  globalVariableStore: GlobalVariableStore;
  slackClient: WebClient;
  logger: RuntimeLogger;
  abortSignal: AbortSignal;
}
