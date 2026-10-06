import { defineConfig } from 'tsup';
export default defineConfig({
  entry: {
    index: 'server/index.ts',
    migrate: 'server/db/migrate.ts',
    seed: 'server/db/seed.ts',
  },
  format: ['esm'],
  platform: 'node',
  target: 'node22',
  outDir: 'dist/server',
  external: ['@electric-sql/pglite'],
  splitting: false,
  clean: true,
});
