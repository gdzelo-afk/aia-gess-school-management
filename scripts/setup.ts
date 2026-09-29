import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
if (!existsSync('.env')) {
  writeFileSync(
    '.env',
    readFileSync('.env.example', 'utf8').replace(
      'replace-with-at-least-32-random-characters',
      randomBytes(32).toString('hex'),
    ),
    { mode: 0o600 },
  );
  console.log('Created local .env.');
} else console.log('Kept existing .env.');
