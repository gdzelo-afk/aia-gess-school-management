import { mkdir, mkdtemp } from 'node:fs/promises';
import { spawn, type ChildProcess } from 'node:child_process';
import { createServer } from 'node:net';
import { browserEnvironment, browserRunsRoot, browserApiPort } from './environment.js';

// Reject occupied API ports too; a proxy must never connect to somebody else's API.
for (const port of [5273, browserApiPort]) {
  await new Promise<void>((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve()));
  });
}
await mkdir(browserRunsRoot, { recursive: true });
const directory = await mkdtemp(`${browserRunsRoot}/run-`);
const env = browserEnvironment(directory, process.env);
const children = new Set<ChildProcess>();
let stopping = false;
function stop(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill('SIGTERM');
  process.exitCode = code;
}
process.once('SIGTERM', () => stop(0));
process.once('SIGINT', () => stop(0));
function run(file: string, args: string[]) {
  const child = spawn(process.execPath, [file, ...args], { env, stdio: 'inherit' });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}
for (const script of [
  'server/db/migrate.ts',
  'server/db/seed.ts',
  'scripts/prepare-attendance-browser.ts',
]) {
  const code = await new Promise<number | null>((resolve, reject) => {
    const child = run('node_modules/tsx/dist/cli.mjs', [script]);
    child.once('error', reject);
    child.once('exit', resolve);
  });
  if (stopping) process.exit(0);
  if (code !== 0) throw new Error(`Isolated browser setup failed: ${script}`);
}
console.log(`Isolated browser database: ${directory}/database`);
for (const child of [
  run('node_modules/tsx/dist/cli.mjs', ['server/index.ts']),
  run('node_modules/vite/bin/vite.js', ['--host', '127.0.0.1']),
]) {
  child.once('error', () => stop(1));
  child.once('exit', (code) => stop(code ?? 1));
}
// Disposable data stays excluded locally for failure investigation; never reuse it.
