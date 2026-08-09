import { contextBridge, ipcRenderer } from 'electron';

const GET_APP_INFO_CHANNEL = 'app:get-info';

contextBridge.exposeInMainWorld('electronAPI', {
  getAppInfo: () => ipcRenderer.invoke(GET_APP_INFO_CHANNEL),
});
