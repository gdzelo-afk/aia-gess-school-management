import { randomBytes } from 'node:crypto';
import { resolve, dirname, basename } from 'node:path';

// Fixed, dedicated origins: Playwright must never reuse the manual preview.
export const browserOrigin = 'http://localhost:5273';
export const browserApiPort = 3101;
export const browserRunsRoot = resolve('.local/browser-runs');
export function browserEnvironment(directory: string, inherited: NodeJS.ProcessEnv) {
  const path = resolve(directory);
  if (dirname(path) !== browserRunsRoot || !basename(path).startsWith('run-'))
    throw new Error('Browser runtime must own a fresh directory under .local/browser-runs.');
  return {
    ...inherited,
    NODE_ENV: 'development',
    DATABASE_URL: `pglite://${path}/database`,
    PRIVATE_STORAGE_DIR: `${path}/private-files`,
    APP_ORIGIN: browserOrigin,
    PORT: String(browserApiPort),
    DEV_WEB_PORT: '5273',
    DEV_API_PORT: String(browserApiPort),
    DEMO_MODE: 'true',
    BETTER_AUTH_SECRET: randomBytes(48).toString('hex'),
  };
}
