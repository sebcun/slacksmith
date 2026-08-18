import { renderEditorPage } from './pages/editor.js';
import { renderComponentsPage } from './pages/components.js';
import { renderHomePage } from './pages/home.js';
import type { AppPage } from '../shared/ipc/menu-contracts.js';
import { setCurrentPage } from './menu-handler.js';

export type { AppPage };

export function createRouter(root: HTMLElement): {
  navigate: (page: AppPage) => void;
  rerenderEditor: () => Promise<void>;
} {
  function navigate(page: AppPage): void {
    setCurrentPage(page);

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

  async function rerenderEditor(): Promise<void> {
    await renderEditorPage(root, () => navigate('home'));
  }

  return { navigate, rerenderEditor };
}
