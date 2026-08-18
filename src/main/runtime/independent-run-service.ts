import { randomUUID } from 'crypto';
import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

import { BotRuntimeError } from '../../shared/ipc/runtime-contracts';
import {
  PROJECT_RUNTIME_DIR_NAME,
  PROJECT_RUNTIME_SCRIPT_NAME,
} from '../../shared/domain/project-file';
import { findProjectById } from '../storage/project-storage-service';
import { loadSlackConfigForProject } from '../storage/slack-config-service';
import { syncProjectRuntimeFiles } from './project-runtime-sync';

async function createLaunchScript(projectPath: string): Promise<string> {
  const extension = process.platform === 'win32' ? 'bat' : 'command';
  const scriptPath = path.join(os.tmpdir(), `slacksmith-run-${randomUUID()}.${extension}`);
  const runnerCommand = `node ${PROJECT_RUNTIME_DIR_NAME}/${PROJECT_RUNTIME_SCRIPT_NAME} .`;

  if (process.platform === 'win32') {
    const script = `@echo off\r\ncd /d ${JSON.stringify(projectPath).replaceAll('"', '')}\r\n${runnerCommand}\r\nif %ERRORLEVEL% NEQ 0 (\r\n  echo.\r\n  echo Bot exited with error code %ERRORLEVEL%.\r\n) else (\r\n  echo.\r\n  echo Bot stopped.\r\n)\r\necho.\r\necho Press any key to close this window.\r\npause >nul\r\n`;
    await fs.writeFile(scriptPath, script, { encoding: 'utf8' });
    return scriptPath;
  }

  const script = `#!/bin/bash
cd ${JSON.stringify(projectPath)}
${runnerCommand}
STATUS=$?
echo ""
if [ $STATUS -eq 0 ]; then
  echo "Bot stopped."
else
  echo "Bot exited with error code $STATUS."
fi
echo "Press Enter to close this window."
read
exit $STATUS
`;

  await fs.writeFile(scriptPath, script, { encoding: 'utf8', mode: 0o755 });
  return scriptPath;
}

function launchMacTerminal(scriptPath: string): void {
  const child = spawn('open', ['-a', 'Terminal', scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

function launchWindowsTerminal(scriptPath: string): void {
  const child = spawn('cmd.exe', ['/c', 'start', 'cmd', '/k', scriptPath], {
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

async function launchLinuxTerminal(scriptPath: string): Promise<void> {
  const terminals = [
    ['x-terminal-emulator', ['-e', 'bash', scriptPath]],
    ['gnome-terminal', ['--', 'bash', scriptPath]],
    ['konsole', ['-e', 'bash', scriptPath]],
    ['xfce4-terminal', ['-e', `bash ${scriptPath}`]],
  ] as const;

  for (const [binary, args] of terminals) {
    try {
      const child = spawn(binary, [...args], {
        detached: true,
        stdio: 'ignore',
      });
      child.unref();
      return;
    } catch {
      // Try the next terminal emulator.
    }
  }

  throw new BotRuntimeError(
    'INDEPENDENT_RUN_FAILED',
    'Could not open a terminal. Install a terminal emulator or run the bot manually from your shell.',
  );
}

export async function runBotIndependently(projectId: string): Promise<void> {
  const project = await findProjectById(projectId);

  if (!project) {
    throw new BotRuntimeError('PROJECT_NOT_FOUND', 'Project could not be found.');
  }

  const slackConfig = await loadSlackConfigForProject(projectId);

  if (!slackConfig) {
    throw new BotRuntimeError(
      'SLACK_NOT_CONFIGURED',
      'Connect this bot to Slack before running it independently.',
    );
  }

  try {
    await syncProjectRuntimeFiles(project.path, project.name);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to prepare the standalone runtime.';
    throw new BotRuntimeError('INDEPENDENT_RUN_FAILED', message);
  }

  const scriptPath = await createLaunchScript(project.path);

  if (process.platform === 'darwin') {
    launchMacTerminal(scriptPath);
    return;
  }

  if (process.platform === 'win32') {
    launchWindowsTerminal(scriptPath);
    return;
  }

  await launchLinuxTerminal(scriptPath);
}
