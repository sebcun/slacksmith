import { createRouter } from './router.js';
import { initMenuHandler } from './menu-handler.js';
import { renderLogsWindowPage } from './pages/logs-window-page.js';
import { initializeTheme } from './theme/theme-manager.js';

const appRoot = document.getElementById('app');
const isLogsWindow = new URLSearchParams(window.location.search).get('view') === 'logs';

async function bootstrap(): Promise<void> {
  if (!appRoot) {
    return;
  }

  await initializeTheme();

  if (isLogsWindow) {
    renderLogsWindowPage(appRoot);
    return;
  }

  const { navigate, rerenderEditor } = createRouter(appRoot);
  initMenuHandler({ navigate, rerenderEditor });
  navigate('home');
}

void bootstrap();
