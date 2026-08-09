import { randomUUID } from 'crypto';
import { dialog } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

import {
  PROJECT_FILE_NAME,
  PROJECT_SUBDIRS,
  type ProjectFile,
} from '../../shared/domain/project-file';
import type { BotProject } from '../../shared/ipc/project-contracts';
import {
  ProjectStorageError,
  type OpenProjectRequest,
} from '../../shared/ipc/project-contracts';
import {
  getProjectFolderName,
  getProjectRegistryPath,
  getProjectsRoot,
  isManagedProjectPath,
} from './project-paths';

interface ProjectRegistryFile {
  externalPaths: string[];
}

function isNonEmptyString(value: string): boolean {
  return value.trim().length > 0;
}

function isValidProjectFile(value: unknown): value is ProjectFile {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.name === 'string' &&
    typeof record.createdAt === 'string' &&
    typeof record.updatedAt === 'string'
  );
}

function toBotProject(projectFile: ProjectFile, projectPath: string): BotProject {
  return {
    id: projectFile.id,
    name: projectFile.name,
    createdAt: projectFile.createdAt,
    updatedAt: projectFile.updatedAt,
    path: projectPath,
  };
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function readProjectFile(projectPath: string): Promise<ProjectFile | null> {
  const projectFilePath = path.join(projectPath, PROJECT_FILE_NAME);

  if (!(await pathExists(projectFilePath))) {
    return null;
  }

  try {
    const raw = await fs.readFile(projectFilePath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (!isValidProjectFile(parsed)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function writeProjectFile(projectPath: string, projectFile: ProjectFile): Promise<void> {
  const projectFilePath = path.join(projectPath, PROJECT_FILE_NAME);
  await fs.writeFile(projectFilePath, `${JSON.stringify(projectFile, null, 2)}\n`, 'utf8');
}

async function readRegistry(): Promise<ProjectRegistryFile> {
  const registryPath = getProjectRegistryPath();

  if (!(await pathExists(registryPath))) {
  }

  try {
    const raw = await fs.readFile(registryPath, 'utf8');
    const parsed: unknown = JSON.parse(raw);

    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      Array.isArray((parsed as ProjectRegistryFile).externalPaths)
    ) {
      return {
        externalPaths: (parsed as ProjectRegistryFile).externalPaths.filter(
          (entry): entry is string => typeof entry === 'string' && entry.trim().length > 0,
        ),
      };
    }
  } catch {
    // Fall back to an empty registry if the file is invalid.
  }

  return { externalPaths: [] };
}

async function writeRegistry(registry: ProjectRegistryFile): Promise<void> {
  const registryPath = getProjectRegistryPath();
  await fs.mkdir(path.dirname(registryPath), { recursive: true });
  await fs.writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8');
}

async function ensureProjectsRoot(): Promise<string> {
  const projectsRoot = getProjectsRoot();
  await fs.mkdir(projectsRoot, { recursive: true });
  return projectsRoot;
}

async function collectManagedProjectPaths(projectsRoot: string): Promise<string[]> {
  let entries: string[] = [];

  try {
    entries = await fs.readdir(projectsRoot);
  } catch {
    return [];
  }

  const projectPaths: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(projectsRoot, entry);
    const stats = await fs.stat(entryPath).catch(() => null);

    if (stats?.isDirectory()) {
      projectPaths.push(entryPath);
    }
  }

  return projectPaths;
}

async function loadProjectsFromPaths(projectPaths: string[]): Promise<BotProject[]> {
  const projects: BotProject[] = [];

  for (const projectPath of projectPaths) {
    const projectFile = await readProjectFile(projectPath);

    if (projectFile) {
      projects.push(toBotProject(projectFile, projectPath));
    }
  }

  projects.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );

  return projects;
}

async function getAllProjectPaths(): Promise<string[]> {
  const projectsRoot = await ensureProjectsRoot();
  const managedPaths = await collectManagedProjectPaths(projectsRoot);
  const registry = await readRegistry();

  const uniquePaths = new Set<string>(managedPaths.map((entry) => path.resolve(entry)));

  for (const externalPath of registry.externalPaths) {
    uniquePaths.add(path.resolve(externalPath));
  }

  return [...uniquePaths];
}

async function findProjectById(projectId: string): Promise<BotProject | null> {
  const projectPaths = await getAllProjectPaths();
  const projects = await loadProjectsFromPaths(projectPaths);
  return projects.find((project) => project.id === projectId) ?? null;
}

async function registerExternalPathIfNeeded(projectPath: string): Promise<void> {
  const projectsRoot = await ensureProjectsRoot();
  const resolvedPath = path.resolve(projectPath);

  if (isManagedProjectPath(resolvedPath, projectsRoot)) {
    return;
  }

  const registry = await readRegistry();
  const normalizedPaths = new Set(registry.externalPaths.map((entry) => path.resolve(entry)));

  if (!normalizedPaths.has(resolvedPath)) {
    registry.externalPaths.push(resolvedPath);
    await writeRegistry(registry);
  }
}

async function removeExternalPathIfRegistered(projectPath: string): Promise<void> {
  const resolvedPath = path.resolve(projectPath);
  const registry = await readRegistry();
  const nextPaths = registry.externalPaths.filter(
    (entry) => path.resolve(entry) !== resolvedPath,
  );

  if (nextPaths.length !== registry.externalPaths.length) {
    await writeRegistry({ externalPaths: nextPaths });
  }
}

function assertValidProjectName(name: string): string {
  const trimmedName = name.trim();

  if (!isNonEmptyString(trimmedName)) {
    throw new ProjectStorageError('INVALID_NAME', 'Project name is required.');
  }

  if (/[<>:"/\\|?*\u0000-\u001f]/.test(trimmedName)) {
    throw new ProjectStorageError(
      'INVALID_NAME',
      'Project name contains characters that are not allowed.',
    );
  }

  return trimmedName;
}

async function assertUniqueProjectName(name: string, excludedProjectId?: string): Promise<void> {
  const projectPaths = await getAllProjectPaths();
  const projects = await loadProjectsFromPaths(projectPaths);
  const normalizedName = name.trim().toLowerCase();

  const duplicate = projects.find(
    (project) =>
      project.id !== excludedProjectId && project.name.trim().toLowerCase() === normalizedName,
  );

  if (duplicate) {
    throw new ProjectStorageError('DUPLICATE_NAME', 'A project with this name already exists.');
  }
}

async function createUniqueManagedProjectPath(name: string, id: string): Promise<string> {
  const projectsRoot = await ensureProjectsRoot();
  const baseFolderName = getProjectFolderName(name, id);
  let folderName = baseFolderName;
  let suffix = 1;

  while (await pathExists(path.join(projectsRoot, folderName))) {
    folderName = `${baseFolderName}-${suffix}`;
    suffix += 1;
  }

  return path.join(projectsRoot, folderName);
}

async function openProjectAtPath(projectPath: string): Promise<BotProject> {
  const resolvedPath = path.resolve(projectPath);
  const stats = await fs.stat(resolvedPath).catch(() => null);

  if (!stats?.isDirectory()) {
    throw new ProjectStorageError('INVALID_PROJECT', 'The selected folder is not a valid project.');
  }

  const projectFile = await readProjectFile(resolvedPath);

  if (!projectFile) {
    throw new ProjectStorageError(
      'INVALID_PROJECT',
      `The selected folder does not contain a ${PROJECT_FILE_NAME} file.`,
    );
  }

  await registerExternalPathIfNeeded(resolvedPath);
  return toBotProject(projectFile, resolvedPath);
}

export async function listProjects(): Promise<BotProject[]> {
  const projectPaths = await getAllProjectPaths();
  return loadProjectsFromPaths(projectPaths);
}

export async function createProject(name: string): Promise<BotProject> {
  const validName = assertValidProjectName(name);
  await assertUniqueProjectName(validName);

  const now = new Date().toISOString();
  const id = randomUUID();
  const projectPath = await createUniqueManagedProjectPath(validName, id);

  const projectFile: ProjectFile = {
    id,
    name: validName,
    createdAt: now,
    updatedAt: now,
  };

  try {
    await fs.mkdir(projectPath, { recursive: true });

    for (const subdir of PROJECT_SUBDIRS) {
      await fs.mkdir(path.join(projectPath, subdir), { recursive: true });
    }

    await writeProjectFile(projectPath, projectFile);
  } catch {
    throw new ProjectStorageError('IO_ERROR', 'Unable to create the project on disk.');
  }

  return toBotProject(projectFile, projectPath);
}

export async function openProject(request: OpenProjectRequest): Promise<BotProject | null> {
  if (request.kind === 'dialog') {
    const result = await dialog.showOpenDialog({
      title: 'Open bot project',
      properties: ['openDirectory'],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return openProjectAtPath(result.filePaths[0]);
  }

  if (request.kind === 'path') {
    return openProjectAtPath(request.path);
  }

  const project = await findProjectById(request.id);

  if (!project) {
    throw new ProjectStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  return project;
}

export async function renameProject(projectId: string, name: string): Promise<BotProject> {
  const validName = assertValidProjectName(name);
  await assertUniqueProjectName(validName, projectId);

  const existingProject = await findProjectById(projectId);

  if (!existingProject) {
    throw new ProjectStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  const projectFile = await readProjectFile(existingProject.path);

  if (!projectFile) {
    throw new ProjectStorageError('INVALID_PROJECT', 'Project metadata could not be read.');
  }

  const updatedProjectFile: ProjectFile = {
    ...projectFile,
    name: validName,
    updatedAt: new Date().toISOString(),
  };

  try {
    await writeProjectFile(existingProject.path, updatedProjectFile);
  } catch {
    throw new ProjectStorageError('IO_ERROR', 'Unable to rename the project.');
  }

  return toBotProject(updatedProjectFile, existingProject.path);
}

export async function deleteProject(projectId: string): Promise<void> {
  const existingProject = await findProjectById(projectId);

  if (!existingProject) {
    throw new ProjectStorageError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  try {
    await fs.rm(existingProject.path, { recursive: true, force: true });
    await removeExternalPathIfRegistered(existingProject.path);
  } catch {
    throw new ProjectStorageError('IO_ERROR', 'Unable to delete the project.');
  }
}

export function getProjectStorageErrorMessage(error: unknown): string {
  if (error instanceof ProjectStorageError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected project storage error occurred.';
}
