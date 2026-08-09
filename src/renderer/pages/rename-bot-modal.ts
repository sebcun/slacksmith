import { createInput, createModal, type ModalHandle } from '../components/index.js';
import type { BotProject } from '../../shared/ipc/project-contracts.js';
import {
  getProjectActionErrorMessage,
  getProjectNameFieldError,
} from './project-name-validation.js';

export interface RenameBotModalOptions {
  project: BotProject;
  existingProjectNames: readonly string[];
  onRenamed: (project: BotProject) => void | Promise<void>;
}

export function createRenameBotModal(options: RenameBotModalOptions): ModalHandle {
  const { project, existingProjectNames, onRenamed } = options;

  let nameValue = project.name;
  let nameError: string | undefined;
  let isSubmitting = false;

  const fieldHost = document.createElement('div');
  fieldHost.className = 'project-action-modal__field';

  function renderNameField(): void {
    fieldHost.replaceChildren(
      createInput({
        id: 'rename-bot-name',
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
    title: 'Rename bot',
    content: fieldHost,
    confirmLabel: 'Save',
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

    nameError = getProjectNameFieldError(nameValue, existingProjectNames, project.name);
    renderNameField();

    if (nameError) {
      fieldHost.querySelector('input')?.focus();
      return false;
    }

    isSubmitting = true;
    renderNameField();

    try {
      const updatedProject = await window.electronAPI.renameProject({
        id: project.id,
        name: nameValue.trim(),
      });
      await onRenamed(updatedProject);
      return true;
    } catch (error) {
      isSubmitting = false;
      nameError = getProjectActionErrorMessage(error, 'Unable to rename the bot. Please try again.');
      renderNameField();
      fieldHost.querySelector('input')?.focus();
      return false;
    }
  }

  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      nameValue = project.name;
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

export function openRenameBotModal(options: RenameBotModalOptions): void {
  createRenameBotModal(options).open();
}
