import {
  createBadge,
  createButton,
  createTopBar,
} from '../components/index.js';
import {
  FlowCanvasEngine,
  serializeComponentTemplate,
} from '../editor/flow-canvas-engine.js';
import { createCanvasTabBar, generateDefaultCanvasName } from '../editor/canvas-tab-bar.js';
import { createNodeConfigForm } from '../editor/node-config-form.js';
import { openOnboardingWizardModal } from './onboarding-wizard.js';
import { openSlackConnectionModal } from './slack-connection-modal.js';
import { reportAppState, setEditorMenuCallbacks } from '../menu-handler.js';
import type { BotRuntimeStatus } from '../../shared/domain/bot-project.js';
import type { SlackConnectionSummary } from '../../shared/domain/slack-config.js';
import {
  COMPONENT_CATEGORIES,
  getCategoryLabel,
  getComponentDefinition,
  getComponentDefinitionsByCategory,
  type ComponentDefinition,
} from '../../shared/domain/component-registry.js';
import type { FlowGraph, FlowNode, ProjectCanvases } from '../../shared/domain/flow-graph.js';
import {
  cloneFlowCanvas,
  createEmptyFlowGraph,
  createFlowCanvas,
  ensureUniqueCanvasName,
  MAX_PROJECT_CANVASES,
} from '../../shared/domain/flow-graph.js';

const STATUS_BADGE: Record<
  BotRuntimeStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }
> = {
  inactive: { label: 'Inactive', variant: 'default' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
};

const ALL_CATEGORIES_ID = 'all';

function normalizeComponentSearchQuery(query: string): string {
  return query.trim().toLowerCase();
}

function matchesComponentSearch(definition: ComponentDefinition, query: string): boolean {
  const normalizedQuery = normalizeComponentSearchQuery(query);
  if (!normalizedQuery) {
    return true;
  }

  const haystack = `${definition.name} ${definition.description}`.toLowerCase();
  return haystack.includes(normalizedQuery);
}

function filterComponentsBySearch(
  definitions: ComponentDefinition[],
  query: string,
): ComponentDefinition[] {
  return definitions.filter((definition) => matchesComponentSearch(definition, query));
}

function createComponentLibraryItem(
  definition: ComponentDefinition,
  onAdd: (definition: ComponentDefinition) => void,
): HTMLElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = 'component-library__item';
  element.setAttribute('aria-label', `${definition.name}: ${definition.description}`);
  element.draggable = true;

  const name = document.createElement('span');
  name.className = 'component-library__item-name';
  name.textContent = definition.name;
  element.appendChild(name);

  const description = document.createElement('span');
  description.className = 'component-library__item-description';
  description.textContent = definition.description;
  element.appendChild(description);

  element.addEventListener('dragstart', (event) => {
    event.dataTransfer?.setData(
      'application/x-slacksmith-component',
      serializeComponentTemplate({ typeId: definition.id }),
    );
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'copy';
    }
  });

  element.addEventListener('click', () => {
    onAdd(definition);
  });

  return element;
}

function createComponentList(
  definitions: ComponentDefinition[],
  ariaLabel: string,
  onAdd: (definition: ComponentDefinition) => void,
): HTMLElement {
  const list = document.createElement('div');
  list.className = 'component-library__list';
  list.setAttribute('role', 'list');
  list.setAttribute('aria-label', ariaLabel);

  for (const definition of definitions) {
    const listItem = document.createElement('div');
    listItem.className = 'component-library__list-item';
    listItem.setAttribute('role', 'listitem');
    listItem.appendChild(createComponentLibraryItem(definition, onAdd));
    list.appendChild(listItem);
  }

  return list;
}

function createComponentLibraryPanel(
  onAdd: (definition: ComponentDefinition) => void,
): HTMLElement {
  const panel = document.createElement('aside');
  panel.className = 'editor-page__library';
  panel.setAttribute('aria-label', 'Component library');

  const library = document.createElement('div');
  library.className = 'component-library';

  const header = document.createElement('div');
  header.className = 'component-library__header';

  const title = document.createElement('h2');
  title.className = 'component-library__title';
  title.textContent = 'Components';
  header.appendChild(title);
  library.appendChild(header);

  const filters = document.createElement('div');
  filters.className = 'component-library__filters';
  filters.setAttribute('role', 'tablist');
  filters.setAttribute('aria-label', 'Component categories');

  const listHost = document.createElement('div');
  listHost.className = 'component-library__list-host';

  let activeCategoryId = ALL_CATEGORIES_ID;
  let searchQuery = '';

  const filterButtons: HTMLButtonElement[] = [];

  function setActiveFilter(categoryId: string): void {
    activeCategoryId = categoryId;

    for (const button of filterButtons) {
      const isActive = button.dataset.categoryId === categoryId;
      button.classList.toggle('component-library__filter--active', isActive);
      button.setAttribute('aria-selected', isActive ? 'true' : 'false');
      button.tabIndex = isActive ? 0 : -1;
    }

    renderComponentList();
  }

  function createFilterButton(id: string, label: string): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'component-library__filter';
    button.dataset.categoryId = id;
    button.textContent = label;
    button.setAttribute('role', 'tab');
    button.addEventListener('click', () => {
      setActiveFilter(id);
    });
    filterButtons.push(button);
    filters.appendChild(button);
    return button;
  }

  createFilterButton(ALL_CATEGORIES_ID, 'All');
  for (const category of COMPONENT_CATEGORIES) {
    createFilterButton(category.id, category.label);
  }

  function renderComponentList(): void {
    listHost.replaceChildren();
    const normalizedSearchQuery = normalizeComponentSearchQuery(searchQuery);
    let hasResults = false;

    if (activeCategoryId === ALL_CATEGORIES_ID) {
      for (const category of COMPONENT_CATEGORIES) {
        const components = filterComponentsBySearch(
          getComponentDefinitionsByCategory(category.id),
          normalizedSearchQuery,
        );
        if (components.length === 0) {
          continue;
        }

        hasResults = true;

        const section = document.createElement('section');
        section.className = 'component-library__section';

        const sectionTitle = document.createElement('h3');
        sectionTitle.className = 'component-library__section-title';
        sectionTitle.textContent = category.label;
        section.appendChild(sectionTitle);

        section.appendChild(
          createComponentList(components, `${category.label} components`, onAdd),
        );
        listHost.appendChild(section);
      }

      if (!hasResults) {
        const empty = document.createElement('p');
        empty.className = 'component-library__empty';
        empty.textContent = normalizedSearchQuery
          ? 'No components match your search.'
          : 'No components in this category.';
        listHost.appendChild(empty);
      }

      return;
    }

    const components = filterComponentsBySearch(
      getComponentDefinitionsByCategory(
        activeCategoryId as (typeof COMPONENT_CATEGORIES)[number]['id'],
      ),
      normalizedSearchQuery,
    );

    if (components.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'component-library__empty';
      empty.textContent = normalizedSearchQuery
        ? 'No components match your search.'
        : 'No components in this category.';
      listHost.appendChild(empty);
      return;
    }

    listHost.appendChild(
      createComponentList(
        components,
        `${getCategoryLabel(activeCategoryId)} components`,
        onAdd,
      ),
    );
  }

  const search = document.createElement('div');
  search.className = 'component-library__search';

  const searchInput = document.createElement('input');
  searchInput.className = 'component-library__search-input';
  searchInput.type = 'search';
  searchInput.placeholder = 'Search components…';
  searchInput.setAttribute('aria-label', 'Search components');
  searchInput.autocomplete = 'off';
  searchInput.spellcheck = false;
  searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderComponentList();
  });
  search.appendChild(searchInput);

  library.appendChild(filters);
  library.appendChild(search);
  library.appendChild(listHost);
  panel.appendChild(library);

  setActiveFilter(ALL_CATEGORIES_ID);

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


function renderSelectedNodeProperties(
  body: HTMLElement,
  node: FlowNode,
  onConfigChange: (fieldId: string, value: unknown) => void,
): void {
  body.replaceChildren();

  const definition = getComponentDefinition(node.typeId);
  if (!definition) {
    return;
  }

  const summary = document.createElement('div');
  summary.className = 'editor-page__properties-summary';

  const nameRow = document.createElement('div');
  nameRow.className = 'editor-page__properties-row';
  nameRow.innerHTML = `
    <span class="editor-page__properties-label">Name</span>
    <span class="editor-page__properties-value">${escapeHtml(definition.name)}</span>
  `;

  const categoryRow = document.createElement('div');
  categoryRow.className = 'editor-page__properties-row';
  categoryRow.innerHTML = `
    <span class="editor-page__properties-label">Category</span>
    <span class="editor-page__properties-value">${escapeHtml(getCategoryLabel(definition.categoryId))}</span>
  `;

  const description = document.createElement('p');
  description.className = 'editor-page__properties-description';
  description.textContent = definition.description;

  summary.append(nameRow, categoryRow, description);


  const fieldsSection = document.createElement('div');
  fieldsSection.className = 'editor-page__properties-section';

  const fieldsTitle = document.createElement('h3');
  fieldsTitle.className = 'editor-page__properties-section-title';
  fieldsTitle.textContent = 'Settings';
  fieldsSection.appendChild(fieldsTitle);

  if (definition.fields.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'editor-page__properties-empty';
    empty.textContent = 'No settings for this component.';
    fieldsSection.appendChild(empty);
  } else {
    fieldsSection.appendChild(
      createNodeConfigForm({
        nodeId: node.id,
        fields: definition.fields,
        config: node.config,
        onChange: onConfigChange,
      }),
    );
  }

  summary.appendChild(fieldsSection);

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

interface EditorWorkspaceOptions {
  initialGraph: FlowGraph;
  onGraphChange: (graph: FlowGraph) => void;
}

interface CanvasViewportState {
  x: number;
  y: number;
  zoom: number;
}

function createEditorWorkspace(options: EditorWorkspaceOptions): {
  element: HTMLElement;
  getGraph: () => FlowGraph;
  loadCanvasGraph: (graph: FlowGraph) => void;
  getViewport: () => CanvasViewportState;
  setViewport: (viewport: CanvasViewportState) => void;
  resetViewport: () => void;
  canvasArea: HTMLElement;
} {
  const workspace = document.createElement('div');
  workspace.className = 'editor-page__workspace';

  const { panel: propertiesPanel, body: propertiesBody } = createPropertiesPanel();

  let canvasEngine: FlowCanvasEngine;

  canvasEngine = new FlowCanvasEngine({
    onSelectionChange: (node) => {
      if (!node) {
        setPropertiesPanelVisible(propertiesPanel, false);
        propertiesBody.replaceChildren();
        return;
      }

      renderSelectedNodeProperties(propertiesBody, node, (fieldId, value) => {
        canvasEngine.updateNodeConfig(node.id, fieldId, value);
      });
      setPropertiesPanelVisible(propertiesPanel, true);
    },
    onGraphChange: options.onGraphChange,
  });

  canvasEngine.loadGraph(options.initialGraph);

  const library = createComponentLibraryPanel((definition) => {
    canvasEngine.addNode({ typeId: definition.id });
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

  return {
    element: workspace,
    getGraph: () => canvasEngine.getGraph(),
    loadCanvasGraph: (graph) => {
      canvasEngine.loadGraph(graph);
    },
    getViewport: () => canvasEngine.getViewport(),
    setViewport: (viewport) => {
      canvasEngine.setViewport(viewport);
    },
    resetViewport: () => {
      canvasEngine.resetView();
    },
    canvasArea,
  };
}

function createSlackConnectionBadge(connection: SlackConnectionSummary): HTMLElement {
  if (!connection.configured) {
    return createBadge({
      label: 'Slack not connected',
      variant: 'warning',
    });
  }

  const workspace = connection.teamName ?? 'Connected';
  return createBadge({
    label: `Slack: ${workspace}`,
    variant: 'success',
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getRuntimeErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'An unexpected runtime error occurred.';
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

  const projectId = activeProject.id;
  const projectName = activeProject.name;

  const [slackConnectionResult, initialCanvases] = await Promise.all([
    window.electronAPI.getSlackConnection({ projectId }),
    window.electronAPI.getProjectCanvases({ projectId }),
  ]);

  let projectCanvases: ProjectCanvases = initialCanvases;
  const canvasViewports = new Map<string, CanvasViewportState>();

  function getActiveCanvas() {
    const active =
      projectCanvases.canvases.find((canvas) => canvas.id === projectCanvases.activeCanvasId) ??
      projectCanvases.canvases[0];

    if (!active) {
      throw new Error('Project has no canvases.');
    }

    return active;
  }

  function syncActiveCanvasGraph(getGraph: () => FlowGraph): void {
    const activeCanvas = getActiveCanvas();
    activeCanvas.graph = getGraph();
  }

  function updateTabBar(tabBar: ReturnType<typeof createCanvasTabBar>): void {
    tabBar.update(projectCanvases.canvases, projectCanvases.activeCanvasId);
  }

  let slackConnection = slackConnectionResult;
  let runtimeStatus = runtimeState.status;
  let runtimeErrorMessage = runtimeState.lastError;

  type SaveState = 'saved' | 'saving' | 'error';
  let saveState: SaveState = 'saved';
  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  const page = document.createElement('div');
  page.className = 'editor-page';

  const saveBadgeHost = document.createElement('div');
  saveBadgeHost.className = 'editor-page__save-badge';

  const runtimeBadgeHost = document.createElement('div');
  runtimeBadgeHost.className = 'editor-page__runtime-badge';

  const runtimeControlsHost = document.createElement('div');
  runtimeControlsHost.className = 'editor-page__runtime-controls';

  const runtimeErrorHost = document.createElement('div');
  runtimeErrorHost.className = 'editor-page__runtime-error';
  runtimeErrorHost.hidden = true;

  const slackBadgeHost = document.createElement('div');
  slackBadgeHost.className = 'editor-page__slack-badge';

  function renderSaveBadge(): void {
    const labels: Record<SaveState, { label: string; variant: 'default' | 'success' | 'danger' }> =
      {
        saved: { label: 'Saved', variant: 'success' },
        saving: { label: 'Saving…', variant: 'default' },
        error: { label: 'Save failed', variant: 'danger' },
      };
    const badge = labels[saveState];
    saveBadgeHost.replaceChildren(createBadge({ label: badge.label, variant: badge.variant }));
  }

  function renderRuntimeBadge(): void {
    const badge = STATUS_BADGE[runtimeStatus];
    runtimeBadgeHost.replaceChildren(createBadge({ label: badge.label, variant: badge.variant }));
  }

  function renderSlackBadge(): void {
    slackBadgeHost.replaceChildren(createSlackConnectionBadge(slackConnection));
  }

  async function persistCanvases(canvases: ProjectCanvases): Promise<void> {
    saveState = 'saving';
    renderSaveBadge();

    try {
      await window.electronAPI.saveProjectCanvases({
        projectId,
        canvases,
      });
      saveState = 'saved';
    } catch (error) {
      console.error('Failed to save flow:', error);
      saveState = 'error';
    }

    renderSaveBadge();
  }

  function scheduleSave(getGraph: () => FlowGraph): void {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
    }

    syncActiveCanvasGraph(getGraph);
    saveState = 'saving';
    renderSaveBadge();

    saveTimer = setTimeout(() => {
      saveTimer = null;
      void persistCanvases(projectCanvases);
    }, 500);
  }

  async function flushPendingSave(getGraph: () => FlowGraph): Promise<void> {
    if (saveTimer !== null) {
      clearTimeout(saveTimer);
      saveTimer = null;
      syncActiveCanvasGraph(getGraph);
      await persistCanvases(projectCanvases);
    } else {
      syncActiveCanvasGraph(getGraph);
    }
  }

  function renderRuntimeError(): void {
    if (!runtimeErrorMessage) {
      runtimeErrorHost.hidden = true;
      runtimeErrorHost.replaceChildren();
      return;
    }

    runtimeErrorHost.hidden = false;
    runtimeErrorHost.textContent = runtimeErrorMessage;
  }

  function applyRuntimeState(
    state: { status: BotRuntimeStatus; lastError: string | null },
    getGraph: () => FlowGraph,
  ): void {
    runtimeStatus = state.status;
    runtimeErrorMessage = state.lastError;
    renderRuntimeBadge();
    renderRuntimeControls(getGraph);
    renderRuntimeError();
    void reportAppState();
  }

  async function runIndependently(getGraph: () => FlowGraph): Promise<void> {
    try {
      await flushPendingSave(getGraph);
      await window.electronAPI.runBotIndependently({ projectId });
      runtimeErrorMessage = null;
      renderRuntimeError();
    } catch (error) {
      console.error('Failed to run bot independently:', error);
      runtimeErrorMessage = getRuntimeErrorMessage(error);
      renderRuntimeError();
      throw error;
    }
  }

  function renderRuntimeControls(getGraph: () => FlowGraph): void {
    runtimeControlsHost.replaceChildren();

    if (runtimeStatus === 'running' || runtimeStatus === 'paused' || runtimeStatus === 'error') {
      runtimeControlsHost.appendChild(
        createButton({
          label: 'Stop',
          variant: 'secondary',
          size: 'sm',
          onClick: () => {
            void (async () => {
              try {
                const state = await window.electronAPI.stopBot();
                applyRuntimeState(state, getGraph);
              } catch (error) {
                console.error('Failed to stop bot:', error);
                runtimeErrorMessage = getRuntimeErrorMessage(error);
                renderRuntimeError();
              }
            })();
          },
        }),
      );

      runtimeControlsHost.appendChild(
        createButton({
          label: 'Restart',
          variant: 'secondary',
          size: 'sm',
          onClick: () => {
            void (async () => {
              try {
                await flushPendingSave(getGraph);
                const state = await window.electronAPI.restartBot();
                applyRuntimeState(state, getGraph);
              } catch (error) {
                console.error('Failed to restart bot:', error);
                runtimeErrorMessage = getRuntimeErrorMessage(error);
                renderRuntimeError();
              }
            })();
          },
        }),
      );
      return;
    }

    runtimeControlsHost.appendChild(
      createButton({
        label: 'Start',
        variant: 'primary',
        size: 'sm',
        onClick: () => {
          void (async () => {
            try {
              await flushPendingSave(getGraph);
              const state = await window.electronAPI.startBot();
              applyRuntimeState(state, getGraph);
            } catch (error) {
              console.error('Failed to start bot:', error);
              runtimeErrorMessage = getRuntimeErrorMessage(error);
              renderRuntimeError();
            }
          })();
        },
      }),
    );
  }

  const activeCanvas = getActiveCanvas();

  const workspace = createEditorWorkspace({
    initialGraph: activeCanvas.graph,
    onGraphChange: () => {
      scheduleSave(workspace.getGraph);
    },
  });

  function switchCanvas(
    canvasId: string,
    tabBar: ReturnType<typeof createCanvasTabBar>,
  ): void {
    if (canvasId === projectCanvases.activeCanvasId) {
      return;
    }

    const currentViewport = workspace.getViewport();
    canvasViewports.set(projectCanvases.activeCanvasId, currentViewport);
    syncActiveCanvasGraph(workspace.getGraph);

    projectCanvases = {
      ...projectCanvases,
      activeCanvasId: canvasId,
    };

    const nextCanvas = getActiveCanvas();
    workspace.loadCanvasGraph(nextCanvas.graph);

    const savedViewport = canvasViewports.get(canvasId);
    if (savedViewport) {
      workspace.setViewport(savedViewport);
    } else {
      workspace.resetViewport();
    }

    updateTabBar(tabBar);
    void persistCanvases(projectCanvases);
  }

  const tabBar = createCanvasTabBar({
    canvases: projectCanvases.canvases,
    activeCanvasId: projectCanvases.activeCanvasId,
    onSelect: (canvasId) => {
      switchCanvas(canvasId, tabBar);
    },
    onCreate: () => {
      if (projectCanvases.canvases.length >= MAX_PROJECT_CANVASES) {
        return;
      }

      syncActiveCanvasGraph(workspace.getGraph);

      const name = generateDefaultCanvasName(projectCanvases.canvases);
      const newCanvas = createFlowCanvas(name);

      projectCanvases = {
        ...projectCanvases,
        activeCanvasId: newCanvas.id,
        canvases: [...projectCanvases.canvases, newCanvas],
      };

      workspace.loadCanvasGraph(createEmptyFlowGraph());
      workspace.resetViewport();
      updateTabBar(tabBar);
      void persistCanvases(projectCanvases);
    },
    onRename: (canvasId, name) => {
      projectCanvases = {
        ...projectCanvases,
        canvases: projectCanvases.canvases.map((canvas) =>
          canvas.id === canvasId ? { ...canvas, name } : canvas,
        ),
      };
      updateTabBar(tabBar);
      void persistCanvases(projectCanvases);
    },
    onDuplicate: (canvasId) => {
      if (projectCanvases.canvases.length >= MAX_PROJECT_CANVASES) {
        return;
      }

      syncActiveCanvasGraph(workspace.getGraph);

      const source = projectCanvases.canvases.find((canvas) => canvas.id === canvasId);
      if (!source) {
        return;
      }

      const duplicateName = ensureUniqueCanvasName(
        `${source.name} Copy`,
        projectCanvases.canvases,
      );
      const duplicate = cloneFlowCanvas(source, duplicateName);

      projectCanvases = {
        ...projectCanvases,
        activeCanvasId: duplicate.id,
        canvases: [...projectCanvases.canvases, duplicate],
      };

      workspace.loadCanvasGraph(duplicate.graph);
      workspace.resetViewport();
      updateTabBar(tabBar);
      void persistCanvases(projectCanvases);
    },
    onDelete: (canvasId) => {
      if (projectCanvases.canvases.length <= 1) {
        return;
      }

      syncActiveCanvasGraph(workspace.getGraph);

      const index = projectCanvases.canvases.findIndex((canvas) => canvas.id === canvasId);
      if (index === -1) {
        return;
      }

      const remaining = projectCanvases.canvases.filter((canvas) => canvas.id !== canvasId);
      canvasViewports.delete(canvasId);

      const wasActive = canvasId === projectCanvases.activeCanvasId;
      let nextActiveId = projectCanvases.activeCanvasId;

      if (wasActive) {
        const neighbour = remaining[Math.min(index, remaining.length - 1)] ?? remaining[0];
        nextActiveId = neighbour?.id ?? remaining[0]!.id;
      }

      projectCanvases = {
        ...projectCanvases,
        activeCanvasId: nextActiveId,
        canvases: remaining,
      };

      if (wasActive) {
        const nextCanvas = getActiveCanvas();
        workspace.loadCanvasGraph(nextCanvas.graph);
        const savedViewport = canvasViewports.get(nextActiveId);
        if (savedViewport) {
          workspace.setViewport(savedViewport);
        } else {
          workspace.resetViewport();
        }
      }

      updateTabBar(tabBar);
      void persistCanvases(projectCanvases);
    },
  });

  workspace.canvasArea.insertBefore(tabBar.element, workspace.canvasArea.firstChild);

  renderSaveBadge();
  renderRuntimeBadge();
  renderSlackBadge();
  renderRuntimeControls(workspace.getGraph);
  renderRuntimeError();

  async function closeEditor(): Promise<void> {
    await flushPendingSave(workspace.getGraph);
    setEditorMenuCallbacks(null);
    await window.electronAPI.closeBot();
    onBack();
  }

  setEditorMenuCallbacks({
    flushSave: async () => {
      await flushPendingSave(workspace.getGraph);
    },
    openSlackSettings: () => {
      openSlackConnectionModal({
        projectId,
        initialConnection: slackConnection,
        onConnectionChanged: async (connection) => {
          slackConnection = connection;
          renderSlackBadge();
        },
      });
    },
    applyRuntimeState: (state) => {
      applyRuntimeState(state, workspace.getGraph);
    },
    runIndependently: async () => {
      await runIndependently(workspace.getGraph);
    },
    getProjectId: () => projectId,
    onClose: closeEditor,
  });

  void reportAppState();

  const topbar = createTopBar({
    title: projectName,
    subtitle: 'Bot editor',
    actions: [
      saveBadgeHost,
      slackBadgeHost,
      runtimeBadgeHost,
      runtimeControlsHost,
    ],
  });

  page.appendChild(topbar);
  page.appendChild(runtimeErrorHost);
  page.appendChild(workspace.element);
  container.appendChild(page);

  if (!slackConnection.configured) {
    openOnboardingWizardModal({
      projectId,
      onComplete: async (connection) => {
        slackConnection = connection;
        renderSlackBadge();
      },
    });
  }
}
