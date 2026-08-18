import { createRouter } from './router.js';
import { initMenuHandler } from './menu-handler.js';
import { renderLogsWindowPage } from './pages/logs-window-page.js';

const appRoot = document.getElementById('app');
const isLogsWindow = new URLSearchParams(window.location.search).get('view') === 'logs';

if (appRoot) {
  if (isLogsWindow) {
    renderLogsWindowPage(appRoot);
  } else {
    const { navigate, rerenderEditor } = createRouter(appRoot);
    initMenuHandler({ navigate, rerenderEditor });
    navigate('home');
  }
}
