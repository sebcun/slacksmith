import { createButton } from './Button.js';

export interface ModalOptions {
  title: string;
  content: HTMLElement | string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm?: () => boolean | void | Promise<boolean | void>;
  onCancel?: () => boolean | void | Promise<boolean | void>;
  closeOnBackdrop?: boolean;
}

export interface ModalHandle {
  element: HTMLElement;
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export function createModal(options: ModalOptions): ModalHandle {
  const {
    title,
    content,
    confirmLabel = 'Confirm',
    cancelLabel = 'Cancel',
    onConfirm,
    onCancel,
    closeOnBackdrop = true,
  } = options;

  let isOpen = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.hidden = true;
  modal.setAttribute('role', 'presentation');

  const dialog = document.createElement('div');
  dialog.className = 'modal__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'modal-title');

  const header = document.createElement('header');
  header.className = 'modal__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal__title';
  titleEl.id = 'modal-title';
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal__close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '×';
  header.appendChild(closeBtn);

  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal__body';

  if (typeof content === 'string') {
    body.textContent = content;
  } else {
    body.appendChild(content);
  }

  dialog.appendChild(body);

  const footer = document.createElement('footer');
  footer.className = 'modal__footer';

  const cancelButton = createButton({
    label: cancelLabel,
    variant: 'secondary',
    onClick: () => {
      handleCancel();
    },
  });

  const confirmButton = createButton({
    label: confirmLabel,
    variant: 'primary',
    onClick: () => {
      void handleConfirm();
    },
  });

  footer.appendChild(cancelButton);
  footer.appendChild(confirmButton);
  dialog.appendChild(footer);

  modal.appendChild(dialog);

  const wrapper = document.createElement('div');
  wrapper.appendChild(backdrop);
  wrapper.appendChild(modal);

  function handleCancel(): void {
    void (async () => {
      const shouldClose = await onCancel?.();
      if (shouldClose !== false) {
        close();
      }
    })();
  }

  async function handleConfirm(): Promise<void> {
    const shouldClose = await onConfirm?.();
    if (shouldClose !== false) {
      close();
    }
  }

  function open(): void {
    if (isOpen) {
      return;
    }

    isOpen = true;
    document.body.appendChild(wrapper);
    backdrop.hidden = false;
    modal.hidden = false;

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-backdrop--visible');
      modal.classList.add('modal--open');
    });

    confirmButton.focus();
  }

  function close(): void {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    backdrop.classList.remove('modal-backdrop--visible');
    modal.classList.remove('modal--open');

    window.setTimeout(() => {
      wrapper.remove();
      backdrop.hidden = true;
      modal.hidden = true;
    }, 200);
  }

  closeBtn.addEventListener('click', handleCancel);

  backdrop.addEventListener('click', () => {
    if (closeOnBackdrop) {
      handleCancel();
    }
  });

  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      handleCancel();
    }
  });

  return {
    element: wrapper,
    open,
    close,
    isOpen: () => isOpen,
  };
}
