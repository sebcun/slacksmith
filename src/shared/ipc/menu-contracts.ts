export type AppPage = 'home' | 'components' | 'editor';

export type MenuAction =
  | { type: 'file:open' }
  | { type: 'file:open-recent'; projectId: string }
  | { type: 'file:save' }
  | { type: 'file:save-as' }
  | { type: 'file:close' }
  | { type: 'bot:run' }
  | { type: 'bot:run-independently' }
  | { type: 'bot:stop' }
  | { type: 'bot:restart' }
  | { type: 'bot:slack-settings' }
  | { type: 'theme:select'; themeId: string };

export interface AppStateReport {
  page: AppPage;
  hasActiveProject: boolean;
  runtimeStatus: 'inactive' | 'running' | 'paused' | 'error';
}
