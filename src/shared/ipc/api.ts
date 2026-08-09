import type { GetAppInfoResponse } from './contracts';
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
} from './project-contracts';
import type {
  CloseBotResponse,
  GetRuntimeStateResponse,
  OpenBotRequest,
  OpenBotResponse,
} from './runtime-contracts';

export interface ElectronAPI {
  getAppInfo: () => Promise<GetAppInfoResponse>;
  listProjects: () => Promise<ListProjectsResponse>;
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  openProject: (request: OpenProjectRequest) => Promise<OpenProjectResponse | null>;
  renameProject: (request: RenameProjectRequest) => Promise<RenameProjectResponse>;
  deleteProject: (request: DeleteProjectRequest) => Promise<DeleteProjectResponse>;
  duplicateProject: (request: DuplicateProjectRequest) => Promise<DuplicateProjectResponse>;
  getRuntimeState: () => Promise<GetRuntimeStateResponse>;
  openBot: (request: OpenBotRequest) => Promise<OpenBotResponse>;
  closeBot: () => Promise<CloseBotResponse>;
}
