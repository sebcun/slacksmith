import {
  createBadge,
  createButton,
  createEmptyState,
  createTopBar,
} from '../components/index.js';
import type { BotRuntimeStatus } from '../../shared/domain/bot-project.js';

const STATUS_BADGE: Record<
  BotRuntimeStatus,
  { label: string; variant: 'default' | 'success' | 'warning' | 'danger' }
> = {
  inactive: { label: 'Inactive', variant: 'default' },
  running: { label: 'Running', variant: 'success' },
  paused: { label: 'Paused', variant: 'warning' },
  error: { label: 'Error', variant: 'danger' },
};

export async function renderEditorStubPage(
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
  page.className = 'editor-stub-page';

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

  const main = document.createElement('main');
  main.className = 'editor-stub-page__main';

  main.appendChild(
    createEmptyState({
      icon: '⚙',
      title: 'Bot is open',
      description:
        'Editor',
    }),
  );

  page.appendChild(topbar);
  page.appendChild(main);
  container.appendChild(page);
}
