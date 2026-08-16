import { appendVariableHint, createStoreAsField } from './variables.js';

export const COMPONENT_CATEGORIES = [
  { id: 'triggers', label: 'Triggers' },
  { id: 'conditions', label: 'Conditions' },
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

export type ConfigFieldType = 'text' | 'number' | 'select' | 'channel' | 'boolean';

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
  defaultValue?: string | number | boolean;
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

const MATCH_OUTPUTS: ComponentPortDefinition[] = [
  { id: 'match', label: 'Match', direction: 'output' },
  { id: 'no-match', label: 'No match', direction: 'output' },
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
        id: 'channelFilter',
        label: 'Channel filter',
        type: 'channel',
        description: 'Only run when a message is posted in this channel. Leave empty for any channel.',
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
    ],
    execution: {
      handlerId: 'trigger.slash-command',
      isTrigger: true,
    },
  },
  {
    id: 'app-mention',
    categoryId: 'triggers',
    name: 'App mention',
    description: 'When the bot is @mentioned',
    inputs: [],
    outputs: [TRIGGER_OUTPUT],
    fields: [
      {
        id: 'channelFilter',
        label: 'Channel filter',
        type: 'channel',
        description: 'Only run when the bot is mentioned in this channel. Leave empty for any channel.',
      },
    ],
    execution: {
      handlerId: 'trigger.app-mention',
      isTrigger: true,
    },
  },
  {
    id: 'if-else',
    categoryId: 'conditions',
    name: 'If / else',
    description: 'Branch based on a condition',
    inputs: [FLOW_INPUT],
    outputs: BRANCH_OUTPUTS,
    fields: [
      {
        id: 'expression',
        label: 'Condition',
        type: 'text',
        description: appendVariableHint('Expression to evaluate. True routes to the True output.'),
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
    id: 'compare-value',
    categoryId: 'conditions',
    name: 'Compare value',
    description: 'Check a value against a rule',
    inputs: [FLOW_INPUT],
    outputs: MATCH_OUTPUTS,
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
        options: [
          { value: 'equals', label: 'Equals' },
          { value: 'contains', label: 'Contains' },
          { value: 'starts-with', label: 'Starts with' },
          { value: 'greater-than', label: 'Greater than' },
          { value: 'less-than', label: 'Less than' },
        ],
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
      handlerId: 'condition.compare-value',
    },
  },
  {
    id: 'channel-match',
    categoryId: 'conditions',
    name: 'Channel match',
    description: 'Match a specific channel',
    inputs: [FLOW_INPUT],
    outputs: MATCH_OUTPUTS,
    fields: [
      {
        id: 'channel',
        label: 'Channel',
        type: 'channel',
        required: true,
      },
    ],
    execution: {
      handlerId: 'condition.channel-match',
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
        description: appendVariableHint(),
        required: true,
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
        required: true,
        defaultValue: '',
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
    }
  }
  return config;
}

export function formatConfigFieldType(type: ConfigFieldType): string {
  switch (type) {
    case 'text':
      return 'Text';
    case 'number':
      return 'Number';
    case 'select':
      return 'Select';
    case 'channel':
      return 'Channel';
    case 'boolean':
      return 'Yes / no';
    default:
      return type;
  }
}
