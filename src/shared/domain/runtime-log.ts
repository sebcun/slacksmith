export type RuntimeLogLevel = 'info' | 'warn' | 'error' | 'debug';

export type RuntimeLogCategory = 'runtime' | 'trigger' | 'execution' | 'slack';

export interface RuntimeLogEntry {
  id: string;
  timestamp: string;
  level: RuntimeLogLevel;
  category: RuntimeLogCategory;
  message: string;
  nodeId?: string;
  nodeName?: string;
  details?: Record<string, unknown>;
}

export const RUNTIME_LOG_FILE_NAME = 'runtime.jsonl';

export const RUNTIME_LOG_RELATIVE_DIR = 'logs';
