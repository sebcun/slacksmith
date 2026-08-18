import { createButton, createInput, type ModalHandle } from '../components/index.js';
import {
  validateSlackCredentials,
  type SlackConnectionSummary,
} from '../../shared/domain/slack-config.js';

type CredentialField = 'botToken' | 'appToken' | 'signingSecret';

interface FieldState {
  botToken: string;
  appToken: string;
  signingSecret: string;
}

type WizardText = string | { success: string; failure: string };

type OnboardingWizardDescriptionComponent = {
  type: 'description';
  text: WizardText;
};

type OnboardingWizardImageComponent = {
  type: 'image';
  src?: string;
  alt?: string;
};

type OnboardingWizardInputComponent = {
  type: 'input';
  field: CredentialField;
  label: string;
  placeholder?: string;
  hint?: string;
};

type OnboardingWizardTestResultComponent = {
  type: 'test-result';
};

type OnboardingWizardComponent =
  | OnboardingWizardDescriptionComponent
  | OnboardingWizardImageComponent
  | OnboardingWizardInputComponent
  | OnboardingWizardTestResultComponent;

interface OnboardingWizardStep {
  id?: string;
  title: WizardText;
  components: readonly OnboardingWizardComponent[];
  action?: 'next' | 'test-and-save' | 'done';
  returnToStepId?: string;
  failureButtonLabel?: string;
}

const ONBOARDING_WIZARD_STEPS: readonly OnboardingWizardStep[] = [
  {
    title: 'Welcome to SlackSmith',
    components: [{ type: 'description', text: 'Lets get started with creating your new bot. We will start by setting up everything on the Slack API page.' }],
  },
  {
    title: 'Create an App',
    components: [{ type: 'description', text: 'Head to [Your Apps](https://api.slack.com/apps) and click "Create new app". Select "Blank App" and give it a name, and select your workspace (eg. Hackclub).' }],
  },
  {
    title: 'Setup Scopes',
    components: [{ type: 'description', text: 'Under "OAuth & Permissions" scroll to "Bot token scopes" and click "Add an OAuth scope". Then, add the following: app_mentions:read, chat:write, im:write, reactions:write, channels:write.topic, groups:write, users:read, channels:read, channels:history, groups:history, commands.' }],
  },
  {
    id: 'bot-token',
    title: 'Create a Bot Token',
    components: [
      { type: 'description', text: 'Scroll up on "OAuth & Permissions" to "OAuth Tokens" and click "Install to [workspace]" (eg. Install to Hackclub). Follow the steps, and then copy the "Bot User OAuth Token" and paste it below.' },
      {
        type: 'input',
        field: 'botToken',
        label: 'Bot User OAuth Token',
        placeholder: 'xoxb-...',
        hint: 'From OAuth & Permissions after installing the app.',
      },
    ],
  },
  {
    id: 'app-token',
    title: 'Create a App Level Token',
    components: [
    //   { type: 'image', alt: 'App-level token illustration' },
      { type: 'description', text: 'Head to "Basic Information" and scroll down to "App Level Tokens".  Click "Generate Token and Scopes", give it a name, and enter the scope connections:write. Copy the token provided and paste it below.' },
      {
        type: 'input',
        field: 'appToken',
        label: 'App-Level Token',
        placeholder: 'xapp-...',
        hint: 'From Socket Mode with the connections:write scope.',
      },
    ],
  },
  {
    id: 'signing-secret',
    title: 'Get your Signing Secret',
    components: [
      { type: 'description', text: 'On "Basic Information", find Signing Secret and click "Show" and copy it and paste below.' },
      {
        type: 'input',
        field: 'signingSecret',
        label: 'Signing Secret',
        placeholder: 'From Basic Information',
      },
    ],
    action: 'test-and-save',
  },
  {
    title: {
      success: 'Connection successful',
      failure: 'Connection failed',
    },
    components: [
      {
        type: 'description',
        text: {
          success: 'Your Slack credentials were verified and saved.',
          failure: 'We could not verify your Slack credentials.',
        },
      },
      { type: 'test-result' },
    ],
    returnToStepId: 'bot-token',
    failureButtonLabel: 'Return to start',
  },  
  {
    title: "Add the bot to a channel",
    components: [{ type: 'description', text: 'Head to a channel you have permissions for, select the people, and search and add your bot.' }],
    action: 'done',
  },
  {
    title: 'Slash Commands',
    components: [{ type: 'description', text: 'If you want to use slash commands, head to "Slash Commands" and click "Create New Command". Follow the instructions, and put the name of your command in the Slash Command component without the /' }],
  },  
  {
    title: "You're Ready!",
    components: [{ type: 'description', text: 'You are now good to start building! Lets see what you can create.' }],
    action: 'done',
  },
];

const LINK_PATTERN = /\[([^\]]+)\]\(([^)]+)\)/g;

function resolveWizardText(text: WizardText, saveSucceeded: boolean): string {
  if (typeof text === 'string') {
    return text;
  }

  return saveSucceeded ? text.success : text.failure;
}

function stepHasTestResult(step: OnboardingWizardStep): boolean {
  return step.components.some((component) => component.type === 'test-result');
}

function getInputComponents(step: OnboardingWizardStep): OnboardingWizardInputComponent[] {
  return step.components.filter(
    (component): component is OnboardingWizardInputComponent => component.type === 'input',
  );
}

function getStepIndexById(id: string): number {
  return ONBOARDING_WIZARD_STEPS.findIndex((step) => step.id === id);
}

function renderRichText(text: string): HTMLElement {
  const paragraph = document.createElement('p');
  paragraph.className = 'onboarding-wizard-modal__description';

  let lastIndex = 0;

  for (const match of text.matchAll(LINK_PATTERN)) {
    const fullMatch = match[0];
    const label = match[1];
    const url = match[2];
    const matchIndex = match.index ?? 0;

    if (matchIndex > lastIndex) {
      paragraph.appendChild(document.createTextNode(text.slice(lastIndex, matchIndex)));
    }

    if (url.startsWith('http://') || url.startsWith('https://')) {
      const link = document.createElement('a');
      link.className = 'onboarding-wizard-modal__link';
      link.href = url;
      link.textContent = label;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      paragraph.appendChild(link);
    } else {
      paragraph.appendChild(document.createTextNode(fullMatch));
    }

    lastIndex = matchIndex + fullMatch.length;
  }

  if (lastIndex < text.length) {
    paragraph.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return paragraph;
}

function renderImageComponent(component: OnboardingWizardImageComponent): HTMLElement {
  const wrapper = document.createElement('div');
  wrapper.className = 'onboarding-wizard-modal__image';

  if (component.src) {
    const image = document.createElement('img');
    image.className = 'onboarding-wizard-modal__image-media';
    image.src = component.src;
    image.alt = component.alt ?? '';
    wrapper.appendChild(image);
    return wrapper;
  }

  wrapper.classList.add('onboarding-wizard-modal__image--placeholder');
  wrapper.setAttribute('role', 'img');
  wrapper.setAttribute('aria-label', component.alt ?? 'Illustration placeholder');
  return wrapper;
}

function getSlackConnectionErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return 'Unable to save Slack connection. Please try again.';
}

function validateCredentialField(
  field: CredentialField,
  value: string,
): string | undefined {
  const validation = validateSlackCredentials({
    botToken: field === 'botToken' ? value : 'xoxb-placeholder',
    appToken: field === 'appToken' ? value : 'xapp-placeholder',
    signingSecret: field === 'signingSecret' ? value : '00000000',
  });

  if (validation.ok) {
    return undefined;
  }

  if (validation.field === field) {
    return validation.message;
  }

  return undefined;
}

export interface OnboardingWizardModalOptions {
  projectId: string;
  onComplete: (connection: SlackConnectionSummary) => void | Promise<void>;
}

export function createOnboardingWizardModal(
  options: OnboardingWizardModalOptions,
): ModalHandle {
  const { projectId, onComplete } = options;

  let currentStepIndex = 0;
  let fieldValues: FieldState = {
    botToken: '',
    appToken: '',
    signingSecret: '',
  };
  let fieldErrors: Partial<Record<CredentialField, string>> = {};
  let isSubmitting = false;
  let hasAttemptedSave = false;
  let saveSucceeded = false;
  let saveErrorMessage: string | undefined;
  let savedConnection: SlackConnectionSummary | undefined;

  let isOpen = false;

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.hidden = true;

  const modal = document.createElement('div');
  modal.className = 'modal onboarding-wizard-modal';
  modal.hidden = true;
  modal.setAttribute('role', 'presentation');

  const dialog = document.createElement('div');
  dialog.className = 'modal__dialog onboarding-wizard-modal__dialog';
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'onboarding-wizard-title');

  const header = document.createElement('header');
  header.className = 'modal__header';

  const titleEl = document.createElement('h2');
  titleEl.className = 'modal__title';
  titleEl.id = 'onboarding-wizard-title';
  header.appendChild(titleEl);

  dialog.appendChild(header);

  const body = document.createElement('div');
  body.className = 'modal__body onboarding-wizard-modal__body';
  dialog.appendChild(body);

  const footer = document.createElement('footer');
  footer.className = 'modal__footer onboarding-wizard-modal__footer';
  dialog.appendChild(footer);

  modal.appendChild(dialog);

  const wrapper = document.createElement('div');
  wrapper.appendChild(backdrop);
  wrapper.appendChild(modal);

  function getCurrentStep(): OnboardingWizardStep {
    return ONBOARDING_WIZARD_STEPS[currentStepIndex];
  }

  function renderInputComponent(component: OnboardingWizardInputComponent): HTMLElement {
    const { field, label, placeholder, hint } = component;

    return createInput({
      id: `onboarding-${field}`,
      label,
      type: 'password',
      value: fieldValues[field],
      placeholder,
      hint: fieldErrors[field] ? undefined : hint,
      error: fieldErrors[field],
      disabled: isSubmitting,
      onInput: (value) => {
        fieldValues = { ...fieldValues, [field]: value };
        if (fieldErrors[field]) {
          fieldErrors = { ...fieldErrors, [field]: undefined };
          renderBody();
        }
      },
    });
  }

  function renderTestResultComponent(): HTMLElement | null {
    if (!hasAttemptedSave) {
      return null;
    }

    if (saveSucceeded && savedConnection) {
      const status = document.createElement('div');
      status.className =
        'onboarding-wizard-modal__status onboarding-wizard-modal__status--success';

      const statusTitle = document.createElement('p');
      statusTitle.className = 'onboarding-wizard-modal__status-title';
      statusTitle.textContent = `Connected to ${savedConnection.teamName ?? 'workspace'}`;

      const statusDetails = document.createElement('p');
      statusDetails.className = 'onboarding-wizard-modal__status-details';
      statusDetails.textContent = `Bot: ${savedConnection.botName ?? 'Unknown'}`;

      status.append(statusTitle, statusDetails);
      return status;
    }

    const status = document.createElement('div');
    status.className =
      'onboarding-wizard-modal__status onboarding-wizard-modal__status--error';
    status.textContent = saveErrorMessage ?? 'Unable to verify your Slack credentials.';
    return status;
  }

  function renderComponent(component: OnboardingWizardComponent): HTMLElement | null {
    switch (component.type) {
      case 'description':
        return renderRichText(resolveWizardText(component.text, saveSucceeded));
      case 'image':
        return renderImageComponent(component);
      case 'input':
        return renderInputComponent(component);
      case 'test-result':
        return renderTestResultComponent();
      default:
        return null;
    }
  }

  function renderBody(): void {
    body.replaceChildren();

    const step = getCurrentStep();

    for (const component of step.components) {
      const element = renderComponent(component);
      if (element) {
        body.appendChild(element);
      }
    }
  }

  function renderFooter(): void {
    footer.replaceChildren();

    const step = getCurrentStep();
    const showFailureActions =
      stepHasTestResult(step) && hasAttemptedSave && !saveSucceeded && step.returnToStepId;

    if (showFailureActions) {
      footer.appendChild(
        createButton({
          label: step.failureButtonLabel ?? 'Return to start',
          variant: 'primary',
          disabled: isSubmitting,
          onClick: () => {
            const returnIndex = getStepIndexById(step.returnToStepId!);
            currentStepIndex = returnIndex >= 0 ? returnIndex : 0;
            fieldErrors = {};
            renderStep();
          },
        }),
      );
      return;
    }

    let primaryLabel = 'Next';

    if (step.action === 'done') {
      primaryLabel = 'Done';
    } else if (step.action === 'test-and-save' && isSubmitting) {
      primaryLabel = 'Testing…';
    }

    footer.appendChild(
      createButton({
        label: primaryLabel,
        variant: 'primary',
        disabled: isSubmitting,
        onClick: () => {
          void handlePrimaryAction();
        },
      }),
    );
  }

  function renderStep(): void {
    const step = getCurrentStep();
    titleEl.textContent = resolveWizardText(step.title, saveSucceeded);
    renderBody();
    renderFooter();

    requestAnimationFrame(() => {
      body.querySelector('input')?.focus();
    });
  }

  function validateCurrentStep(): boolean {
    fieldErrors = {};

    const step = getCurrentStep();
    const inputs = getInputComponents(step);

    for (const input of inputs) {
      const error = validateCredentialField(input.field, fieldValues[input.field]);
      if (error) {
        fieldErrors = { ...fieldErrors, [input.field]: error };
      }
    }

    if (Object.keys(fieldErrors).length > 0) {
      renderBody();
      body.querySelector('input')?.focus();
      return false;
    }

    return true;
  }

  async function runTestAndSave(): Promise<void> {
    isSubmitting = true;
    hasAttemptedSave = false;
    saveSucceeded = false;
    saveErrorMessage = undefined;
    savedConnection = undefined;
    renderStep();

    try {
      savedConnection = await window.electronAPI.saveSlackConnection({
        projectId,
        credentials: fieldValues,
      });
      saveSucceeded = true;
    } catch (error) {
      saveErrorMessage = getSlackConnectionErrorMessage(error);
    } finally {
      isSubmitting = false;
      hasAttemptedSave = true;
      currentStepIndex += 1;
      renderStep();
    }
  }

  async function handlePrimaryAction(): Promise<void> {
    if (isSubmitting) {
      return;
    }

    const step = getCurrentStep();

    if (step.action === 'done') {
      if (savedConnection) {
        await onComplete(savedConnection);
      }
      close();
      return;
    }

    if (stepHasTestResult(step) && hasAttemptedSave && saveSucceeded) {
      currentStepIndex += 1;
      fieldErrors = {};
      renderStep();
      return;
    }

    if (step.action === 'test-and-save') {
      if (!validateCurrentStep()) {
        return;
      }

      await runTestAndSave();
      return;
    }

    if (getInputComponents(step).length > 0 && !validateCurrentStep()) {
      return;
    }

    currentStepIndex += 1;
    fieldErrors = {};
    renderStep();
  }

  function open(): void {
    if (isOpen) {
      return;
    }

    currentStepIndex = 0;
    fieldValues = {
      botToken: '',
      appToken: '',
      signingSecret: '',
    };
    fieldErrors = {};
    isSubmitting = false;
    hasAttemptedSave = false;
    saveSucceeded = false;
    saveErrorMessage = undefined;
    savedConnection = undefined;

    isOpen = true;
    document.body.appendChild(wrapper);
    backdrop.hidden = false;
    modal.hidden = false;

    renderStep();

    requestAnimationFrame(() => {
      backdrop.classList.add('modal-backdrop--visible');
      modal.classList.add('modal--open');
    });
  }

  function close(): void {
    if (!isOpen) {
      return;
    }

    isOpen = false;
    backdrop.classList.remove('modal-backdrop--visible');
    modal.classList.remove('modal--open');

    window.setTimeout(() => {
      wrapper.remove();
      backdrop.hidden = true;
      modal.hidden = true;
    }, 200);
  }

  dialog.addEventListener('click', (event) => {
    event.stopPropagation();
  });

  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !isSubmitting) {
      const target = event.target;
      if (target instanceof HTMLInputElement) {
        event.preventDefault();
        void handlePrimaryAction();
      }
    }
  });

  return {
    element: wrapper,
    open,
    close,
    isOpen: () => isOpen,
  };
}

export function openOnboardingWizardModal(options: OnboardingWizardModalOptions): void {
  createOnboardingWizardModal(options).open();
}
