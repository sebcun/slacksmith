import path from 'path';

import { runStandaloneBot } from '../main/runtime/standalone-bot-runner';

async function main(): Promise<void> {
  const projectPath = process.argv[2] ?? '.';

  await runStandaloneBot(path.resolve(projectPath));
}

void main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Failed to start the bot.';
  console.error(message);
  process.exit(1);
});
