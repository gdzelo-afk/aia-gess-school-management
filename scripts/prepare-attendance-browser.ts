// Explicit test fixture provisioning, before the isolated browser database has a server owner.
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { config } from '../server/config.js';
import { database, db } from '../server/db/client.js';
import * as s from '../server/db/schema.js';
if (
  config.NODE_ENV === 'production' ||
  !config.DEMO_MODE ||
  (!process.env.CI && !/(browser|e2e)/.test(config.DATABASE_URL))
)
  throw new Error('Use a separate fictional browser database, with its server stopped.');
await database.migrate();
const userId = 'attendance-e2e-founder';
const existing = (await db.select().from(s.user).where(eq(s.user.id, userId)))[0];
if (!existing) {
  const personId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(s.user).values({
      id: userId,
      name: 'სატესტო დამფუძნებელი',
      email: 'founder@attendance.demo.local',
      emailVerified: true,
    });
    await tx.insert(s.account).values({
      id: randomUUID(),
      accountId: userId,
      providerId: 'credential',
      userId,
      password: await hashPassword('AiaDemo-2026!'),
    });
    await tx.insert(s.person).values({ id: personId, userId, fullName: 'სატესტო დამფუძნებელი' });
    await tx
      .insert(s.staff)
      .values({ personId, title: 'დამფუძნებელთა ოფისი', startsOn: '2026-09-01' });
    await tx.insert(s.roleGrant).values({ userId, role: 'founders_office' });
  });
}
await database.close();
console.log('Fictional attendance browser persona ready.');
