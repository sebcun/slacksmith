import {
  createBadge,
  createButton,
  createTopBar,
} from '../components/index.js';
import {
  FlowCanvasEngine,
  serializeComponentTemplate,
} from '../editor/flow-canvas-engine.js';
import { createNodeConfigForm } from '../editor/node-config-form.js';
import type { BotRuntimeStatus } from '../../shared/domain/bot-project.js';
import {
  COMPONENT_CATEGORIES,
  getCategoryLabel,
  getComponentDefinition,
  getComponentDefinitionsByCategory,
  type ComponentDefinition,
} from '../../shared/domain/component-registry.js';
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

const ALL_CATEGORIES_ID = 'all';

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

    if (activeCategoryId === ALL_CATEGORIES_ID) {
      for (const category of COMPONENT_CATEGORIES) {
        const components = getComponentDefinitionsByCategory(category.id);
        if (components.length === 0) {
          continue;
        }

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
      return;
    }

    const components = getComponentDefinitionsByCategory(
      activeCategoryId as (typeof COMPONENT_CATEGORIES)[number]['id'],
    );
    listHost.appendChild(
      createComponentList(
        components,
        `${getCategoryLabel(activeCategoryId)} components`,
        onAdd,
      ),
    );
  }

  library.appendChild(filters);
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

function renderPortList(
  container: HTMLElement,
  title: string,
  ports: { id: string; label: string }[],
): void {
  const section = document.createElement('div');
  section.className = 'editor-page__properties-section';

  const heading = document.createElement('h3');
  heading.className = 'editor-page__properties-section-title';
  heading.textContent = title;
  section.appendChild(heading);

  if (ports.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'editor-page__properties-empty';
    empty.textContent = 'None';
    section.appendChild(empty);
  } else {
    const list = document.createElement('ul');
    list.className = 'editor-page__properties-list';

    for (const port of ports) {
      const item = document.createElement('li');
      item.className = 'editor-page__properties-list-item';
      item.textContent = port.label;
      list.appendChild(item);
    }

    section.appendChild(list);
  }

  container.appendChild(section);
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

  renderPortList(summary, 'Inputs', definition.inputs);
  renderPortList(summary, 'Outputs', definition.outputs);

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

  const executionSection = document.createElement('div');
  executionSection.className = 'editor-page__properties-section';

  const executionTitle = document.createElement('h3');
  executionTitle.className = 'editor-page__properties-section-title';
  executionTitle.textContent = 'Execution';
  executionSection.appendChild(executionTitle);

  const executionRow = document.createElement('div');
  executionRow.className = 'editor-page__properties-row';
  executionRow.innerHTML = `
    <span class="editor-page__properties-label">Handler</span>
    <span class="editor-page__properties-value editor-page__properties-value--mono">${escapeHtml(definition.execution.handlerId)}</span>
  `;
  executionSection.appendChild(executionRow);

  if (definition.execution.isTrigger) {
    const triggerRow = document.createElement('div');
    triggerRow.className = 'editor-page__properties-row';
    triggerRow.innerHTML = `
      <span class="editor-page__properties-label">Role</span>
      <span class="editor-page__properties-value">Flow trigger</span>
    `;
    executionSection.appendChild(triggerRow);
  }

  if (definition.execution.terminatesFlow) {
    const terminateRow = document.createElement('div');
    terminateRow.className = 'editor-page__properties-row';
    terminateRow.innerHTML = `
      <span class="editor-page__properties-label">Role</span>
      <span class="editor-page__properties-value">Flow terminator</span>
    `;
    executionSection.appendChild(terminateRow);
  }

  summary.appendChild(executionSection);

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
  });

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

  return workspace;
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
    subtitle: 'Flow editor',
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
