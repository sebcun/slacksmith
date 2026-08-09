import { createInput, createModal, type ModalHandle } from '../components/index.js';
import type { BotProject } from '../../shared/ipc/project-contracts.js';

const ILLEGAL_NAME_CHARACTERS = /[<>:"/\\|?*\u0000-\u001f]/;

function validateBotName(
  name: string,
  existingNames: readonly string[],
): string | undefined {
  const trimmedName = name.trim();

  if (trimmedName.length === 0) {
    return 'Project name is required.';
  }

  if (ILLEGAL_NAME_CHARACTERS.test(trimmedName)) {
    return 'Project name contains characters that are not allowed.';
  }

  const normalizedName = trimmedName.toLowerCase();
  const hasDuplicate = existingNames.some(
    (existingName) => existingName.trim().toLowerCase() === normalizedName,
  );

  if (hasDuplicate) {
    return 'A project with this name already exists.';
  }

  return undefined;
}

function getProjectCreationErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to create the bot project. Please try again.';
}

export interface NewBotModalOptions {
  existingProjectNames: readonly string[];
  onCreated: (project: BotProject) => void | Promise<void>;
}

export function createNewBotModal(options: NewBotModalOptions): ModalHandle {
  const { existingProjectNames, onCreated } = options;

  let nameValue = '';
  let nameError: string | undefined;
  let isSubmitting = false;

  const fieldHost = document.createElement('div');
  fieldHost.className = 'new-bot-modal__field';

  function renderNameField(): void {
    fieldHost.replaceChildren(
      createInput({
        id: 'new-bot-name',
        label: 'Bot name',
        value: nameValue,
        placeholder: 'e.g. Welcome Bot',
        hint: nameError ? undefined : 'This name appears in your project list.',
        error: nameError,
        disabled: isSubmitting,
        onInput: (value) => {
          nameValue = value;
          if (nameError) {
            nameError = undefined;
            renderNameField();
          }
        },
      }),
    );

    const input = fieldHost.querySelector('input');
    input?.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !isSubmitting) {
        event.preventDefault();
        void handleSubmit();
      }
    });
  }

  renderNameField();

  const modal = createModal({
    title: 'New bot',
    content: fieldHost,
    confirmLabel: 'Create & open',
    cancelLabel: 'Cancel',
    closeOnBackdrop: !isSubmitting,
    onCancel: () => {
      if (isSubmitting) {
        return;
      }
    },
    onConfirm: () => handleSubmit(),
  });

  async function handleSubmit(): Promise<boolean> {
    if (isSubmitting) {
      return false;
    }

    nameError = validateBotName(nameValue, existingProjectNames);
    renderNameField();

    if (nameError) {
      fieldHost.querySelector('input')?.focus();
      return false;
    }

    isSubmitting = true;
    renderNameField();

    try {
      const project = await window.electronAPI.createProject({ name: nameValue.trim() });
      await window.electronAPI.openProject({ kind: 'id', id: project.id });
      await onCreated(project);
      return true;
    } catch (error) {
      isSubmitting = false;
      nameError = getProjectCreationErrorMessage(error);
      renderNameField();
      fieldHost.querySelector('input')?.focus();
      return false;
    }
  }

  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      nameValue = '';
      nameError = undefined;
      isSubmitting = false;
      renderNameField();
      originalOpen();
      requestAnimationFrame(() => {
        fieldHost.querySelector('input')?.focus();
      });
    },
  };
}

export function openNewBotModal(options: NewBotModalOptions): void {
  createNewBotModal(options).open();
}
