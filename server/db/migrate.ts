import { database } from './client.js';
try {
  await database.migrate();
  console.log('Migrations applied.');
} finally {
  await database.close();
}
