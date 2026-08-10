import { renderEditorPage } from './pages/editor.js';
import { renderComponentsPage } from './pages/components.js';
import { renderHomePage } from './pages/home.js';

export type AppPage = 'home' | 'components' | 'editor';

export function createRouter(root: HTMLElement): {
  navigate: (page: AppPage) => void;
} {
  function navigate(page: AppPage): void {
    if (page === 'components') {
      renderComponentsPage(root, () => navigate('home'));
      return;
    }

    if (page === 'editor') {
      void renderEditorPage(root, () => navigate('home'));
      return;
    }

    void renderHomePage(root, { navigate });
  }

  return { navigate };
}
