import { beforeAll, afterAll, describe, it, expect } from 'vitest';
import { eq, sql } from 'drizzle-orm';
import { capabilitiesFor } from '../shared/contracts.js';
process.env.NODE_ENV = 'test';
process.env.BETTER_AUTH_SECRET = 'test-only-secret-that-is-more-than-32-characters';
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? 'pglite://';
process.env.APP_ORIGIN = 'http://localhost:5173';
process.env.DEMO_MODE = 'true';
const { database, db } = await import('../server/db/client.js');
const { seedDemo } = await import('../server/db/seed-data.js');
const { buildApp } = await import('../server/app.js');
const { student, guardianLink, roleGrant, teachingAssignment, person } =
  await import('../server/db/schema.js');
const { fixtureId: id, demoPassword } = await import('../server/db/fixtures.js');
const { parseConfig, config } = await import('../server/config.js');
const app = await buildApp(false);
const cookies: Record<string, string> = {};
async function get(path: string, role = 'director') {
  return app.inject({ method: 'GET', url: path, headers: { cookie: cookies[role] ?? '' } });
}
beforeAll(async () => {
  await database.migrate();
  await seedDemo();
  await seedDemo();
  for (const role of ['director', 'teacher', 'parent', 'student']) {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'http://localhost:5173' },
      payload: { email: `${role}@demo.aia.local`, password: demoPassword },
    });
    expect(response.statusCode, response.body).toBe(200);
    cookies[role] = response.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
  }
});
afterAll(async () => {
  await app.close();
  await database.close();
});
describe('protected preview overview presentation', () => {
  const passcode = 'fictional-preview-test-passcode-at-least-24-characters';
  const authorization = `Basic ${Buffer.from(`reviewer:${passcode}`).toString('base64')}`;
  const previewGet = (path: string, role = 'director') =>
    app.inject({
      method: 'GET',
      url: path,
      headers: { authorization, cookie: cookies[role] ?? '' },
    });
  const usePreview = () => {
    config.DEMO_MODE = false;
    config.PREVIEW_MODE = true;
    config.PREVIEW_ACCESS_USERNAME = 'reviewer';
    config.PREVIEW_ACCESS_PASSWORD = passcode;
  };

  it('restores the local fictional overview without widening any role scope', async () => {
    const previous = { ...config };
    try {
      const roles = ['director', 'teacher', 'parent', 'student'];
      const local = await Promise.all(
        roles.map(async (role) => (await get('/api/foundation/overview', role)).json()),
      );
      usePreview();
      for (const [index, role] of roles.entries()) {
        const response = await previewGet('/api/foundation/overview', role);
        expect(response.statusCode).toBe(200);
        expect(response.json()).toEqual(local[index]);
        expect(response.json().demo).toBe(true);
        expect(response.json().agenda.length).toBeGreaterThan(0);
        expect(response.json().announcements.length).toBeGreaterThan(0);
        if (role !== 'director') expect(response.json().school).toBeNull();
      }
      expect(local.map((item) => item.totalStudents)).toEqual([44, 35, 2, 1]);
    } finally {
      Object.assign(config, previous);
    }
  });

  it('keeps ordinary non-preview production presentation free of fictional events', async () => {
    const previous = { ...config };
    try {
      config.DEMO_MODE = false;
      config.PREVIEW_MODE = false;
      const response = await get('/api/foundation/overview');
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({
        demo: false,
        totalStudents: 44,
        agenda: [],
        announcements: [],
      });
    } finally {
      Object.assign(config, previous);
    }
  });

  it('retains the passcode, session requirement and non-demo finance/config behavior', async () => {
    const previous = { ...config };
    try {
      usePreview();
      expect((await app.inject({ method: 'GET', url: '/' })).statusCode).toBe(401);
      expect((await get('/api/foundation/overview')).statusCode).toBe(401);
      expect((await previewGet('/api/foundation/overview', 'anonymous')).statusCode).toBe(401);
      expect((await previewGet('/api/config')).json().demo).toBe(false);
      expect(
        (await previewGet(`/api/foundation/students/${id(200)}/finance-preview`, 'parent')).json(),
      ).toEqual({ demo: false, status: 'planned' });
      expect(() =>
        parseConfig({
          ...process.env,
          NODE_ENV: 'production',
          APP_ORIGIN: 'https://review.example',
          DATABASE_URL: 'postgresql://localhost/test',
          DEMO_MODE: 'true',
          PREVIEW_MODE: 'true',
          PREVIEW_ACCESS_USERNAME: 'reviewer',
          PREVIEW_ACCESS_PASSWORD: passcode,
        }),
      ).toThrow('Demo mode is forbidden in production.');
    } finally {
      Object.assign(config, previous);
    }
  });
});
describe('foundational database and authentication', () => {
  it('applies migrations and idempotent fictional seeds', async () => {
    expect((await db.select().from(student)).map((s) => s.id).sort()).toEqual(
      [
        ...Array.from({ length: 12 }, (_, i) => id(200 + i)),
        ...Array.from({ length: 32 }, (_, i) => id(13000 + i)),
      ].sort(),
    );
    await database.migrate();
  });

  it('keeps every documented seeded persona eligible with its canonical credentials and scope', async () => {
    const expected: Record<string, string> = {
      director: 'director',
      teacher: 'teacher',
      parent: 'guardian',
      student: 'student',
    };
    for (const [account, role] of Object.entries(expected)) {
      const viewer = (await get('/api/me', account)).json();
      expect(viewer.roles).toEqual([role]);
      expect(viewer.personId).toBeTruthy();
    }
  });
  it('denies an anonymous API request', async () => {
    expect((await app.inject({ method: 'GET', url: '/api/foundation/students' })).statusCode).toBe(
      401,
    );
  });
  it('does not permit public registration or untrusted mutation origins', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: 'http://localhost:5173' },
      payload: { name: 'მომხმარებელი', email: 'outsider@example.test', password: demoPassword },
    });
    expect(r.statusCode).not.toBe(200);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/auth/sign-out',
          headers: { origin: 'https://other.example', cookie: cookies.director },
          payload: {},
        })
      ).statusCode,
    ).toBe(403);
  });
  it('sets HttpOnly cookies and no-store on protected responses', async () => {
    const r = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/email',
      headers: { origin: 'http://localhost:5173' },
      payload: { email: 'director@demo.aia.local', password: demoPassword },
    });
    expect(r.cookies.some((c) => c.httpOnly)).toBe(true);
    expect((await get('/api/me')).headers['cache-control']).toBe('no-store');
  });
  it('rejects invalid pagination and IDs', async () => {
    expect((await get('/api/foundation/students?limit=1000')).statusCode).toBe(400);
    expect((await get('/api/foundation/students/not-a-uuid')).statusCode).toBe(400);
  });
  it('keeps audit entries immutable', async () => {
    await expect(db.execute(sql`update audit_event set action='tampered'`)).rejects.toThrow();
    await expect(db.execute(sql`delete from audit_event`)).rejects.toThrow();
  });
  it('fails closed on unsafe production environment', () => {
    const base = {
      NODE_ENV: 'production',
      BETTER_AUTH_SECRET: 'long-enough-strong-production-like-test-secret',
      DEMO_MODE: 'false',
      APP_ORIGIN: 'https://school.example',
      DATABASE_URL: 'postgresql://localhost/test',
    };
    expect(() => parseConfig({ ...base, DEMO_MODE: 'true' })).toThrow('Demo');
    expect(() => parseConfig({ ...base, DATABASE_URL: 'pglite://' })).toThrow('PostgreSQL');
    expect(() => parseConfig({ ...base, APP_ORIGIN: 'http://school.example' })).toThrow('HTTPS');
  });
});
describe('server-side scopes', () => {
  it('restricts director, teacher, guardian and student to expected rows', async () => {
    for (const [role, total] of [
      ['director', 44],
      ['teacher', 35],
      ['parent', 2],
      ['student', 1],
    ] as const) {
      const response = await get('/api/foundation/students?limit=100', role);
      expect(response.statusCode).toBe(200);
      expect(response.json().total).toBe(total);
      expect(response.json().items.length).toBe(total);
      if (role === 'teacher')
        expect(
          response
            .json()
            .items.map((s: { id: string }) => s.id)
            .sort(),
        ).toEqual(
          [
            id(200),
            id(204),
            id(208),
            ...Array.from({ length: 32 }, (_, i) => id(13000 + i)),
          ].sort(),
        );
    }
  });
  it('never includes school aggregates in guardian overview', async () => {
    const body = (await get('/api/foundation/overview', 'parent')).json();
    expect(body.school).toBeNull();
    expect(body.totalStudents).toBe(2);
    expect((await get('/api/foundation/finance-summary', 'parent')).statusCode).toBe(403);
  });
  it('hides unrelated children even with guessed valid UUIDs', async () => {
    expect((await get(`/api/foundation/students/${id(202)}`, 'parent')).statusCode).toBe(404);
    expect(
      (await get(`/api/foundation/students/${id(202)}/finance-preview`, 'parent')).statusCode,
    ).toBe(404);
    expect((await get(`/api/foundation/students/${id(201)}`, 'teacher')).statusCode).toBe(404);
  });
  it('independently honors academic and financial guardian rights', async () => {
    await db
      .update(guardianLink)
      .set({ financeAccess: false })
      .where(eq(guardianLink.id, id(400)));
    expect((await get(`/api/foundation/students/${id(200)}`, 'parent')).statusCode).toBe(200);
    expect(
      (await get(`/api/foundation/students/${id(200)}/finance-preview`, 'parent')).statusCode,
    ).toBe(404);
    await db
      .update(guardianLink)
      .set({ financeAccess: true, academicAccess: false })
      .where(eq(guardianLink.id, id(400)));
    expect((await get(`/api/foundation/students/${id(200)}`, 'parent')).statusCode).toBe(404);
    expect(
      (await get(`/api/foundation/students/${id(200)}/finance-preview`, 'parent')).statusCode,
    ).toBe(200);
    await db
      .update(guardianLink)
      .set({ academicAccess: true })
      .where(eq(guardianLink.id, id(400)));
  });
  it('enforces effective relationship and assignment revocation', async () => {
    await db
      .update(guardianLink)
      .set({ endsOn: '2021-01-01' })
      .where(eq(guardianLink.id, id(400)));
    expect((await get('/api/foundation/students', 'parent')).json().total).toBe(1);
    expect(
      (await get(`/api/foundation/students/${id(200)}/finance-preview`, 'parent')).statusCode,
    ).toBe(404);
    await db
      .update(guardianLink)
      .set({ endsOn: null })
      .where(eq(guardianLink.id, id(400)));
    const assignments = await db
      .select()
      .from(teachingAssignment)
      .where(eq(teachingAssignment.staffPersonId, id(2)));
    for (const assignment of assignments)
      await db
        .update(teachingAssignment)
        .set({
          endsOn: new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tbilisi' }).format(new Date()),
        })
        .where(eq(teachingAssignment.id, assignment.id));
    expect((await get('/api/foundation/students', 'teacher')).json().total).toBe(0);
    for (const assignment of assignments)
      await db
        .update(teachingAssignment)
        .set({ endsOn: assignment.endsOn })
        .where(eq(teachingAssignment.id, assignment.id));
  });
  it('combines roles without granting unrelated school access', async () => {
    await db.insert(roleGrant).values({ userId: 'demo-parent', role: 'teacher' });
    expect((await get('/api/foundation/students', 'parent')).json().total).toBe(2);
    expect((await get('/api/foundation/finance-summary', 'parent')).statusCode).toBe(403);
    await db.delete(roleGrant).where(sql`user_id='demo-parent' and role='teacher'`);
    expect(capabilitiesFor(['it_admin'])).not.toContain('students:school');
  });
  it('filters and counts only authorized rows; literal wildcard search cannot expand access', async () => {
    expect((await get('/api/foundation/students?q=%25', 'parent')).json().total).toBe(0);
    expect(
      (await get('/api/foundation/students?section=VIII%20%E1%83%90', 'parent')).json().total,
    ).toBe(0);
  });
  it('removes privileged scopes immediately when a person is archived', async () => {
    await db
      .update(person)
      .set({ archivedAt: new Date() })
      .where(eq(person.id, id(1)));
    expect((await get('/api/foundation/students')).json().total).toBe(0);
    expect((await get('/api/foundation/overview')).json().school).toBeNull();
    await db
      .update(person)
      .set({ archivedAt: null })
      .where(eq(person.id, id(1)));
  });
  it('invalidates the session on logout', async () => {
    const out = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-out',
      headers: { origin: 'http://localhost:5173', cookie: cookies.student },
      payload: {},
    });
    expect(out.statusCode).toBe(200);
    expect((await get('/api/me', 'student')).statusCode).toBe(401);
  });
});

describe('Stage 1A operational administration', () => {
  let yearId: string,
    sectionId: string,
    sectionTwo: string,
    subjectId: string,
    offeringId: string,
    studentId: string,
    guardianId: string,
    staffPersonId: string,
    staffId: string,
    invitedUserId: string,
    activationUrl: string;
  async function command(path: string, payload: unknown, role = 'director') {
    return app.inject({
      method: 'POST',
      url: path,
      headers: {
        cookie: cookies[role] ?? '',
        origin: 'http://localhost:5173',
        'content-type': 'application/json',
      },
      payload: JSON.stringify(payload),
    });
  }
  async function academic(payload: unknown) {
    return command('/api/academics/actions', payload);
  }
  async function people(payload: unknown) {
    return command('/api/people/actions', payload);
  }
  it('imports approved demo calendar into normal records and reports source discrepancies', async () => {
    const { parseDemoCalendar } = await import('../server/db/calendar-import.js');
    const source = (await import('../scripts/fixtures/calendar-2026-27.json')).default;
    const imported = parseDemoCalendar(source);
    expect(imported.warnings).toEqual(
      expect.arrayContaining([
        expect.stringContaining('monthly sum 152'),
        expect.stringContaining('monthly sum 156'),
      ]),
    );
    expect(imported.semesters[0]!.endsOn).toBe('2026-12-30');
    const setup = (await get('/api/academics')).json();
    expect(setup.events).toHaveLength(21);
    expect(setup.subjects).toHaveLength(17);
    expect(() =>
      parseDemoCalendar({
        ...source,
        vacation_periods: [{ ...source.vacation_periods[0], end_date: '2026-02-31' }],
      }),
    ).toThrow();
  });
  it('denies anonymous and nonadministrative writes and identity enumeration', async () => {
    for (const role of ['teacher', 'parent', 'none']) {
      const r = await command(
        '/api/people/actions',
        { action: 'person.create', fullName: 'გამოგონილი პიროვნება', contactEmail: null },
        role,
      );
      expect(r.statusCode).toBe(role === 'none' ? 401 : 403);
      expect((await get('/api/accounts', role)).statusCode).toBe(role === 'none' ? 401 : 403);
      expect((await get('/api/people?kind=staff', role)).statusCode).toBe(
        role === 'none' ? 401 : 403,
      );
    }
    expect(
      (
        await command(
          '/api/academics/actions',
          { action: 'year.status', id: id(10), version: 1, status: 'archived' },
          'teacher',
        )
      ).statusCode,
    ).toBe(403);
  });
  it('creates a two-semester year and rejects overlapping or unsafe historical changes', async () => {
    const input = {
      action: 'year.save',
      name: '2030–2031 ტესტი',
      startsOn: '2030-09-01',
      endsOn: '2031-07-01',
      semesters: [
        { name: 'I სემესტრი', startsOn: '2030-09-01', endsOn: '2031-01-01' },
        { name: 'II სემესტრი', startsOn: '2031-01-15', endsOn: '2031-07-01' },
      ],
    };
    const bad = structuredClone(input);
    bad.semesters[1]!.startsOn = '2030-12-01';
    expect((await academic(bad)).statusCode).toBe(400);
    const result = await academic(input);
    expect(result.statusCode, result.body).toBe(200);
    yearId = result.json().id;
    const a = await academic({ action: 'section.save', yearId, name: 'VII ტესტი', gradeLevel: 7 });
    expect(a.statusCode, a.body).toBe(200);
    sectionId = a.json().id;
    sectionTwo = (
      await academic({ action: 'section.save', yearId, name: 'VII მეორე', gradeLevel: 7 })
    ).json().id;
    expect(
      (await academic({ ...input, id: yearId, version: 1, name: 'შეცვლილი' })).statusCode,
    ).toBe(409);
  });
  it('creates subject/offering without conflating electives and section membership', async () => {
    const a = await academic({
      action: 'subject.save',
      name: 'სატესტო მეცნიერება',
      code: 'TEST-SCI',
      archived: false,
    });
    expect(a.statusCode, a.body).toBe(200);
    subjectId = a.json().id;
    const b = await academic({
      action: 'offering.create',
      sectionId,
      subjectId,
      elective: true,
      startsOn: '2030-09-01',
      endsOn: '2031-07-01',
    });
    expect(b.statusCode, b.body).toBe(200);
    offeringId = b.json().id;
    expect(
      (
        await academic({
          action: 'subject.save',
          id: subjectId,
          version: 1,
          name: 'შეცვლილი',
          code: 'TEST-SCI',
          archived: false,
        })
      ).statusCode,
    ).toBe(409);
  });
  it('creates a student plus enrollment atomically; rejects invalid boundaries and duplicates', async () => {
    const body = {
      action: 'student.create',
      fullName: 'სატესტო მოსწავლე',
      contactEmail: null,
      number: 'TEST-1A',
      sectionId,
      startsOn: '2030-09-01',
    };
    expect((await people({ ...body, startsOn: '2032-01-01' })).statusCode).toBe(409);
    const r = await people(body);
    expect(r.statusCode, r.body).toBe(200);
    studentId = r.json().id;
    expect((await people(body)).statusCode).toBe(409);
    const detail = (await get(`/api/people/students/${studentId}`)).json();
    expect(detail.enrollments).toHaveLength(1);
    expect((await get(`/api/people/students/${studentId}`, 'parent')).statusCode).toBe(403);
  });
  it('supports multiple normal guardians, prevents overlaps, and keeps unrelated children hidden', async () => {
    guardianId = (
      await people({
        action: 'person.create',
        fullName: 'სატესტო მეურვე',
        contactEmail: 'guardian@stage.test',
      })
    ).json().id;
    const body = {
      action: 'guardian.link',
      guardianPersonId: guardianId,
      studentId,
      startsOn: '2030-09-01',
    };
    expect((await people(body)).statusCode).toBe(200);
    expect((await people(body)).statusCode).toBe(409);
    expect((await people({ ...body, guardianPersonId: id(5) })).statusCode).toBe(200);
    const detail = (await get(`/api/people/students/${studentId}`)).json();
    expect(detail.guardians).toHaveLength(2);
    const link = (
      await db.select().from(guardianLink).where(eq(guardianLink.guardianPersonId, guardianId))
    )[0]!;
    expect(link.academicAccess).toBe(true);
    expect(link.financeAccess).toBe(true);
    expect((await get(`/api/foundation/students/${studentId}`, 'parent')).statusCode).toBe(404);
  });
  it('uses explicit elective membership; transfer retains history and changes effective rosters', async () => {
    const path = `/api/academics/offerings/${offeringId}/roster?on=2030-10-01`;
    expect((await get(path)).json().total).toBe(0);
    const member = await academic({
      action: 'membership.create',
      offeringId,
      studentId,
      startsOn: '2030-09-01',
      endsOn: '2031-07-01',
    });
    expect(member.statusCode, member.body).toBe(200);
    expect((await get(path)).json().total).toBe(1);
    const r = await people({
      action: 'enrollment.change',
      studentId,
      version: 1,
      sectionId: sectionTwo,
      effectiveOn: '2030-11-01',
      reason: 'კლასის შეცვლა',
    });
    expect(r.statusCode, r.body).toBe(200);
    expect((await get(path)).json().total).toBe(1);
    expect((await get(path.replace('2030-10-01', '2030-12-01'))).json().total).toBe(0);
    const detail = (await get(`/api/people/students/${studentId}`)).json();
    expect(detail.enrollments).toHaveLength(2);
    expect(
      detail.enrollments.find((e: { sectionId: string }) => e.sectionId === sectionId).endsOn,
    ).toBe('2030-11-01');
    expect(
      (
        await people({
          action: 'enrollment.change',
          studentId,
          version: 1,
          sectionId,
          effectiveOn: '2030-12-01',
          reason: 'ძველი ვერსია',
        })
      ).statusCode,
    ).toBe(409);
  });
  it('database rejects overlapping closed intervals and successful mutations carry atomic audit', async () => {
    const { enrollment, auditEvent } = await import('../server/db/schema.js');
    await expect(
      db
        .insert(enrollment)
        .values({ studentId, sectionId, startsOn: '2030-10-01', endsOn: '2030-12-01' }),
    ).rejects.toThrow();
    const entries = await db.select().from(auditEvent).where(eq(auditEvent.objectId, studentId));
    expect(entries.some((a) => a.action === 'student.create')).toBe(true);
    expect(entries.some((a) => a.action === 'enrollment.change')).toBe(true);
    expect(entries.every((a) => a.requestId)).toBe(true);
  });
  it('creates staff and retains teaching assignment history on effective departure', async () => {
    const r = await people({
      action: 'staff.save',
      fullName: 'სატესტო მასწავლებელი',
      contactEmail: 'staff@stage.test',
      title: 'მასწავლებელი',
      startsOn: '2026-01-01',
      endsOn: null,
    });
    expect(r.statusCode, r.body).toBe(200);
    staffId = r.json().id;
    const { staff } = await import('../server/db/schema.js');
    staffPersonId = (await db.select().from(staff).where(eq(staff.id, staffId)))[0]!.personId;
    const a = await academic({
      action: 'assignment.create',
      staffPersonId,
      sectionId,
      offeringId,
      startsOn: '2030-09-01',
      endsOn: '2031-07-01',
    });
    expect(a.statusCode, a.body).toBe(200);
    expect(
      (await academic({ action: 'assignment.end', id: a.json().id, endsOn: '2030-12-01' }))
        .statusCode,
    ).toBe(200);
    expect(
      (await db.select().from(teachingAssignment).where(eq(teachingAssignment.id, a.json().id)))[0]!
        .endsOn,
    ).toBe('2030-12-01');
  });
  it('limits provisioning roles, stores only token digests, activates once and disables existing sessions', async () => {
    const payload = {
      action: 'invite',
      personId: staffPersonId,
      email: 'staff@stage.test',
      roles: ['teacher'],
    };
    expect(
      (await command('/api/accounts/actions', { ...payload, roles: ['super_admin'] })).statusCode,
    ).toBe(403);
    const r = await command('/api/accounts/actions', payload);
    expect(r.statusCode, r.body).toBe(200);
    invitedUserId = r.json().id;
    activationUrl = r.json().activationUrl;
    const token = activationUrl.split('#')[1]!;
    const { onboardingToken } = await import('../server/db/schema.js');
    const stored = (
      await db.select().from(onboardingToken).where(eq(onboardingToken.userId, invitedUserId))
    )[0]!;
    expect(stored.digest).not.toContain(token);
    const a = await command('/api/onboarding/activate', {
      token,
      password: 'Test-Activated-2026!',
    });
    expect(a.statusCode, a.body).toBe(200);
    expect(
      (await command('/api/onboarding/activate', { token, password: 'Test-Activated-2026!' }))
        .statusCode,
    ).toBe(400);
    const signed = await command('/api/auth/sign-in/email', {
      email: 'staff@stage.test',
      password: 'Test-Activated-2026!',
    });
    expect(signed.statusCode, signed.body).toBe(200);
    cookies.newStaff = signed.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    expect((await get('/api/me', 'newStaff')).json().roles).toEqual(['teacher']);
    expect(
      (await command('/api/accounts/actions', { action: 'disable', userId: invitedUserId }))
        .statusCode,
    ).toBe(200);
    expect((await get('/api/me', 'newStaff')).statusCode).toBe(401);
    expect(
      (
        await command('/api/auth/sign-in/email', {
          email: 'staff@stage.test',
          password: 'Test-Activated-2026!',
        })
      ).statusCode,
    ).not.toBe(200);
  });
  it('rejects expired invitations and IT cannot turn identity access into academic authority', async () => {
    const r = await command('/api/accounts/actions', { action: 'reinvite', userId: invitedUserId });
    expect(r.statusCode, r.body).toBe(200);
    const { onboardingToken } = await import('../server/db/schema.js');
    await db
      .update(onboardingToken)
      .set({ expiresAt: new Date(0) })
      .where(eq(onboardingToken.userId, invitedUserId));
    expect(
      (
        await command('/api/onboarding/activate', {
          token: r.json().activationUrl.split('#')[1],
          password: 'Test-Activated-2026!',
        })
      ).statusCode,
    ).toBe(400);
    const { changeAccount } = await import('../server/modules/onboarding.js');
    await expect(
      changeAccount(
        {
          id: 'demo-teacher',
          personId: id(2),
          name: 'მარიამი',
          roles: ['it_admin'],
          capabilities: capabilitiesFor(['it_admin']),
        },
        'test',
        { action: 'invite', personId: guardianId, email: 'new@stage.test', roles: ['principal'] },
      ),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(capabilitiesFor(['it_admin'])).not.toContain('people:manage');
    expect(capabilitiesFor(['hr'])).not.toContain('students:school');
  });
  it('serializes concurrent profile edits and preserves the losing version', async () => {
    const current = (await get(`/api/people/students/${studentId}`)).json();
    const base = {
      action: 'student.edit',
      id: studentId,
      version: current.version,
      personVersion: current.personVersion,
      number: current.number,
      contactEmail: null,
    };
    const results = await Promise.all(
      ['პირველი ცვლილება', 'მეორე ცვლილება'].map((fullName) => people({ ...base, fullName })),
    );
    expect(results.map((r) => r.statusCode).sort()).toEqual([200, 409]);
    const after = (await get(`/api/people/students/${studentId}`)).json();
    expect(after.version).toBe(current.version + 1);
  });
  it('ends guardian access without erasing history and scopes person histories', async () => {
    const link = await people({
      action: 'guardian.link',
      guardianPersonId: id(3),
      studentId: id(202),
      startsOn: '2026-09-01',
    });
    expect(link.statusCode, link.body).toBe(200);
    expect((await get(`/api/foundation/students/${id(202)}`, 'parent')).statusCode).toBe(200);
    const { schoolToday } = await import('../server/modules/operations.js');
    expect(
      (await people({ action: 'guardian.end', id: link.json().id, endsOn: schoolToday() }))
        .statusCode,
    ).toBe(200);
    expect((await get(`/api/foundation/students/${id(202)}`, 'parent')).statusCode).toBe(404);
    expect(
      (await get(`/api/people/${id(3)}/history?kind=guardian`))
        .json()
        .items.some((r: { id: string }) => r.id === link.json().id),
    ).toBe(true);
    expect((await get(`/api/people/${id(3)}/history?kind=guardian`, 'parent')).statusCode).toBe(
      403,
    );
    expect(
      (await get(`/api/people/${staffPersonId}/history?kind=staff`)).json().items.length,
    ).toBeGreaterThan(0);
  });
  it('withdraws, archives and restores identity without rewriting completed enrollment', async () => {
    const r = await people({
      action: 'student.create',
      fullName: 'გასვლის დემო',
      contactEmail: null,
      number: 'TEST-EXIT',
      sectionId: id(30),
      startsOn: '2026-09-15',
    });
    expect(r.statusCode, r.body).toBe(200);
    const { schoolToday } = await import('../server/modules/operations.js');
    expect(
      (
        await people({
          action: 'enrollment.change',
          studentId: r.json().id,
          version: 1,
          sectionId: null,
          effectiveOn: schoolToday(),
          reason: 'სწავლის შეწყვეტა',
        })
      ).statusCode,
    ).toBe(200);
    expect(
      (await people({ action: 'student.status', id: r.json().id, version: 2, status: 'archived' }))
        .statusCode,
    ).toBe(200);
    expect((await get(`/api/people/students/${r.json().id}`)).json().enrollments[0].endsOn).toBe(
      schoolToday(),
    );
    expect(
      (await people({ action: 'student.status', id: r.json().id, version: 3, status: 'active' }))
        .statusCode,
    ).toBe(200);
  });

  it('rejects session creation for archived people and effective staff departure', async () => {
    const { staff } = await import('../server/db/schema.js');
    await db
      .update(person)
      .set({ archivedAt: new Date() })
      .where(eq(person.id, id(3)));
    const archived = await command('/api/auth/sign-in/email', {
      email: 'parent@demo.aia.local',
      password: demoPassword,
    });
    expect(archived.statusCode).not.toBe(200);
    expect((await get('/api/me', 'parent')).json().capabilities).toEqual([]);
    await db
      .update(person)
      .set({ archivedAt: null })
      .where(eq(person.id, id(3)));
    const { schoolToday } = await import('../server/modules/operations.js');
    await db
      .update(staff)
      .set({ endsOn: schoolToday() })
      .where(eq(staff.personId, id(2)));
    const ended = await command('/api/auth/sign-in/email', {
      email: 'teacher@demo.aia.local',
      password: demoPassword,
    });
    expect(ended.statusCode).not.toBe(200);
    expect((await get('/api/me', 'teacher')).json().capabilities).toEqual([]);
    await db
      .update(staff)
      .set({ endsOn: null })
      .where(eq(staff.personId, id(2)));
  });
  it('keeps request throttling as 429 rather than an internal error', async () => {
    let status = 200;
    for (let i = 0; i < 181; i++)
      status = (await app.inject({ method: 'GET', url: '/api/health', remoteAddress: '127.0.0.9' }))
        .statusCode;
    expect(status).toBe(429);
  });
});
