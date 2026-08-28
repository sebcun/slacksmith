import { createButton } from '../components/index.js';
import {
  ensureUniqueCanvasName,
  generateDefaultCanvasName,
  MAX_PROJECT_CANVASES,
  type FlowCanvas,
} from '../../shared/domain/flow-graph.js';
import { createModal } from '../components/Modal.js';

export interface CanvasTabBarOptions {
  canvases: FlowCanvas[];
  activeCanvasId: string;
  onSelect: (canvasId: string) => void;
  onCreate: () => void;
  onRename: (canvasId: string, name: string) => void;
  onDuplicate: (canvasId: string) => void;
  onDelete: (canvasId: string) => void;
}

export interface CanvasTabBarHandle {
  element: HTMLElement;
  update: (canvases: FlowCanvas[], activeCanvasId: string) => void;
}

function canvasHasComponents(canvas: FlowCanvas): boolean {
  return canvas.graph.nodes.length > 0;
}

export function createCanvasTabBar(options: CanvasTabBarOptions): CanvasTabBarHandle {
  const bar = document.createElement('div');
  bar.className = 'canvas-tab-bar';
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', 'Canvas tabs');

  const scrollLeftButton = createButton({
    label: '‹',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      tabsScroller.scrollBy({ left: -160, behavior: 'smooth' });
    },
  });
  scrollLeftButton.classList.add('canvas-tab-bar__scroll-btn', 'canvas-tab-bar__scroll-btn--left');
  scrollLeftButton.setAttribute('aria-label', 'Scroll tabs left');
  scrollLeftButton.hidden = true;

  const tabsScroller = document.createElement('div');
  tabsScroller.className = 'canvas-tab-bar__scroller';

  const tabsTrack = document.createElement('div');
  tabsTrack.className = 'canvas-tab-bar__track';
  tabsScroller.appendChild(tabsTrack);

  const scrollRightButton = createButton({
    label: '›',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      tabsScroller.scrollBy({ left: 160, behavior: 'smooth' });
    },
  });
  scrollRightButton.classList.add('canvas-tab-bar__scroll-btn', 'canvas-tab-bar__scroll-btn--right');
  scrollRightButton.setAttribute('aria-label', 'Scroll tabs right');
  scrollRightButton.hidden = true;

  const addButton = createButton({
    label: '+',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      options.onCreate();
    },
  });
  addButton.classList.add('canvas-tab-bar__add-btn');
  addButton.setAttribute('aria-label', 'Create new canvas');

  const maxHint = document.createElement('span');
  maxHint.className = 'canvas-tab-bar__max-hint';
  maxHint.textContent = `Maximum of ${MAX_PROJECT_CANVASES} canvases reached`;
  maxHint.hidden = true;

  const scrollContainer = document.createElement('div');
  scrollContainer.className = 'canvas-tab-bar__scroll-container';
  scrollContainer.append(scrollLeftButton, tabsScroller, scrollRightButton);

  const actions = document.createElement('div');
  actions.className = 'canvas-tab-bar__actions';
  actions.append(addButton, maxHint);

  bar.append(scrollContainer, actions);

  let contextMenu: HTMLElement | null = null;
  let renamingCanvasId: string | null = null;

  function closeContextMenu(): void {
    if (contextMenu) {
      contextMenu.remove();
      contextMenu = null;
    }
  }

  function updateScrollControls(): void {
    const overflow = tabsScroller.scrollWidth > tabsScroller.clientWidth + 1;
    scrollLeftButton.hidden = !overflow;
    scrollRightButton.hidden = !overflow;

    if (!overflow) {
      return;
    }

    scrollLeftButton.disabled = tabsScroller.scrollLeft <= 0;
    scrollRightButton.disabled =
      tabsScroller.scrollLeft + tabsScroller.clientWidth >= tabsScroller.scrollWidth - 1;
  }

  function scrollActiveTabIntoView(canvasId: string): void {
    const tab = tabsTrack.querySelector<HTMLElement>(`[data-canvas-id="${canvasId}"]`);
    tab?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }

  function startRename(tab: HTMLButtonElement, canvas: FlowCanvas): void {
    if (renamingCanvasId !== null) {
      return;
    }

    renamingCanvasId = canvas.id;
    tab.replaceChildren();

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'canvas-tab-bar__rename-input';
    input.value = canvas.name;
    input.setAttribute('aria-label', 'Canvas name');
    tab.appendChild(input);

    requestAnimationFrame(() => {
      input.focus();
      input.select();
    });

    function finishRename(confirm: boolean): void {
      if (renamingCanvasId !== canvas.id) {
        return;
      }

      renamingCanvasId = null;

      if (confirm) {
        const trimmed = input.value.trim();
        if (trimmed.length > 0) {
          const uniqueName = ensureUniqueCanvasName(trimmed, options.canvases, canvas.id);
          options.onRename(canvas.id, uniqueName);
          return;
        }
      }

      renderTabs(options.canvases, options.activeCanvasId);
    }

    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        finishRename(true);
      } else if (event.key === 'Escape') {
        event.preventDefault();
        finishRename(false);
      }
    });

    input.addEventListener('blur', () => {
      finishRename(true);
    });
  }

  function openContextMenu(event: MouseEvent, canvas: FlowCanvas): void {
    event.preventDefault();
    closeContextMenu();

    const menu = document.createElement('div');
    menu.className = 'canvas-tab-bar__context-menu';
    menu.setAttribute('role', 'menu');

    const renameItem = document.createElement('button');
    renameItem.type = 'button';
    renameItem.className = 'canvas-tab-bar__context-menu-item';
    renameItem.textContent = 'Rename';
    renameItem.setAttribute('role', 'menuitem');
    renameItem.addEventListener('click', () => {
      closeContextMenu();
      const tab = tabsTrack.querySelector<HTMLButtonElement>(`[data-canvas-id="${canvas.id}"]`);
      if (tab) {
        startRename(tab, canvas);
      }
    });

    const duplicateItem = document.createElement('button');
    duplicateItem.type = 'button';
    duplicateItem.className = 'canvas-tab-bar__context-menu-item';
    duplicateItem.textContent = 'Duplicate';
    duplicateItem.setAttribute('role', 'menuitem');
    duplicateItem.disabled = options.canvases.length >= MAX_PROJECT_CANVASES;
    duplicateItem.addEventListener('click', () => {
      closeContextMenu();
      options.onDuplicate(canvas.id);
    });

    const deleteItem = document.createElement('button');
    deleteItem.type = 'button';
    deleteItem.className = 'canvas-tab-bar__context-menu-item canvas-tab-bar__context-menu-item--danger';
    deleteItem.textContent = 'Delete';
    deleteItem.setAttribute('role', 'menuitem');
    deleteItem.disabled = options.canvases.length <= 1;
    deleteItem.addEventListener('click', () => {
      closeContextMenu();
      confirmDelete(canvas);
    });

    menu.append(renameItem, duplicateItem, deleteItem);
    document.body.appendChild(menu);

    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;

    contextMenu = menu;
  }

  function confirmDelete(canvas: FlowCanvas): void {
    const performDelete = (): void => {
      options.onDelete(canvas.id);
    };

    if (!canvasHasComponents(canvas)) {
      performDelete();
      return;
    }

    const modal = createModal({
      title: 'Delete canvas',
      content: `Delete "${canvas.name}"? This canvas contains components and cannot be recovered.`,
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      onConfirm: () => {
        performDelete();
        return true;
      },
    });

    const confirmButton = modal.element.querySelector('.modal__footer .btn--primary');
    confirmButton?.classList.replace('btn--primary', 'btn--danger');
    modal.open();
  }

  function renderTabs(canvases: FlowCanvas[], activeCanvasId: string): void {
    tabsTrack.replaceChildren();

    for (const canvas of canvases) {
      const tab = document.createElement('button');
      tab.type = 'button';
      tab.className = 'canvas-tab-bar__tab';
      tab.dataset.canvasId = canvas.id;
      tab.setAttribute('role', 'tab');
      tab.setAttribute('aria-selected', canvas.id === activeCanvasId ? 'true' : 'false');
      tab.tabIndex = canvas.id === activeCanvasId ? 0 : -1;

      if (canvas.id === activeCanvasId) {
        tab.classList.add('canvas-tab-bar__tab--active');
      }

      const label = document.createElement('span');
      label.className = 'canvas-tab-bar__tab-label';
      label.textContent = canvas.name;
      tab.appendChild(label);

      tab.addEventListener('click', () => {
        if (renamingCanvasId !== null) {
          return;
        }
        options.onSelect(canvas.id);
      });

      tab.addEventListener('dblclick', (event) => {
        event.preventDefault();
        startRename(tab, canvas);
      });

      tab.addEventListener('contextmenu', (event) => {
        openContextMenu(event, canvas);
      });

      tabsTrack.appendChild(tab);
    }

    const atMax = canvases.length >= MAX_PROJECT_CANVASES;
    addButton.disabled = atMax;
    addButton.hidden = atMax;
    maxHint.hidden = !atMax;

    requestAnimationFrame(() => {
      updateScrollControls();
      scrollActiveTabIntoView(activeCanvasId);
    });
  }

  tabsScroller.addEventListener('scroll', updateScrollControls, { passive: true });

  document.addEventListener('click', (event) => {
    if (contextMenu && !contextMenu.contains(event.target as Node)) {
      closeContextMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeContextMenu();
    }
  });

  window.addEventListener('resize', updateScrollControls);

  renderTabs(options.canvases, options.activeCanvasId);

  return {
    element: bar,
    update(canvases, activeCanvasId) {
      options.canvases = canvases;
      options.activeCanvasId = activeCanvasId;
      renderTabs(canvases, activeCanvasId);
    },
  };
}

export { generateDefaultCanvasName };
