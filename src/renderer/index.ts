import { createRouter } from './router.js';

const appRoot = document.getElementById('app');

if (appRoot) {
  const { navigate } = createRouter(appRoot);
  navigate('home');
}
