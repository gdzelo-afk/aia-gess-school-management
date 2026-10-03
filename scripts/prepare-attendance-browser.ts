// Explicit test fixture provisioning, before the isolated browser database has a server owner.
import { browserRunsRoot } from './browser/environment.js';
import { randomUUID } from 'node:crypto';
import { hashPassword } from 'better-auth/crypto';
import { eq } from 'drizzle-orm';
import { config } from '../server/config.js';
import { database, db } from '../server/db/client.js';
import * as s from '../server/db/schema.js';
if (
  config.NODE_ENV === 'production' ||
  !config.DEMO_MODE ||
  !config.DATABASE_URL.startsWith(`pglite://${browserRunsRoot}/run-`)
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
// A distinct homeroom-only identity tests cross-subject oversight without granting grading.
if (!(await db.select().from(s.user).where(eq(s.user.id, 'gradebook-e2e-homeroom')))[0]) {
  const personId = randomUUID();
  await db.transaction(async (tx) => {
    await tx.insert(s.user).values({
      id: 'gradebook-e2e-homeroom',
      name: 'სატესტო დამრიგებელი',
      email: 'homeroom@gradebook.demo.local',
      emailVerified: true,
    });
    await tx.insert(s.account).values({
      id: randomUUID(),
      accountId: 'gradebook-e2e-homeroom',
      providerId: 'credential',
      userId: 'gradebook-e2e-homeroom',
      password: await hashPassword('AiaDemo-2026!'),
    });
    await tx
      .insert(s.person)
      .values({ id: personId, userId: 'gradebook-e2e-homeroom', fullName: 'სატესტო დამრიგებელი' });
    await tx.insert(s.staff).values({ personId, title: 'დამრიგებელი', startsOn: '2026-09-01' });
    await tx
      .insert(s.roleGrant)
      .values({ userId: 'gradebook-e2e-homeroom', role: 'homeroom_teacher' });
    await tx.insert(s.teachingAssignment).values({
      staffPersonId: personId,
      sectionId: '00000000-0000-4000-8000-000000000030',
      kind: 'homeroom',
      startsOn: '2026-09-01',
    });
  });
}
await database.close();
console.log('Fictional attendance browser persona ready.');
