import {
  createDefaultBlockKitMessage,
  getBlockKitMessageSummary,
  resolveBlockKitMessageFromConfig,
} from './block-kit.js';
import type { HttpHeaderEntry } from './http-headers.js';
import { appendVariableHint, createStoreAsField } from './variables.js';

export const COMPONENT_CATEGORIES = [
  { id: 'triggers', label: 'Triggers' },
  { id: 'conditions', label: 'Conditions' },
  { id: 'loops', label: 'Loops' },
  { id: 'actions', label: 'Actions' },
  { id: 'data', label: 'Data' },
  { id: 'utilities', label: 'Utilities' },
] as const;

export type ComponentCategoryId = (typeof COMPONENT_CATEGORIES)[number]['id'];

export type ComponentPortDirection = 'input' | 'output';

export interface ComponentPortDefinition {
  id: string;
  label: string;
  direction: ComponentPortDirection;
}

export type ConfigFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'channel'
  | 'boolean'
  | 'list'
  | 'header-list'
  | 'block-kit-message';

export interface ConfigFieldOption {
  value: string;
  label: string;
}

export interface ConfigFieldDefinition {
  id: string;
  label: string;
  type: ConfigFieldType;
  description?: string;
  required?: boolean;
  defaultValue?: string | number | boolean | string[] | HttpHeaderEntry[];
  options?: ConfigFieldOption[];
  /** When true, field values may include ${variableName} references. */
  supportsVariables?: boolean;
}

export interface ExecutionMetadata {
  handlerId: string;
  isTrigger?: boolean;
  terminatesFlow?: boolean;
}

export interface ComponentDefinition {
  id: string;
  categoryId: ComponentCategoryId;
  name: string;
  description: string;
  inputs: ComponentPortDefinition[];
  outputs: ComponentPortDefinition[];
  fields: ConfigFieldDefinition[];
  execution: ExecutionMetadata;
}

const FLOW_INPUT: ComponentPortDefinition = {
  id: 'in',
  label: 'In',
  direction: 'input',
};

const FLOW_OUTPUT: ComponentPortDefinition = {
  id: 'out',
  label: 'Out',
  direction: 'output',
};

const TRIGGER_OUTPUT: ComponentPortDefinition = {
  id: 'out',
  label: 'Then',
  direction: 'output',
};

const BRANCH_OUTPUTS: ComponentPortDefinition[] = [
  { id: 'true', label: 'True', direction: 'output' },
  { id: 'false', label: 'False', direction: 'output' },
];

const LOOP_OUTPUTS: ComponentPortDefinition[] = [
  { id: 'loop', label: 'Loop', direction: 'output' },
  { id: 'done', label: 'Done', direction: 'output' },
];

const COMPARISON_OPERATOR_OPTIONS: ConfigFieldOption[] = [
  { value: 'equals', label: 'Equals' },
  { value: 'not-equals', label: 'Does not equal' },
  { value: 'contains', label: 'Contains' },
  { value: 'not-contains', label: 'Does not contain' },
  { value: 'starts-with', label: 'Starts with' },
  { value: 'ends-with', label: 'Ends with' },
  { value: 'greater-than', label: 'Greater than' },
  { value: 'greater-than-or-equal', label: 'Greater than or equal to' },
  { value: 'less-than', label: 'Less than' },
  { value: 'less-than-or-equal', label: 'Less than or equal to' },
];

export const COMPONENT_DEFINITIONS: ComponentDefinition[] = [
  {
    id: 'message-received',
    categoryId: 'triggers',
    name: 'Message received',
    description: 'When a message is posted',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'storeAuthor',
        label: 'Store author',
        type: 'boolean',
        description: 'Save the message author as ${author.id} and ${author.name}.',
        defaultValue: true,
      },
      {
        id: 'storeMessage',
        label: 'Store message',
        type: 'boolean',
        description:
          'Save the message as ${message.content}, ${message.channel}, and ${message.channel.id}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.message-received',
      isTrigger: true,
    },
  },
  {
    id: 'slash-command',
    categoryId: 'triggers',
    name: 'Slash command',
    description: 'When a slash command runs',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'command',
        label: 'Command',
        type: 'text',
        description: 'Slash command name without the leading slash.',
        required: true,
        defaultValue: 'hello',
      },
      {
        id: 'storeAuthor',
        label: 'Store author',
        type: 'boolean',
        description: 'Save the command author as ${author.id} and ${author.name}.',
        defaultValue: true,
      },
      {
        id: 'storeChannel',
        label: 'Store channel',
        type: 'boolean',
        description: 'Save the command channel as ${channel.id} and ${channel.name}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.slash-command',
      isTrigger: true,
    },
  },
  {
    id: 'user-joined-channel',
    categoryId: 'triggers',
    name: 'User joined channel',
    description: 'When someone joins a channel',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'storeUser',
        label: 'Store user',
        type: 'boolean',
        description: 'Save the user who joined as ${user.id} and ${user.name}.',
        defaultValue: true,
      },
      {
        id: 'storeChannel',
        label: 'Store channel',
        type: 'boolean',
        description: 'Save the channel as ${channel.id} and ${channel.name}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.user-joined-channel',
      isTrigger: true,
    },
  },
  {
    id: 'user-left-channel',
    categoryId: 'triggers',
    name: 'User left channel',
    description: 'When someone leaves a channel',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'storeUser',
        label: 'Store user',
        type: 'boolean',
        description: 'Save the user who left as ${user.id} and ${user.name}.',
        defaultValue: true,
      },
      {
        id: 'storeChannel',
        label: 'Store channel',
        type: 'boolean',
        description: 'Save the channel as ${channel.id} and ${channel.name}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.user-left-channel',
      isTrigger: true,
    },
  },
  {
    id: 'app-mention',
    categoryId: 'triggers',
    name: 'App mention',
    description: 'When someone @mentions the bot',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'storeUser',
        label: 'Store user',
        type: 'boolean',
        description: 'Save the user who mentioned the bot as ${user.id} and ${user.name}.',
        defaultValue: true,
      },
      {
        id: 'storeChannel',
        label: 'Store channel',
        type: 'boolean',
        description: 'Save the channel as ${channel.id} and ${channel.name}.',
        defaultValue: true,
      },
      {
        id: 'storeMessage',
        label: 'Store message',
        type: 'boolean',
        description:
          'Save the mention text as ${message.content} and ${message.ts} for reply and reaction steps.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.app-mention',
      isTrigger: true,
    },
  },
  {
    id: 'button-clicked',
    categoryId: 'triggers',
    name: 'Button clicked',
    description: 'When someone clicks a button from a Block Kit message',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'actionId',
        label: 'Button action ID',
        type: 'text',
        description:
          'Must match the action ID used in a Send Block Kit Message step (the part after the |).',
        required: true,
        defaultValue: '',
      },
      {
        id: 'storeAuthor',
        label: 'Store author',
        type: 'boolean',
        description: 'Save the user who clicked as ${author.id} and ${author.name}.',
        defaultValue: true,
      },
      {
        id: 'storeChannel',
        label: 'Store channel',
        type: 'boolean',
        description: 'Save the channel as ${channel.id} and ${channel.name}.',
        defaultValue: true,
      },
      {
        id: 'storeButton',
        label: 'Store button',
        type: 'boolean',
        description: 'Save the clicked button as ${button.actionId} and ${button.label}.',
        defaultValue: true,
      },
      {
        id: 'storeMessage',
        label: 'Store message',
        type: 'boolean',
        description:
          'Save the message the button belongs to as ${message.ts} and ${message.channel.id}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.button-clicked',
      isTrigger: true,
    },
  },
  {
    id: 'scheduled',
    categoryId: 'triggers',
    name: 'Scheduled',
    description: 'Run on a repeating interval while the bot is running',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'interval',
        label: 'Every',
        type: 'text',
        description: appendVariableHint('How often to run this flow.'),
        required: true,
        defaultValue: '5',
        supportsVariables: true,
      },
      {
        id: 'unit',
        label: 'Unit',
        type: 'select',
        required: true,
        defaultValue: 'minutes',
        options: [
          { value: 'seconds', label: 'Seconds' },
          { value: 'minutes', label: 'Minutes' },
          { value: 'hours', label: 'Hours' },
        ],
      },
      {
        id: 'storeScheduledTime',
        label: 'Store scheduled time',
        type: 'boolean',
        description: 'Save the run time as ${scheduled.time} (ISO) and ${scheduled.unix}.',
        defaultValue: true,
      },
    ],
    execution: {
      handlerId: 'trigger.scheduled',
      isTrigger: true,
    },
  },
  {
    id: 'if-else',
    categoryId: 'conditions',
    name: 'If / else',
    description: 'Branch based on a value comparison',
    inputs: [FLOW_INPUT],
    outputs: BRANCH_OUTPUTS,
    fields: [
      {
        id: 'leftValue',
        label: 'Value',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'operator',
        label: 'Operator',
        type: 'select',
        required: true,
        defaultValue: 'equals',
        options: COMPARISON_OPERATOR_OPTIONS,
      },
      {
        id: 'rightValue',
        label: 'Compare to',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'condition.if-else',
    },
  },
  {
    id: 'for-each',
    categoryId: 'loops',
    name: 'For Each',
    description: 'Loop through every item in an array',
    inputs: [FLOW_INPUT],
    outputs: LOOP_OUTPUTS,
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to loop through.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'itemVariable',
        label: 'Item variable',
        type: 'text',
        description: appendVariableHint('Variable name for the current item.'),
        required: true,
        defaultValue: 'item',
        supportsVariables: true,
      },
      {
        id: 'indexVariable',
        label: 'Index variable',
        type: 'text',
        description: appendVariableHint('Variable name for the current index.'),
        required: true,
        defaultValue: 'index',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'loop.for-each',
    },
  },
  {
    id: 'repeat',
    categoryId: 'loops',
    name: 'Repeat',
    description: 'Repeat connected steps a specified number of times',
    inputs: [FLOW_INPUT],
    outputs: LOOP_OUTPUTS,
    fields: [
      {
        id: 'count',
        label: 'Times',
        type: 'text',
        description: appendVariableHint('How many times to repeat the loop body.'),
        required: true,
        defaultValue: '5',
        supportsVariables: true,
      },
      {
        id: 'indexVariable',
        label: 'Index variable',
        type: 'text',
        description: appendVariableHint('Variable name for the current iteration number.'),
        required: true,
        defaultValue: 'index',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'loop.repeat',
    },
  },
  {
    id: 'while',
    categoryId: 'loops',
    name: 'While',
    description: 'Repeat connected steps while a condition is true',
    inputs: [FLOW_INPUT],
    outputs: LOOP_OUTPUTS,
    fields: [
      {
        id: 'leftValue',
        label: 'Value',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'operator',
        label: 'Operator',
        type: 'select',
        required: true,
        defaultValue: 'equals',
        options: COMPARISON_OPERATOR_OPTIONS,
      },
      {
        id: 'rightValue',
        label: 'Compare to',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'loop.while',
    },
  },
  {
    id: 'send-message',
    categoryId: 'actions',
    name: 'Send message',
    description: 'Post a message to a channel',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to send to the channel where the trigger occurred, or #general if unavailable.',
        ),
        supportsVariables: true,
      },
      {
        id: 'message',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.send-message',
    },
  },
  {
    id: 'send-block-kit-message',
    categoryId: 'actions',
    name: 'Send Block Kit message',
    description: 'Post an interactive message with optional buttons',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to send to the channel where the trigger occurred, or #general if unavailable.',
        ),
        supportsVariables: true,
      },
      {
        id: 'blockKitMessage',
        label: 'Message',
        type: 'block-kit-message',
        description:
          'Build the Block Kit layout with headers, markdown, dividers, images, and buttons.',
        required: true,
      },
      {
        id: 'fallbackText',
        label: 'Notification text',
        type: 'text',
        description: appendVariableHint(
          'Plain-text fallback for notifications. Defaults to the message text when empty.',
        ),
        supportsVariables: true,
      },
      {
        id: 'storeMessage',
        label: 'Store sent message',
        type: 'boolean',
        description:
          'Save the posted message as ${message.ts} and ${message.channel.id} for later edit or reply steps.',
        defaultValue: false,
      },
    ],
    execution: {
      handlerId: 'action.send-block-kit-message',
    },
  },
  {
    id: 'reply',
    categoryId: 'actions',
    name: 'Reply',
    description: 'Reply to a message in a thread',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'message',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'alsoSendInChannel',
        label: 'Also send in channel',
        type: 'boolean',
        description:
          'When enabled, the reply is also posted to the channel instead of only in the thread.',
        defaultValue: false,
      },
    ],
    execution: {
      handlerId: 'action.reply',
    },
  },
  {
    id: 'add-reaction',
    categoryId: 'actions',
    name: 'Add reaction',
    description: 'React to a message',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'emoji',
        label: 'Emoji',
        type: 'text',
        description: appendVariableHint('Emoji name without colons, for example thumbsup.'),
        required: true,
        defaultValue: 'thumbsup',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.add-reaction',
    },
  },
  {
    id: 'create-channel',
    categoryId: 'actions',
    name: 'Create channel',
    description: 'Create a new channel',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'channelName',
        label: 'Channel name',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'isPrivate',
        label: 'Private channel',
        type: 'boolean',
        defaultValue: false,
      },
    ],
    execution: {
      handlerId: 'action.create-channel',
    },
  },
  {
    id: 'edit-message',
    categoryId: 'actions',
    name: 'Edit message',
    description: 'Update the text of an existing Slack message',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'timestamp',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(
          'Timestamp of the message to edit. Defaults to ${message.ts} from the trigger when available.',
        ),
        defaultValue: '${message.ts}',
        supportsVariables: true,
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to use the channel where the trigger occurred.',
        ),
        supportsVariables: true,
      },
      {
        id: 'message',
        label: 'New message',
        type: 'text',
        description: appendVariableHint('Updated message text.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.edit-message',
    },
  },
  {
    id: 'delete-message',
    categoryId: 'actions',
    name: 'Delete message',
    description: 'Remove an existing Slack message',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'timestamp',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(
          'Timestamp of the message to delete. Defaults to ${message.ts} from the trigger when available.',
        ),
        defaultValue: '${message.ts}',
        supportsVariables: true,
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to use the channel where the trigger occurred.',
        ),
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.delete-message',
    },
  },
  {
    id: 'send-ephemeral-message',
    categoryId: 'actions',
    name: 'Send ephemeral message',
    description: 'Send a message visible only to a specific user in a channel',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'user',
        label: 'User',
        type: 'text',
        description: appendVariableHint(
          'Slack user ID of the recipient. Defaults to ${author.id} from the trigger when available.',
        ),
        defaultValue: '${author.id}',
        supportsVariables: true,
      },
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to use the channel where the trigger occurred, or #general if unavailable.',
        ),
        supportsVariables: true,
      },
      {
        id: 'message',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.send-ephemeral-message',
    },
  },
  {
    id: 'send-dm',
    categoryId: 'actions',
    name: 'Send DM',
    description: 'Send a direct message to a Slack user',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'user',
        label: 'User',
        type: 'text',
        description: appendVariableHint('Slack user ID to message, for example ${author.id}.'),
        required: true,
        defaultValue: '${author.id}',
        supportsVariables: true,
      },
      {
        id: 'message',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.send-dm',
    },
  },
  {
    id: 'remove-reaction',
    categoryId: 'actions',
    name: 'Remove reaction',
    description: 'Remove a reaction from a message',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'emoji',
        label: 'Emoji',
        type: 'text',
        description: appendVariableHint('Emoji name without colons, for example thumbsup.'),
        required: true,
        defaultValue: 'thumbsup',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.remove-reaction',
    },
  },
  {
    id: 'set-channel-topic',
    categoryId: 'actions',
    name: 'Set channel topic',
    description: 'Change the topic of a Slack channel',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        description: appendVariableHint(
          'Leave blank to use the channel where the trigger occurred, or #general if unavailable.',
        ),
        supportsVariables: true,
      },
      {
        id: 'topic',
        label: 'Topic',
        type: 'text',
        description: appendVariableHint('New channel topic text.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'action.set-channel-topic',
    },
  },
  {
    id: 'get-user',
    categoryId: 'data',
    name: 'Get user',
    description: 'Look up a Slack user and store the result in a variable',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'userId',
        label: 'User ID',
        type: 'text',
        description: appendVariableHint('Slack user ID to look up.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.get-user',
    },
  },
  {
    id: 'http-request',
    categoryId: 'data',
    name: 'HTTP request',
    description: 'Call a web API and store the response',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'method',
        label: 'Method',
        type: 'select',
        required: true,
        defaultValue: 'GET',
        options: [
          { value: 'GET', label: 'GET' },
          { value: 'POST', label: 'POST' },
          { value: 'PUT', label: 'PUT' },
          { value: 'PATCH', label: 'PATCH' },
          { value: 'DELETE', label: 'DELETE' },
        ],
      },
      {
        id: 'url',
        label: 'URL',
        type: 'text',
        description: appendVariableHint('Full URL including https://'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'headers',
        label: 'Headers',
        type: 'header-list',
        description: appendVariableHint('Optional request headers.'),
        defaultValue: [{ name: '', value: '' }],
        supportsVariables: true,
      },
      {
        id: 'body',
        label: 'Request body',
        type: 'textarea',
        description: appendVariableHint(
          'Optional JSON or text body. Used for POST, PUT, and PATCH requests.',
        ),
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
      {
        id: 'storeStatusAs',
        label: 'Status variable',
        type: 'text',
        description: appendVariableHint(
          'Optional variable name for the HTTP status code (e.g. statusCode).',
        ),
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'data.http-request',
    },
  },
  {
    id: 'store-variable',
    categoryId: 'data',
    name: 'Store variable',
    description: 'Save a value under a name for use in later steps',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'variableName',
        label: 'Variable name',
        type: 'text',
        description: appendVariableHint(
          'Use global. prefix for persistent variables, e.g. global.stats or global.${author.id}.money.',
        ),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'value',
        label: 'Value',
        type: 'text',
        description: appendVariableHint('Value to save under the variable name.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'data.store-variable',
    },
  },
  {
    id: 'math',
    categoryId: 'data',
    name: 'Math',
    description: 'Perform arithmetic on two numbers and store the result',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'leftValue',
        label: 'First value',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      {
        id: 'operator',
        label: 'Operator',
        type: 'select',
        required: true,
        defaultValue: 'add',
        options: [
          { value: 'add', label: 'Add (+)' },
          { value: 'subtract', label: 'Subtract (−)' },
          { value: 'multiply', label: 'Multiply (×)' },
          { value: 'divide', label: 'Divide (÷)' },
          { value: 'modulo', label: 'Modulo (%)' },
          { value: 'power', label: 'Exponent (^)' },
        ],
      },
      {
        id: 'rightValue',
        label: 'Second value',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.math',
    },
  },
  {
    id: 'random-number',
    categoryId: 'data',
    name: 'Random number',
    description: 'Generate random numbers within a range',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'minimum',
        label: 'Minimum',
        type: 'text',
        description: appendVariableHint('Lowest possible value (inclusive).'),
        required: true,
        defaultValue: '1',
        supportsVariables: true,
      },
      {
        id: 'maximum',
        label: 'Maximum',
        type: 'text',
        description: appendVariableHint('Highest possible value (inclusive).'),
        required: true,
        defaultValue: '100',
        supportsVariables: true,
      },
      {
        id: 'count',
        label: 'Amount',
        type: 'text',
        description: appendVariableHint(
          'How many numbers to generate. Returns a single number when 1, or an array when greater than 1.',
        ),
        required: true,
        defaultValue: '1',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.random-number',
    },
  },
  {
    id: 'random-string',
    categoryId: 'data',
    name: 'Random string',
    description: 'Generate random strings from selected character sets',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'length',
        label: 'Length',
        type: 'text',
        description: appendVariableHint('Number of characters in each string.'),
        required: true,
        defaultValue: '8',
        supportsVariables: true,
      },
      {
        id: 'count',
        label: 'Amount',
        type: 'text',
        description: appendVariableHint(
          'How many strings to generate. Returns a single string when 1, or an array when greater than 1.',
        ),
        required: true,
        defaultValue: '1',
        supportsVariables: true,
      },
      {
        id: 'includeNumbers',
        label: 'Include numbers',
        type: 'boolean',
        defaultValue: true,
      },
      {
        id: 'includeUppercase',
        label: 'Include uppercase letters',
        type: 'boolean',
        defaultValue: true,
      },
      {
        id: 'includeLowercase',
        label: 'Include lowercase letters',
        type: 'boolean',
        defaultValue: true,
      },
      {
        id: 'includeSymbols',
        label: 'Include symbols',
        type: 'boolean',
        defaultValue: false,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.random-string',
    },
  },
  {
    id: 'date-time',
    categoryId: 'data',
    name: 'Date and time',
    description: 'Get the current date and time in a custom format',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'format',
        label: 'Format',
        type: 'text',
        description:
          'Format tokens: YYYY (year), MM (month), DD (day), HH (hour), mm (minute), ss (second), dddd (weekday), ww (week), unix (seconds), unixMs (milliseconds). Combine tokens freely, e.g. YYYY-MM-DD HH:mm:ss.',
        required: true,
        defaultValue: 'YYYY-MM-DD HH:mm:ss',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.date-time',
    },
  },
  {
    id: 'convert',
    categoryId: 'data',
    name: 'Convert',
    description: 'Convert a value between formats or units',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'value',
        label: 'Value',
        type: 'text',
        description: appendVariableHint('The value to convert.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'conversion',
        label: 'Conversion',
        type: 'select',
        required: true,
        defaultValue: 'number-to-string',
        options: [
          { value: 'number-to-string', label: 'Number to string' },
          { value: 'string-to-number', label: 'String to number' },
          { value: 'celsius-to-fahrenheit', label: 'Celsius to Fahrenheit' },
          { value: 'fahrenheit-to-celsius', label: 'Fahrenheit to Celsius' },
          { value: 'kilometres-to-miles', label: 'Kilometres to miles' },
          { value: 'miles-to-kilometres', label: 'Miles to kilometres' },
          { value: 'metres-to-feet', label: 'Metres to feet' },
          { value: 'feet-to-metres', label: 'Feet to metres' },
          { value: 'seconds-to-milliseconds', label: 'Seconds to milliseconds' },
          { value: 'milliseconds-to-seconds', label: 'Milliseconds to seconds' },
          { value: 'kilograms-to-pounds', label: 'Kilograms to pounds' },
          { value: 'pounds-to-kilograms', label: 'Pounds to kilograms' },
        ],
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.convert',
    },
  },
  {
    id: 'round-number',
    categoryId: 'data',
    name: 'Round number',
    description: 'Round a number using a chosen method',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'value',
        label: 'Value',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      {
        id: 'method',
        label: 'Method',
        type: 'select',
        required: true,
        defaultValue: 'round',
        options: [
          { value: 'round', label: 'Round' },
          { value: 'floor', label: 'Floor' },
          { value: 'ceiling', label: 'Ceiling' },
          { value: 'truncate', label: 'Truncate' },
        ],
      },
      {
        id: 'decimalPlaces',
        label: 'Decimal places',
        type: 'text',
        description: appendVariableHint('Number of decimal places to keep.'),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.round-number',
    },
  },
  {
    id: 'string',
    categoryId: 'data',
    name: 'String',
    description: 'Create or modify text with variable references',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'value',
        label: 'Text',
        type: 'text',
        description: appendVariableHint('Text to store, including ${variableName} references.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string',
    },
  },
  {
    id: 'string-length',
    categoryId: 'data',
    name: 'String length',
    description: 'Count the number of characters in a string',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-length',
    },
  },
  {
    id: 'string-replace',
    categoryId: 'data',
    name: 'String replace',
    description: 'Find and replace text in a string',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'find',
        label: 'Find',
        type: 'text',
        description: appendVariableHint('Text to search for.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'replace',
        label: 'Replace with',
        type: 'text',
        description: appendVariableHint('Text to insert instead.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'replaceMode',
        label: 'Replace',
        type: 'select',
        required: true,
        defaultValue: 'all',
        options: [
          { value: 'first', label: 'First match only' },
          { value: 'all', label: 'All matches' },
        ],
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-replace',
    },
  },
  {
    id: 'string-split',
    categoryId: 'data',
    name: 'String split',
    description: 'Split a string into an array using a separator',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint('Text to split, e.g. apple,banana,orange.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'separator',
        label: 'Separator',
        type: 'text',
        description: appendVariableHint('Character or text to split on, e.g. ,'),
        required: true,
        defaultValue: ',',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-split',
    },
  },
  {
    id: 'string-join',
    categoryId: 'data',
    name: 'String join',
    description: 'Combine array values into a single string',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'values',
        label: 'Values',
        type: 'text',
        description: appendVariableHint(
          'An array variable like ${items}, or comma-separated values like apple, banana, orange.',
        ),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'separator',
        label: 'Separator',
        type: 'text',
        description: appendVariableHint('Text placed between each value.'),
        required: true,
        defaultValue: ', ',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-join',
    },
  },
  {
    id: 'string-contains',
    categoryId: 'data',
    name: 'String contains',
    description: 'Check whether a string contains specific text',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'search',
        label: 'Contains',
        type: 'text',
        description: appendVariableHint('Text to look for.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-contains',
    },
  },
  {
    id: 'string-case',
    categoryId: 'data',
    name: 'String case',
    description: 'Change the casing of text',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'caseType',
        label: 'Case',
        type: 'select',
        required: true,
        defaultValue: 'uppercase',
        options: [
          { value: 'uppercase', label: 'Uppercase' },
          { value: 'lowercase', label: 'Lowercase' },
          { value: 'title', label: 'Title case' },
          { value: 'sentence', label: 'Sentence case' },
        ],
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.string-case',
    },
  },
  {
    id: 'regex-match',
    categoryId: 'data',
    name: 'Regex match',
    description: 'Check whether text matches a regular expression',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'pattern',
        label: 'Pattern',
        type: 'text',
        description: appendVariableHint('Regular expression pattern without slashes.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'flags',
        label: 'Flags',
        type: 'text',
        description: appendVariableHint('Optional regex flags such as i for case-insensitive.'),
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.regex-match',
    },
  },
  {
    id: 'regex-replace',
    categoryId: 'data',
    name: 'Regex replace',
    description: 'Find and replace text using a regular expression',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'text',
        label: 'Text',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'pattern',
        label: 'Pattern',
        type: 'text',
        description: appendVariableHint('Regular expression pattern without slashes.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'replacement',
        label: 'Replace with',
        type: 'text',
        description: appendVariableHint('Replacement text. Use $1, $2 for capture groups.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'flags',
        label: 'Flags',
        type: 'text',
        description: appendVariableHint('Regex flags. Defaults to g for all matches.'),
        defaultValue: 'g',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.regex-replace',
    },
  },
  {
    id: 'array',
    categoryId: 'data',
    name: 'Array',
    description: 'Create an array containing multiple values',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'values',
        label: 'Values',
        type: 'list',
        description: appendVariableHint('Add, remove, and reorder values in the array.'),
        defaultValue: [''],
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array',
    },
  },
  {
    id: 'array-get',
    categoryId: 'data',
    name: 'Array Get',
    description: 'Retrieve an item from an array by index',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to read from.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'index',
        label: 'Index',
        type: 'text',
        description: appendVariableHint('Position of the item to retrieve.'),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-get',
    },
  },
  {
    id: 'array-set',
    categoryId: 'data',
    name: 'Array Set',
    description: 'Replace the value at a specific index in an array',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to update.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'index',
        label: 'Index',
        type: 'text',
        description: appendVariableHint('Position of the item to replace.'),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      {
        id: 'value',
        label: 'New value',
        type: 'text',
        description: appendVariableHint('Value to store at the index.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-set',
    },
  },
  {
    id: 'array-length',
    categoryId: 'data',
    name: 'Array Length',
    description: 'Get the number of items in an array',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to measure.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-length',
    },
  },
  {
    id: 'array-add',
    categoryId: 'data',
    name: 'Array Add',
    description: 'Add a value to an array at a position or at the end',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to add to.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'value',
        label: 'Value',
        type: 'text',
        description: appendVariableHint('Value to add.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'position',
        label: 'Position',
        type: 'text',
        description: appendVariableHint(
          'Optional index where the value should be inserted. Leave blank to append to the end.',
        ),
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-add',
    },
  },
  {
    id: 'array-remove',
    categoryId: 'data',
    name: 'Array Remove',
    description: 'Remove an item from an array by index',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to remove from.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'index',
        label: 'Index',
        type: 'text',
        description: appendVariableHint('Position of the item to remove.'),
        required: true,
        defaultValue: '0',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-remove',
    },
  },
  {
    id: 'array-sort',
    categoryId: 'data',
    name: 'Array Sort',
    description: 'Sort the values in an array',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to sort.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'method',
        label: 'Sort method',
        type: 'select',
        required: true,
        defaultValue: 'ascending',
        options: [
          { value: 'ascending', label: 'Ascending' },
          { value: 'descending', label: 'Descending' },
          { value: 'alphabetical', label: 'Alphabetical' },
          { value: 'reverse-alphabetical', label: 'Reverse alphabetical' },
        ],
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-sort',
    },
  },
  {
    id: 'array-random-item',
    categoryId: 'data',
    name: 'Array Random Item',
    description: 'Randomly select one item from an array',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'array',
        label: 'Array',
        type: 'text',
        description: appendVariableHint('Array to pick from.'),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      createStoreAsField(),
    ],
    execution: {
      handlerId: 'data.array-random-item',
    },
  },
  {
    id: 'delay',
    categoryId: 'utilities',
    name: 'Delay',
    description: 'Wait before continuing',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'seconds',
        label: 'Seconds',
        type: 'text',
        description: appendVariableHint('Number of seconds to wait, or a variable reference.'),
        required: true,
        defaultValue: '1',
        supportsVariables: true,
      },
    ],
    execution: {
      handlerId: 'utility.delay',
    },
  },
  {
    id: 'log',
    categoryId: 'utilities',
    name: 'Log',
    description: 'Write to the debug log',
    inputs: [FLOW_INPUT],
    outputs: [FLOW_OUTPUT],
    fields: [
      {
        id: 'message',
        label: 'Message',
        type: 'text',
        description: appendVariableHint(),
        required: true,
        defaultValue: '',
        supportsVariables: true,
      },
      {
        id: 'level',
        label: 'Level',
        type: 'select',
        defaultValue: 'info',
        options: [
          { value: 'info', label: 'Info' },
          { value: 'warn', label: 'Warning' },
          { value: 'error', label: 'Error' },
        ],
      },
    ],
    execution: {
      handlerId: 'utility.log',
    },
  },
  {
    id: 'stop-flow',
    categoryId: 'utilities',
    name: 'Stop flow',
    description: 'End execution here',
    inputs: [FLOW_INPUT],
    outputs: [],
    fields: [],
    execution: {
      handlerId: 'utility.stop-flow',
      terminatesFlow: true,
    },
  },
];

const COMPONENT_DEFINITION_MAP = new Map(
  COMPONENT_DEFINITIONS.map((definition) => [definition.id, definition]),
);

export function getComponentDefinition(typeId: string): ComponentDefinition | undefined {
  return COMPONENT_DEFINITION_MAP.get(typeId);
}

export function getComponentDefinitionsByCategory(
  categoryId: ComponentCategoryId,
): ComponentDefinition[] {
  return COMPONENT_DEFINITIONS.filter((definition) => definition.categoryId === categoryId);
}

export function getCategoryLabel(categoryId: string): string {
  const category = COMPONENT_CATEGORIES.find((entry) => entry.id === categoryId);
  return category?.label ?? categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

export function createDefaultNodeConfig(typeId: string): Record<string, unknown> {
  const definition = getComponentDefinition(typeId);
  if (!definition) {
    return {};
  }

  const config: Record<string, unknown> = {};
  for (const field of definition.fields) {
    if (field.defaultValue !== undefined) {
      config[field.id] = field.defaultValue;
      continue;
    }

    if (field.type === 'list') {
      config[field.id] = [''];
    }

    if (field.type === 'header-list') {
      config[field.id] = [{ name: '', value: '' }];
    }

    if (field.type === 'block-kit-message') {
      config[field.id] = createDefaultBlockKitMessage();
      continue;
    }
  }
  return config;
}

export function formatConfigFieldType(type: ConfigFieldType): string {
  switch (type) {
    case 'text':
      return 'Text';
    case 'textarea':
      return 'Text area';
    case 'number':
      return 'Number';
    case 'select':
      return 'Select';
    case 'channel':
      return 'Channel';
    case 'boolean':
      return 'Yes / no';
    case 'list':
      return 'List';
    case 'header-list':
      return 'Headers';
    case 'block-kit-message':
      return 'Block Kit message';
    default:
      return type;
  }
}

function getSelectOptionLabel(
  field: ConfigFieldDefinition,
  value: unknown,
): string | undefined {
  if (field.type !== 'select' || !field.options) {
    return undefined;
  }

  const normalized = String(value ?? '');
  return field.options.find((option) => option.value === normalized)?.label;
}

function truncateDisplayValue(value: string, maxLength = 18): string {
  const trimmed = value.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength - 1)}…`;
}

/** Short summary shown on the canvas node body for branching components. */
export function getNodeCanvasSubtitle(
  typeId: string,
  config: Record<string, unknown>,
): string | null {
  const definition = getComponentDefinition(typeId);
  if (!definition) {
    return null;
  }

  switch (typeId) {
    case 'if-else': {
      const operatorField = definition.fields.find((field) => field.id === 'operator');
      const operatorLabel = operatorField
        ? getSelectOptionLabel(operatorField, config.operator) ?? 'Equals'
        : 'Equals';
      const rightValue = truncateDisplayValue(String(config.rightValue ?? ''));
      return rightValue.length > 0 ? `${operatorLabel} "${rightValue}"` : operatorLabel;
    }

    case 'while': {
      const operatorField = definition.fields.find((field) => field.id === 'operator');
      const operatorLabel = operatorField
        ? getSelectOptionLabel(operatorField, config.operator) ?? 'Equals'
        : 'Equals';
      const rightValue = truncateDisplayValue(String(config.rightValue ?? ''));
      return rightValue.length > 0 ? `${operatorLabel} "${rightValue}"` : operatorLabel;
    }

    case 'for-each': {
      const itemVariable = truncateDisplayValue(String(config.itemVariable ?? 'item'));
      return `Each as ${itemVariable}`;
    }

    case 'repeat': {
      const count = truncateDisplayValue(String(config.count ?? '5'));
      return count.length > 0 ? `${count} times` : 'Repeat';
    }

    case 'array': {
      const values = Array.isArray(config.values) ? config.values : [];
      return `${values.length} value${values.length === 1 ? '' : 's'}`;
    }

    case 'array-sort': {
      const methodField = definition.fields.find((field) => field.id === 'method');
      return methodField
        ? getSelectOptionLabel(methodField, config.method) ?? 'Sort'
        : 'Sort';
    }

    case 'math': {
      const operatorField = definition.fields.find((field) => field.id === 'operator');
      const operatorLabel = operatorField
        ? getSelectOptionLabel(operatorField, config.operator) ?? 'Add'
        : 'Add';
      const rightValue = truncateDisplayValue(String(config.rightValue ?? ''));
      return rightValue.length > 0 ? `${operatorLabel} ${rightValue}` : operatorLabel;
    }

    case 'convert': {
      const conversionField = definition.fields.find((field) => field.id === 'conversion');
      return conversionField
        ? getSelectOptionLabel(conversionField, config.conversion) ?? 'Convert'
        : 'Convert';
    }

    case 'round-number': {
      const methodField = definition.fields.find((field) => field.id === 'method');
      return methodField
        ? getSelectOptionLabel(methodField, config.method) ?? 'Round'
        : 'Round';
    }

    case 'string-case': {
      const caseField = definition.fields.find((field) => field.id === 'caseType');
      return caseField ? getSelectOptionLabel(caseField, config.caseType) ?? 'Case' : 'Case';
    }

    case 'string-replace': {
      const find = truncateDisplayValue(String(config.find ?? ''));
      return find.length > 0 ? `Replace "${find}"` : 'Replace text';
    }

    case 'date-time': {
      const format = truncateDisplayValue(String(config.format ?? ''));
      return format.length > 0 ? format : 'Current date/time';
    }

    case 'button-clicked': {
      const actionId = truncateDisplayValue(String(config.actionId ?? ''));
      return actionId.length > 0 ? actionId : 'Any button';
    }

    case 'scheduled': {
      const interval = truncateDisplayValue(String(config.interval ?? ''));
      const unitField = definition.fields.find((field) => field.id === 'unit');
      const unitLabel = unitField
        ? getSelectOptionLabel(unitField, config.unit) ?? 'Minutes'
        : 'Minutes';
      return interval.length > 0 ? `Every ${interval} ${unitLabel.toLowerCase()}` : 'Scheduled';
    }

    case 'send-block-kit-message': {
      const message = resolveBlockKitMessageFromConfig(config);
      return getBlockKitMessageSummary(message);
    }

    case 'http-request': {
      const methodField = definition.fields.find((field) => field.id === 'method');
      const methodLabel = methodField
        ? getSelectOptionLabel(methodField, config.method) ?? 'GET'
        : 'GET';
      const url = truncateDisplayValue(String(config.url ?? ''));
      return url.length > 0 ? `${methodLabel} ${url}` : methodLabel;
    }

    default:
      return null;
  }
}

/** Whether a component exposes labeled branching outputs on the canvas. */
export function hasLabeledBranchOutputs(typeId: string): boolean {
  const definition = getComponentDefinition(typeId);
  if (!definition) {
    return false;
  }

  return definition.outputs.length > 1;
}
