import {
  createBadge,
  createButton,
  createCard,
  createEmptyState,
  createTopBar,
} from '../components/index.js';
import type {
  BotRuntimeStatus,
} from '../../shared/domain/bot-project.js';
import type { BotProject } from '../../shared/ipc/project-contracts.js';
import { openDeleteBotModal } from './delete-bot-modal.js';
import { openDuplicateBotModal } from './duplicate-bot-modal.js';
import { openNewBotModal } from './new-bot-modal.js';
import { openRenameBotModal } from './rename-bot-modal.js';
import type { AppPage } from '../router.js';

interface BotProjectListItem extends BotProject {
  description: string;
  status: BotRuntimeStatus;
}

interface HomePageOptions {
  navigate: (page: AppPage) => void;
}

const STATUS_BADGE: Record<
  BotRuntimeStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }
> = {
  inactive: { label: 'Inactive', variant: 'default' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
};

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown';
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

async function loadProjects(): Promise<BotProjectListItem[]> {
  const [projects, runtimeState] = await Promise.all([
    window.electronAPI.listProjects(),
    window.electronAPI.getRuntimeState(),
  ]);

  return projects.map((project) => ({
    ...project,
    description: 'Slack bot project',
    status:
      runtimeState.activeProject?.id === project.id ? runtimeState.status : 'inactive',
  }));
}

async function openBotInApp(
  projectId: string,
  navigate: (page: AppPage) => void,
): Promise<void> {
  try {
    await window.electronAPI.openBot({ id: projectId });
    await window.electronAPI.refreshRecentProjectsMenu();
    navigate('editor');
  } catch (error) {
    console.error('Failed to open bot:', error);
  }
}

function handleCreateBot(
  onProjectsChanged: (selectedProjectId?: string) => Promise<void>,
  getExistingProjectNames: () => Promise<string[]>,
  navigate: (page: AppPage) => void,
): void {
  void (async () => {
    const existingProjectNames = await getExistingProjectNames();

    openNewBotModal({
      existingProjectNames,
      onCreated: async (project) => {
        await onProjectsChanged(project.id);
        await openBotInApp(project.id, navigate);
      },
    });
  })();
}

async function handleOpenProject(
  onProjectsChanged: () => Promise<void>,
  navigate: (page: AppPage) => void,
): Promise<void> {
  try {
    const project = await window.electronAPI.openProject({ kind: 'dialog' });

    if (project) {
      await onProjectsChanged();
      await window.electronAPI.refreshRecentProjectsMenu();
      await openBotInApp(project.id, navigate);
    }
  } catch (error) {
    console.error('Failed to open project:', error);
  }
}

function createDetailMetaRow(label: string, value: string): HTMLElement {
  const row = document.createElement('div');
  row.className = 'home-page__detail-meta-row';

  const labelEl = document.createElement('dt');
  labelEl.className = 'home-page__detail-meta-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('dd');
  valueEl.className = 'home-page__detail-meta-value';
  valueEl.textContent = value;

  row.appendChild(labelEl);
  row.appendChild(valueEl);
  return row;
}

function createBotDetailContent(project: BotProjectListItem): HTMLElement {
  const badge = STATUS_BADGE[project.status];

  const content = document.createElement('div');
  content.className = 'home-page__detail-content';

  const statusRow = document.createElement('div');
  statusRow.className = 'home-page__detail-status';
  statusRow.appendChild(createBadge({ label: badge.label, variant: badge.variant }));
  content.appendChild(statusRow);

  const meta = document.createElement('dl');
  meta.className = 'home-page__detail-meta';
  meta.appendChild(createDetailMetaRow('Created', formatDate(project.createdAt)));
  meta.appendChild(createDetailMetaRow('Last updated', formatDate(project.updatedAt)));
  meta.appendChild(createDetailMetaRow('Project ID', project.id));
  content.appendChild(meta);

  return content;
}

function createDetailPlaceholder(): HTMLElement {
  const placeholder = document.createElement('div');
  placeholder.className = 'home-page__detail-placeholder';

  const icon = document.createElement('div');
  icon.className = 'home-page__detail-placeholder-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = '🤖';
  placeholder.appendChild(icon);

  const title = document.createElement('h2');
  title.className = 'home-page__detail-placeholder-title';
  title.textContent = 'No bot selected';
  placeholder.appendChild(title);

  const description = document.createElement('p');
  description.className = 'home-page__detail-placeholder-description';
  description.textContent =
    'Select a bot from the list to view its details and manage it here.';
  placeholder.appendChild(description);

  return placeholder;
}

interface BotListPanelCallbacks {
  onSelect: (project: BotProjectListItem) => void;
}

function createBotListPanel(
  projects: BotProjectListItem[],
  callbacks: BotListPanelCallbacks,
): {
  element: HTMLElement;
  setSelectedId: (projectId: string | null) => void;
} {
  const panel = document.createElement('aside');
  panel.className = 'home-page__list';
  panel.setAttribute('aria-label', 'Bot projects');

  const header = document.createElement('div');
  header.className = 'home-page__list-header';

  const title = document.createElement('h2');
  title.className = 'home-page__list-title';
  title.textContent = 'Your bots';
  header.appendChild(title);

  const count = document.createElement('p');
  count.className = 'home-page__list-count';
  count.textContent =
    projects.length === 1 ? '1 project' : `${projects.length} projects`;
  header.appendChild(count);

  panel.appendChild(header);

  const list = document.createElement('div');
  list.className = 'home-page__list-items';
  list.setAttribute('role', 'list');

  const itemElements = new Map<string, HTMLElement>();

  for (const project of projects) {
    const item = document.createElement('div');
    item.className = 'home-page__list-item';
    item.setAttribute('role', 'listitem');
    item.dataset.projectId = project.id;
    itemElements.set(project.id, item);

    const info = document.createElement('div');
    info.className = 'home-page__list-item-info';

    const name = document.createElement('span');
    name.className = 'home-page__list-item-name';
    name.textContent = project.name;
    info.appendChild(name);

    const badge = STATUS_BADGE[project.status];
    info.appendChild(createBadge({ label: badge.label, variant: badge.variant }));
    item.appendChild(info);

    item.tabIndex = 0;
    item.setAttribute('aria-label', `View ${project.name}`);

    item.addEventListener('click', () => {
      setSelectedId(project.id);
      callbacks.onSelect(project);
    });

    item.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        setSelectedId(project.id);
        callbacks.onSelect(project);
      }
    });

    list.appendChild(item);
  }

  function setSelectedId(projectId: string | null): void {
    for (const [id, item] of itemElements) {
      item.classList.toggle('home-page__list-item--selected', id === projectId);
    }
  }

  panel.appendChild(list);

  return { element: panel, setSelectedId };
}

interface BotDetailPanelCallbacks {
  onOpen: (project: BotProjectListItem) => void;
  onRename: (project: BotProjectListItem) => void;
  onDuplicate: (project: BotProjectListItem) => void;
  onDelete: (project: BotProjectListItem) => void;
}

function createBotDetailPanel(callbacks: BotDetailPanelCallbacks): {
  element: HTMLElement;
  showProject: (project: BotProjectListItem) => void;
  showPlaceholder: () => void;
} {
  const panel = document.createElement('section');
  panel.className = 'home-page__detail';
  panel.setAttribute('aria-label', 'Bot details');

  const contentHost = document.createElement('div');
  contentHost.className = 'home-page__detail-host';
  panel.appendChild(contentHost);

  function showPlaceholder(): void {
    contentHost.replaceChildren(createDetailPlaceholder());
  }

  function createDetailActions(project: BotProjectListItem): HTMLElement {
    const actions = document.createElement('div');
    actions.className = 'home-page__detail-actions';

    actions.appendChild(
      createButton({
        label: 'Open',
        variant: 'primary',
        onClick: () => callbacks.onOpen(project),
      }),
    );

    actions.appendChild(
      createButton({
        label: 'Rename',
        variant: 'secondary',
        onClick: () => callbacks.onRename(project),
      }),
    );

    actions.appendChild(
      createButton({
        label: 'Duplicate',
        variant: 'secondary',
        onClick: () => callbacks.onDuplicate(project),
      }),
    );

    actions.appendChild(
      createButton({
        label: 'Delete',
        variant: 'danger',
        onClick: () => callbacks.onDelete(project),
      }),
    );

    return actions;
  }

  function showProject(project: BotProjectListItem): void {
    contentHost.replaceChildren(
      createCard({
        title: project.name,
        description: project.description,
        content: createBotDetailContent(project),
        footer: createDetailActions(project),
      }),
    );
  }

  showPlaceholder();

  return {
    element: panel,
    showProject,
    showPlaceholder,
  };
}

function createSplitLayout(
  projects: BotProjectListItem[],
  callbacks: BotDetailPanelCallbacks,
  initialSelectedProjectId?: string,
): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'home-page__split';

  const detailPanel = createBotDetailPanel(callbacks);
  const listPanel = createBotListPanel(projects, {
    onSelect: (project) => {
      detailPanel.showProject(project);
    },
  });

  if (initialSelectedProjectId) {
    const selectedProject = projects.find((project) => project.id === initialSelectedProjectId);

    if (selectedProject) {
      listPanel.setSelectedId(selectedProject.id);
      detailPanel.showProject(selectedProject);
    }
  }

  layout.appendChild(listPanel.element);
  layout.appendChild(detailPanel.element);
  return layout;
}

function createEmptyProjectsState(onCreateBot: () => void): HTMLElement {
  return createEmptyState({
    icon: '⚒',
    title: 'No bots yet',
    description: 'Create your first Slack bot to get started building.',
    action: {
      label: 'Create bot',
      variant: 'primary',
      onClick: onCreateBot,
    },
  });
}

function createProjectsLoadErrorState(): HTMLElement {
  return createEmptyState({
    icon: '!',
    title: 'Unable to load projects',
    description: 'Project storage could not be read. Try restarting the app.',
  });
}

function renderHomeContent(
  main: HTMLElement,
  projects: BotProjectListItem[] | null,
  onCreateBot: () => void,
  callbacks: BotDetailPanelCallbacks,
  selectedProjectId?: string,
): void {
  main.replaceChildren();

  if (projects === null) {
    main.appendChild(createProjectsLoadErrorState());
    return;
  }

  if (projects.length === 0) {
    main.appendChild(createEmptyProjectsState(onCreateBot));
    return;
  }

  main.appendChild(createSplitLayout(projects, callbacks, selectedProjectId));
}

export async function renderHomePage(
  container: HTMLElement,
  options: HomePageOptions,
): Promise<void> {
  const { navigate } = options;

  container.replaceChildren();

  const page = document.createElement('div');
  page.className = 'home-page';

  const main = document.createElement('main');
  main.className = 'home-page__main';

  async function getExistingProjectNames(): Promise<string[]> {
    const projects = await loadProjects();
    return projects.map((project) => project.name);
  }

  async function refreshProjects(selectedProjectId?: string): Promise<void> {
    try {
      const projects = await loadProjects();
      renderHomeContent(main, projects, triggerCreateBot, createProjectCallbacks(), selectedProjectId);
    } catch (error) {
      console.error('Failed to load projects:', error);
      renderHomeContent(main, null, triggerCreateBot, createProjectCallbacks());
    }
  }

  function createProjectCallbacks(): BotDetailPanelCallbacks {
    return {
      onOpen: (project) => {
        void openBotInApp(project.id, navigate);
      },
      onRename: (project) => {
        void (async () => {
          const existingProjectNames = await getExistingProjectNames();
          openRenameBotModal({
            project,
            existingProjectNames,
            onRenamed: async () => {
              await refreshProjects(project.id);
            },
          });
        })();
      },
      onDuplicate: (project) => {
        void (async () => {
          const existingProjectNames = await getExistingProjectNames();
          openDuplicateBotModal({
            project,
            existingProjectNames,
            onDuplicated: async (duplicatedProject) => {
              await refreshProjects(duplicatedProject.id);
            },
          });
        })();
      },
      onDelete: (project) => {
        openDeleteBotModal({
          project,
          onDeleted: async () => {
            await refreshProjects();
          },
        });
      },
    };
  }

  function triggerCreateBot(): void {
    handleCreateBot(
      (selectedProjectId) => refreshProjects(selectedProjectId),
      getExistingProjectNames,
      navigate,
    );
  }

  const topbar = createTopBar({
    title: 'SlackSmith',
    subtitle: 'Build Slack bots visually',
    actions: [
      createButton({
        label: 'Open project',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          void handleOpenProject(() => refreshProjects(), navigate);
        },
      }),
      createButton({
        label: 'New bot',
        variant: 'primary',
        size: 'sm',
        onClick: triggerCreateBot,
      }),
    ],
  });

  page.appendChild(topbar);
  page.appendChild(main);
  container.appendChild(page);

  await refreshProjects();
}
