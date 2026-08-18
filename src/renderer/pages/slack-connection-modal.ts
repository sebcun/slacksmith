import {
  createInput,
  createModal,
  type ModalHandle,
} from '../components/index.js';
import {
  credentialFieldsFromConnection,
  type SlackConnectionSummary,
} from '../../shared/domain/slack-config.js';

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
        disabled: isSubmitting,
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
        disabled: isSubmitting,
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
        disabled: isSubmitting,
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


  function applyConnectionToFields(nextConnection: SlackConnectionSummary): void {
    fieldValues = credentialFieldsFromConnection(nextConnection);
    fieldErrors = {};
    setFormError(undefined);
  }

  renderStatus();
  renderFields();

  const modal = createModal({
    title: 'Slack Connection Settings',
    content,
    confirmLabel: 'Test & save',
    cancelLabel: 'Close',
    closeOnBackdrop: !isSubmitting,
    onCancel: () => {
      if (isSubmitting) {
        return false;
      }
    },
    onConfirm: () => handleSave(),
  });




  async function handleSave(): Promise<boolean> {
    if (isSubmitting) {
      return false;
    }

    isSubmitting = true;
    fieldErrors = {};
    setFormError(undefined);
    renderFields();

    try {
      connection = await window.electronAPI.saveSlackConnection({
        projectId,
        credentials: fieldValues,
      });
      applyConnectionToFields(connection);
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
    }
  }


  const originalOpen = modal.open.bind(modal);

  return {
    ...modal,
    open: () => {
      void (async () => {
        connection = await window.electronAPI.getSlackConnection({ projectId });
        applyConnectionToFields(connection);
        renderStatus();
        renderFields();
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
