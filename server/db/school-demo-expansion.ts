import { eq } from 'drizzle-orm';
import { db } from './client.js';
import * as s from './schema.js';
import { fixtureId as id } from './fixtures.js';
import { config } from '../config.js';
import {
  conflictsFor,
  labelsFor,
  loadContext,
  resolveRange,
  validateDocument,
} from '../modules/timetable-engine.js';
import type { TimetableDocument } from '../../shared/timetable.js';

export const expandedDemo = {
  marker: id(22999),
  timetableId: id(22000),
  effectiveFrom: '2026-10-05',
  sections: [id(11000), id(11001), id(11002)],
  studentIds: Array.from({ length: 32 }, (_, i) => id(13000 + i)),
  // Includes the three preserved original subjects. Curriculum coverage is fictional,
  // not a claim about the school's confirmed current weekly hour allocation.
  subjects: [
    { id: id(600), code: 'KA', name: 'ქართული ენა და ლიტერატურა' },
    { id: id(601), code: 'MA', name: 'მათემატიკა' },
    { id: id(10000), code: 'EN', name: 'ინგლისური ენა' },
    { id: id(10001), code: 'DE', name: 'გერმანული ენა' },
    { id: id(10002), code: 'HIS', name: 'ისტორია' },
    { id: id(10003), code: 'GEO', name: 'გეოგრაფია' },
    { id: id(10004), code: 'BIO', name: 'ბიოლოგია' },
    { id: id(10005), code: 'CHE', name: 'ქიმია' },
    { id: id(10006), code: 'PHY', name: 'ფიზიკა' },
    { id: id(10007), code: 'CIV', name: 'მოქალაქეობა' },
    { id: id(10008), code: 'ICT', name: 'კომპიუტერული ტექნოლოგიები' },
    { id: id(10009), code: 'ART', name: 'სახვითი და გამოყენებითი ხელოვნება' },
    { id: id(10010), code: 'MUS', name: 'მუსიკა' },
    { id: id(10011), code: 'PE', name: 'სპორტი' },
    { id: id(10012), code: 'ROAD', name: 'საგზაო ნიშნები და მოძრაობის უსაფრთხოება' },
    { id: id(602), code: 'SCI', name: 'ბუნებისმეტყველება' },
    { id: id(10013), code: 'CHESS', name: 'ჭადრაკი · არჩევითი' },
  ],
} as const;
const pupilNames = [
  'მათე ჯორბენაძე',
  'ანასტასია გელოვანი',
  'დემეტრე ბაქრაძე',
  'ნინა ჩხარტიშვილი',
  'ალექსანდრე ჯავახიშვილი',
  'მარიამ ნაკაშიძე',
  'იოანე გოგიბერიძე',
  'ლილე აბულაძე',
  'დანიელ რობაქიძე',
  'ელენე ფანცხავა',
  'ნიკო მანაგაძე',
  'მართა სამხარაძე',
  'საბა კუჭავა',
  'კესო ღლონტი',
  'ილია კობალაძე',
  'ლიზი ასათიანი',
  'ანდრია გაბუნია',
  'ნატალი ზამბახიძე',
  'გაბრიელ მახარაძე',
  'თინათინ ბერიშვილი',
  'თომა კალანდაძე',
  'მილა მესხიშვილი',
  'მიხეილ ჯაყელი',
  'ანი ცინცაძე',
  'ლევან ხუციშვილი',
  'დარინა ჭანტურია',
  'ლაზარე ჭელიძე',
  'ეკატერინე ფირცხალავა',
  'გრიგოლ ბენდელიანი',
  'ნიტა ხიდაშელი',
  'ბექა ხურცილავა',
  'სოფიო იოსელიანი',
];
const teacherNames = [
  'ნანა გურგენიძე',
  'ზურაბ ტაბიძე',
  'თეა მიქაბერიძე',
  'დავით ჭიჭინაძე',
  'თამუნა კობახიძე',
  'გოჩა გოგოლაძე',
  'ნათია ბაგრატიონი',
  'მაკა ჯანელიძე',
  'ოთარ მინდაძე',
  'ნინო კახიძე',
  'თათია ლორთქიფანიძე',
  'გიორგი ქავთარაძე',
  'ნინო დარჩია',
  'ლაშა გეგეჭკორი',
  'სოფო შენგელია',
  'ანა ბუბუტეიშვილი',
  'გურამ ნემსაძე',
];
// Indexes into the explicit subject catalog; each row is one fictional school day.
const weekPlans = [
  [
    [0, 1, 2, 4, 6, 13],
    [1, 0, 3, 5, 8, 10],
    [2, 1, 0, 7, 9, 11],
    [0, 2, 1, 4, 6, 13],
    [1, 0, 3, 5, 12, 14],
  ],
  [
    [0, 1, 2, 15, 11],
    [1, 0, 15, 12, 13],
    [0, 1, 2, 10, 11],
    [1, 0, 15, 12, 13],
    [0, 1, 2, 15, 14],
  ],
  [
    [0, 1, 2, 15, 11, 13],
    [1, 0, 3, 4, 10, 12],
    [2, 1, 0, 15, 9, 13],
    [0, 2, 1, 3, 11, 14],
    [1, 0, 2, 15, 10, 12],
  ],
];

/** Insert-only demo upgrade. Never edits an existing pupil, publication or attendance row. */
export async function seedSchoolExpansion() {
  if (config.NODE_ENV === 'production' || !config.DEMO_MODE)
    throw Error('Fictional seed requires non-production demo mode.');
  await db.transaction(async (tx) => {
    if (
      (await tx.select().from(s.auditEvent).where(eq(s.auditEvent.id, expandedDemo.marker))).length
    )
      return;
    const year = (
      await tx
        .select()
        .from(s.academicYear)
        .where(eq(s.academicYear.id, id(10)))
    )[0];
    if (!year) throw Error('Seed academic structure first.');
    const span = { startsOn: year.startsOn, endsOn: year.endsOn };
    for (const subject of expandedDemo.subjects)
      await tx.insert(s.subject).values(subject).onConflictDoNothing();
    for (const [ci, name, grade] of [
      [0, 'VIII ბ', 8],
      [1, 'IV ა', 4],
      [2, 'V ა', 5],
    ] as const) {
      await tx
        .insert(s.section)
        .values({ id: expandedDemo.sections[ci], yearId: year.id, name, gradeLevel: grade })
        .onConflictDoNothing();
    }
    for (const [i, name] of pupilNames.entries()) {
      const ci = i < 20 ? 0 : i < 26 ? 1 : 2;
      await tx
        .insert(s.person)
        .values({ id: id(12000 + i), fullName: name })
        .onConflictDoNothing();
      await tx
        .insert(s.student)
        .values({ id: id(13000 + i), personId: id(12000 + i), number: `AG-D${String(100 + i)}` })
        .onConflictDoNothing();
      await tx
        .insert(s.enrollment)
        .values({
          id: id(14000 + i),
          studentId: id(13000 + i),
          sectionId: expandedDemo.sections[ci]!,
          ...span,
        })
        .onConflictDoNothing();
    }
    for (const [i, name] of teacherNames.entries()) {
      await tx
        .insert(s.person)
        .values({ id: id(15000 + i), fullName: name })
        .onConflictDoNothing();
      await tx
        .insert(s.staff)
        .values({
          id: id(15100 + i),
          personId: id(15000 + i),
          title: `${expandedDemo.subjects[i]!.name} · მასწავლებელი`,
          startsOn: year.startsOn,
        })
        .onConflictDoNothing();
    }
    const teacherFor = (subject: number) => (subject === 0 ? id(2) : id(15000 + subject));
    const doc: TimetableDocument = { periods: [], groups: [], lessons: [] };
    const versions = await tx
      .select()
      .from(s.timetableVersion)
      .where(eq(s.timetableVersion.yearId, year.id));
    const original = versions.find((v) => v.id === id(1600));
    if (!original) throw Error('Seed original timetable first.');
    Object.assign(doc, structuredClone(original.document));
    for (let ci = 0; ci < 3; ci++) {
      const subjects = [...new Set(weekPlans[ci]!.flat())];
      if (ci === 0) subjects.push(16);
      await tx
        .insert(s.timetableRoom)
        .values({ id: id(18000 + ci), number: String(301 + ci) })
        .onConflictDoNothing();
      for (const si of subjects) {
        const offeringId = id(16000 + ci * 100 + si);
        await tx
          .insert(s.courseOffering)
          .values({
            id: offeringId,
            sectionId: expandedDemo.sections[ci]!,
            subjectId: expandedDemo.subjects[si]!.id,
            elective: si === 16,
            ...span,
          })
          .onConflictDoNothing();
        await tx
          .insert(s.teachingAssignment)
          .values({
            id: id(17000 + ci * 100 + si),
            staffPersonId: teacherFor(si),
            sectionId: expandedDemo.sections[ci]!,
            offeringId,
            kind: 'course',
            ...span,
          })
          .onConflictDoNothing();
        doc.groups.push({
          id: id(19000 + ci * 100 + si),
          name: `${['VIII ბ', 'IV ა', 'V ა'][ci]} · ${expandedDemo.subjects[si]!.name}`,
          sources: [{ offeringId, studentIds: null }],
        });
      }
    }
    // Place the fixed seed lesson plan around preserved lessons. This is fixture
    // construction only: no automatic timetable-generation API or user workflow.
    const usedTeachers = new Set(
      doc.lessons.map((l) => `${l.weekday}:${l.periodId}:${l.teacherId}`),
    );
    let lesson = 20000;
    for (let day = 1; day <= 5; day++)
      for (let ci = 0; ci < 3; ci++) {
        const usedPeriods = new Set<string>();
        for (const si of weekPlans[ci]![day - 1]!) {
          const teacherId = teacherFor(si);
          const period = doc.periods.find(
            (p) =>
              p.number <= 7 &&
              !usedPeriods.has(p.id) &&
              !usedTeachers.has(`${day}:${p.id}:${teacherId}`),
          );
          if (!period) throw Error('Fictional plan cannot fit the configured periods.');
          usedPeriods.add(period.id);
          usedTeachers.add(`${day}:${period.id}:${teacherId}`);
          doc.lessons.push({
            id: id(lesson++),
            groupId: id(19000 + ci * 100 + si),
            teacherId,
            roomId: id(18000 + ci),
            weekday: day,
            periodId: period.id,
          });
        }
      }
    // Cross-section elective uses explicit memberships; no widening of the old elective.
    await tx
      .insert(s.courseOffering)
      .values({
        id: id(16399),
        sectionId: id(30),
        subjectId: expandedDemo.subjects[16].id,
        elective: true,
        ...span,
      })
      .onConflictDoNothing();
    await tx
      .insert(s.teachingAssignment)
      .values({
        id: id(17399),
        staffPersonId: teacherFor(16),
        sectionId: id(30),
        offeringId: id(16399),
        kind: 'course',
        ...span,
      })
      .onConflictDoNothing();
    for (const [n, studentId, offeringId] of [
      [0, id(200), id(16399)],
      [1, id(13000), id(16016)],
      [2, id(13001), id(16016)],
    ] as const)
      await tx
        .insert(s.courseMembership)
        .values({ id: id(18300 + n), studentId, offeringId, ...span })
        .onConflictDoNothing();
    doc.groups = doc.groups.filter((g) => g.id !== id(19016));
    doc.groups.push({
      id: id(19016),
      name: 'VII ა + VIII ბ · ჭადრაკი',
      sources: [
        { offeringId: id(16016), studentIds: null },
        { offeringId: id(16399), studentIds: null },
      ],
    });
    // Friday VII remains free after its preserved two morning lessons. Dense VIII's
    // last available slot is selected explicitly from its fixed Friday plan.
    const electivePeriod = doc.periods.find(
      (p) =>
        !doc.lessons.some(
          (l) =>
            l.weekday === 5 &&
            l.periodId === p.id &&
            (l.roomId === id(18000) || l.groupId === id(1410) || l.groupId === id(1413)),
        ),
    );
    if (!electivePeriod) throw Error('Fictional elective needs a free shared period.');
    doc.lessons.push({
      id: id(lesson),
      groupId: id(19016),
      teacherId: teacherFor(16),
      roomId: id(18000),
      weekday: 5,
      periodId: electivePeriod.id,
    });
    const customized = versions.some((v) => v.id !== original.id && v.status === 'published');
    if (!customized) {
      const ctx = await loadContext(tx, year.id);
      validateDocument(ctx, doc, expandedDemo.effectiveFrom, year.endsOn);
      const [v] = await tx
        .insert(s.timetableVersion)
        .values({
          id: expandedDemo.timetableId,
          yearId: year.id,
          name: 'სადემონსტრაციო განრიგი · გაფართოებული სკოლა',
          startsOn: expandedDemo.effectiveFrom,
          endsOn: year.endsOn,
          status: 'published',
          document: doc,
          labels: labelsFor(ctx),
          publishedAt: new Date(),
          publishedBy: 'demo-director',
        })
        .returning();
      if (conflictsFor(ctx, resolveRange(ctx, [v!], [], v!.startsOn, v!.endsOn)).length)
        throw Error('Expanded fictional timetable has conflicts.');
    }
    await tx.insert(s.auditEvent).values({
      id: expandedDemo.marker,
      actorUserId: 'demo-director',
      action: 'demo.school.expanded',
      objectType: 'academic_year',
      objectId: year.id,
      metadata: {
        fictional: true,
        pupils: 32,
        subjectCatalog: 17,
        timetableSkippedForCustomPublication: customized,
        effectiveFrom: expandedDemo.effectiveFrom,
      },
    });
  });
}
