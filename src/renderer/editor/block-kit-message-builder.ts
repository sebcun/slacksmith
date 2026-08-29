import {
  BLOCK_KIT_BLOCK_LABELS,
  cloneBlockKitMessage,
  createEmptyBlock,
  getBlockKitMessageSummary,
  normalizeBlockKitMessage,
  type BlockKitEditorBlock,
  type BlockKitEditorBlockType,
  type BlockKitMessage,
  validateBlockKitMessage,
} from '../../shared/domain/block-kit.js';
import { createButton } from '../components/Button.js';

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function renderMrkdwnPreview(text: string): string {
  let html = escapeHtml(text);

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
  html = html.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/~([^~]+)~/g, '<s>$1</s>');
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  html = html.replace(/\n/g, '<br>');

  return html;
}

export function renderBlockKitPreview(message: BlockKitMessage, target: HTMLElement): void {
  target.replaceChildren();

  if (message.blocks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'block-kit-preview__empty';
    empty.textContent = 'Add an item to get started';
    target.appendChild(empty);
    return;
  }

  const stack = document.createElement('div');
  stack.className = 'block-kit-preview__stack';

  for (const block of message.blocks) {
    const blockEl = document.createElement('div');
    blockEl.className = `block-kit-preview__block block-kit-preview__block--${block.type}`;

    switch (block.type) {
      case 'header': {
        const header = document.createElement('div');
        header.className = 'block-kit-preview__header';
        header.textContent = block.text.trim() || 'Header text';
        blockEl.appendChild(header);
        break;
      }

      case 'markdown': {
        const section = document.createElement('div');
        section.className = 'block-kit-preview__markdown';
        section.innerHTML = renderMrkdwnPreview(
          block.text.trim() || 'Markdown text will appear here.',
        );
        blockEl.appendChild(section);
        break;
      }

      case 'divider': {
        const divider = document.createElement('hr');
        divider.className = 'block-kit-preview__divider';
        blockEl.appendChild(divider);
        break;
      }

      case 'image': {
        const figure = document.createElement('figure');
        figure.className = 'block-kit-preview__image-wrap';

        const placeholder = document.createElement('div');
        placeholder.className = 'block-kit-preview__image-placeholder';
        placeholder.textContent = block.imageUrl.trim()
          ? 'Image failed to load'
          : 'Image URL required';

        if (block.imageUrl.trim()) {
          const image = document.createElement('img');
          image.className = 'block-kit-preview__image';
          image.src = block.imageUrl.trim();
          image.alt = block.altText.trim() || 'Image preview';
          image.addEventListener('error', () => {
            image.hidden = true;
            placeholder.hidden = false;
          });
          placeholder.hidden = true;
          figure.appendChild(image);
        }

        figure.appendChild(placeholder);

        if (block.title.trim()) {
          const caption = document.createElement('figcaption');
          caption.className = 'block-kit-preview__image-title';
          caption.textContent = block.title.trim();
          figure.appendChild(caption);
        }

        blockEl.appendChild(figure);
        break;
      }

      case 'buttons': {
        const actions = document.createElement('div');
        actions.className = 'block-kit-preview__actions';

        for (const button of block.buttons) {
          const buttonEl = document.createElement('button');
          buttonEl.type = 'button';
          buttonEl.className = 'block-kit-preview__button';
          buttonEl.textContent = button.label.trim() || 'Button';
          buttonEl.disabled = true;
          buttonEl.title = button.actionId.trim()
            ? `action_id: ${button.actionId.trim()}`
            : 'Action ID required';
          actions.appendChild(buttonEl);
        }

        if (block.buttons.length === 0) {
          const hint = document.createElement('span');
          hint.className = 'block-kit-preview__hint';
          hint.textContent = 'Add at least one button.';
          actions.appendChild(hint);
        }

        blockEl.appendChild(actions);
        break;
      }

      default:
        break;
    }

    stack.appendChild(blockEl);
  }

  target.appendChild(stack);
}

export interface BlockKitMessageBuilderOptions {
  initialMessage: BlockKitMessage;
  onSave: (message: BlockKitMessage) => void;
}

export interface BlockKitMessageBuilderHandle {
  open: () => void;
  close: () => void;
}

function moveBlock(blocks: BlockKitEditorBlock[], index: number, direction: -1 | 1): void {
  const targetIndex = index + direction;
  if (targetIndex < 0 || targetIndex >= blocks.length) {
    return;
  }

  const current = blocks[index];
  blocks[index] = blocks[targetIndex];
  blocks[targetIndex] = current;
}

export function createBlockKitMessageBuilder(
  options: BlockKitMessageBuilderOptions,
): BlockKitMessageBuilderHandle {
  let draft = cloneBlockKitMessage(options.initialMessage);
  let isOpen = false;
  let errorMessage = '';

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;

  const modal = document.createElement('div');
  modal.className = 'modal block-kit-builder-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'presentation');

  const dialog = document.createElement('div');
  dialog.className = 'modal__dialog block-kit-builder-modal__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'block-kit-builder-title');

  const header = document.createElement('header');
  header.className = 'modal__header';

  const title = document.createElement('h2');
  title.className = 'modal__title';
  title.id = 'block-kit-builder-title';
  title.textContent = 'Edit Block Kit message';

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'modal__close';
  closeBtn.setAttribute('aria-label', 'Close dialog');
  closeBtn.textContent = '×';

  header.append(title, closeBtn);
  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal__body block-kit-builder-modal__body';
  dialog.appendChild(body);

  const layout = document.createElement('div');
  layout.className = 'block-kit-builder';

  const editorColumn = document.createElement('section');
  editorColumn.className = 'block-kit-builder__editor';
  editorColumn.setAttribute('aria-label', 'Message blocks');

  const editorHeader = document.createElement('div');
  editorHeader.className = 'block-kit-builder__column-header';
  editorHeader.innerHTML = '<h3>Blocks</h3><p>Build your message from top to bottom.</p>';
  editorColumn.appendChild(editorHeader);

  const blockList = document.createElement('div');
  blockList.className = 'block-kit-builder__block-list';
  editorColumn.appendChild(blockList);

  const previewColumn = document.createElement('section');
  previewColumn.className = 'block-kit-builder__preview';
  previewColumn.setAttribute('aria-label', 'Message preview');

  const previewHeader = document.createElement('div');
  previewHeader.className = 'block-kit-builder__column-header';
  previewHeader.innerHTML = '<h3>Preview</h3><p>Approximate Slack appearance.</p>';
  previewColumn.appendChild(previewHeader);

  const previewSurface = document.createElement('div');
  previewSurface.className = 'block-kit-preview';
  previewColumn.appendChild(previewSurface);

  layout.append(editorColumn, previewColumn);
  body.appendChild(layout);

  const toolbar = document.createElement('div');
  toolbar.className = 'block-kit-builder-modal__toolbar';

  const addBlockRow = document.createElement('div');
  addBlockRow.className = 'block-kit-builder__add-row';
  toolbar.appendChild(addBlockRow);

  const errorBanner = document.createElement('div');
  errorBanner.className = 'block-kit-builder__error';
  errorBanner.hidden = true;
  toolbar.appendChild(errorBanner);

  dialog.appendChild(toolbar);

  const footer = document.createElement('footer');
  footer.className = 'modal__footer block-kit-builder-modal__footer';

  const cancelButton = createButton({
    label: 'Cancel',
    variant: 'secondary',
    onClick: () => {
      close();
    },
  });

  const saveButton = createButton({
    label: 'Save message',
    variant: 'primary',
    onClick: () => {
      try {
        validateBlockKitMessage(draft);
        options.onSave(cloneBlockKitMessage(draft));
        close();
      } catch (error) {
        errorMessage = error instanceof Error ? error.message : 'Message is invalid.';
        renderError();
      }
    },
  });

  footer.append(cancelButton, saveButton);
  dialog.appendChild(footer);

  modal.appendChild(dialog);

  const wrapper = document.createElement('div');
  wrapper.append(backdrop, modal);

  function renderError(): void {
    if (!errorMessage) {
      errorBanner.hidden = true;
      errorBanner.textContent = '';
      return;
    }

    errorBanner.hidden = false;
    errorBanner.textContent = errorMessage;
  }

  function renderPreview(): void {
    if (draft.blocks.length === 0) {
      previewColumn.hidden = true;
      return;
    }

    previewColumn.hidden = false;
    renderBlockKitPreview(draft, previewSurface);
  }

  function renderStructure(): void {
    blockList.replaceChildren();

    if (draft.blocks.length === 0) {
      const emptyState = document.createElement('div');
      emptyState.className = 'block-kit-builder__empty-state';
      emptyState.textContent = 'Add an item to get started';
      blockList.appendChild(emptyState);
    } else {
      draft.blocks.forEach((block, index) => {
        blockList.appendChild(createBlockEditor(block, index));
      });
    }

    renderAddButtons();
    renderError();
    renderPreview();
  }

  function replaceDraft(next: BlockKitMessage): void {
    draft = next;
    errorMessage = '';
    renderStructure();
  }

  function patchBlock(index: number, updated: BlockKitEditorBlock): void {
    draft.blocks[index] = updated;
    errorMessage = '';
    renderPreview();
  }

  function updateDraft(next: BlockKitMessage): void {
    replaceDraft(next);
  }

  function render(): void {
    renderStructure();
  }

  function createBlockEditor(block: BlockKitEditorBlock, index: number): HTMLElement {
    const card = document.createElement('article');
    card.className = 'block-kit-builder__block-card';

    const cardHeader = document.createElement('div');
    cardHeader.className = 'block-kit-builder__block-card-header';

    const cardTitle = document.createElement('span');
    cardTitle.className = 'block-kit-builder__block-type';
    cardTitle.textContent = BLOCK_KIT_BLOCK_LABELS[block.type];
    cardHeader.appendChild(cardTitle);

    const cardActions = document.createElement('div');
    cardActions.className = 'block-kit-builder__block-card-actions';

    const moveUp = createButton({
      label: '↑',
      variant: 'ghost',
      size: 'sm',
      disabled: index === 0,
      onClick: () => {
        const next = cloneBlockKitMessage(draft);
        moveBlock(next.blocks, index, -1);
        updateDraft(next);
      },
    });
    moveUp.setAttribute('aria-label', 'Move block up');

    const moveDown = createButton({
      label: '↓',
      variant: 'ghost',
      size: 'sm',
      disabled: index === draft.blocks.length - 1,
      onClick: () => {
        const next = cloneBlockKitMessage(draft);
        moveBlock(next.blocks, index, 1);
        updateDraft(next);
      },
    });
    moveDown.setAttribute('aria-label', 'Move block down');

    const remove = createButton({
      label: 'Remove',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        const next = cloneBlockKitMessage(draft);
        next.blocks.splice(index, 1);
        updateDraft(next);
      },
    });

    cardActions.append(moveUp, moveDown, remove);
    cardHeader.appendChild(cardActions);
    card.appendChild(cardHeader);

    const fields = document.createElement('div');
    fields.className = 'block-kit-builder__fields';

    const updateBlock = (updated: BlockKitEditorBlock, restructure = false): void => {
      if (restructure) {
        const next = cloneBlockKitMessage(draft);
        next.blocks[index] = updated;
        replaceDraft(next);
        return;
      }

      patchBlock(index, updated);
    };

    if (block.type === 'header' || block.type === 'markdown') {
      const label = document.createElement('label');
      label.className = 'block-kit-builder__field-label';
      label.textContent = block.type === 'header' ? 'Header text' : 'Markdown text';

      const input =
        block.type === 'header'
          ? document.createElement('input')
          : document.createElement('textarea');

      input.className = 'field__control';
      if (input instanceof HTMLTextAreaElement) {
        input.rows = 4;
      }

      input.value = block.text;
      input.placeholder =
        block.type === 'header' ? 'Title shown prominently' : 'Supports *bold*, _italic_, and `code`';
      input.addEventListener('input', () => {
        updateBlock({ ...block, text: input.value });
      });

      label.appendChild(input);
      fields.appendChild(label);
    }

    if (block.type === 'image') {
      const urlLabel = document.createElement('label');
      urlLabel.className = 'block-kit-builder__field-label';
      urlLabel.textContent = 'Image URL';
      const urlInput = document.createElement('input');
      urlInput.className = 'field__control';
      urlInput.value = block.imageUrl;
      urlInput.placeholder = 'https://example.com/image.jpg';
      urlInput.addEventListener('input', () => {
        updateBlock({ ...block, imageUrl: urlInput.value });
      });
      urlLabel.appendChild(urlInput);
      fields.appendChild(urlLabel);

      const altLabel = document.createElement('label');
      altLabel.className = 'block-kit-builder__field-label';
      altLabel.textContent = 'Alt text';
      const altInput = document.createElement('input');
      altInput.className = 'field__control';
      altInput.value = block.altText;
      altInput.placeholder = 'Describe the image';
      altInput.addEventListener('input', () => {
        updateBlock({ ...block, altText: altInput.value });
      });
      altLabel.appendChild(altInput);
      fields.appendChild(altLabel);

      const titleLabel = document.createElement('label');
      titleLabel.className = 'block-kit-builder__field-label';
      titleLabel.textContent = 'Title (optional)';
      const titleInput = document.createElement('input');
      titleInput.className = 'field__control';
      titleInput.value = block.title;
      titleInput.addEventListener('input', () => {
        updateBlock({ ...block, title: titleInput.value });
      });
      titleLabel.appendChild(titleInput);
      fields.appendChild(titleLabel);
    }

    if (block.type === 'buttons') {
      const hint = document.createElement('p');
      hint.className = 'block-kit-builder__field-hint';
      hint.textContent =
        'Use the action ID in a Button clicked trigger. Up to 5 buttons total across the message.';
      fields.appendChild(hint);

      block.buttons.forEach((button, buttonIndex) => {
        const row = document.createElement('div');
        row.className = 'block-kit-builder__button-row';

        const labelInput = document.createElement('input');
        labelInput.className = 'field__control';
        labelInput.value = button.label;
        labelInput.placeholder = 'Button label';
        labelInput.addEventListener('input', () => {
          const nextButtons = block.buttons.map((entry, entryIndex) =>
            entryIndex === buttonIndex ? { ...entry, label: labelInput.value } : entry,
          );
          updateBlock({ ...block, buttons: nextButtons });
        });

        const actionInput = document.createElement('input');
        actionInput.className = 'field__control';
        actionInput.value = button.actionId;
        actionInput.placeholder = 'action_id';
        actionInput.addEventListener('input', () => {
          const nextButtons = block.buttons.map((entry, entryIndex) =>
            entryIndex === buttonIndex ? { ...entry, actionId: actionInput.value } : entry,
          );
          updateBlock({ ...block, buttons: nextButtons });
        });

        const removeButton = createButton({
          label: 'Remove',
          variant: 'ghost',
          size: 'sm',
          disabled: block.buttons.length === 1,
          onClick: () => {
            const nextButtons = block.buttons.filter((_, entryIndex) => entryIndex !== buttonIndex);
            updateBlock({ ...block, buttons: nextButtons }, true);
          },
        });

        row.append(labelInput, actionInput, removeButton);
        fields.appendChild(row);
      });

      const addButton = createButton({
        label: 'Add button',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          updateBlock(
            {
              ...block,
              buttons: [...block.buttons, { label: 'New button', actionId: 'new_action' }],
            },
            true,
          );
        },
      });
      addButton.classList.add('block-kit-builder__add-button');
      fields.appendChild(addButton);
    }

    if (block.type === 'divider') {
      const hint = document.createElement('p');
      hint.className = 'block-kit-builder__field-hint';
      hint.textContent = 'Adds a horizontal line between sections.';
      fields.appendChild(hint);
    }

    card.appendChild(fields);
    return card;
  }

  function renderAddButtons(): void {
    addBlockRow.replaceChildren();

    const label = document.createElement('span');
    label.className = 'block-kit-builder__add-label';
    label.textContent = 'Add block';
    addBlockRow.appendChild(label);

    const buttonsWrap = document.createElement('div');
    buttonsWrap.className = 'block-kit-builder__add-buttons';

    const blockTypes: BlockKitEditorBlockType[] = [
      'header',
      'markdown',
      'divider',
      'image',
      'buttons',
    ];

    for (const blockType of blockTypes) {
      const addBtn = createButton({
        label: BLOCK_KIT_BLOCK_LABELS[blockType],
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          const next = cloneBlockKitMessage(draft);
          next.blocks.push(createEmptyBlock(blockType));
          updateDraft(next);
        },
      });
      buttonsWrap.appendChild(addBtn);
    }

    addBlockRow.appendChild(buttonsWrap);
  }

  function open(): void {
    if (isOpen) {
      return;
    }

    draft = cloneBlockKitMessage(options.initialMessage);
    errorMessage = '';
    render();

    isOpen = true;
    document.body.appendChild(wrapper);
    backdrop.hidden = false;
    modal.hidden = false;

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-backdrop--visible');
      modal.classList.add('modal--open');
    });
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

  closeBtn.addEventListener('click', close);
  backdrop.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      close();
    }
  });

  return { open, close };
}

export function createBlockKitMessageFieldControl(options: {
  nodeId: string;
  value: unknown;
  onChange: (value: BlockKitMessage) => void;
}): HTMLElement {
  const { nodeId, value, onChange } = options;
  let currentMessage = normalizeBlockKitMessage(value);

  const wrapper = document.createElement('div');
  wrapper.className = 'block-kit-message-field';

  const label = document.createElement('span');
  label.className = 'field__label';
  label.textContent = 'Message';
  wrapper.appendChild(label);

  const summary = document.createElement('p');
  summary.className = 'block-kit-message-field__summary';
  wrapper.appendChild(summary);

  const preview = document.createElement('div');
  preview.className = 'block-kit-preview block-kit-preview--compact';
  wrapper.appendChild(preview);

  const editButton = createButton({
    label: 'Edit message',
    variant: 'secondary',
    size: 'sm',
    onClick: () => {
      createBlockKitMessageBuilder({
        initialMessage: currentMessage,
        onSave: (nextMessage) => {
          currentMessage = nextMessage;
          onChange(nextMessage);
          renderSummary();
        },
      }).open();
    },
  });
  editButton.classList.add('block-kit-message-field__edit');
  wrapper.appendChild(editButton);

  const hint = document.createElement('span');
  hint.className = 'field__hint';
  hint.textContent =
    'Build headers, markdown, dividers, images, and buttons. Use Button clicked triggers with matching action IDs.';
  wrapper.appendChild(hint);

  function renderSummary(): void {
    summary.textContent = getBlockKitMessageSummary(currentMessage);
    renderBlockKitPreview(currentMessage, preview);
  }

  renderSummary();
  wrapper.dataset.nodeId = nodeId;

  return wrapper;
}
