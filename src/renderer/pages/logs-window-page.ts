import type { BotRuntimeStatus } from '../../shared/domain/bot-project.js';
import type { RuntimeLogEntry } from '../../shared/domain/runtime-log.js';

const POLL_INTERVAL_MS = 1000;

const STATUS_LABELS: Record<BotRuntimeStatus, string> = {
  inactive: 'Stopped',
  running: 'Running',
  paused: 'Paused',
  error: 'Error',
};

function formatLogTimestamp(isoDate: string): string {
  const date = new Date(isoDate);

  if (Number.isNaN(date.getTime())) {
    return isoDate;
  }

  return date.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function createStatusBadge(status: BotRuntimeStatus): HTMLElement {
  const badge = document.createElement('div');
  badge.className = `logs-window__status logs-window__status--${status}`;

  const dot = document.createElement('span');
  dot.className = 'logs-window__status-dot';
  dot.setAttribute('aria-hidden', 'true');

  const label = document.createElement('span');
  label.textContent = STATUS_LABELS[status];

  badge.appendChild(dot);
  badge.appendChild(label);
  return badge;
}

function renderLogLine(entry: RuntimeLogEntry): HTMLElement {
  const line = document.createElement('div');
  line.className = `logs-window__line logs-window__line--${entry.level}`;

  const time = document.createElement('span');
  time.className = 'logs-window__line-time';
  time.textContent = formatLogTimestamp(entry.timestamp);

  const level = document.createElement('span');
  level.className = 'logs-window__line-level';
  level.textContent = entry.level;

  const category = document.createElement('span');
  category.className = 'logs-window__line-category';
  category.textContent = entry.category;

  const message = document.createElement('span');
  message.className = 'logs-window__line-message';
  message.textContent = entry.nodeName ? `${entry.nodeName}: ${entry.message}` : entry.message;

  line.appendChild(time);
  line.appendChild(level);
  line.appendChild(category);
  line.appendChild(message);

  return line;
}

function isScrolledToBottom(element: HTMLElement, threshold = 24): boolean {
  return element.scrollHeight - element.scrollTop - element.clientHeight <= threshold;
}

function renderInitialEmptyState(output: HTMLElement): void {
  output.replaceChildren();
  const empty = document.createElement('p');
  empty.className = 'logs-window__empty';
  empty.textContent = 'Waiting for bot activity. Start the bot to see runtime logs here.';
  output.appendChild(empty);
}

function renderErrorState(root: HTMLElement, message: string): void {
  root.replaceChildren();

  const closed = document.createElement('div');
  closed.className = 'logs-window__closed';

  const text = document.createElement('p');
  text.className = 'logs-window__closed-message';
  text.textContent = message;

  closed.appendChild(text);
  root.appendChild(closed);
}

export function renderLogsWindowPage(root: HTMLElement): () => void {
  if (!window.electronAPI) {
    renderErrorState(root, 'Unable to connect to the app runtime.');
    return () => undefined;
  }

  root.replaceChildren();

  const shell = document.createElement('div');
  shell.className = 'logs-window';

  const header = document.createElement('header');
  header.className = 'logs-window__header';

  const headerMain = document.createElement('div');
  headerMain.className = 'logs-window__header-main';

  const title = document.createElement('h1');
  title.className = 'logs-window__title';
  title.textContent = 'Bot Logs';

  const subtitle = document.createElement('p');
  subtitle.className = 'logs-window__subtitle';
  subtitle.textContent = 'Loading project…';

  headerMain.appendChild(title);
  headerMain.appendChild(subtitle);

  const statusHost = document.createElement('div');
  statusHost.appendChild(createStatusBadge('inactive'));

  header.appendChild(headerMain);
  header.appendChild(statusHost);

  const terminal = document.createElement('section');
  terminal.className = 'logs-window__terminal';
  terminal.setAttribute('aria-label', 'Bot runtime output');

  const toolbar = document.createElement('div');
  toolbar.className = 'logs-window__terminal-toolbar';

  const terminalLabel = document.createElement('span');
  terminalLabel.className = 'logs-window__terminal-label';
  terminalLabel.textContent = 'runtime output';

  const terminalMeta = document.createElement('span');
  terminalMeta.className = 'logs-window__terminal-meta';
  terminalMeta.textContent = '0 entries';

  toolbar.appendChild(terminalLabel);
  toolbar.appendChild(terminalMeta);

  const output = document.createElement('div');
  output.className = 'logs-window__output';
  output.tabIndex = 0;
  renderInitialEmptyState(output);

  terminal.appendChild(toolbar);
  terminal.appendChild(output);

  shell.appendChild(header);
  shell.appendChild(terminal);
  root.appendChild(shell);

  let lastRenderedSignature = '';
  let hasActiveProject = true;

  function renderClosedState(): void {
    root.replaceChildren();

    const closed = document.createElement('div');
    closed.className = 'logs-window__closed';

    const message = document.createElement('p');
    message.className = 'logs-window__closed-message';
    message.textContent = 'This project was closed. The logs window will close automatically.';

    closed.appendChild(message);
    root.appendChild(closed);
  }

  function renderEntries(entries: RuntimeLogEntry[]): void {
    const signature = entries.map((entry) => entry.id).join('|');
    const shouldStickToBottom = isScrolledToBottom(output) || signature !== lastRenderedSignature;

    if (entries.length === 0) {
      renderInitialEmptyState(output);
      terminalMeta.textContent = '0 entries';
      lastRenderedSignature = signature;
      return;
    }

    if (signature === lastRenderedSignature) {
      terminalMeta.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
      return;
    }

    output.replaceChildren();

    for (const entry of entries) {
      output.appendChild(renderLogLine(entry));
    }

    terminalMeta.textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
    lastRenderedSignature = signature;

    if (shouldStickToBottom) {
      output.scrollTop = output.scrollHeight;
    }
  }

  async function refresh(): Promise<void> {
    if (!hasActiveProject) {
      return;
    }

    try {
      const [runtimeState, entries] = await Promise.all([
        window.electronAPI.getRuntimeState(),
        window.electronAPI.getRuntimeLogs(),
      ]);

      if (!runtimeState.activeProject) {
        hasActiveProject = false;
        renderClosedState();
        return;
      }

      subtitle.textContent = runtimeState.activeProject.name;
      document.title = `Bot Logs — ${runtimeState.activeProject.name}`;

      statusHost.replaceChildren(createStatusBadge(runtimeState.status));
      renderEntries(entries);

      if (runtimeState.lastError) {
        subtitle.textContent = `${runtimeState.activeProject.name} · ${runtimeState.lastError}`;
      }
    } catch (error) {
      console.error('Failed to refresh bot logs:', error);
    }
  }

  const interval = window.setInterval(() => {
    void refresh();
  }, POLL_INTERVAL_MS);

  const unsubscribeLogsUpdated = window.electronAPI.onRuntimeLogsUpdated(() => {
    void refresh();
  });

  void refresh();

  return () => {
    window.clearInterval(interval);
    unsubscribeLogsUpdated();
  };
}
