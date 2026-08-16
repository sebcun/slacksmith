/**
 * Flow-scoped variables are referenced in text fields using ${variableName}.
 * Data lookup nodes store results under the name given in their "Store as" field.
 */

export const VARIABLE_REFERENCE_PATTERN = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

export const VARIABLE_SYNTAX_HINT =
  'Use ${variableName} to insert a saved variable.';

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

export function resolveVariableReferences(
  template: string,
  variables: Record<string, unknown>,
): string {
  return template.replace(VARIABLE_REFERENCE_PATTERN, (match, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null) {
      return match;
    }

    return String(value);
  });
}

export function createStoreAsField(): {
  id: string;
  label: string;
  type: 'text';
  description: string;
  required: true;
  defaultValue: string;
} {
  return {
    id: 'storeAs',
    label: 'Store as',
    type: 'text',
    description: 'Name of the variable to save the lookup result under.',
    required: true,
    defaultValue: '',
  };
}
