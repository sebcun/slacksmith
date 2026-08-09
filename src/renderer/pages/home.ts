function setAppInfoMessage(element: HTMLElement, message: string): void {
  element.textContent = message;
}

export async function renderHomePage(container: HTMLElement): Promise<void> {
  container.innerHTML = `
    <main class="home-page">
      <h1>SlackSmith</h1>
      <p id="app-info" class="app-info">Loading app info…</p>
    </main>
  `;

  const infoElement = container.querySelector<HTMLElement>('#app-info');
  if (!infoElement) {
    return;
  }

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
