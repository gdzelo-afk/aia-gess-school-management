import 'dotenv/config';
import { z } from 'zod';
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  BETTER_AUTH_SECRET: z.string().min(32),
  DATABASE_URL: z.string().min(1).default('pglite://.local/database'),
  DEMO_MODE: z
    .enum(['true', 'false'])
    .default('false')
    .transform((x) => x === 'true'),
});
export function parseConfig(input: NodeJS.ProcessEnv) {
  const result = envSchema.parse(input);
  if (result.BETTER_AUTH_SECRET.startsWith('replace-with'))
    throw new Error('Run npm run setup or configure a secure auth secret.');
  if (result.NODE_ENV === 'production') {
    if (result.DEMO_MODE) throw new Error('Demo mode is forbidden in production.');
    if (!result.DATABASE_URL.startsWith('postgres'))
      throw new Error('Production requires PostgreSQL.');
    if (!result.APP_ORIGIN.startsWith('https://')) throw new Error('Production requires HTTPS.');
  }
  return result;
}
export const config = parseConfig(process.env);
