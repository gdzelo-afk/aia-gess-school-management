import { PGlite } from '@electric-sql/pglite';
import { drizzle as embeddedDrizzle } from 'drizzle-orm/pglite';
import { drizzle as postgresDrizzle } from 'drizzle-orm/node-postgres';
import { migrate as embeddedMigrate } from 'drizzle-orm/pglite/migrator';
import { migrate as postgresMigrate } from 'drizzle-orm/node-postgres/migrator';
import pg from 'pg';
import { mkdirSync } from 'node:fs';
import * as schema from './schema.js';
import { config } from '../config.js';
export function createDatabase(url: string) {
  if (url.startsWith('pglite://')) {
    const path = url.slice('pglite://'.length);
    if (path) mkdirSync(path, { recursive: true });
    const client = new PGlite(path || undefined);
    const db = embeddedDrizzle(client, { schema });
    return {
      db,
      migrate: () => embeddedMigrate(db, { migrationsFolder: 'migrations' }),
      close: () => client.close(),
    };
  }
  const pool = new pg.Pool({ connectionString: url, max: 10 });
  const db = postgresDrizzle(pool, { schema });
  return {
    db,
    migrate: () => postgresMigrate(db, { migrationsFolder: 'migrations' }),
    close: () => pool.end(),
  };
}
export const database = createDatabase(config.DATABASE_URL);
export const db = database.db;
export type Database = typeof db;
