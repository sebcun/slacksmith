import type { ThemeColors, ThemeSummary } from '../domain/theme-colors';

export interface ListThemesResponse {
  themes: ThemeSummary[];
}

export interface GetActiveThemeResponse {
  themeId: string;
}

export interface SetActiveThemeRequest {
  themeId: string;
}

export interface SetActiveThemeResponse {
  themeId: string;
}

export interface GetThemeColorsRequest {
  themeId: string;
}

export interface GetThemeColorsResponse {
  themeId: string;
  name: string;
  colors: ThemeColors;
}

export interface GetActiveThemeColorsResponse {
  themeId: string;
  name: string;
  colors: ThemeColors;
}
