import type { GetAppInfoResponse } from './contracts';
import type {
  CreateProjectRequest,
  CreateProjectResponse,
  DeleteProjectRequest,
  DeleteProjectResponse,
  ListProjectsResponse,
  OpenProjectRequest,
  OpenProjectResponse,
  RenameProjectRequest,
  RenameProjectResponse,
} from './project-contracts';

export interface ElectronAPI {
  getAppInfo: () => Promise<GetAppInfoResponse>;
  listProjects: () => Promise<ListProjectsResponse>;
  createProject: (request: CreateProjectRequest) => Promise<CreateProjectResponse>;
  openProject: (request: OpenProjectRequest) => Promise<OpenProjectResponse | null>;
  renameProject: (request: RenameProjectRequest) => Promise<RenameProjectResponse>;
  deleteProject: (request: DeleteProjectRequest) => Promise<DeleteProjectResponse>;
}
