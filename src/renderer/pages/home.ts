import { createButton } from '../components/index.js';

function setAppInfoMessage(element: HTMLElement, message: string): void {
  element.textContent = message;
}

export async function renderHomePage(
  container: HTMLElement,
  onOpenComponents: () => void,
): Promise<void> {
  container.replaceChildren();

  const main = document.createElement('main');
  main.className = 'home-page';

  const title = document.createElement('h1');
  title.textContent = 'SlackSmith';
  main.appendChild(title);

  const infoElement = document.createElement('p');
  infoElement.id = 'app-info';
  infoElement.className = 'app-info';
  infoElement.textContent = 'Loading app info…';
  main.appendChild(infoElement);

  const actions = document.createElement('div');
  actions.className = 'home-page__actions';
  actions.appendChild(
    createButton({
      label: 'Components',
      variant: 'secondary',
      onClick: onOpenComponents,
    }),
  );
  main.appendChild(actions);

  container.appendChild(main);

  if (!window.electronAPI?.getAppInfo) {
    setAppInfoMessage(
      infoElement,
      'Preload bridge unavailable. Rebuild the app and restart.',
    );
    return;
  }

  try {
    const info = await window.electronAPI.getAppInfo();
    setAppInfoMessage(
      infoElement,
      `${info.name} v${info.version} (${info.platform})`,
    );
  } catch {
    setAppInfoMessage(infoElement, 'Unable to load app info from main process.');
  }
}
