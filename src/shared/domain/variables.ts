/**
 * Flow variables are referenced in text fields using ${path.to.value}.
 * Local variables reset between trigger invocations.
 * Variables whose path starts with "global." persist across restarts.
 */

export const VARIABLE_REFERENCE_PATTERN = /\$\{([^{}]+)\}/g;

export const VARIABLE_SYNTAX_HINT =
  'Use ${variableName} or ${object.property} to insert a value. Prefix with global. for persistent variables.';

export function appendVariableHint(description?: string): string | undefined {
  if (description) {
    return `${description} ${VARIABLE_SYNTAX_HINT}`;
  }

  return VARIABLE_SYNTAX_HINT;
}

export function containsVariableReference(value: string): boolean {
  VARIABLE_REFERENCE_PATTERN.lastIndex = 0;
  return VARIABLE_REFERENCE_PATTERN.test(value);
}

export function getNestedValue(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.').filter((part) => part.length > 0);
  let current: unknown = source;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return undefined;
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

export function setNestedValue(
  target: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const parts = path.split('.').filter((part) => part.length > 0);

  if (parts.length === 0) {
    return;
  }

  let current: Record<string, unknown> = target;

  for (let index = 0; index < parts.length - 1; index += 1) {
    const part = parts[index];
    const existing = current[part];

    if (
      existing === null ||
      existing === undefined ||
      typeof existing !== 'object' ||
      Array.isArray(existing)
    ) {
      current[part] = {};
    }

    current = current[part] as Record<string, unknown>;
  }

  current[parts[parts.length - 1]] = value;
}

export function isGlobalVariablePath(path: string): boolean {
  return path.startsWith('global.') || path === 'global';
}

export function parseStoredValue(value: unknown): unknown {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();

  if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
    const parsed = Number(trimmed);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return value;
}

export interface VariableScope {
  local: Record<string, unknown>;
  global: Record<string, unknown>;
}

export function resolveVariablePath(path: string, scope: VariableScope): unknown {
  const trimmedPath = path.trim();

  if (trimmedPath.length === 0) {
    return undefined;
  }

  if (isGlobalVariablePath(trimmedPath)) {
    const globalPath =
      trimmedPath === 'global' ? '' : trimmedPath.slice('global.'.length);
    return globalPath.length > 0 ? getNestedValue(scope.global, globalPath) : scope.global;
  }

  const localValue = getNestedValue(scope.local, trimmedPath);
  if (localValue !== undefined) {
    return localValue;
  }

  return undefined;
}

export function formatVariableValue(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (typeof record.name === 'string' && record.name.length > 0) {
      return record.name;
    }

    if (typeof record.id === 'string' && record.id.length > 0) {
      return record.id;
    }
  }

  return String(value);
}

export function resolveVariableReferences(template: string, scope: VariableScope): string {
  const maxIterations = 32;
  let result = template;

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    VARIABLE_REFERENCE_PATTERN.lastIndex = 0;
    let changed = false;

    result = result.replace(VARIABLE_REFERENCE_PATTERN, (match, rawPath: string) => {
      const value = resolveVariablePath(rawPath, scope);

      if (value === undefined || value === null) {
        return match;
      }

      changed = true;
      return formatVariableValue(value);
    });

    if (!changed) {
      break;
    }
  }

  return result;
}

export function setScopedVariable(
  scope: VariableScope,
  name: string,
  value: unknown,
): 'local' | 'global' {
  const trimmedName = name.trim();
  const parsedValue = parseStoredValue(value);

  if (isGlobalVariablePath(trimmedName)) {
    const globalPath =
      trimmedName === 'global' ? '' : trimmedName.slice('global.'.length);

    if (globalPath.length === 0) {
      if (typeof parsedValue === 'object' && parsedValue !== null && !Array.isArray(parsedValue)) {
        Object.assign(scope.global, parsedValue as Record<string, unknown>);
      }
    } else {
      setNestedValue(scope.global, globalPath, parsedValue);
    }

    return 'global';
  }

  setNestedValue(scope.local, trimmedName, parsedValue);
  return 'local';
}

export function createStoreAsField(): {
  id: string;
  label: string;
  type: 'text';
  description: string;
  required: true;
  defaultValue: string;
  supportsVariables: true;
} {
  return {
    id: 'storeAs',
    label: 'Store as',
    type: 'text',
    description: appendVariableHint('Name of the variable to save the result under.') ?? '',
    required: true,
    defaultValue: '',
    supportsVariables: true,
  };
}
