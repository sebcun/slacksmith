import {
  createBadge,
  createButton,
  createSidebar,
  createTopBar,
  setSidebarActiveItem,
} from '../components/index.js';
import {
  FlowCanvasEngine,
  serializeComponentTemplate,
} from '../editor/flow-canvas-engine.js';
import type { BotRuntimeStatus } from '../../shared/domain/bot-project.js';
import type { FlowNode } from '../../shared/domain/flow-graph.js';

const STATUS_BADGE: Record<
  BotRuntimeStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }
> = {
  inactive: { label: 'Inactive', variant: 'default' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
};

interface ComponentLibraryItem {
  id: string;
  name: string;
  description: string;
}

interface ComponentLibraryCategory {
  id: string;
  label: string;
  items: ComponentLibraryItem[];
}

const COMPONENT_LIBRARY: ComponentLibraryCategory[] = [
  {
    id: 'triggers',
    label: 'Triggers',
    items: [
      { id: 'message-received', name: 'Message received', description: 'When a message is posted' },
      { id: 'slash-command', name: 'Slash command', description: 'When a slash command runs' },
      { id: 'app-mention', name: 'App mention', description: 'When the bot is @mentioned' },
    ],
  },
  {
    id: 'conditions',
    label: 'Conditions',
    items: [
      { id: 'if-else', name: 'If / else', description: 'Branch based on a condition' },
      { id: 'compare-value', name: 'Compare value', description: 'Check a value against a rule' },
      { id: 'channel-match', name: 'Channel match', description: 'Match a specific channel' },
    ],
  },
  {
    id: 'actions',
    label: 'Actions',
    items: [
      { id: 'send-message', name: 'Send message', description: 'Post a message to a channel' },
      { id: 'add-reaction', name: 'Add reaction', description: 'React to a message' },
      { id: 'create-channel', name: 'Create channel', description: 'Create a new channel' },
    ],
  },
  {
    id: 'data',
    label: 'Data',
    items: [
      { id: 'get-user', name: 'Get user', description: 'Look up a Slack user' },
      { id: 'store-variable', name: 'Store variable', description: 'Save a value for later' },
      { id: 'read-variable', name: 'Read variable', description: 'Load a saved value' },
    ],
  },
  {
    id: 'utilities',
    label: 'Utilities',
    items: [
      { id: 'delay', name: 'Delay', description: 'Wait before continuing' },
      { id: 'log', name: 'Log', description: 'Write to the debug log' },
      { id: 'stop-flow', name: 'Stop flow', description: 'End execution here' },
    ],
  },
];

const DEFAULT_CATEGORY_ID = COMPONENT_LIBRARY[0]?.id ?? 'triggers';

function createComponentLibraryItem(
  item: ComponentLibraryItem,
  categoryId: string,
  onAdd: (categoryId: string, item: ComponentLibraryItem) => void,
): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'component-library__item';
  element.setAttribute('aria-label', `${item.name}: ${item.description}`);
  element.draggable = true;

  const name = document.createElement('span');
  name.className = 'component-library__item-name';
  name.textContent = item.name;
  element.appendChild(name);

  const description = document.createElement('span');
  description.className = 'component-library__item-description';
  description.textContent = item.description;
  element.appendChild(description);

  element.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(
      'application/x-slacksmith-component',
      serializeComponentTemplate({
        typeId: item.id,
        name: item.name,
        categoryId,
      }),
    );
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  });

  element.addEventListener('click', () => {
    onAdd(categoryId, item);
  });

  return element;
}

function createComponentLibraryPanel(
  onAdd: (categoryId: string, item: ComponentLibraryItem) => void,
): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'editor-page__library';
  panel.setAttribute('aria-label', 'Component library');

  const listHost = document.createElement('div');
  listHost.className = 'component-library__list-host';

  const sidebar = createSidebar({
    title: 'Components',
    items: COMPONENT_LIBRARY.map((category) => ({
      id: category.id,
      label: category.label,
    })),
    activeId: DEFAULT_CATEGORY_ID,
    onSelect: (categoryId) => {
      showCategory(categoryId);
    },
    content: listHost,
  });

  function showCategory(categoryId: string): void {
    setSidebarActiveItem(sidebar, categoryId);

    const category = COMPONENT_LIBRARY.find((entry) => entry.id === categoryId);
    listHost.replaceChildren();

    if (!category) {
      return;
    }

    const list = document.createElement('div');
    list.className = 'component-library__list';
    list.setAttribute('role', 'list');
    list.setAttribute('aria-label', `${category.label} components`);

    for (const item of category.items) {
      const listItem = document.createElement('div');
      listItem.className = 'component-library__list-item';
      listItem.setAttribute('role', 'listitem');
      listItem.appendChild(createComponentLibraryItem(item, category.id, onAdd));
      list.appendChild(listItem);
    }

    listHost.appendChild(list);
  }

  panel.appendChild(sidebar);
  showCategory(DEFAULT_CATEGORY_ID);

  return panel;
}

function createCanvasNavigationControls(canvas: FlowCanvasEngine): HTMLElement {
  const toolbar = document.createElement('div');
  toolbar.className = 'editor-page__canvas-toolbar';
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Canvas navigation');

  const zoomGroup = document.createElement('div');
  zoomGroup.className = 'editor-page__canvas-toolbar-group';

  const zoomOutButton = createButton({
    label: '−',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      canvas.zoomOut();
      updateZoomLabel();
    },
  });
  zoomOutButton.setAttribute('aria-label', 'Zoom out');
  zoomOutButton.classList.add('editor-page__canvas-zoom-button');
  zoomGroup.appendChild(zoomOutButton);

  const zoomLabel = document.createElement('span');
  zoomLabel.className = 'editor-page__canvas-zoom-label';
  zoomLabel.setAttribute('aria-live', 'polite');
  zoomGroup.appendChild(zoomLabel);

  const zoomInButton = createButton({
    label: '+',
    variant: 'ghost',
    size: 'sm',
    onClick: () => {
      canvas.zoomIn();
      updateZoomLabel();
    },
  });
  zoomInButton.setAttribute('aria-label', 'Zoom in');
  zoomInButton.classList.add('editor-page__canvas-zoom-button');
  zoomGroup.appendChild(zoomInButton);

  function updateZoomLabel(): void {
    const percent = canvas.getZoomPercent();
    zoomLabel.textContent = `${percent}%`;
    zoomOutButton.disabled = canvas.getZoomIndex() === 0;
    zoomInButton.disabled = canvas.getZoomIndex() === canvas.getMaxZoomIndex();
  }

  updateZoomLabel();

  toolbar.appendChild(zoomGroup);

  const viewGroup = document.createElement('div');
  viewGroup.className = 'editor-page__canvas-toolbar-group';

  viewGroup.appendChild(
    createButton({
      label: 'Reset view',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        canvas.resetView();
        updateZoomLabel();
      },
    }),
  );

  viewGroup.appendChild(
    createButton({
      label: 'Fit to screen',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        canvas.fitToScreen();
        updateZoomLabel();
      },
    }),
  );

  viewGroup.appendChild(
    createButton({
      label: 'Delete node',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        canvas.deleteSelectedNode();
      },
    }),
  );

  toolbar.appendChild(viewGroup);

  return toolbar;
}

function renderSelectedNodeProperties(body: HTMLElement, node: FlowNode): void {
  body.replaceChildren();

  const summary = document.createElement('div');
  summary.className = 'editor-page__properties-summary';

  const nameRow = document.createElement('div');
  nameRow.className = 'editor-page__properties-row';
  nameRow.innerHTML = `
    <span class="editor-page__properties-label">Name</span>
    <span class="editor-page__properties-value">${escapeHtml(node.name)}</span>
  `;

  const categoryRow = document.createElement('div');
  categoryRow.className = 'editor-page__properties-row';
  categoryRow.innerHTML = `
    <span class="editor-page__properties-label">Category</span>
    <span class="editor-page__properties-value">${escapeHtml(formatCategoryLabel(node.categoryId))}</span>
  `;

  const hint = document.createElement('p');
  hint.className = 'editor-page__properties-hint';
  hint.textContent = 'editor go here with properties and stuff';

  summary.append(nameRow, categoryRow, hint);
  body.append(summary);
}

function setPropertiesPanelVisible(panel: HTMLElement, visible: boolean): void {
  panel.hidden = !visible;
  panel.setAttribute('aria-hidden', visible ? 'false' : 'true');
}

function createPropertiesPanel(): {
  panel: HTMLElement;
  body: HTMLElement;
} {
  const panel = document.createElement('aside');
  panel.className = 'editor-page__properties';
  panel.setAttribute('aria-label', 'Node properties');
  setPropertiesPanelVisible(panel, false);

  const header = document.createElement('div');
  header.className = 'editor-page__properties-header';

  const title = document.createElement('h2');
  title.className = 'editor-page__properties-title';
  title.textContent = 'Properties';
  header.appendChild(title);

  panel.appendChild(header);

  const body = document.createElement('div');
  body.className = 'editor-page__properties-body';
  panel.appendChild(body);

  return { panel, body };
}

function createEditorWorkspace(): HTMLElement {
  const workspace = document.createElement('div');
  workspace.className = 'editor-page__workspace';

  const { panel: propertiesPanel, body: propertiesBody } = createPropertiesPanel();

  const canvasEngine = new FlowCanvasEngine({
    onSelectionChange: (node) => {
      if (!node) {
        setPropertiesPanelVisible(propertiesPanel, false);
        propertiesBody.replaceChildren();
        return;
      }

      renderSelectedNodeProperties(propertiesBody, node);
      setPropertiesPanelVisible(propertiesPanel, true);
    },
  });

  const library = createComponentLibraryPanel((categoryId, item) => {
    canvasEngine.addNode({
      typeId: item.id,
      name: item.name,
      categoryId,
    });
  });

  const canvasArea = document.createElement('section');
  canvasArea.className = 'editor-page__canvas-area';
  canvasArea.setAttribute('aria-label', 'Editor canvas area');

  const navigation = createCanvasNavigationControls(canvasEngine);
  canvasArea.appendChild(navigation);

  const frame = document.createElement('div');
  frame.className = 'editor-page__canvas-frame';
  frame.setAttribute('role', 'region');
  frame.setAttribute('aria-label', 'Flow canvas');
  frame.appendChild(canvasEngine.getElement());
  canvasArea.appendChild(frame);

  workspace.appendChild(library);
  workspace.appendChild(canvasArea);
  workspace.appendChild(propertiesPanel);

  return workspace;
}

function formatCategoryLabel(categoryId: string): string {
  return categoryId.charAt(0).toUpperCase() + categoryId.slice(1);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

export async function renderEditorPage(
  container: HTMLElement,
  onBack: () => void,
): Promise<void> {
  container.replaceChildren();

  const runtimeState = await window.electronAPI.getRuntimeState();
  const activeProject = runtimeState.activeProject;

  if (!activeProject) {
    onBack();
    return;
  }

  const page = document.createElement('div');
  page.className = 'editor-page';

  const badge = STATUS_BADGE[runtimeState.status];

  const topbar = createTopBar({
    title: activeProject.name,
    subtitle: 'Bot editor',
    actions: [
      createBadge({ label: badge.label, variant: badge.variant }),
      createButton({
        label: 'Back to home',
        variant: 'secondary',
        size: 'sm',
        onClick: onBack,
      }),
    ],
  });

  page.appendChild(topbar);
  page.appendChild(createEditorWorkspace());
  container.appendChild(page);
}
