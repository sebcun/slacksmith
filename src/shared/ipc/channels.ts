export const IPC_CHANNELS = {
  GET_APP_INFO: 'app:get-info',
} as const;

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS];
