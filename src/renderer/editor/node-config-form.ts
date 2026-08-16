import {
  createCheckbox,
  createInput,
  createSelect,
} from '../components/index.js';
import type { ConfigFieldDefinition } from '../../shared/domain/component-registry.js';

export interface NodeConfigFormOptions {
  nodeId: string;
  fields: ConfigFieldDefinition[];
  config: Record<string, unknown>;
  onChange: (fieldId: string, value: unknown) => void;
}

function getFieldValue(
  config: Record<string, unknown>,
  field: ConfigFieldDefinition,
): unknown {
  const value = config[field.id];
  if (value !== undefined) {
    return value;
  }

  if (field.defaultValue !== undefined) {
    return field.defaultValue;
  }

  if (field.type === 'boolean') {
    return false;
  }

  return '';
}

function isRequiredFieldEmpty(field: ConfigFieldDefinition, value: unknown): boolean {
  if (!field.required || field.type === 'boolean') {
    return false;
  }

  if (field.type === 'number') {
    return value === '' || value === undefined || value === null || Number.isNaN(Number(value));
  }

  return value === '' || value === undefined || value === null;
}

function getRequiredFieldError(field: ConfigFieldDefinition, value: unknown): string | undefined {
  if (isRequiredFieldEmpty(field, value)) {
    return `${field.label} is required.`;
  }

  return undefined;
}

function createConfigFieldControl(
  nodeId: string,
  field: ConfigFieldDefinition,
  config: Record<string, unknown>,  
  onChange: (fieldId: string, value: unknown) => void,
): HTMLElement {
  const fieldId = `${nodeId}-${field.id}`;
  const value = getFieldValue(config, field);
  const error = getRequiredFieldError(field, value);

  switch (field.type) {
    case 'text':
      return createInput({
        id: fieldId,
        label: field.label,
        value: String(value ?? ''),
        hint: error ? undefined : field.description,
        error,
        onInput: (nextValue) => {
          onChange(field.id, nextValue);
        },
      });

    case 'channel':
      return createInput({
        id: fieldId,
        label: field.label,
        value: String(value ?? ''),
        placeholder: '#general or channel ID',
        hint: error ? undefined : (field.description ?? 'Leave empty for any channel.'),
        error,
        onInput: (nextValue) => {
          onChange(field.id, nextValue);
        },
      });

    case 'number':
      return createInput({
        id: fieldId,
        label: field.label,
        type: 'number',
        value: value === '' || value === undefined || value === null ? '' : String(value),
        hint: error ? undefined : field.description,
        error,
        onInput: (nextValue) => {
          if (nextValue.trim() === '') {
            onChange(field.id, '');
            return;
          }

          const parsed = Number(nextValue);
          onChange(field.id, Number.isNaN(parsed) ? nextValue : parsed);
        },
      });

    case 'select':
      return createSelect({
        id: fieldId,
        label: field.label,
        value: String(value ?? ''),
        options: field.options ?? [],
        hint: error ? undefined : field.description,
        error,
        onChange: (nextValue) => {
          onChange(field.id, nextValue);
        },
      });

    case 'boolean':
      return createCheckbox({
        id: fieldId,
        label: field.label,
        checked: Boolean(value),
        hint: field.description,
        onChange: (checked) => {
          onChange(field.id, checked);
        },
      });

    default:
      return createInput({
        id: fieldId,
        label: field.label,
        value: String(value ?? ''),
        hint: field.description,
        onInput: (nextValue) => {
          onChange(field.id, nextValue);
        },
      });
  }
}

export function createNodeConfigForm(options: NodeConfigFormOptions): HTMLElement {
  const { nodeId, fields, config, onChange } = options;

  const form = document.createElement('div');
  form.className = 'node-config-form';

  for (const field of fields) {
    form.appendChild(createConfigFieldControl(nodeId, field, config, onChange));
  }

  return form;
}
