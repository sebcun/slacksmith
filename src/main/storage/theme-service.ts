import { promises as fs } from 'fs';
import path from 'path';

import {
  THEME_COLOR_KEYS,
  type ThemeColors,
  type ThemeDefinition,
  type ThemeSummary,
} from '../../shared/domain/theme-colors';
import { DEFAULT_LIGHT_THEME, DEFAULT_THEME_FILES } from './default-themes';
import { getThemePreferencesPath, getThemesRoot } from './theme-paths';

const DEFAULT_ACTIVE_THEME_ID = 'light';

interface ThemePreferences {
  activeThemeId: string;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isThemeColors(value: unknown): value is ThemeColors {
  if (!isRecord(value)) {
    return false;
  }

  return THEME_COLOR_KEYS.every((key) => typeof value[key] === 'string');
}

function isThemeDefinition(value: unknown): value is ThemeDefinition {
  if (!isRecord(value)) {
    return false;
  }

  return typeof value.name === 'string' && isThemeColors(value.colors);
}

function mergeWithDefaults(colors: ThemeColors, fallback: ThemeColors): ThemeColors {
  const merged = { ...fallback };

  for (const key of THEME_COLOR_KEYS) {
    const value = colors[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      merged[key] = value;
    }
  }

  return merged;
}

function formatThemeName(themeId: string, name?: string): string {
  if (name && name.trim().length > 0) {
    return name.trim();
  }

  return themeId
    .split(/[-_]+/)
    .filter((part) => part.length > 0)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

async function readThemeFile(
  themePath: string,
  themeId: string,
): Promise<ThemeDefinition | null> {
  try {
    const raw = await fs.readFile(themePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isThemeDefinition(parsed)) {
      return null;
    }

    const fallback =
      DEFAULT_THEME_FILES[themeId]?.colors ?? DEFAULT_LIGHT_THEME.colors;

    return {
      name: formatThemeName(themeId, parsed.name),
      colors: mergeWithDefaults(parsed.colors, fallback),
    };
  } catch {
    return null;
  }
}

async function readPreferences(): Promise<ThemePreferences> {
  const preferencesPath = getThemePreferencesPath();

  if (!(await pathExists(preferencesPath))) {
    return { activeThemeId: DEFAULT_ACTIVE_THEME_ID };
  }

  try {
    const raw = await fs.readFile(preferencesPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (isRecord(parsed) && typeof parsed.activeThemeId === 'string') {
      return { activeThemeId: parsed.activeThemeId };
    }
  } catch {
    // Fall back to default preference.
  }

  return { activeThemeId: DEFAULT_ACTIVE_THEME_ID };
}

async function writePreferences(preferences: ThemePreferences): Promise<void> {
  const preferencesPath = getThemePreferencesPath();
  await fs.writeFile(preferencesPath, `${JSON.stringify(preferences, null, 2)}\n`, 'utf8');
}

export async function ensureDefaultThemes(): Promise<void> {
  const themesRoot = getThemesRoot();
  await fs.mkdir(themesRoot, { recursive: true });

  for (const [themeId, theme] of Object.entries(DEFAULT_THEME_FILES)) {
    const themePath = path.join(themesRoot, `${themeId}.json`);

    if (await pathExists(themePath)) {
      continue;
    }

    await fs.writeFile(themePath, `${JSON.stringify(theme, null, 2)}\n`, 'utf8');
  }
}

export async function listThemes(): Promise<ThemeSummary[]> {
  await ensureDefaultThemes();

  const themesRoot = getThemesRoot();
  const entries = await fs.readdir(themesRoot, { withFileTypes: true });
  const themes: ThemeSummary[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const themeId = entry.name.slice(0, -'.json'.length);
    const themePath = path.join(themesRoot, entry.name);
    const theme = await readThemeFile(themePath, themeId);

    themes.push({
      id: themeId,
      name: theme?.name ?? formatThemeName(themeId),
    });
  }

  themes.sort((left, right) => {
    const order = ['light', 'dark', 'space', 'hackclub'];
    const leftIndex = order.indexOf(left.id);
    const rightIndex = order.indexOf(right.id);

    if (leftIndex !== -1 || rightIndex !== -1) {
      const leftRank = leftIndex === -1 ? order.length : leftIndex;
      const rightRank = rightIndex === -1 ? order.length : rightIndex;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }
    }

    return left.name.localeCompare(right.name);
  });

  return themes;
}

export async function getActiveThemeId(): Promise<string> {
  await ensureDefaultThemes();

  const preferences = await readPreferences();
  const themes = await listThemes();
  const themeIds = new Set(themes.map((theme) => theme.id));

  if (themeIds.has(preferences.activeThemeId)) {
    return preferences.activeThemeId;
  }

  return DEFAULT_ACTIVE_THEME_ID;
}

export async function setActiveThemeId(themeId: string): Promise<string> {
  await ensureDefaultThemes();

  const themes = await listThemes();
  const themeExists = themes.some((theme) => theme.id === themeId);

  if (!themeExists) {
    throw new Error(`Theme "${themeId}" was not found.`);
  }

  await writePreferences({ activeThemeId: themeId });
  return themeId;
}

export async function getThemeColors(themeId: string): Promise<ThemeDefinition> {
  await ensureDefaultThemes();

  const themePath = path.join(getThemesRoot(), `${themeId}.json`);
  const theme = await readThemeFile(themePath, themeId);

  if (!theme) {
    throw new Error(`Theme "${themeId}" could not be loaded.`);
  }

  return theme;
}

export async function getActiveThemeColors(): Promise<
  ThemeDefinition & { themeId: string }
> {
  const themeId = await getActiveThemeId();
  const theme = await getThemeColors(themeId);

  return {
    themeId,
    ...theme,
  };
}
