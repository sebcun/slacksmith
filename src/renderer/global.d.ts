import type { ElectronAPI } from '../shared/ipc/api';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};
