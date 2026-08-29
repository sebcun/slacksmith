import {
  createButton,
  createCheckbox,
  createInput,
  createSelect,
} from '../components/index.js';
import {
  createEmptyHttpHeaderEntry,
  normalizeHttpHeaderList,
  type HttpHeaderEntry,
} from '../../shared/domain/http-headers.js';
import { resolveBlockKitMessageFromConfig } from '../../shared/domain/block-kit.js';
import type { ConfigFieldDefinition } from '../../shared/domain/component-registry.js';
import { createBlockKitMessageFieldControl } from './block-kit-message-builder.js';

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

  if (field.type === 'list') {
    return [''];
  }

  if (field.type === 'header-list') {
    return normalizeHttpHeaderList(undefined);
  }

  if (field.type === 'block-kit-message') {
    return resolveBlockKitMessageFromConfig(config);
  }

  return '';
}

function isRequiredFieldEmpty(field: ConfigFieldDefinition, value: unknown): boolean {
  if (!field.required || field.type === 'boolean') {
    return false;
  }

  if (field.type === 'block-kit-message') {
    if (!value || typeof value !== 'object' || !Array.isArray((value as { blocks?: unknown }).blocks)) {
      return true;
    }

    return (value as { blocks: unknown[] }).blocks.length === 0;
  }

  if (field.type === 'list') {
    return !Array.isArray(value) || value.length === 0;
  }

  if (field.type === 'header-list') {
    return !Array.isArray(value) || value.length === 0;
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

function normalizeListValues(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [''];
  }

  if (value.length === 0) {
    return [''];
  }

  return value.map((entry) => String(entry ?? ''));
}

function createListFieldControl(
  nodeId: string,
  field: ConfigFieldDefinition,
  config: Record<string, unknown>,
  onChange: (fieldId: string, value: unknown) => void,
): HTMLElement {
  const fieldId = `${nodeId}-${field.id}`;
  let currentValues = normalizeListValues(getFieldValue(config, field));
  const error = getRequiredFieldError(field, currentValues);

  const wrapper = document.createElement('div');
  wrapper.className = 'field field--list';
  if (error) {
    wrapper.classList.add('field--error');
  }

  const labelEl = document.createElement('label');
  labelEl.className = 'field__label';
  labelEl.htmlFor = `${fieldId}-0`;
  labelEl.textContent = field.label;
  wrapper.appendChild(labelEl);

  const list = document.createElement('div');
  list.className = 'list-field';

  const updateValues = (nextValues: string[]): void => {
    currentValues = normalizeListValues(nextValues);
    onChange(field.id, currentValues);
    renderItems();
  };

  const renderItems = (): void => {
    list.replaceChildren();

    currentValues.forEach((itemValue, index) => {
      const row = document.createElement('div');
      row.className = 'list-field__item';

      const input = document.createElement('input');
      input.className = 'field__control list-field__input';
      input.id = `${fieldId}-${index}`;
      input.type = 'text';
      input.value = itemValue;
      input.placeholder = `Value ${index + 1}`;
      input.addEventListener('input', () => {
        const nextValues = [...currentValues];
        nextValues[index] = input.value;
        currentValues = nextValues;
        onChange(field.id, nextValues);
      });
      row.appendChild(input);

      const actions = document.createElement('div');
      actions.className = 'list-field__actions';

      const moveUpButton = createButton({
        label: '↑',
        variant: 'ghost',
        size: 'sm',
        disabled: index === 0,
        onClick: () => {
          if (index === 0) {
            return;
          }

          const nextValues = [...currentValues];
          const previous = nextValues[index - 1];
          nextValues[index - 1] = nextValues[index];
          nextValues[index] = previous;
          updateValues(nextValues);
        },
      });
      moveUpButton.className = `${moveUpButton.className} list-field__action`;
      moveUpButton.setAttribute('aria-label', 'Move up');
      actions.appendChild(moveUpButton);

      const moveDownButton = createButton({
        label: '↓',
        variant: 'ghost',
        size: 'sm',
        disabled: index === currentValues.length - 1,
        onClick: () => {
          if (index === currentValues.length - 1) {
            return;
          }

          const nextValues = [...currentValues];
          const next = nextValues[index + 1];
          nextValues[index + 1] = nextValues[index];
          nextValues[index] = next;
          updateValues(nextValues);
        },
      });
      moveDownButton.className = `${moveDownButton.className} list-field__action`;
      moveDownButton.setAttribute('aria-label', 'Move down');
      actions.appendChild(moveDownButton);

      const removeButton = createButton({
        label: 'Remove',
        variant: 'ghost',
        size: 'sm',
        disabled: currentValues.length === 1,
        onClick: () => {
          const nextValues = currentValues.filter((_, itemIndex) => itemIndex !== index);
          updateValues(nextValues.length > 0 ? nextValues : ['']);
        },
      });
      removeButton.className = `${removeButton.className} list-field__action`;
      actions.appendChild(removeButton);

      row.appendChild(actions);
      list.appendChild(row);
    });
  };

  renderItems();

  wrapper.appendChild(list);

  const addButton = createButton({
    label: 'Add value',
    variant: 'secondary',
    size: 'sm',
    onClick: () => {
      updateValues([...currentValues, '']);
    },
  });
  addButton.className = `${addButton.className} list-field__add`;
  wrapper.appendChild(addButton);

  if (error) {
    const errorEl = document.createElement('span');
    errorEl.className = 'field__error';
    errorEl.textContent = error;
    wrapper.appendChild(errorEl);
  } else if (field.description) {
    const hintEl = document.createElement('span');
    hintEl.className = 'field__hint';
    hintEl.textContent = field.description;
    wrapper.appendChild(hintEl);
  }

  return wrapper;
}

function createHeaderListFieldControl(
  nodeId: string,
  field: ConfigFieldDefinition,
  config: Record<string, unknown>,
  onChange: (fieldId: string, value: unknown) => void,
): HTMLElement {
  const fieldId = `${nodeId}-${field.id}`;
  let currentValues = normalizeHttpHeaderList(getFieldValue(config, field));
  const error = getRequiredFieldError(field, currentValues);

  const wrapper = document.createElement('div');
  wrapper.className = 'field field--list field--header-list';
  if (error) {
    wrapper.classList.add('field--error');
  }

  const labelEl = document.createElement('label');
  labelEl.className = 'field__label';
  labelEl.htmlFor = `${fieldId}-name-0`;
  labelEl.textContent = field.label;
  wrapper.appendChild(labelEl);

  const list = document.createElement('div');
  list.className = 'header-list-field';

  const columnHeaders = document.createElement('div');
  columnHeaders.className = 'header-list-field__columns';
  columnHeaders.setAttribute('aria-hidden', 'true');

  const nameHeader = document.createElement('span');
  nameHeader.className = 'header-list-field__column-label';
  nameHeader.textContent = 'Name';
  columnHeaders.appendChild(nameHeader);

  const valueHeader = document.createElement('span');
  valueHeader.className = 'header-list-field__column-label';
  valueHeader.textContent = 'Value';
  columnHeaders.appendChild(valueHeader);

  const actionsSpacer = document.createElement('span');
  actionsSpacer.className = 'header-list-field__actions-spacer';
  columnHeaders.appendChild(actionsSpacer);
  list.appendChild(columnHeaders);

  const updateValues = (nextValues: HttpHeaderEntry[]): void => {
    currentValues = normalizeHttpHeaderList(nextValues);
    onChange(field.id, currentValues);
    renderItems();
  };

  const renderItems = (): void => {
    const rows = list.querySelectorAll('.header-list-field__item');
    rows.forEach((row) => row.remove());

    currentValues.forEach((entry, index) => {
      const row = document.createElement('div');
      row.className = 'header-list-field__item';

      const nameInput = document.createElement('input');
      nameInput.className = 'field__control header-list-field__input';
      nameInput.id = `${fieldId}-name-${index}`;
      nameInput.type = 'text';
      nameInput.value = entry.name;
      nameInput.placeholder = 'Content-Type';
      nameInput.addEventListener('input', () => {
        const nextValues = currentValues.map((item, itemIndex) =>
          itemIndex === index ? { ...item, name: nameInput.value } : item,
        );
        currentValues = nextValues;
        onChange(field.id, nextValues);
      });
      row.appendChild(nameInput);

      const valueInput = document.createElement('input');
      valueInput.className = 'field__control header-list-field__input';
      valueInput.id = `${fieldId}-value-${index}`;
      valueInput.type = 'text';
      valueInput.value = entry.value;
      valueInput.placeholder = 'application/json';
      valueInput.addEventListener('input', () => {
        const nextValues = currentValues.map((item, itemIndex) =>
          itemIndex === index ? { ...item, value: valueInput.value } : item,
        );
        currentValues = nextValues;
        onChange(field.id, nextValues);
      });
      row.appendChild(valueInput);

      const actions = document.createElement('div');
      actions.className = 'list-field__actions';

      const moveUpButton = createButton({
        label: '↑',
        variant: 'ghost',
        size: 'sm',
        disabled: index === 0,
        onClick: () => {
          if (index === 0) {
            return;
          }

          const nextValues = [...currentValues];
          const previous = nextValues[index - 1];
          nextValues[index - 1] = nextValues[index];
          nextValues[index] = previous;
          updateValues(nextValues);
        },
      });
      moveUpButton.className = `${moveUpButton.className} list-field__action`;
      moveUpButton.setAttribute('aria-label', 'Move up');
      actions.appendChild(moveUpButton);

      const moveDownButton = createButton({
        label: '↓',
        variant: 'ghost',
        size: 'sm',
        disabled: index === currentValues.length - 1,
        onClick: () => {
          if (index === currentValues.length - 1) {
            return;
          }

          const nextValues = [...currentValues];
          const next = nextValues[index + 1];
          nextValues[index + 1] = nextValues[index];
          nextValues[index] = next;
          updateValues(nextValues);
        },
      });
      moveDownButton.className = `${moveDownButton.className} list-field__action`;
      moveDownButton.setAttribute('aria-label', 'Move down');
      actions.appendChild(moveDownButton);

      const removeButton = createButton({
        label: 'Remove',
        variant: 'ghost',
        size: 'sm',
        disabled: currentValues.length === 1,
        onClick: () => {
          const nextValues = currentValues.filter((_, itemIndex) => itemIndex !== index);
          updateValues(nextValues.length > 0 ? nextValues : [createEmptyHttpHeaderEntry()]);
        },
      });
      removeButton.className = `${removeButton.className} list-field__action`;
      actions.appendChild(removeButton);

      row.appendChild(actions);
      list.appendChild(row);
    });
  };

  renderItems();

  wrapper.appendChild(list);

  const addButton = createButton({
    label: 'Add header',
    variant: 'secondary',
    size: 'sm',
    onClick: () => {
      updateValues([...currentValues, createEmptyHttpHeaderEntry()]);
    },
  });
  addButton.className = `${addButton.className} list-field__add`;
  wrapper.appendChild(addButton);

  if (error) {
    const errorEl = document.createElement('span');
    errorEl.className = 'field__error';
    errorEl.textContent = error;
    wrapper.appendChild(errorEl);
  } else if (field.description) {
    const hintEl = document.createElement('span');
    hintEl.className = 'field__hint';
    hintEl.textContent = field.description;
    wrapper.appendChild(hintEl);
  }

  return wrapper;
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
    case 'list':
      return createListFieldControl(nodeId, field, config, onChange);

    case 'header-list':
      return createHeaderListFieldControl(nodeId, field, config, onChange);

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

    case 'textarea': {
      const fieldWrapper = document.createElement('div');
      fieldWrapper.className = 'field';
      if (error) {
        fieldWrapper.classList.add('field--error');
      }

      const labelEl = document.createElement('label');
      labelEl.className = 'field__label';
      labelEl.htmlFor = fieldId;
      labelEl.textContent = field.label;
      fieldWrapper.appendChild(labelEl);

      const textarea = document.createElement('textarea');
      textarea.className = 'field__control field__control--textarea';
      textarea.id = fieldId;
      textarea.value = String(value ?? '');
      textarea.rows = 4;
      textarea.addEventListener('input', () => {
        onChange(field.id, textarea.value);
      });
      fieldWrapper.appendChild(textarea);

      if (error) {
        const errorEl = document.createElement('span');
        errorEl.className = 'field__error';
        errorEl.textContent = error;
        fieldWrapper.appendChild(errorEl);
      } else if (field.description) {
        const hintEl = document.createElement('span');
        hintEl.className = 'field__hint';
        hintEl.textContent = field.description;
        fieldWrapper.appendChild(hintEl);
      }

      return fieldWrapper;
    }

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

    case 'block-kit-message':
      return createBlockKitMessageFieldControl({
        nodeId,
        value: resolveBlockKitMessageFromConfig(config),
        onChange: (nextValue) => {
          onChange(field.id, nextValue);
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
