import { app } from 'electron';
import path from 'path';

export function getProjectsRoot(): string {
  return path.join(app.getPath('userData'), 'bot-projects');
}

export function getProjectRegistryPath(): string {
  return path.join(app.getPath('userData'), 'project-registry.json');
}

export function getProjectFolderName(name: string, id: string): string {
  const slug = slugifyName(name);
  const shortId = id.slice(0, 8);
  return `${slug}-${shortId}`;
}

export function slugifyName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);

  return slug.length > 0 ? slug : 'bot';
}

export function isManagedProjectPath(projectPath: string, projectsRoot: string): boolean {
  const normalizedProjectPath = path.resolve(projectPath);
  const normalizedRoot = path.resolve(projectsRoot);
  const relative = path.relative(normalizedRoot, normalizedProjectPath);

  return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative);
}
