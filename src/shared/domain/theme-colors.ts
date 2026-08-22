/** Color tokens that can be overridden per theme file. */
export const THEME_COLOR_KEYS = [
  'color-bg',
  'color-bg-subtle',
  'color-surface',
  'color-surface-hover',
  'color-border',
  'color-border-strong',
  'color-text',
  'color-text-muted',
  'color-text-subtle',
  'color-text-inverse',
  'color-accent',
  'color-accent-hover',
  'color-accent-subtle',
  'color-accent-text',
  'color-danger',
  'color-danger-hover',
  'color-danger-subtle',
  'color-success',
  'color-success-subtle',
  'color-warning',
  'color-warning-subtle',
  'color-info',
  'color-info-subtle',
  'color-focus-ring',
] as const;

export type ThemeColorKey = (typeof THEME_COLOR_KEYS)[number];

export type ThemeColors = Record<ThemeColorKey, string>;

export interface ThemeDefinition {
  name: string;
  colors: ThemeColors;
}

export interface ThemeSummary {
  id: string;
  name: string;
}
