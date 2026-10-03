import { describe, expect, it } from 'vitest';
import { browserEnvironment, browserRunsRoot, browserOrigin } from '../scripts/browser/environment';

describe('browser write-runtime isolation', () => {
  it('overrides inherited normal/production database, origins, mode and credentials', () => {
    const env = browserEnvironment(`${browserRunsRoot}/run-fixture`, {
      DATABASE_URL: 'pglite://.local/database',
      APP_ORIGIN: 'http://localhost:5173',
      PORT: '3001',
      NODE_ENV: 'production',
      DEMO_MODE: 'false',
      BETTER_AUTH_SECRET: 'inherited',
    });
    expect(env.DATABASE_URL).toBe(`pglite://${browserRunsRoot}/run-fixture/database`);
    expect(env.APP_ORIGIN).toBe(browserOrigin);
    expect(env.PORT).toBe('3101');
    expect(env.NODE_ENV).toBe('development');
    expect(env.DEMO_MODE).toBe('true');
    expect(env.BETTER_AUTH_SECRET).not.toBe('inherited');
  });
  it.each([
    '.local/database',
    `${browserRunsRoot}/../database`,
    `${browserRunsRoot}/run-x/../database`,
  ])('rejects database-directory escape %s', (path) =>
    expect(() => browserEnvironment(path, {})).toThrow(),
  );
});
