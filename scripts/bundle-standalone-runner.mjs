import esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

await esbuild.build({
  entryPoints: [path.join(rootDir, 'src/standalone/entry.ts')],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'cjs',
  outfile: path.join(rootDir, 'dist/standalone/run-bot.js'),
  external: ['electron'],
  logLevel: 'info',
});
