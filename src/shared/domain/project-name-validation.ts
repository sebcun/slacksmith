const ILLEGAL_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;

export interface ProjectNameValidationSuccess {
  ok: true;
  name: string;
}

export interface ProjectNameValidationFailure {
  ok: false;
  message: string;
}

export type ProjectNameValidationResult =
  | ProjectNameValidationSuccess
  | ProjectNameValidationFailure;

export function validateProjectName(name: string): ProjectNameValidationResult {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return { ok: false, message: 'Project name is required.' };
  }

  if (ILLEGAL_NAME_CHARACTERS.test(trimmedName)) {
    return {
      ok: false,
      message: 'Project name contains characters that are not allowed.',
    };
  }

  return { ok: true, name: trimmedName };
}

export function isDuplicateProjectName(
  name: string,
  existingNames: readonly string[],
): boolean {
  const normalizedName = name.trim().toLowerCase();
  return existingNames.some(
    (existingName) => existingName.trim().toLowerCase() === normalizedName,
  );
}
