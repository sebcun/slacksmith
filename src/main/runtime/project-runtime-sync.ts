import { promises as fs } from 'fs';
import path from 'path';

import {
  PROJECT_PACKAGE_FILE_NAME,
  PROJECT_RUNTIME_DIR_NAME,
  PROJECT_RUNTIME_SCRIPT_NAME,
} from '../../shared/domain/project-file';

const BUNDLED_RUNNER_RELATIVE_PATH = path.join('standalone', 'run-bot.js');

function toPackageName(name: string): string {
  const normalized = name
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return normalized.length > 0 ? normalized : 'slack-bot';
}

export function getBundledStandaloneRunnerPath(): string {
  return path.join(__dirname, '..', '..', BUNDLED_RUNNER_RELATIVE_PATH);
}

export function getProjectRuntimeScriptPath(projectPath: string): string {
  return path.join(projectPath, PROJECT_RUNTIME_DIR_NAME, PROJECT_RUNTIME_SCRIPT_NAME);
}

function createProjectPackageJson(projectName: string): string {
  const packageJson = {
    name: toPackageName(projectName),
    private: true,
    description: 'SlackSmith bot project',
    scripts: {
      start: `node ${PROJECT_RUNTIME_DIR_NAME}/${PROJECT_RUNTIME_SCRIPT_NAME} .`,
    },
    engines: {
      node: '>=20',
    },
  };

  return `${JSON.stringify(packageJson, null, 2)}\n`;
}

export async function syncProjectRuntimeFiles(
  projectPath: string,
  projectName: string,
): Promise<void> {
  const bundledRunnerPath = getBundledStandaloneRunnerPath();

  try {
    await fs.access(bundledRunnerPath);
  } catch {
    throw new Error(
      'Standalone runtime bundle is missing. Rebuild the app before running the bot independently.',
    );
  }

  const runtimeDir = path.join(projectPath, PROJECT_RUNTIME_DIR_NAME);
  await fs.mkdir(runtimeDir, { recursive: true });

  await fs.copyFile(
    bundledRunnerPath,
    path.join(runtimeDir, PROJECT_RUNTIME_SCRIPT_NAME),
  );

  await fs.writeFile(
    path.join(projectPath, PROJECT_PACKAGE_FILE_NAME),
    createProjectPackageJson(projectName),
    'utf8',
  );
}

export async function ensureProjectRuntimeFiles(
  projectPath: string,
  projectName: string,
): Promise<string> {
  const projectRunnerPath = getProjectRuntimeScriptPath(projectPath);

  try {
    await fs.access(projectRunnerPath);
    return projectRunnerPath;
  } catch {
    await syncProjectRuntimeFiles(projectPath, projectName);
    return projectRunnerPath;
  }
}
