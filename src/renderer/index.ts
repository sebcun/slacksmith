import { createRouter } from './router.js';
import { initMenuHandler } from './menu-handler.js';

const appRoot = document.getElementById('app');

if (appRoot) {
  const { navigate, rerenderEditor } = createRouter(appRoot);
  initMenuHandler({ navigate, rerenderEditor });
  navigate('home');
}
