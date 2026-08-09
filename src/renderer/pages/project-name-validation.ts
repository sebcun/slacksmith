import {
  isDuplicateProjectName,
  validateProjectName,
} from '../../shared/domain/project-name-validation.js';

export function getProjectNameFieldError(
  name: string,
  existingNames: readonly string[],
  excludedName?: string,
): string | undefined {
  const validation = validateProjectName(name);

  if (!validation.ok) {
    return validation.message;
  }

  const normalizedExcludedName = excludedName?.trim().toLowerCase();

  if (
    normalizedExcludedName !== undefined &&
    validation.name.toLowerCase() === normalizedExcludedName
  ) {
    return undefined;
  }

  if (isDuplicateProjectName(validation.name, existingNames)) {
    return 'A project with this name already exists.';
  }

  return undefined;
}

export function getProjectActionErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}
