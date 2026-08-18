import path from 'path';

import { runStandaloneBot } from '../main/runtime/standalone-bot-runner';

async function main(): Promise<void> {
  const projectPath = process.argv[2];

  if (!projectPath) {
    console.error('Usage: node run-bot.js <project-path>');
    process.exit(1);
  }

  await runStandaloneBot(path.resolve(projectPath));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start the bot.';
  console.error(message);
  process.exit(1);
});
