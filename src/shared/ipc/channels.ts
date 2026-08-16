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
  RUNTIME_START_BOT: 'runtime:start-bot',
  RUNTIME_STOP_BOT: 'runtime:stop-bot',
  RUNTIME_RESTART_BOT: 'runtime:restart-bot',
  RUNTIME_GET_LOGS: 'runtime:get-logs',
  FLOW_GET: 'flow:get',
  FLOW_SAVE: 'flow:save',
  SLACK_GET_CONNECTION: 'slack:get-connection',
  SLACK_SAVE_CONNECTION: 'slack:save-connection',
  SLACK_CLEAR_CONNECTION: 'slack:clear-connection',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
