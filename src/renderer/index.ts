import { renderHomePage } from './pages/home.js';

const appRoot = document.getElementById('app');

if (appRoot) {
  void renderHomePage(appRoot);
}
