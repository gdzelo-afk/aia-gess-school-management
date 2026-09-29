import { database } from './client.js';
import { seedDemo } from './seed-data.js';
try {
  await seedDemo();
  console.log('Fictional demo data ready. Credentials are documented in README.md.');
} finally {
  await database.close();
}
