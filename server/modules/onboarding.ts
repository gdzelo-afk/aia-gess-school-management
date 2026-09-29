import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { hashPassword } from 'better-auth/crypto';
import { and, eq, ilike, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as s from '../db/schema.js';
import { config } from '../config.js';
import type { Viewer, Role } from '../../shared/contracts.js';
import type { AccountCommand } from '../../shared/stage1a.js';
import {
  administration,
  audit,
  fail,
  found,
  requireCapability,
  schoolToday,
  type Transaction,
} from './operations.js';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
export const localDeliveryAvailable = config.NODE_ENV !== 'production' && config.DEMO_MODE;
async function rolePolicy(tx: Transaction, viewer: Viewer, personId: string, roles: Role[]) {
  requireCapability(viewer, 'access:roles');
  if (new Set(roles).size !== roles.length) fail('როლები არ უნდა განმეორდეს.', 'VALIDATION', 400);
  if (
    !viewer.roles.includes('super_admin') &&
    roles.some((r) => ['super_admin', 'director', 'it_admin'].includes(r))
  )
    fail('ამ როლის მინიჭების უფლება არ გაქვთ.', 'FORBIDDEN', 403);
  if (personId === viewer.personId) fail('საკუთარი როლების შეცვლა დაუშვებელია.', 'FORBIDDEN', 403);
  for (const role of roles) {
    if (
      role === 'student' &&
      !(
        await tx
          .select()
          .from(s.student)
          .where(and(eq(s.student.personId, personId), eq(s.student.status, 'active')))
      ).length
    )
      fail('მოსწავლის აქტიური პროფილი საჭიროა.');
    if (
      role === 'guardian' &&
      !(
        await tx
          .select()
          .from(s.guardianLink)
          .where(
            and(
              eq(s.guardianLink.guardianPersonId, personId),
              sql`${s.guardianLink.startsOn}<=${schoolToday()} and coalesce(${s.guardianLink.endsOn},'infinity'::date)>${schoolToday()}`,
            ),
          )
      ).length
    )
      fail('ჯერ დააკავშირეთ მშობელი მოსწავლესთან.');
    if (
      !['student', 'guardian'].includes(role) &&
      !(
        await tx
          .select()
          .from(s.staff)
          .where(
            and(
              eq(s.staff.personId, personId),
              sql`${s.staff.startsOn}<=${schoolToday()} and coalesce(${s.staff.endsOn},'infinity'::date)>${schoolToday()}`,
            ),
          )
      ).length
    )
      fail('თანამშრომლის მოქმედი პროფილი საჭიროა.');
  }
}
async function protectedAccount(tx: Transaction, viewer: Viewer, userId: string) {
  if (userId === viewer.id) fail('საკუთარი ანგარიშის შეცვლა ამ გზით დაუშვებელია.');
  const roles = await tx.select().from(s.roleGrant).where(eq(s.roleGrant.userId, userId));
  if (
    roles.some((r) => ['super_admin', 'director', 'it_admin'].includes(r.role)) &&
    !viewer.roles.includes('super_admin')
  )
    fail('დაცულ ანგარიშზე უფლებამოსილება არ გაქვთ.', 'FORBIDDEN', 403);
  if (roles.some((r) => r.role === 'super_admin')) {
    const others = await tx
      .select()
      .from(s.roleGrant)
      .innerJoin(s.user, eq(s.user.id, s.roleGrant.userId))
      .innerJoin(s.person, eq(s.person.userId, s.user.id))
      .where(
        and(
          eq(s.roleGrant.role, 'super_admin'),
          eq(s.user.disabled, false),
          sql`${s.user.id}<>${userId} and ${s.person.archivedAt} is null`,
        ),
      );
    if (!others.length) fail('ბოლო მთავარი ადმინისტრატორის გაუქმება დაუშვებელია.');
  }
}
async function tokenFor(tx: Transaction, userId: string, purpose: 'invite' | 'recovery') {
  await tx
    .update(s.onboardingToken)
    .set({ usedAt: new Date() })
    .where(and(eq(s.onboardingToken.userId, userId), sql`${s.onboardingToken.usedAt} is null`));
  const token = randomBytes(32).toString('base64url');
  await tx.insert(s.onboardingToken).values({
    userId,
    purpose,
    digest: digest(token),
    expiresAt: new Date(Date.now() + (purpose === 'invite' ? 48 : 1) * 3600000),
  });
  // A URL fragment keeps the bearer token out of HTTP URLs/referrer/access logs.
  return `${config.APP_ORIGIN}/activate#${token}`;
}
export async function accounts(viewer: Viewer, q: string, offset: number) {
  requireCapability(viewer, 'access:manage');
  const where = ilike(s.user.email, `%${q.replace(/[\\%_]/g, '\\$&')}%`);
  const items = await db
    .select({
      id: s.user.id,
      name: s.user.name,
      email: s.user.email,
      disabled: s.user.disabled,
      personId: s.person.id,
      roles: sql<
        Role[]
      >`coalesce((select json_agg(r.role) from role_grant r where r.user_id=${s.user.id}),'[]'::json)`,
      pending: sql<boolean>`not exists(select 1 from auth_account a where a.user_id=${s.user.id} and a.provider_id='credential')`,
    })
    .from(s.user)
    .innerJoin(s.person, eq(s.person.userId, s.user.id))
    .where(where)
    .orderBy(s.user.email)
    .limit(25)
    .offset(offset);
  const total = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.user)
    .innerJoin(s.person, eq(s.person.userId, s.user.id))
    .where(where);
  return { items, total: total[0]!.n, localDelivery: localDeliveryAvailable };
}
export async function changeAccount(viewer: Viewer, requestId: string, c: AccountCommand) {
  requireCapability(viewer, 'access:manage');
  if ((c.action === 'invite' || c.action === 'reinvite') && !localDeliveryAvailable)
    fail('ელფოსტის მიწოდება ჯერ არ არის გამართული.', 'DELIVERY_UNAVAILABLE', 503);
  return administration(async (tx) => {
    let id = '',
      activationUrl: string | undefined;
    if (c.action === 'invite') {
      const person = found(
        (await tx.select().from(s.person).where(eq(s.person.id, c.personId)))[0],
      );
      if (person.archivedAt || person.userId) fail('პიროვნება არქივშია ან ანგარიში უკვე აქვს.');
      await rolePolicy(tx, viewer, c.personId, c.roles);
      const email = c.email.toLowerCase();
      if ((await tx.select().from(s.user).where(eq(s.user.email, email))).length)
        fail('ელფოსტა უკვე გამოყენებულია.');
      id = randomUUID();
      await tx.insert(s.user).values({ id, name: person.fullName, email, disabled: true });
      await tx
        .update(s.person)
        .set({ userId: id, version: person.version + 1 })
        .where(eq(s.person.id, person.id));
      await tx.insert(s.roleGrant).values(c.roles.map((role) => ({ userId: id, role })));
      activationUrl = await tokenFor(tx, id, 'invite');
    } else {
      const user = found((await tx.select().from(s.user).where(eq(s.user.id, c.userId)))[0]);
      const person = found(
        (await tx.select().from(s.person).where(eq(s.person.userId, user.id)))[0],
      );
      await protectedAccount(tx, viewer, user.id);
      id = user.id;
      if (c.action === 'roles') {
        await rolePolicy(tx, viewer, person.id, c.roles);
        await tx.delete(s.roleGrant).where(eq(s.roleGrant.userId, id));
        await tx.insert(s.roleGrant).values(c.roles.map((role) => ({ userId: id, role })));
      } else if (c.action === 'disable') {
        await tx
          .update(s.user)
          .set({ disabled: true, updatedAt: new Date() })
          .where(eq(s.user.id, id));
        await tx
          .update(s.onboardingToken)
          .set({ usedAt: new Date() })
          .where(eq(s.onboardingToken.userId, id));
      } else {
        if (person.archivedAt) fail('პიროვნება არქივშია.');
        // Re-enabling a disabled account needs role-grant authority, not IT reset alone.
        if (user.disabled) requireCapability(viewer, 'access:roles');
        activationUrl = await tokenFor(tx, id, user.disabled ? 'invite' : 'recovery');
      }
      await tx.delete(s.session).where(eq(s.session.userId, id));
    }
    await audit(
      tx,
      viewer,
      requestId,
      `account.${c.action}`,
      'account',
      id,
      c.action === 'invite' || c.action === 'roles' ? { roles: c.roles } : {},
    );
    return { id, activationUrl, delivery: activationUrl ? 'local' : 'none' };
  });
}
export async function activate(token: string, password: string, requestId: string) {
  // Hash before taking the administrative lock; consumption is checked again atomically.
  const hash = await hashPassword(password);
  return administration(async (tx) => {
    const entry = found(
      (
        await tx
          .select()
          .from(s.onboardingToken)
          .where(eq(s.onboardingToken.digest, digest(token)))
      )[0],
    );
    if (entry.usedAt || entry.expiresAt <= new Date())
      fail('ბმული ვადაგასული ან უკვე გამოყენებულია.', 'TOKEN_INVALID', 400);
    const person = found(
      (await tx.select().from(s.person).where(eq(s.person.userId, entry.userId)))[0],
    );
    const user = found((await tx.select().from(s.user).where(eq(s.user.id, entry.userId)))[0]);
    if (person.archivedAt || (entry.purpose === 'recovery' && user.disabled))
      fail('ანგარიში მიუწვდომელია.', 'TOKEN_INVALID', 400);
    const staff = await tx.select().from(s.staff).where(eq(s.staff.personId, person.id));
    if (staff[0]?.endsOn && staff[0].endsOn <= schoolToday())
      fail('თანამშრომლის სამუშაო პერიოდი დასრულებულია.', 'TOKEN_INVALID', 400);
    const credential = (
      await tx
        .select()
        .from(s.account)
        .where(and(eq(s.account.userId, user.id), eq(s.account.providerId, 'credential')))
    )[0];
    if (credential)
      await tx
        .update(s.account)
        .set({ password: hash, updatedAt: new Date() })
        .where(eq(s.account.id, credential.id));
    else
      await tx.insert(s.account).values({
        id: randomUUID(),
        userId: user.id,
        accountId: user.id,
        providerId: 'credential',
        password: hash,
      });
    await tx
      .update(s.user)
      .set({ disabled: false, emailVerified: true, updatedAt: new Date() })
      .where(eq(s.user.id, user.id));
    await tx
      .update(s.onboardingToken)
      .set({ usedAt: new Date() })
      .where(eq(s.onboardingToken.userId, user.id));
    await tx.delete(s.session).where(eq(s.session.userId, user.id));
    await tx.insert(s.auditEvent).values({
      actorUserId: user.id,
      action: `account.${entry.purpose}.complete`,
      objectType: 'account',
      objectId: user.id,
      requestId,
    });
    return { ok: true };
  });
}
export async function requestRecovery(email: string) {
  if (!localDeliveryAvailable) return { ok: true };
  const delivery = await administration(async (tx) => {
    const row = (
      await tx
        .select()
        .from(s.user)
        .innerJoin(s.person, eq(s.person.userId, s.user.id))
        .where(
          and(
            eq(s.user.email, email.toLowerCase()),
            eq(s.user.disabled, false),
            sql`${s.person.archivedAt} is null`,
          ),
        )
    )[0];
    if (!row) return null;
    const url = await tokenFor(tx, row.app_user.id, 'recovery');
    return { url };
  });
  if (delivery) {
    await mkdir('.local/delivery', { recursive: true, mode: 0o700 });
    await writeFile(`.local/delivery/${randomUUID()}.json`, JSON.stringify(delivery), {
      mode: 0o600,
      flag: 'wx',
    });
  }
  return { ok: true };
}
