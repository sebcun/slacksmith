import { createModal, type ModalHandle } from '../components/index.js';
import type { BotProject } from '../../shared/ipc/project-contracts.js';
import { getProjectActionErrorMessage } from './project-name-validation.js';

export interface DeleteBotModalOptions {
  project: BotProject;
  onDeleted: () => void | Promise<void>;
}

export function createDeleteBotModal(options: DeleteBotModalOptions): ModalHandle {
  const { project, onDeleted } = options;

  let isSubmitting = false;
  let errorMessage: string | undefined;

  const content = document.createElement('div');
  content.className = 'project-action-modal__delete';

  const message = document.createElement('p');
  message.className = 'project-action-modal__delete-message';
  content.appendChild(message);

  const error = document.createElement('p');
  error.className = 'project-action-modal__delete-error';
  error.hidden = true;
  content.appendChild(error);

  function renderContent(): void {
    message.textContent = `Delete "${project.name}"? This removes the project folder and cannot be undone.`;

    if (errorMessage) {
      error.textContent = errorMessage;
      error.hidden = false;
    } else {
      error.hidden = true;
    }
  }

  renderContent();

  const modal = createModal({
    title: 'Delete bot',
    content,
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    closeOnBackdrop: !isSubmitting,
    onCancel: () => {
      if (isSubmitting) {
        return;
      }
    },
    onConfirm: () => handleSubmit(),
  });

  const confirmButton = modal.element.querySelector('.modal__footer .btn--primary');
  confirmButton?.classList.replace('btn--primary', 'btn--danger');

  async function handleSubmit(): Promise<boolean> {
    if (isSubmitting) {
      return false;
    }

    isSubmitting = true;
    errorMessage = undefined;
    renderContent();

    try {
      await window.electronAPI.deleteProject({ id: project.id });
      await onDeleted();
      return true;
    } catch (submitError) {
      isSubmitting = false;
      errorMessage = getProjectActionErrorMessage(
        submitError,
        'Unable to delete the bot. Please try again.',
      );
      renderContent();
      return false;
    }
  }

  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      isSubmitting = false;
      errorMessage = undefined;
      renderContent();
      originalOpen();
    },
  };
}

export function openDeleteBotModal(options: DeleteBotModalOptions): void {
  createDeleteBotModal(options).open();
}
