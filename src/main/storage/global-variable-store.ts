import { promises as fs } from 'fs';
import path from 'path';

import { FLOW_RELATIVE_DIR } from '../../shared/domain/flow-graph';
import { getNestedValue, setNestedValue } from '../../shared/domain/variables';

export const GLOBAL_VARIABLES_FILE_NAME = 'global-variables.json';

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export class GlobalVariableStore {
  private data: Record<string, unknown> = {};
  private readonly filePath: string;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(projectPath: string) {
    this.filePath = path.join(projectPath, FLOW_RELATIVE_DIR, GLOBAL_VARIABLES_FILE_NAME);
  }

  async load(): Promise<void> {
    if (!(await pathExists(this.filePath))) {
      this.data = {};
      return;
    }

    try {
      const raw = await fs.readFile(this.filePath, 'utf8');
      const parsed: unknown = JSON.parse(raw);

      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        this.data = parsed as Record<string, unknown>;
        return;
      }
    } catch {
      // Fall back to empty store if the file is missing or invalid.
    }

    this.data = {};
  }

  getSnapshot(): Record<string, unknown> {
    return this.data;
  }

  get(path: string): unknown {
    return getNestedValue(this.data, path);
  }

  set(path: string, value: unknown): void {
    setNestedValue(this.data, path, value);
    this.queuePersist();
  }

  replaceAll(next: Record<string, unknown>): void {
    this.data = next;
    this.queuePersist();
  }

  async flush(): Promise<void> {
    await this.persistQueue;
  }

  scheduleSave(): void {
    this.queuePersist();
  }

  private queuePersist(): void {
    this.persistQueue = this.persistQueue.then(() => this.persist());
  }

  private async persist(): Promise<void> {
    const directory = path.dirname(this.filePath);

    try {
      await fs.mkdir(directory, { recursive: true });
      await fs.writeFile(this.filePath, `${JSON.stringify(this.data, null, 2)}\n`, 'utf8');
    } catch {
      // Persistence failures should not crash flow execution.
    }
  }
}
