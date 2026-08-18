import { randomUUID } from 'crypto';
import { promises as fs } from 'fs';
import path from 'path';

import {
  RUNTIME_LOG_FILE_NAME,
  RUNTIME_LOG_RELATIVE_DIR,
  type RuntimeLogCategory,
  type RuntimeLogEntry,
  type RuntimeLogLevel,
} from '../../shared/domain/runtime-log';

const MAX_IN_MEMORY_ENTRIES = 200;

export class RuntimeLogger {
  private readonly entries: RuntimeLogEntry[] = [];
  private readonly logFilePath: string;
  private readonly changeListeners = new Set<() => void>();

  constructor(projectPath: string) {
    this.logFilePath = path.join(projectPath, RUNTIME_LOG_RELATIVE_DIR, RUNTIME_LOG_FILE_NAME);
  }

  onChange(listener: () => void): () => void {
    this.changeListeners.add(listener);
    return () => {
      this.changeListeners.delete(listener);
    };
  }

  private emitChange(): void {
    for (const listener of this.changeListeners) {
      listener();
    }
  }

  log(
    level: RuntimeLogLevel,
    category: RuntimeLogCategory,
    message: string,
    options?: {
      nodeId?: string;
      nodeName?: string;
      details?: Record<string, unknown>;
    },
  ): RuntimeLogEntry {
    const entry: RuntimeLogEntry = {
      id: randomUUID(),
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      nodeId: options?.nodeId,
      nodeName: options?.nodeName,
      details: options?.details,
    };

    this.entries.push(entry);

    if (this.entries.length > MAX_IN_MEMORY_ENTRIES) {
      this.entries.shift();
    }

    void this.persistEntry(entry);
    this.emitChange();

    return entry;
  }

  info(category: RuntimeLogCategory, message: string, options?: Parameters<RuntimeLogger['log']>[3]): void {
    this.log('info', category, message, options);
  }

  warn(category: RuntimeLogCategory, message: string, options?: Parameters<RuntimeLogger['log']>[3]): void {
    this.log('warn', category, message, options);
  }

  error(category: RuntimeLogCategory, message: string, options?: Parameters<RuntimeLogger['log']>[3]): void {
    this.log('error', category, message, options);
  }

  debug(category: RuntimeLogCategory, message: string, options?: Parameters<RuntimeLogger['log']>[3]): void {
    this.log('debug', category, message, options);
  }

  getEntries(): RuntimeLogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries.length = 0;
    this.emitChange();
  }

  private async persistEntry(entry: RuntimeLogEntry): Promise<void> {
    const logDir = path.dirname(this.logFilePath);

    try {
      await fs.mkdir(logDir, { recursive: true });
      await fs.appendFile(this.logFilePath, `${JSON.stringify(entry)}\n`, 'utf8');
    } catch {
      // 
    }
  }
}
