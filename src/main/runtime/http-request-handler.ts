import {
  resolveVariableReferences,
  setScopedVariable,
  type VariableScope,
} from '../../shared/domain/variables';
import { normalizeHttpHeaderList } from '../../shared/domain/http-headers';
import type { FlowNode } from '../../shared/domain/flow-graph';
import type { FlowExecutionContext } from './flow-execution-context';

function resolveConfigString(value: unknown, scope: VariableScope): string {
  const raw = value === undefined || value === null ? '' : String(value);
  return resolveVariableReferences(raw, scope);
}

function parseHttpHeaders(entries: unknown, scope: VariableScope): Record<string, string> {
  const headers: Record<string, string> = {};
  const normalized = normalizeHttpHeaderList(entries);

  for (const entry of normalized) {
    const name = resolveConfigString(entry.name, scope).trim();
    const value = resolveConfigString(entry.value, scope).trim();

    if (!name) {
      continue;
    }

    headers[name] = value;
  }

  return headers;
}

function parseResponseBody(rawBody: string): unknown {
  const trimmed = rawBody.trim();
  if (!trimmed) {
    return '';
  }

  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    return rawBody;
  }
}

const METHODS_WITH_BODY = new Set(['POST', 'PUT', 'PATCH']);

export async function executeHttpRequestHandler(
  node: FlowNode,
  context: FlowExecutionContext,
  scope: VariableScope,
): Promise<void> {
  const method = resolveConfigString(node.config.method, scope).trim().toUpperCase() || 'GET';
  const url = resolveConfigString(node.config.url, scope).trim();
  const storeAs = resolveConfigString(node.config.storeAs, scope).trim();
  const storeStatusAs = resolveConfigString(node.config.storeStatusAs, scope).trim();

  if (!url) {
    throw new Error('URL is required.');
  }

  if (!storeAs) {
    throw new Error('Store as variable name is required.');
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
    throw new Error('URL must start with http:// or https://');
  }

  const headers = parseHttpHeaders(node.config.headers, scope);
  const requestInit: RequestInit = {
    method,
    headers,
    signal: context.abortSignal,
  };

  if (METHODS_WITH_BODY.has(method)) {
    const body = resolveConfigString(node.config.body, scope);
    if (body.trim().length > 0) {
      requestInit.body = body;

      const hasContentType = Object.keys(headers).some(
        (name) => name.toLowerCase() === 'content-type',
      );

      if (!hasContentType) {
        requestInit.headers = {
          ...headers,
          'Content-Type': 'application/json',
        };
      }
    }
  }

  const response = await fetch(parsedUrl.toString(), requestInit);
  const responseText = await response.text();
  const parsedBody = parseResponseBody(responseText);

  const bodyTarget = setScopedVariable(scope, storeAs, parsedBody);
  let statusTarget: 'local' | 'global' | null = null;

  if (storeStatusAs.trim().length > 0) {
    statusTarget = setScopedVariable(scope, storeStatusAs, response.status);
  }

  if (bodyTarget === 'global' || statusTarget === 'global') {
    context.globalVariableStore.scheduleSave();
  }

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  }

  context.logger.info('execution', `HTTP ${method} ${parsedUrl.host} returned ${response.status}`, {
    nodeId: node.id,
    nodeName: node.name,
  });
}
