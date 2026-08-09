export const IPC_CHANNELS = {
  GET_APP_INFO: 'app:get-info',
  PROJECTS_LIST: 'projects:list',
  PROJECTS_CREATE: 'projects:create',
  PROJECTS_OPEN: 'projects:open',
  PROJECTS_RENAME: 'projects:rename',
  PROJECTS_DELETE: 'projects:delete',
  PROJECTS_DUPLICATE: 'projects:duplicate',
  RUNTIME_GET_STATE: 'runtime:get-state',
  RUNTIME_OPEN_BOT: 'runtime:open-bot',
  RUNTIME_CLOSE_BOT: 'runtime:close-bot',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
