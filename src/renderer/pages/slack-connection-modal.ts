import {
  createButton,
  createInput,
  createModal,
  type ModalHandle,
} from '../components/index.js';
import type { SlackConnectionSummary } from '../../shared/domain/slack-config.js';

type CredentialField = 'botToken' | 'appToken' | 'signingSecret';

interface FieldState {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

function getSlackConnectionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to save Slack connection. Please try again.';
}

function createInstructions(): HTMLElement {
  const instructions = document.createElement('div');
  instructions.className = 'slack-connection-modal__instructions';

  const intro = document.createElement('p');
  intro.className = 'slack-connection-modal__intro';
  intro.textContent =
    'Connect this bot to a Slack app using Socket Mode. Credentials are stored locally inside this project folder and are never sent anywhere except Slack when verifying the connection.';
  instructions.appendChild(intro);

  const steps = document.createElement('ol');
  steps.className = 'slack-connection-modal__steps';

  const stepItems = [
    'Create or open a Slack app at api.slack.com/apps.',
    'Enable Socket Mode and create an app-level token with the connections:write scope.',
    'Under Event Subscriptions, enable events and subscribe to message.channels (and message.groups / message.im if needed).',
    'Under OAuth & Permissions, add bot scopes: channels:history, chat:write, and reactions:write (reinstall the app after changing scopes).',
    'Install the app to your workspace, invite the bot to your channel (/invite @YourBot), and copy the Bot User OAuth Token.',
    'Copy the Signing Secret from Basic Information.',
    'Paste all three values below and click Test & save.',
  ];

  for (const step of stepItems) {
    const item = document.createElement('li');
    item.textContent = step;
    steps.appendChild(item);
  }

  instructions.appendChild(steps);

  const link = document.createElement('a');
  link.className = 'slack-connection-modal__link';
  link.href = 'https://api.slack.com/apps';
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.textContent = 'Open Slack app dashboard';
  instructions.appendChild(link);

  return instructions;
}

function createStatusBanner(connection: SlackConnectionSummary): HTMLElement {
  const banner = document.createElement('div');
  banner.className = 'slack-connection-modal__status';

  if (!connection.configured) {
    banner.classList.add('slack-connection-modal__status--disconnected');
    banner.textContent = 'Not connected to Slack yet.';
    return banner;
  }

  banner.classList.add('slack-connection-modal__status--connected');

  const title = document.createElement('p');
  title.className = 'slack-connection-modal__status-title';
  title.textContent = `Connected to ${connection.teamName ?? 'workspace'}`;

  const details = document.createElement('p');
  details.className = 'slack-connection-modal__status-details';
  details.textContent = `Bot: ${connection.botName ?? 'Unknown'} · Last verified ${formatVerifiedAt(connection.lastVerifiedAt)}`;

  banner.append(title, details);
  return banner;
}

function formatVerifiedAt(isoDate?: string): string {
  if (!isoDate) {
    return 'recently';
  }

  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) {
    return 'recently';
  }

  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export interface SlackConnectionModalOptions {
  projectId: string;
  initialConnection: SlackConnectionSummary;
  onConnectionChanged: (connection: SlackConnectionSummary) => void | Promise<void>;
}

export function createSlackConnectionModal(options: SlackConnectionModalOptions): ModalHandle {
  const { projectId, onConnectionChanged } = options;

  let connection = options.initialConnection;
  let fieldValues: FieldState = {
    botToken: '',
    appToken: '',
    signingSecret: '',
  };
  let fieldErrors: Partial<Record<CredentialField, string>> = {};
  let isSubmitting = false;
  let isDisconnecting = false;

  const content = document.createElement('div');
  content.className = 'slack-connection-modal';

  const statusHost = document.createElement('div');
  const instructions = createInstructions();
  const fieldsHost = document.createElement('div');
  fieldsHost.className = 'slack-connection-modal__fields';

  const formErrorEl = document.createElement('p');
  formErrorEl.className = 'slack-connection-modal__form-error';
  formErrorEl.hidden = true;

  content.append(statusHost, instructions, fieldsHost, formErrorEl);

  function renderStatus(): void {
    statusHost.replaceChildren(createStatusBanner(connection));
  }

  function renderFields(): void {
    fieldsHost.replaceChildren(
      createInput({
        id: 'slack-bot-token',
        label: 'Bot User OAuth Token',
        type: 'password',
        value: fieldValues.botToken,
        placeholder: 'xoxb-...',
        hint: fieldErrors.botToken ? undefined : 'From OAuth & Permissions after installing the app.',
        error: fieldErrors.botToken,
        disabled: isSubmitting || isDisconnecting,
        onInput: (value) => {
          fieldValues = { ...fieldValues, botToken: value };
          if (fieldErrors.botToken) {
            fieldErrors = { ...fieldErrors, botToken: undefined };
            renderFields();
          }
        },
      }),
      createInput({
        id: 'slack-app-token',
        label: 'App-Level Token',
        type: 'password',
        value: fieldValues.appToken,
        placeholder: 'xapp-...',
        hint: fieldErrors.appToken
          ? undefined
          : 'From Socket Mode with the connections:write scope.',
        error: fieldErrors.appToken,
        disabled: isSubmitting || isDisconnecting,
        onInput: (value) => {
          fieldValues = { ...fieldValues, appToken: value };
          if (fieldErrors.appToken) {
            fieldErrors = { ...fieldErrors, appToken: undefined };
            renderFields();
          }
        },
      }),
      createInput({
        id: 'slack-signing-secret',
        label: 'Signing Secret',
        type: 'password',
        value: fieldValues.signingSecret,
        placeholder: 'From Basic Information',
        hint: fieldErrors.signingSecret ? undefined : 'Used to verify requests from Slack.',
        error: fieldErrors.signingSecret,
        disabled: isSubmitting || isDisconnecting,
        onInput: (value) => {
          fieldValues = { ...fieldValues, signingSecret: value };
          if (fieldErrors.signingSecret) {
            fieldErrors = { ...fieldErrors, signingSecret: undefined };
            renderFields();
          }
        },
      }),
    );
  }

  function setFormError(message: string | undefined): void {
    formErrorEl.hidden = !message;
    formErrorEl.textContent = message ?? '';
  }

  function resetFormState(): void {
    fieldValues = {
      botToken: '',
      appToken: '',
      signingSecret: '',
    };
    fieldErrors = {};
    setFormError(undefined);
  }

  renderStatus();
  renderFields();

  const modal = createModal({
    title: 'Slack connection',
    content,
    confirmLabel: 'Test & save',
    cancelLabel: 'Close',
    closeOnBackdrop: !isSubmitting && !isDisconnecting,
    onCancel: () => {
      if (isSubmitting || isDisconnecting) {
        return false;
      }
    },
    onConfirm: () => handleSave(),
  });

  let disconnectButton: HTMLButtonElement | null = null;

  const footer = modal.element.querySelector('.modal__footer');

  if (footer) {
    disconnectButton = createButton({
      label: 'Disconnect',
      variant: 'ghost',
      size: 'sm',
      onClick: () => {
        void handleDisconnect();
      },
    });
    disconnectButton.classList.add('slack-connection-modal__disconnect');
    footer.insertBefore(disconnectButton, footer.firstChild);
  }

  function updateDisconnectButton(): void {
    if (!disconnectButton) {
      return;
    }

    disconnectButton.hidden = !connection.configured;
    disconnectButton.disabled = isSubmitting || isDisconnecting;
  }

  updateDisconnectButton();

  async function handleSave(): Promise<boolean> {
    if (isSubmitting || isDisconnecting) {
      return false;
    }

    isSubmitting = true;
    fieldErrors = {};
    setFormError(undefined);
    renderFields();
    updateDisconnectButton();

    try {
      connection = await window.electronAPI.saveSlackConnection({
        projectId,
        credentials: fieldValues,
      });
      resetFormState();
      renderStatus();
      renderFields();
      await onConnectionChanged(connection);
      return true;
    } catch (error) {
      setFormError(getSlackConnectionErrorMessage(error));
      fieldsHost.querySelector('input')?.focus();
      return false;
    } finally {
      isSubmitting = false;
      renderFields();
      updateDisconnectButton();
    }
  }

  async function handleDisconnect(): Promise<void> {
    if (isSubmitting || isDisconnecting || !connection.configured) {
      return;
    }

    isDisconnecting = true;
    setFormError(undefined);
    renderFields();
    updateDisconnectButton();

    try {
      connection = await window.electronAPI.clearSlackConnection({ projectId });
      resetFormState();
      renderStatus();
      renderFields();
      await onConnectionChanged(connection);
    } catch (error) {
      setFormError(getSlackConnectionErrorMessage(error));
    } finally {
      isDisconnecting = false;
      renderFields();
      updateDisconnectButton();
    }
  }

  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      void (async () => {
        connection = await window.electronAPI.getSlackConnection({ projectId });
        resetFormState();
        renderStatus();
        renderFields();
        updateDisconnectButton();
        originalOpen();
        requestAnimationFrame(() => {
          fieldsHost.querySelector('input')?.focus();
        });
      })();
    },
  };
}

export function openSlackConnectionModal(options: SlackConnectionModalOptions): void {
  createSlackConnectionModal(options).open();
}
