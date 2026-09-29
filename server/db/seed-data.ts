import { seedTimetable } from './timetable-seed.js';
import { eq } from 'drizzle-orm';
import calendarSource from '../../scripts/fixtures/calendar-2026-27.json' with { type: 'json' };
import { parseDemoCalendar } from './calendar-import.js';
import { hashPassword } from 'better-auth/crypto';
import { db } from './client.js';
import * as s from './schema.js';
import { demoAccounts, demoPassword, fictionalNames, fixtureId as id } from './fixtures.js';
import { config } from '../config.js';
export async function seedDemo() {
  if (config.NODE_ENV === 'production' || !config.DEMO_MODE)
    throw new Error('Fictional seed requires non-production DEMO_MODE=true.');
  const hash = await hashPassword(demoPassword);
  const calendar = parseDemoCalendar(calendarSource);
  await db.transaction(async (tx) => {
    for (const a of demoAccounts) {
      await tx
        .insert(s.user)
        .values({ id: a.id, name: a.name, email: a.email, emailVerified: true })
        .onConflictDoNothing();
      await tx
        .insert(s.account)
        .values({
          id: `account-${a.id}`,
          userId: a.id,
          accountId: a.id,
          providerId: 'credential',
          password: hash,
        })
        .onConflictDoNothing();
      await tx
        .insert(s.person)
        .values({ id: id(a.person), userId: a.id, fullName: a.name })
        .onConflictDoNothing();
      await tx.insert(s.roleGrant).values({ userId: a.id, role: a.role }).onConflictDoNothing();
    }
    await tx
      .insert(s.person)
      .values({ id: id(4), fullName: 'ირაკლი მეტრეველი' })
      .onConflictDoNothing();
    await tx
      .insert(s.staff)
      .values([
        {
          id: id(20),
          personId: id(2),
          title: 'ქართული ენისა და ლიტერატურის მასწავლებელი',
          startsOn: '2020-09-01',
        },
        { id: id(21), personId: id(4), title: 'მათემატიკის მასწავლებელი', startsOn: '2020-09-01' },
      ])
      .onConflictDoNothing();
    await tx
      .insert(s.academicYear)
      .values({
        id: id(10),
        name: calendar.name,
        startsOn: calendar.startsOn,
        endsOn: calendar.endsOn,
        status: 'active',
      })
      .onConflictDoNothing();
    // One-time, explicit demo-only upgrade; never overwrite later administrator edits.
    if (
      !(
        await tx
          .select()
          .from(s.auditEvent)
          .where(eq(s.auditEvent.id, id(950)))
      ).length
    ) {
      // Temporarily retain broad old year bounds while normalizing the known fictional records.
      await tx.delete(s.semester).where(eq(s.semester.yearId, id(10)));
      for (let i = 0; i < 12; i++)
        await tx
          .update(s.enrollment)
          .set({ startsOn: calendar.startsOn, endsOn: calendar.endsOn })
          .where(eq(s.enrollment.id, id(300 + i)));
      await tx
        .update(s.academicYear)
        .set({ startsOn: calendar.startsOn, endsOn: calendar.endsOn, status: 'active' })
        .where(eq(s.academicYear.id, id(10)));
      await tx
        .insert(s.semester)
        .values(calendar.semesters.map((term, i) => ({ ...term, id: id(11 + i), yearId: id(10) })));
      await tx
        .insert(s.calendarEvent)
        .values(
          calendar.events.map((event, i) => ({ ...event, id: id(1000 + i), yearId: id(10) })),
        );
      await tx.insert(s.auditEvent).values({
        id: id(950),
        action: 'demo.calendar.import',
        objectType: 'academic_year',
        objectId: id(10),
        metadata: {
          fictional: true,
          source: 'calendar-2026-27.json',
          warnings: calendar.warnings,
        },
      });
    }
    for (const [i, name] of ['VII ა', 'VII ბ', 'VIII ა', 'IX ა'].entries()) {
      await tx
        .insert(s.section)
        .values({ id: id(30 + i), yearId: id(10), name, gradeLevel: [7, 7, 8, 9][i]! })
        .onConflictDoNothing();
    }
    for (const [i, name] of fictionalNames.entries()) {
      await tx
        .insert(s.person)
        .values({ id: id(100 + i), fullName: name })
        .onConflictDoNothing();
      await tx
        .insert(s.student)
        .values({ id: id(200 + i), personId: id(100 + i), number: `AG-${String(2601 + i)}` })
        .onConflictDoNothing();
      await tx
        .insert(s.enrollment)
        .values({
          id: id(300 + i),
          studentId: id(200 + i),
          sectionId: id(30 + (i % 4)),
          startsOn: calendar.startsOn,
          endsOn: calendar.endsOn,
        })
        .onConflictDoNothing();
    }
    for (const i of [0, 1])
      await tx
        .insert(s.guardianLink)
        .values({
          id: id(400 + i),
          guardianPersonId: id(3),
          studentId: id(200 + i),
          academicAccess: true,
          financeAccess: true,
          startsOn: '2020-01-01',
        })
        .onConflictDoNothing();
    await tx
      .insert(s.teachingAssignment)
      .values({ id: id(500), staffPersonId: id(2), sectionId: id(30), startsOn: '2020-01-01' })
      .onConflictDoNothing();
    await tx
      .insert(s.person)
      .values({
        id: id(5),
        fullName: 'გიორგი მაისურაძე',
        contactEmail: 'guardian-two@demo.aia.local',
      })
      .onConflictDoNothing();
    await tx
      .insert(s.guardianLink)
      .values({
        id: id(402),
        guardianPersonId: id(5),
        studentId: id(200),
        academicAccess: true,
        financeAccess: true,
        startsOn: '2020-01-01',
      })
      .onConflictDoNothing();
    await tx
      .insert(s.staff)
      .values({ id: id(22), personId: id(1), title: 'დირექტორი', startsOn: '2020-09-01' })
      .onConflictDoNothing();
    for (const [i, name] of [
      'ქართული ენა და ლიტერატურა',
      'მათემატიკა',
      'ბუნებისმეტყველება',
    ].entries()) {
      await tx
        .insert(s.subject)
        .values({ id: id(600 + i), code: ['KA', 'MA', 'SCI'][i]!, name })
        .onConflictDoNothing();
      await tx
        .insert(s.courseOffering)
        .values({
          id: id(610 + i),
          sectionId: id(30),
          subjectId: id(600 + i),
          elective: i === 2,
          startsOn: calendar.startsOn,
          endsOn: calendar.endsOn,
        })
        .onConflictDoNothing();
    }
    await tx
      .insert(s.teachingAssignment)
      .values({
        id: id(501),
        staffPersonId: id(4),
        sectionId: id(30),
        offeringId: id(611),
        kind: 'course',
        startsOn: calendar.startsOn,
        endsOn: calendar.endsOn,
      })
      .onConflictDoNothing();
    await tx
      .insert(s.courseMembership)
      .values({
        id: id(620),
        offeringId: id(612),
        studentId: id(200),
        startsOn: calendar.startsOn,
        endsOn: calendar.endsOn,
      })
      .onConflictDoNothing();
    await tx
      .insert(s.auditEvent)
      .values({
        id: id(900),
        actorUserId: 'demo-director',
        action: 'demo.seed',
        objectType: 'foundation',
        objectId: 'fictional-demo',
        metadata: { fictional: true },
      })
      .onConflictDoNothing();
  });
  await seedTimetable();
}
