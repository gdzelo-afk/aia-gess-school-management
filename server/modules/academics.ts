import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as s from '../db/schema.js';
import type { Viewer } from '../../shared/contracts.js';
import type { AcademicCommand } from '../../shared/stage1a.js';
import {
  administration,
  audit,
  expectVersion,
  fail,
  found,
  requireCapability,
  validInterval,
  schoolToday,
  type Transaction,
} from './operations.js';

export async function editableYear(tx: Transaction, id: string) {
  const year = found((await tx.select().from(s.academicYear).where(eq(s.academicYear.id, id)))[0]);
  if (year.status === 'archived') fail('არქივირებული სასწავლო წელი უცვლელია.', 'HISTORY_LOCKED');
  return year;
}
function within(start: string, end: string, year: { startsOn: string; endsOn: string }) {
  validInterval(start, end);
  if (start < year.startsOn || end > year.endsOn)
    fail('პერიოდი სასწავლო წლის საზღვრებში უნდა იყოს.', 'YEAR_BOUNDARY', 400);
}
export async function academicSetup(viewer: Viewer, yearId?: string) {
  // Structure contains no people; calendar is available to every active school account.
  if (!viewer.personId || !viewer.roles.length) fail('წვდომა შეზღუდულია.', 'FORBIDDEN', 403);
  const years = await db
    .select()
    .from(s.academicYear)
    .orderBy(sql`${s.academicYear.startsOn} desc`)
    .limit(100);
  const selected = yearId ?? years.find((y) => y.status === 'active')?.id ?? years[0]?.id;
  if (!selected)
    return {
      years,
      selectedYearId: null,
      semesters: [],
      sections: [],
      subjects: [],
      events: [],
      offerings: [],
      assignments: [],
    };
  found(years.find((y) => y.id === selected));
  const [semesters, sections, subjects, events, offerings] = await Promise.all([
    db.select().from(s.semester).where(eq(s.semester.yearId, selected)).orderBy(s.semester.ordinal),
    db
      .select()
      .from(s.section)
      .where(eq(s.section.yearId, selected))
      .orderBy(s.section.gradeLevel, s.section.name),
    db.select().from(s.subject).orderBy(s.subject.name).limit(200),
    db
      .select()
      .from(s.calendarEvent)
      .where(eq(s.calendarEvent.yearId, selected))
      .orderBy(s.calendarEvent.startsOn),
    db
      .select({
        id: s.courseOffering.id,
        sectionId: s.courseOffering.sectionId,
        subjectId: s.courseOffering.subjectId,
        elective: s.courseOffering.elective,
        startsOn: s.courseOffering.startsOn,
        endsOn: s.courseOffering.endsOn,
        version: s.courseOffering.version,
      })
      .from(s.courseOffering)
      .innerJoin(s.section, eq(s.section.id, s.courseOffering.sectionId))
      .where(eq(s.section.yearId, selected)),
  ]);
  const assignments = viewer.capabilities.includes('academics:manage')
    ? await db
        .select({
          id: s.teachingAssignment.id,
          staffPersonId: s.teachingAssignment.staffPersonId,
          staffName: s.person.fullName,
          sectionId: s.teachingAssignment.sectionId,
          offeringId: s.teachingAssignment.offeringId,
          kind: s.teachingAssignment.kind,
          startsOn: s.teachingAssignment.startsOn,
          endsOn: s.teachingAssignment.endsOn,
        })
        .from(s.teachingAssignment)
        .innerJoin(s.section, eq(s.section.id, s.teachingAssignment.sectionId))
        .innerJoin(s.person, eq(s.person.id, s.teachingAssignment.staffPersonId))
        .where(eq(s.section.yearId, selected))
    : [];
  return {
    years,
    selectedYearId: selected,
    semesters,
    sections,
    subjects,
    events,
    offerings,
    assignments,
  };
}
export async function changeAcademics(viewer: Viewer, requestId: string, c: AcademicCommand) {
  requireCapability(viewer, 'academics:manage');
  return administration(async (tx) => {
    let objectId = '';
    if (c.action === 'year.save') {
      validInterval(c.startsOn, c.endsOn);
      for (const term of c.semesters) within(term.startsOn, term.endsOn, c);
      if (c.semesters[0]!.endsOn > c.semesters[1]!.startsOn)
        fail('სემესტრების პერიოდები იკვეთება.', 'OVERLAP', 400);
      const duplicate = await tx
        .select()
        .from(s.academicYear)
        .where(
          and(
            eq(s.academicYear.name, c.name),
            c.id ? sql`${s.academicYear.id}<>${c.id}` : sql`true`,
          ),
        );
      if (duplicate.length) fail('ასეთი სასწავლო წელი უკვე არსებობს.');
      if (c.id) {
        const old = await editableYear(tx, c.id);
        expectVersion(old.version, c.version);
        if (
          old.status !== 'draft' ||
          (await tx.select().from(s.section).where(eq(s.section.yearId, c.id)).limit(1)).length
        )
          fail(
            'გამოყენებული წლისა და სემესტრების თარიღები დაცულია. შექმენით ახალი სასწავლო წელი.',
            'HISTORY_LOCKED',
          );
        await tx
          .update(s.academicYear)
          .set({ name: c.name, startsOn: c.startsOn, endsOn: c.endsOn, version: old.version + 1 })
          .where(eq(s.academicYear.id, c.id));
        objectId = c.id;
        await tx.delete(s.semester).where(eq(s.semester.yearId, c.id));
      } else
        objectId = (
          await tx
            .insert(s.academicYear)
            .values({ name: c.name, startsOn: c.startsOn, endsOn: c.endsOn })
            .returning()
        )[0]!.id;
      await tx
        .insert(s.semester)
        .values(c.semesters.map((term, i) => ({ ...term, yearId: objectId, ordinal: i + 1 })));
    } else if (c.action === 'year.status') {
      const year = await editableYear(tx, c.id);
      expectVersion(year.version, c.version);
      if (c.status === 'active') {
        if ((await tx.select().from(s.semester).where(eq(s.semester.yearId, c.id))).length !== 2)
          fail('გაამართეთ ორივე სემესტრი.');
        const active = await tx
          .select()
          .from(s.academicYear)
          .where(and(eq(s.academicYear.status, 'active'), sql`${s.academicYear.id}<>${c.id}`));
        if (active.length) fail('ჯერ დააარქივეთ მიმდინარე სასწავლო წელი.');
      }
      await tx
        .update(s.academicYear)
        .set({ status: c.status, version: year.version + 1 })
        .where(eq(s.academicYear.id, c.id));
      objectId = c.id;
    } else if (c.action === 'section.save') {
      await editableYear(tx, c.yearId);
      if (
        (
          await tx
            .select()
            .from(s.section)
            .where(
              and(
                eq(s.section.yearId, c.yearId),
                eq(s.section.name, c.name),
                c.id ? sql`${s.section.id}<>${c.id}` : sql`true`,
              ),
            )
        ).length
      )
        fail('ამ წელს ასეთი კლასი უკვე არსებობს.');
      const value = { yearId: c.yearId, name: c.name, gradeLevel: c.gradeLevel };
      if (c.id) {
        const old = found((await tx.select().from(s.section).where(eq(s.section.id, c.id)))[0]);
        expectVersion(old.version, c.version);
        if (old.yearId !== c.yearId) fail('კლასი სხვა სასწავლო წელში ვერ გადავა.');
        if (
          (await tx.select().from(s.enrollment).where(eq(s.enrollment.sectionId, c.id)).limit(1))
            .length ||
          (
            await tx
              .select()
              .from(s.courseOffering)
              .where(eq(s.courseOffering.sectionId, c.id))
              .limit(1)
          ).length
        )
          fail('გამოყენებული კლასის დასახელება და საფეხური ისტორიის ნაწილია.', 'HISTORY_LOCKED');
        await tx
          .update(s.section)
          .set({ ...value, version: old.version + 1 })
          .where(eq(s.section.id, c.id));
        objectId = c.id;
      } else objectId = (await tx.insert(s.section).values(value).returning())[0]!.id;
    } else if (c.action === 'subject.save') {
      if (
        (
          await tx
            .select()
            .from(s.subject)
            .where(
              and(eq(s.subject.code, c.code), c.id ? sql`${s.subject.id}<>${c.id}` : sql`true`),
            )
        ).length
      )
        fail('საგნის კოდი უკვე გამოყენებულია.');
      const value = { name: c.name, code: c.code, archived: c.archived };
      if (c.id) {
        const old = found((await tx.select().from(s.subject).where(eq(s.subject.id, c.id)))[0]);
        expectVersion(old.version, c.version);
        if (
          (old.name !== c.name || old.code !== c.code) &&
          (
            await tx
              .select()
              .from(s.courseOffering)
              .where(eq(s.courseOffering.subjectId, c.id))
              .limit(1)
          ).length
        )
          fail('გამოყენებული საგნის იდენტობა დაცულია. შეგიძლიათ დააარქივოთ იგი.', 'HISTORY_LOCKED');
        await tx
          .update(s.subject)
          .set({ ...value, version: old.version + 1 })
          .where(eq(s.subject.id, c.id));
        objectId = c.id;
      } else objectId = (await tx.insert(s.subject).values(value).returning())[0]!.id;
    } else if (c.action === 'calendar.save') {
      const year = await editableYear(tx, c.yearId);
      within(c.startsOn, c.endsOn, year);
      if (c.gradeFrom > c.gradeTo) fail('შეამოწმეთ კლასების დიაპაზონი.', 'VALIDATION', 400);
      const value = {
        yearId: c.yearId,
        title: c.title,
        kind: c.kind,
        startsOn: c.startsOn,
        endsOn: c.endsOn,
        gradeFrom: c.gradeFrom,
        gradeTo: c.gradeTo,
      };
      if (c.id) {
        const old = found(
          (await tx.select().from(s.calendarEvent).where(eq(s.calendarEvent.id, c.id)))[0],
        );
        expectVersion(old.version, c.version);
        if (old.startsOn < schoolToday())
          fail('ისტორიული კალენდარული ჩანაწერის შეცვლა დაუშვებელია.');
        if (old.yearId !== c.yearId) fail('წლის შეცვლა დაუშვებელია.');
        await tx
          .update(s.calendarEvent)
          .set({ ...value, version: old.version + 1 })
          .where(eq(s.calendarEvent.id, c.id));
        objectId = c.id;
      } else objectId = (await tx.insert(s.calendarEvent).values(value).returning())[0]!.id;
    } else if (c.action === 'calendar.remove') {
      const old = found(
        (await tx.select().from(s.calendarEvent).where(eq(s.calendarEvent.id, c.id)))[0],
      );
      await editableYear(tx, old.yearId);
      expectVersion(old.version, c.version);
      if (old.startsOn < schoolToday())
        fail('წარსული კალენდარული ჩანაწერი დაცულია.', 'HISTORY_LOCKED');
      await tx.delete(s.calendarEvent).where(eq(s.calendarEvent.id, c.id));
      objectId = c.id;
    } else if (c.action === 'offering.create') {
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, c.sectionId)))[0],
      );
      const year = await editableYear(tx, section.yearId);
      within(c.startsOn, c.endsOn, year);
      const subject = found(
        (await tx.select().from(s.subject).where(eq(s.subject.id, c.subjectId)))[0],
      );
      if (subject.archived) fail('საგანი არქივშია.');
      if (
        (
          await tx
            .select()
            .from(s.courseOffering)
            .where(
              and(
                eq(s.courseOffering.sectionId, c.sectionId),
                eq(s.courseOffering.subjectId, c.subjectId),
              ),
            )
        ).length
      )
        fail('საგანი ამ კლასისთვის უკვე გახსნილია.');
      objectId = (
        await tx
          .insert(s.courseOffering)
          .values({
            sectionId: c.sectionId,
            subjectId: c.subjectId,
            elective: c.elective,
            startsOn: c.startsOn,
            endsOn: c.endsOn,
          })
          .returning()
      )[0]!.id;
    } else if (c.action === 'assignment.create') {
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, c.sectionId)))[0],
      );
      within(c.startsOn, c.endsOn, await editableYear(tx, section.yearId));
      const staff = found(
        (
          await tx
            .select()
            .from(s.staff)
            .innerJoin(s.person, eq(s.person.id, s.staff.personId))
            .where(eq(s.staff.personId, c.staffPersonId))
        )[0],
      );
      if (
        staff.person.archivedAt ||
        c.startsOn < staff.staff.startsOn ||
        (staff.staff.endsOn && c.endsOn > staff.staff.endsOn)
      )
        fail('დანიშვნა თანამშრომლის მოქმედების პერიოდს სცდება.');
      if (c.offeringId) {
        const offering = found(
          (
            await tx.select().from(s.courseOffering).where(eq(s.courseOffering.id, c.offeringId))
          )[0],
        );
        if (offering.sectionId !== c.sectionId) fail('კურსი სხვა კლასს ეკუთვნის.');
        within(c.startsOn, c.endsOn, offering);
      }
      const overlap = await tx
        .select()
        .from(s.teachingAssignment)
        .where(
          and(
            eq(s.teachingAssignment.sectionId, c.sectionId),
            c.offeringId
              ? and(
                  eq(s.teachingAssignment.offeringId, c.offeringId),
                  eq(s.teachingAssignment.staffPersonId, c.staffPersonId),
                )
              : sql`${s.teachingAssignment.offeringId} is null`,
            sql`${s.teachingAssignment.startsOn}<${c.endsOn} and coalesce(${s.teachingAssignment.endsOn},'infinity'::date)>${c.startsOn}`,
          ),
        );
      if (overlap.length) fail('ამ პერიოდში დანიშვნა უკვე არსებობს.', 'OVERLAP');
      objectId = (
        await tx
          .insert(s.teachingAssignment)
          .values({
            staffPersonId: c.staffPersonId,
            sectionId: c.sectionId,
            offeringId: c.offeringId,
            kind: c.offeringId ? 'course' : 'homeroom',
            startsOn: c.startsOn,
            endsOn: c.endsOn,
          })
          .returning()
      )[0]!.id;
    } else if (c.action === 'assignment.end') {
      const old = found(
        (await tx.select().from(s.teachingAssignment).where(eq(s.teachingAssignment.id, c.id)))[0],
      );
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, old.sectionId)))[0],
      );
      await editableYear(tx, section.yearId);
      validInterval(old.startsOn, c.endsOn);
      if ((old.endsOn && c.endsOn >= old.endsOn) || c.endsOn < schoolToday())
        fail('დასრულება მოქმედი პერიოდის ფარგლებში უნდა იყოს; წარსული ისტორია დაცულია.');
      await tx
        .update(s.teachingAssignment)
        .set({ endsOn: c.endsOn })
        .where(eq(s.teachingAssignment.id, c.id));
      objectId = c.id;
    } else if (c.action === 'membership.create') {
      const offering = found(
        (await tx.select().from(s.courseOffering).where(eq(s.courseOffering.id, c.offeringId)))[0],
      );
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, offering.sectionId)))[0],
      );
      await editableYear(tx, section.yearId);
      within(c.startsOn, c.endsOn, offering);
      if (!offering.elective) fail('ძირითადი კურსის სია კლასის ჩარიცხვებიდან იქმნება.');
      const enrollment = await tx
        .select()
        .from(s.enrollment)
        .innerJoin(s.student, eq(s.student.id, s.enrollment.studentId))
        .where(
          and(
            eq(s.enrollment.studentId, c.studentId),
            eq(s.enrollment.sectionId, offering.sectionId),
            eq(s.student.status, 'active'),
            sql`${s.enrollment.startsOn}<=${c.startsOn} and coalesce(${s.enrollment.endsOn},'infinity'::date)>=${c.endsOn}`,
          ),
        );
      if (!enrollment.length) fail('მოსწავლეს ამ პერიოდში შესაბამის კლასში ჩარიცხვა სჭირდება.');
      if (
        (
          await tx
            .select()
            .from(s.courseMembership)
            .where(
              and(
                eq(s.courseMembership.offeringId, c.offeringId),
                eq(s.courseMembership.studentId, c.studentId),
                sql`${s.courseMembership.startsOn}<${c.endsOn} and ${s.courseMembership.endsOn}>${c.startsOn}`,
              ),
            )
        ).length
      )
        fail('კურსის წევრობის პერიოდები იკვეთება.', 'OVERLAP');
      objectId = (
        await tx
          .insert(s.courseMembership)
          .values({
            offeringId: c.offeringId,
            studentId: c.studentId,
            startsOn: c.startsOn,
            endsOn: c.endsOn,
          })
          .returning()
      )[0]!.id;
    } else if (c.action === 'membership.end') {
      const old = found(
        (await tx.select().from(s.courseMembership).where(eq(s.courseMembership.id, c.id)))[0],
      );
      validInterval(old.startsOn, c.endsOn);
      const offering = found(
        (
          await tx.select().from(s.courseOffering).where(eq(s.courseOffering.id, old.offeringId))
        )[0],
      );
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, offering.sectionId)))[0],
      );
      await editableYear(tx, section.yearId);
      if (c.endsOn >= old.endsOn || c.endsOn < schoolToday())
        fail('წევრობის პერიოდის დასრულება შეამოწმეთ.');
      await tx
        .update(s.courseMembership)
        .set({ endsOn: c.endsOn })
        .where(eq(s.courseMembership.id, c.id));
      objectId = c.id;
    }
    await audit(tx, viewer, requestId, c.action, c.action.split('.')[0]!, objectId);
    return { id: objectId };
  });
}
export async function offeringRoster(viewer: Viewer, id: string, on: string, offset: number) {
  requireCapability(viewer, 'academics:manage');
  const offering = found(
    (await db.select().from(s.courseOffering).where(eq(s.courseOffering.id, id)))[0],
  );
  const predicate = and(
    eq(s.enrollment.sectionId, offering.sectionId),
    sql`${s.enrollment.startsOn}<=${on} and coalesce(${s.enrollment.endsOn},'infinity'::date)>${on}`,
    sql`${on}::date>=${offering.startsOn}::date and ${on}::date<${offering.endsOn}::date`,
    offering.elective
      ? sql`exists (select 1 from course_membership m where m.student_id=${s.student.id} and m.offering_id=${id} and m.starts_on<=${on} and m.ends_on>${on})`
      : sql`true`,
  );
  const items = await db
    .select({
      id: s.student.id,
      name: s.person.fullName,
      number: s.student.number,
      startsOn: s.enrollment.startsOn,
      endsOn: s.enrollment.endsOn,
      membershipId: sql<
        string | null
      >`(select m.id from course_membership m where m.student_id=${s.student.id} and m.offering_id=${id} and m.starts_on<=${on} and m.ends_on>${on} limit 1)`,
    })
    .from(s.enrollment)
    .innerJoin(s.student, eq(s.student.id, s.enrollment.studentId))
    .innerJoin(s.person, eq(s.person.id, s.student.personId))
    .where(predicate)
    .orderBy(s.person.fullName, s.student.id)
    .limit(25)
    .offset(offset);
  const total = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.enrollment)
    .innerJoin(s.student, eq(s.student.id, s.enrollment.studentId))
    .where(predicate);
  return { items, total: total[0]!.n };
}
