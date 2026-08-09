import {
  createBadge,
  createButton,
  createCard,
  createEmptyState,
  createTopBar,
} from '../components/index.js';
import type {
  BotProjectMetadata,
  BotRuntimeStatus,
} from '../../shared/domain/bot-project.js';

interface BotProjectListItem extends BotProjectMetadata {
  description: string;
  status: BotRuntimeStatus;
}

const PROJECTS: BotProjectListItem[] = [];

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

function handleCreateBot(): void {
}

function handleOpenProject(): void {
}

function handleOpenBot(_project: BotProjectListItem): void {
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
  icon.textContent = '◇';
  placeholder.appendChild(icon);

  const title = document.createElement('h2');
  title.className = 'home-page__detail-placeholder-title';
  title.textContent = 'No bot selected';
  placeholder.appendChild(title);

  const description = document.createElement('p');
  description.className = 'home-page__detail-placeholder-description';
  description.textContent =
    'Choose a bot from the list and click View to see its details here.';
  placeholder.appendChild(description);

  return placeholder;
}

function createBotListPanel(
  projects: BotProjectListItem[],
  onView: (project: BotProjectListItem) => void,
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

    item.appendChild(
      createButton({
        label: 'View',
        variant: 'secondary',
        size: 'sm',
        onClick: () => {
          setSelectedId(project.id);
          onView(project);
        },
      }),
    );

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

function createBotDetailPanel(): {
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

  function showProject(project: BotProjectListItem): void {
    contentHost.replaceChildren(
      createCard({
        title: project.name,
        description: project.description,
        content: createBotDetailContent(project),
        footer: createButton({
          label: 'Open',
          variant: 'primary',
          onClick: () => handleOpenBot(project),
        }),
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

function createSplitLayout(projects: BotProjectListItem[]): HTMLElement {
  const layout = document.createElement('div');
  layout.className = 'home-page__split';

  const detailPanel = createBotDetailPanel();
  const listPanel = createBotListPanel(projects, (project) => {
    detailPanel.showProject(project);
  });

  layout.appendChild(listPanel.element);
  layout.appendChild(detailPanel.element);
  return layout;
}

function createEmptyProjectsState(): HTMLElement {
  return createEmptyState({
    icon: '⚒',
    title: 'No bots yet',
    description: 'Create your first Slack bot to get started building.',
    action: {
      label: 'Create bot',
      variant: 'primary',
      onClick: handleCreateBot,
    },
  });
}

export function renderHomePage(container: HTMLElement): void {
  container.replaceChildren();

  const page = document.createElement('div');
  page.className = 'home-page';

  const topbar = createTopBar({
    title: 'SlackSmith',
    subtitle: 'Build Slack bots visually',
    actions: [
      createButton({
        label: 'Open project',
        variant: 'secondary',
        size: 'sm',
        onClick: handleOpenProject,
      }),
      createButton({
        label: 'New bot',
        variant: 'primary',
        size: 'sm',
        onClick: handleCreateBot,
      }),
    ],
  });

  const main = document.createElement('mcreateEmptyProjectsStateain');
  main.className = 'home-page__main';

  if (PROJECTS.length === 0) {
    main.appendChild(createEmptyProjectsState());
  } else {
    main.appendChild(createSplitLayout(PROJECTS));
  }

  page.appendChild(topbar);
  page.appendChild(main);
  container.appendChild(page);
}
