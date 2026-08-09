import {
  createBadge,
  createButton,
  createCard,
  createEmptyState,
  createInput,
  createModal,
  createSelect,
  createSidebar,
  createTopBar,
  setSidebarActiveItem,
} from '../components/index.js';

const SHOWCASE_SECTIONS = [
  { id: 'buttons', label: 'Button' },
  { id: 'topbar', label: 'TopBar' },
  { id: 'sidebar', label: 'Sidebar' },
  { id: 'cards', label: 'Card' },
  { id: 'inputs', label: 'Input' },
  { id: 'selects', label: 'Select' },
  { id: 'badges', label: 'Badge' },
  { id: 'empty-states', label: 'EmptyState' },
  { id: 'modals', label: 'Modal' },
] as const;

function createSectionHeading(title: string, description: string): HTMLElement {
  const heading = document.createElement('div');
  heading.className = 'showcase-section__heading';

  const titleEl = document.createElement('h2');
  titleEl.className = 'showcase-section__title';
  titleEl.id = title.toLowerCase().replace(/\s+/g, '-');
  titleEl.textContent = title;
  heading.appendChild(titleEl);

  const descriptionEl = document.createElement('p');
  descriptionEl.className = 'showcase-section__description';
  descriptionEl.textContent = description;
  heading.appendChild(descriptionEl);

  return heading;
}

function createDemoRow(children: HTMLElement[]): HTMLElement {
  const row = document.createElement('div');
  row.className = 'showcase-demo-row';
  for (const child of children) {
    row.appendChild(child);
  }
  return row;
}

function createButtonsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'buttons';
  section.appendChild(createSectionHeading('Button', 'You click on them!'));

  const variants = createDemoRow([
    createButton({ label: 'Primary', variant: 'primary' }),
    createButton({ label: 'Secondary', variant: 'secondary' }),
    createButton({ label: 'Ghost', variant: 'ghost' }),
    createButton({ label: 'Danger', variant: 'danger' }),
  ]);

  const sizes = createDemoRow([
    createButton({ label: 'Small', size: 'sm' }),
    createButton({ label: 'Medium', size: 'md' }),
    createButton({ label: 'Large', size: 'lg' }),
    createButton({ label: 'Extra Large', size: 'xl' }),
    createButton({ label: 'Disabled', disabled: true }),
  ]);

  section.appendChild(
    createCard({
      title: 'Variants & sizes',
      content: [variants, sizes],
    })
  );

  return section;
}

function createTopBarSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'topbar';
  section.appendChild(
    createSectionHeading('TopBar', 'Put information here + bot status/save probably')
  );

  const demo = document.createElement('div');
  demo.className = 'showcase-framed';

  demo.appendChild(
    createTopBar({
      title: 'Slack Bot Project',
      subtitle: 'Last edited today',
      actions: [
        createButton({ label: 'Settings', variant: 'ghost', size: 'sm' }),
        createButton({ label: 'Save', variant: 'primary', size: 'sm' }),
      ],
    })
  );

  section.appendChild(
    createCard({
      title: 'Example top bar',
      description: 'description',
      content: demo,
    })
  );

  return section;
}

function createSidebarSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'sidebar';
  section.appendChild(
    createSectionHeading('Sidebar', 'Like a top bar but on the side and mainly for nav')
  );

  const demo = document.createElement('div');
  demo.className = 'showcase-framed showcase-framed--sidebar';

  demo.appendChild(
    createSidebar({
      title: 'Components',
      items: [
        { id: 'triggers', label: 'Triggers' },
        { id: 'conditions', label: 'Conditions' },
        { id: 'actions', label: 'Actions' },
        { id: 'data', label: 'Data' },
      ],
      activeId: 'triggers',
    })
  );

  section.appendChild(
    createCard({
      title: 'Component library sidebar',
      content: demo,
    })
  );

  return section;
}

function createCardsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'cards';
  section.appendChild(
    createSectionHeading('Card', 'Slick info cards with the ability to add footers.')
  );

  const grid = document.createElement('div');
  grid.className = 'showcase-card-grid';

  grid.appendChild(
    createCard({
      title: 'Welcome Bot',
      description: 'Greets new members in #slacksmith.',
      content: createBadge({ label: 'Inactive', variant: 'default' }),
      footer: [
        createButton({ label: 'Start', variant: 'ghost', size: 'sm' }),
        createButton({ label: 'Edit', variant: 'primary', size: 'sm' }),
      ],
    })
  );

  grid.appendChild(
    createCard({
      title: 'Standup Reminder',
      description: 'Posts a daily prompt at 9:00 AM.',
      content: createBadge({ label: 'Running', variant: 'success' }),
      footer: [
        createButton({ label: 'Stop', variant: 'ghost', size: 'sm' }),
        createButton({ label: 'Edit', variant: 'primary', size: 'sm' }),
      ],
    })
  );

  section.appendChild(grid);
  return section;
}

function createInputsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'inputs';
  section.appendChild(
    createSectionHeading('Input', 'Text fields.')
  );

  const stack = document.createElement('div');
  stack.className = 'showcase-form-stack';

  stack.appendChild(
    createInput({
      id: 'bot-name',
      label: 'Bot name',
      placeholder: 'e.g. Welcome Bot',
      hint: 'This name appears in your project list.',
    })
  );

  stack.appendChild(
    createInput({
      id: 'bot-name-error',
      label: 'Bot name (error)',
      value: 'My/Bot',
      error: 'Name cannot contain slashes.',
    })
  );

  stack.appendChild(
    createInput({
      id: 'bot-name-disabled',
      label: 'Bot name (disabled)',
      value: 'Read-only value',
      disabled: true,
    })
  );

  section.appendChild(
    createCard({
      title: 'Text input states',
      content: stack,
    })
  );

  return section;
}

function createSelectsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'selects';
  section.appendChild(
    createSectionHeading('Select', 'Dropdown fields.')
  );

  const stack = document.createElement('div');
  stack.className = 'showcase-form-stack';

  stack.appendChild(
    createSelect({
      id: 'trigger-type',
      label: 'Trigger type',
      placeholder: 'Choose a trigger…',
      options: [
        { value: 'message', label: 'New message' },
        { value: 'reaction', label: 'Reaction added' },
        { value: 'schedule', label: 'Scheduled time' },
      ],
      hint: 'What starts this bot flow.',
    })
  );

  stack.appendChild(
    createSelect({
      id: 'channel-error',
      label: 'Channel (error)',
      value: '',
      error: 'Please select a channel.',
      options: [
        { value: 'general', label: '#general' },
        { value: 'random', label: '#random' },
      ],
    })
  );

  section.appendChild(
    createCard({
      title: 'Select states',
      content: stack,
    })
  );

  return section;
}

function createBadgesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'badges';
  section.appendChild(
    createSectionHeading('Badge', 'Yeah cant say much else.')
  );

  section.appendChild(
    createCard({
      title: 'Status variants',
      content: createDemoRow([
        createBadge({ label: 'Draft', variant: 'default' }),
        createBadge({ label: 'Running', variant: 'success' }),
        createBadge({ label: 'Paused', variant: 'warning' }),
        createBadge({ label: 'Error', variant: 'danger' }),
        createBadge({ label: 'Connected', variant: 'info' }),
      ]),
    })
  );

  return section;
}

function createEmptyStatesSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'empty-states';
  section.appendChild(
    createSectionHeading(
      'EmptyState',
      'Placeholder for when a list or panel has no content yet.'
    )
  );

  section.appendChild(
    createEmptyState({
      icon: '⚒',
      title: 'No bots yet',
      description: 'Create your first Slack bot to get started.',
      action: { label: 'Create bot', variant: 'primary' },
    })
  );

  return section;
}

function createModalsSection(): HTMLElement {
  const section = document.createElement('section');
  section.className = 'showcase-section';
  section.id = 'modals';
  section.appendChild(
    createSectionHeading('Modal', 'Popup boxes/dialogs.')
  );

  const modal = createModal({
    title: 'Delete bot project?',
    content: 'This removes the bot folder from your machine. This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Keep project',
    onConfirm: () => {
      /* showcase only */
    },
  });

  const trigger = createButton({
    label: 'Open modal',
    variant: 'secondary',
    onClick: () => modal.open(),
  });

  section.appendChild(
    createCard({
      title: 'Confirmation dialog',
      description: 'Click the button to preview the modal overlay.',
      content: trigger,
    })
  );

  return section;
}

function scrollToSection(sectionId: string): void {
  document.getElementById(sectionId)?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  });
}

export function renderComponentsPage(container: HTMLElement, onBack: () => void): void {
  container.replaceChildren();

  const page = document.createElement('div');
  page.className = 'showcase-page';

  const main = document.createElement('main');
  main.className = 'showcase-page__main';

  const content = document.createElement('div');
  content.className = 'showcase-page__content';

  content.appendChild(createButtonsSection());
  content.appendChild(createTopBarSection());
  content.appendChild(createSidebarSection());
  content.appendChild(createCardsSection());
  content.appendChild(createInputsSection());
  content.appendChild(createSelectsSection());
  content.appendChild(createBadgesSection());
  content.appendChild(createEmptyStatesSection());
  content.appendChild(createModalsSection());

  const sidebar = createSidebar({
    title: 'Components',
    items: SHOWCASE_SECTIONS.map((section) => ({
      id: section.id,
      label: section.label,
    })),
    activeId: SHOWCASE_SECTIONS[0].id,
    onSelect: (id) => {
      setSidebarActiveItem(sidebar, id);
      scrollToSection(id);
    },
  });

  main.appendChild(sidebar);
  main.appendChild(content);
  page.appendChild(main);

  const topbar = createTopBar({
    title: 'Components',
    subtitle: '',
    actions: [
      createButton({
        label: 'Back',
        variant: 'ghost',
        size: 'sm',
        onClick: onBack,
      }),
    ],
  });

  page.insertBefore(topbar, main);
  container.appendChild(page);
}
