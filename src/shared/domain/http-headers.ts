export interface HttpHeaderEntry {
  name: string;
  value: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeHeaderEntry(value: unknown): HttpHeaderEntry | null {
  if (!isRecord(value)) {
    return null;
  }

  const name = typeof value.name === 'string' ? value.name : '';
  const headerValue = typeof value.value === 'string' ? value.value : '';

  if (!name.trim() && !headerValue.trim()) {
    return null;
  }

  return { name, value: headerValue };
}

function parseLegacyHeaderString(raw: string): HttpHeaderEntry | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const separatorIndex = trimmed.indexOf(':');
  if (separatorIndex === -1) {
    return { name: trimmed, value: '' };
  }

  const name = trimmed.slice(0, separatorIndex).trim();
  const value = trimmed.slice(separatorIndex + 1).trim();

  if (!name && !value) {
    return null;
  }

  return { name, value };
}

export function createEmptyHttpHeaderEntry(): HttpHeaderEntry {
  return { name: '', value: '' };
}

export function normalizeHttpHeaderList(value: unknown): HttpHeaderEntry[] {
  if (!Array.isArray(value)) {
    return [createEmptyHttpHeaderEntry()];
  }

  if (value.length === 0) {
    return [createEmptyHttpHeaderEntry()];
  }

  const entries: HttpHeaderEntry[] = [];

  for (const item of value) {
    if (typeof item === 'string') {
      const legacy = parseLegacyHeaderString(item);
      if (legacy) {
        entries.push(legacy);
      }
      continue;
    }

    const normalized = normalizeHeaderEntry(item);
    if (normalized) {
      entries.push(normalized);
    }
  }

  if (entries.length === 0) {
    return [createEmptyHttpHeaderEntry()];
  }

  return entries;
}

export function serializeHttpHeaderList(entries: HttpHeaderEntry[]): HttpHeaderEntry[] {
  return entries.map((entry) => ({
    name: entry.name,
    value: entry.value,
  }));
}
