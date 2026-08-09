import { createButton, type ButtonOptions } from './Button.js';

export interface EmptyStateOptions {
  title: string;
  description: string;
  icon?: string;
  action?: ButtonOptions;
}

export function createEmptyState(options: EmptyStateOptions): HTMLElement {
  const { title, description, icon = '◇', action } = options;

  const emptyState = document.createElement('div');
  emptyState.className = 'empty-state';

  const iconEl = document.createElement('div');
  iconEl.className = 'empty-state__icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.textContent = icon;
  emptyState.appendChild(iconEl);

  const titleEl = document.createElement('h3');
  titleEl.className = 'empty-state__title';
  titleEl.textContent = title;
  emptyState.appendChild(titleEl);

  const descriptionEl = document.createElement('p');
  descriptionEl.className = 'empty-state__description';
  descriptionEl.textContent = description;
  emptyState.appendChild(descriptionEl);

  if (action) {
    const actionWrap = document.createElement('div');
    actionWrap.className = 'empty-state__action';
    actionWrap.appendChild(createButton(action));
    emptyState.appendChild(actionWrap);
  }

  return emptyState;
}
