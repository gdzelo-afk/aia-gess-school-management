import { eq } from 'drizzle-orm';
import { db } from './client.js';
import * as s from './schema.js';
import { fixtureId as id } from './fixtures.js';
import { loadContext, labelsFor, resolveRange, conflictsFor } from '../modules/timetable-engine.js';
import type { TimetableDocument } from '../../shared/timetable.js';
export async function seedTimetable() {
  await db.transaction(async (tx) => {
    if (
      (
        await tx
          .select()
          .from(s.auditEvent)
          .where(eq(s.auditEvent.id, id(1900)))
      ).length
    )
      return;
    const year = (
      await tx
        .select()
        .from(s.academicYear)
        .where(eq(s.academicYear.id, id(10)))
    )[0]!;
    const span = { startsOn: year.startsOn, endsOn: year.endsOn };
    await tx
      .insert(s.timetableRoom)
      .values([101, 102, 201].map((n, i) => ({ id: id(1300 + i), number: String(n) })))
      .onConflictDoNothing();
    // Extra offerings reuse existing subjects/sections; no new authenticated persona.
    await tx
      .insert(s.courseOffering)
      .values([
        { id: id(1310), sectionId: id(31), subjectId: id(601), elective: false, ...span },
        { id: id(1311), sectionId: id(31), subjectId: id(602), elective: true, ...span },
      ])
      .onConflictDoNothing();
    for (const [i, offeringId, sectionId, teacherId] of [
      [0, id(610), id(30), id(2)],
      [1, id(610), id(30), id(4)],
      [2, id(612), id(30), id(4)],
      [3, id(1310), id(31), id(4)],
      [4, id(1311), id(31), id(4)],
    ] as const) {
      const existing = await tx
        .select()
        .from(s.teachingAssignment)
        .where(eq(s.teachingAssignment.offeringId, offeringId));
      if (!existing.some((a) => a.staffPersonId === teacherId))
        await tx.insert(s.teachingAssignment).values({
          id: id(1320 + i),
          offeringId,
          sectionId,
          staffPersonId: teacherId,
          kind: 'course',
          ...span,
        });
    }
    const en = await tx
      .select()
      .from(s.enrollment)
      .where(eq(s.enrollment.sectionId, id(31)));
    const studentId = en[0]!.studentId;
    await tx
      .insert(s.courseMembership)
      .values({ id: id(1330), offeringId: id(1311), studentId, ...span })
      .onConflictDoNothing();
    const first = await tx
      .select()
      .from(s.enrollment)
      .where(eq(s.enrollment.sectionId, id(30)));
    const document: TimetableDocument = {
      periods: Array.from({ length: 7 }, (_, i) => {
        const m = 9 * 60 + i * 55;
        const time = (x: number) =>
          `${Math.floor(x / 60)
            .toString()
            .padStart(2, '0')}:${(x % 60).toString().padStart(2, '0')}`;
        return {
          id: id(1400 + i),
          number: i + 1,
          start: time(m),
          end: time(m + 45),
          weekdays: [1, 2, 3, 4, 5],
          teaching: true,
        };
      }),
      groups: [
        {
          id: id(1410),
          name: 'VII ა · ქართული',
          sources: [{ offeringId: id(610), studentIds: null }],
        },
        {
          id: id(1411),
          name: 'VII ა · ჯგუფი 1',
          sources: [{ offeringId: id(610), studentIds: [first[0]!.studentId] }],
        },
        {
          id: id(1412),
          name: 'VII ა · ჯგუფი 2',
          sources: [{ offeringId: id(610), studentIds: first.slice(1).map((e) => e.studentId) }],
        },
        {
          id: id(1413),
          name: 'VII ა + VII ბ · მათემატიკა',
          sources: [
            { offeringId: id(611), studentIds: null },
            { offeringId: id(1310), studentIds: null },
          ],
        },
        {
          id: id(1414),
          name: 'საბუნებისმეტყველო არჩევითი ჯგუფი',
          sources: [
            { offeringId: id(612), studentIds: null },
            { offeringId: id(1311), studentIds: null },
          ],
        },
      ],
      lessons: [],
    };
    for (let d = 1; d <= 5; d++) {
      document.lessons.push({
        id: id(1500 + d),
        groupId: id(1410),
        teacherId: id(2),
        roomId: id(1300),
        weekday: d,
        periodId: id(1400),
      });
      document.lessons.push({
        id: id(1510 + d),
        groupId: id(1413),
        teacherId: id(4),
        roomId: id(1301),
        weekday: d,
        periodId: id(1401),
      });
    }
    document.lessons.push(
      {
        id: id(1521),
        groupId: id(1411),
        teacherId: id(2),
        roomId: id(1300),
        weekday: 2,
        periodId: id(1402),
      },
      {
        id: id(1522),
        groupId: id(1412),
        teacherId: id(4),
        roomId: id(1301),
        weekday: 2,
        periodId: id(1402),
      },
      {
        id: id(1523),
        groupId: id(1414),
        teacherId: id(4),
        roomId: id(1302),
        weekday: 4,
        periodId: id(1403),
      },
    );
    const ctx = await loadContext(tx, year.id),
      labels = labelsFor(ctx);
    const v = (
      await tx
        .insert(s.timetableVersion)
        .values({
          id: id(1600),
          yearId: year.id,
          name: 'სადემონსტრაციო განრიგი · I გამოცემა',
          ...span,
          document,
          labels,
          status: 'published',
          publishedAt: new Date(),
          publishedBy: 'demo-director',
        })
        .returning()
    )[0]!;
    const conflicts = conflictsFor(ctx, resolveRange(ctx, [v], [], v.startsOn, v.endsOn));
    if (conflicts.length)
      throw Error(`Demo timetable invalid: ${JSON.stringify(conflicts.slice(0, 3))}`);
    await tx.insert(s.timetableAvailability).values({
      id: id(1610),
      teacherId: id(4),
      ...span,
      weekdays: [5],
      periodNumbers: [7],
      reason: 'სადემონსტრაციო კონსულტაციის დრო',
    });
    const date = '2026-09-30',
      prior = resolveRange(ctx, [v], [], date, '2026-10-01')[0]!;
    await tx.insert(s.timetableException).values({
      id: id(1620),
      versionId: v.id,
      lessonId: prior.lessonId,
      date,
      targetDate: date,
      change: {
        date,
        targetDate: date,
        occurrenceId: prior.id,
        expectedRevision: prior.revision,
        teacherId: id(4),
        roomId: prior.roomId,
        groupId: prior.groupId,
        periodId: prior.periodId,
        start: prior.start,
        end: prior.end,
        cancelled: false,
        exceptionalDay: false,
      },
      labels,
      reason: 'სადემონსტრაციო ერთდღიანი ჩანაცვლება',
      actorId: 'demo-director',
    });
    await tx.insert(s.auditEvent).values({
      id: id(1900),
      actorUserId: 'demo-director',
      action: 'timetable.demo.seed',
      objectType: 'timetable',
      objectId: v.id,
      metadata: { fictional: true },
    });
  });
}
