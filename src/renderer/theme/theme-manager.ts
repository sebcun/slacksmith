import type { ThemeColors } from '../../shared/domain/theme-colors.js';

let activeThemeId: string | null = null;

export function applyThemeColors(colors: ThemeColors): void {
  const root = document.documentElement;

  for (const [key, value] of Object.entries(colors)) {
    root.style.setProperty(`--${key}`, value);
  }
}

export async function loadAndApplyTheme(themeId: string): Promise<void> {
  const theme = await window.electronAPI.getThemeColors({ themeId });
  applyThemeColors(theme.colors);
  activeThemeId = themeId;
}

export async function initializeTheme(): Promise<string> {
  const activeTheme = await window.electronAPI.getActiveThemeColors();
  applyThemeColors(activeTheme.colors);
  activeThemeId = activeTheme.themeId;
  return activeTheme.themeId;
}

export function getActiveThemeId(): string | null {
  return activeThemeId;
}
