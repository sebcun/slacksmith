import { app } from 'electron';
import path from 'path';

export function getThemesRoot(): string {
  return path.join(app.getPath('userData'), 'themes');
}

export function getThemePreferencesPath(): string {
  return path.join(app.getPath('userData'), 'theme-preferences.json');
}
