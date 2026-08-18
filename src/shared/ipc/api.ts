import type { GetAppInfoResponse } from './contracts';
import type {
  GetFlowGraphRequest,
  GetFlowGraphResponse,
  SaveFlowGraphRequest,
  SaveFlowGraphResponse,
} from './flow-contracts';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  DuplicateProjectRequest,
  DuplicateProjectResponse,
  ListProjectsResponse,
  OpenProjectRequest,
  OpenProjectResponse,
  RenameProjectRequest,
  RenameProjectResponse,
  SaveProjectAsRequest,
  SaveProjectAsResponse,
} from './project-contracts';
import type {
  CloseBotResponse,
  GetRuntimeLogsResponse,
  GetRuntimeStateResponse,
  OpenBotRequest,
  OpenBotResponse,
  RestartBotResponse,
  StartBotResponse,
  StopBotResponse,
} from './runtime-contracts';
import type {
  ClearSlackConnectionRequest,
  ClearSlackConnectionResponse,
  GetSlackConnectionRequest,
  GetSlackConnectionResponse,
  SaveSlackConnectionRequest,
  SaveSlackConnectionResponse,
} from './slack-contracts';
import type { AppStateReport, MenuAction } from './menu-contracts';

export interface ElectronAPI {
  getAppInfo: () => Promise<GetAppInfoResponse>;
  listProjects: () => Promise<ListProjectsResponse>;
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  openProject: (request: OpenProjectRequest) => Promise<OpenProjectResponse | null>;
  renameProject: (request: RenameProjectRequest) => Promise<RenameProjectResponse>;
  deleteProject: (request: DeleteProjectRequest) => Promise<DeleteProjectResponse>;
  duplicateProject: (request: DuplicateProjectRequest) => Promise<DuplicateProjectResponse>;
  saveProjectAs: (request: SaveProjectAsRequest) => Promise<SaveProjectAsResponse>;
  getRuntimeState: () => Promise<GetRuntimeStateResponse>;
  openBot: (request: OpenBotRequest) => Promise<OpenBotResponse>;
  closeBot: () => Promise<CloseBotResponse>;
  startBot: () => Promise<StartBotResponse>;
  stopBot: () => Promise<StopBotResponse>;
  restartBot: () => Promise<RestartBotResponse>;
  getRuntimeLogs: () => Promise<GetRuntimeLogsResponse>;
  onRuntimeLogsUpdated: (callback: () => void) => () => void;
  getFlowGraph: (request: GetFlowGraphRequest) => Promise<GetFlowGraphResponse>;
  saveFlowGraph: (request: SaveFlowGraphRequest) => Promise<SaveFlowGraphResponse>;
  getSlackConnection: (request: GetSlackConnectionRequest) => Promise<GetSlackConnectionResponse>;
  saveSlackConnection: (
    request: SaveSlackConnectionRequest,
  ) => Promise<SaveSlackConnectionResponse>;
  clearSlackConnection: (
    request: ClearSlackConnectionRequest,
  ) => Promise<ClearSlackConnectionResponse>;
  onMenuAction: (callback: (action: MenuAction) => void) => () => void;
  reportAppState: (state: AppStateReport) => Promise<void>;
  refreshRecentProjectsMenu: () => Promise<void>;
}
