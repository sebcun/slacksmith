import type { GetAppInfoResponse } from './contracts';

export interface ElectronAPI {
  getAppInfo: () => Promise<GetAppInfoResponse>;
}
