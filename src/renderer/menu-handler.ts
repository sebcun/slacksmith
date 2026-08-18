import type { BotRuntimeStatus } from '../shared/domain/bot-project.js';
import type { AppPage, MenuAction } from '../shared/ipc/menu-contracts.js';

export interface EditorMenuCallbacks {
  flushSave: () => Promise<void>;
  openSlackSettings: () => void;
  applyRuntimeState: (state: { status: BotRuntimeStatus; lastError: string | null }) => void;
  runIndependently: () => Promise<void>;
  getProjectId: () => string;
  onClose: () => Promise<void>;
}

interface MenuHandlerOptions {
  navigate: (page: AppPage) => void;
  rerenderEditor: () => Promise<void>;
}

let navigateFn: (page: AppPage) => void = () => undefined;
let rerenderEditorFn: () => Promise<void> = async () => undefined;
let currentPage: AppPage = 'home';
let editorCallbacks: EditorMenuCallbacks | null = null;

export function initMenuHandler(options: MenuHandlerOptions): void {
  navigateFn = options.navigate;
  rerenderEditorFn = options.rerenderEditor;

  window.electronAPI.onMenuAction((action) => {
    void handleMenuAction(action);
  });
}

export function setCurrentPage(page: AppPage): void {
  currentPage = page;
  void reportAppState();
}

export function setEditorMenuCallbacks(callbacks: EditorMenuCallbacks | null): void {
  editorCallbacks = callbacks;
  void reportAppState();
}

async function reportAppState(): Promise<void> {
  let hasActiveProject = false;
  let runtimeStatus: BotRuntimeStatus = 'inactive';

  try {
    const runtimeState = await window.electronAPI.getRuntimeState();
    hasActiveProject = runtimeState.activeProject !== null;
    runtimeStatus = runtimeState.status;
  } catch (error) {
    console.error('Failed to read runtime state for menu:', error);
  }

  await window.electronAPI.reportAppState({
    page: currentPage,
    hasActiveProject,
    runtimeStatus,
  });
}

async function openProjectInEditor(projectId: string): Promise<void> {
  if (editorCallbacks) {
    await editorCallbacks.flushSave();
  }

  await window.electronAPI.openBot({ id: projectId });
  navigateFn('editor');
}

async function handleMenuAction(action: MenuAction): Promise<void> {
  switch (action.type) {
    case 'file:open': {
      try {
        if (editorCallbacks) {
          await editorCallbacks.flushSave();
        }

        const project = await window.electronAPI.openProject({ kind: 'dialog' });
        if (!project) {
          return;
        }

        await window.electronAPI.openBot({ id: project.id });
        await window.electronAPI.refreshRecentProjectsMenu();
        navigateFn('editor');
      } catch (error) {
        console.error('Failed to open project from menu:', error);
      }
      break;
    }

    case 'file:open-recent': {
      try {
        await openProjectInEditor(action.projectId);
        await window.electronAPI.refreshRecentProjectsMenu();
      } catch (error) {
        console.error('Failed to open recent project from menu:', error);
      }
      break;
    }

    case 'file:save': {
      if (editorCallbacks) {
        await editorCallbacks.flushSave();
      }
      break;
    }

    case 'file:save-as': {
      if (!editorCallbacks) {
        return;
      }

      try {
        await editorCallbacks.flushSave();
        const projectId = editorCallbacks.getProjectId();
        const savedProject = await window.electronAPI.saveProjectAs({ id: projectId });

        if (!savedProject) {
          return;
        }

        await window.electronAPI.openBot({ id: savedProject.id });
        await window.electronAPI.refreshRecentProjectsMenu();
        await rerenderEditorFn();
      } catch (error) {
        console.error('Failed to save project as from menu:', error);
      }
      break;
    }

    case 'file:close': {
      if (editorCallbacks) {
        await editorCallbacks.onClose();
      } else {
        try {
          await window.electronAPI.closeBot();
          navigateFn('home');
        } catch (error) {
          console.error('Failed to close project from menu:', error);
        }
      }
      break;
    }

    case 'bot:run': {
      if (!editorCallbacks) {
        return;
      }

      try {
        await editorCallbacks.flushSave();
        const state = await window.electronAPI.startBot();
        editorCallbacks.applyRuntimeState(state);
      } catch (error) {
        console.error('Failed to run bot from menu:', error);
        const state = await window.electronAPI.getRuntimeState();
        editorCallbacks.applyRuntimeState(state);
      }
      await reportAppState();
      break;
    }

    case 'bot:run-independently': {
      if (!editorCallbacks) {
        return;
      }

      try {
        await editorCallbacks.runIndependently();
      } catch (error) {
        console.error('Failed to run bot independently from menu:', error);
      }
      await reportAppState();
      break;
    }

    case 'bot:stop': {
      if (!editorCallbacks) {
        return;
      }

      try {
        const state = await window.electronAPI.stopBot();
        editorCallbacks.applyRuntimeState(state);
      } catch (error) {
        console.error('Failed to stop bot from menu:', error);
        const state = await window.electronAPI.getRuntimeState();
        editorCallbacks.applyRuntimeState(state);
      }
      await reportAppState();
      break;
    }

    case 'bot:restart': {
      if (!editorCallbacks) {
        return;
      }

      try {
        await editorCallbacks.flushSave();
        const state = await window.electronAPI.restartBot();
        editorCallbacks.applyRuntimeState(state);
      } catch (error) {
        console.error('Failed to restart bot from menu:', error);
        const state = await window.electronAPI.getRuntimeState();
        editorCallbacks.applyRuntimeState(state);
      }
      await reportAppState();
      break;
    }

    case 'bot:slack-settings': {
      editorCallbacks?.openSlackSettings();
      break;
    }
  }
}

export { reportAppState };
