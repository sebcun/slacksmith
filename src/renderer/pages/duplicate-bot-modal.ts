import { createInput, createModal, type ModalHandle } from '../components/index.js';
import type { BotProject } from '../../shared/ipc/project-contracts.js';
import {
  getProjectActionErrorMessage,
  getProjectNameFieldError,
} from './project-name-validation.js';

function getDefaultDuplicateName(projectName: string): string {
  return `Copy of ${projectName}`;
}

export interface DuplicateBotModalOptions {
  project: BotProject;
  existingProjectNames: readonly string[];
  onDuplicated: (project: BotProject) => void | Promise<void>;
}

export function createDuplicateBotModal(options: DuplicateBotModalOptions): ModalHandle {
  const { project, existingProjectNames, onDuplicated } = options;

  let nameValue = getDefaultDuplicateName(project.name);
  let nameError: string | undefined;
  let isSubmitting = false;

  const fieldHost = document.createElement('div');
  fieldHost.className = 'project-action-modal__field';

  function renderNameField(): void {
    fieldHost.replaceChildren(
      createInput({
        id: 'duplicate-bot-name',
        label: 'New bot name',
        value: nameValue,
        placeholder: 'e.g. Welcome Bot copy',
        hint: nameError ? undefined : 'A new project folder will be created with this name.',
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
    title: 'Duplicate bot',
    content: fieldHost,
    confirmLabel: 'Duplicate',
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

    nameError = getProjectNameFieldError(nameValue, existingProjectNames);
    renderNameField();

    if (nameError) {
      fieldHost.querySelector('input')?.focus();
      return false;
    }

    isSubmitting = true;
    renderNameField();

    try {
      const duplicatedProject = await window.electronAPI.duplicateProject({
        id: project.id,
        name: nameValue.trim(),
      });
      await onDuplicated(duplicatedProject);
      return true;
    } catch (error) {
      isSubmitting = false;
      nameError = getProjectActionErrorMessage(
        error,
        'Unable to duplicate the bot. Please try again.',
      );
      renderNameField();
      fieldHost.querySelector('input')?.focus();
      return false;
    }
  }

  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      nameValue = getDefaultDuplicateName(project.name);
      nameError = undefined;
      isSubmitting = false;
      renderNameField();
      originalOpen();
      requestAnimationFrame(() => {
        const input = fieldHost.querySelector('input');
        input?.focus();
        input?.select();
      });
    },
  };
}

export function openDuplicateBotModal(options: DuplicateBotModalOptions): void {
  createDuplicateBotModal(options).open();
}
