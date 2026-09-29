import { buildApp } from './app.js';
import { database } from './db/client.js';
import { config } from './config.js';
const app = await buildApp();
async function shutdown() {
  await app.close();
  await database.close();
  process.exit(0);
}
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
await app.listen({
  port: config.PORT,
  host: config.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1',
});
