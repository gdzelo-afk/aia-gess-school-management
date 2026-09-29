import { and, eq, or, sql, ilike } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as s from '../db/schema.js';
import type { Viewer } from '../../shared/contracts.js';
import type { PeopleCommand } from '../../shared/stage1a.js';
import {
  administration,
  audit,
  expectVersion,
  fail,
  found,
  requireCapability,
  validInterval,
  schoolToday,
} from './operations.js';
import { editableYear } from './academics.js';

export async function listPeople(
  viewer: Viewer,
  input: {
    q: string;
    kind: 'guardian' | 'staff' | 'person';
    offset: number;
    status: 'active' | 'archived' | 'all' | 'departed';
  },
) {
  requireCapability(
    viewer,
    input.kind === 'staff'
      ? 'staff:manage'
      : input.kind === 'person'
        ? 'access:manage'
        : 'people:manage',
  );
  const pattern = `%${input.q.replace(/[\\%_]/g, '\\$&')}%`;
  const where = and(
    or(
      ilike(s.person.fullName, pattern),
      ilike(s.person.contactEmail, pattern),
      input.kind === 'person' ? sql`false` : ilike(s.student.number, pattern),
    ),
    input.kind === 'staff'
      ? sql`${s.staff.id} is not null`
      : input.kind === 'guardian'
        ? sql`((${s.student.id} is null and ${s.staff.id} is null) or exists(select 1 from guardian_link g where g.guardian_person_id=${s.person.id}))`
        : sql`true`,
    input.kind === 'staff' && input.status === 'active'
      ? sql`${s.staff.startsOn} <= ${schoolToday()} and coalesce(${s.staff.endsOn},'infinity'::date)>${schoolToday()}`
      : input.status === 'departed'
        ? sql`${s.staff.endsOn}<=${schoolToday()}`
        : sql`true`,
    input.status === 'all'
      ? sql`true`
      : input.status === 'archived'
        ? sql`${s.person.archivedAt} is not null`
        : sql`${s.person.archivedAt} is null`,
  );
  const items = await db
    .select({
      id: s.person.id,
      fullName: s.person.fullName,
      contactEmail: s.person.contactEmail,
      version: s.person.version,
      archivedAt: s.person.archivedAt,
      userId: s.person.userId,
      staffId: s.staff.id,
      title: s.staff.title,
      startsOn: s.staff.startsOn,
      endsOn: s.staff.endsOn,
      staffVersion: s.staff.version,
      studentId: s.student.id,
      number: s.student.number,
    })
    .from(s.person)
    .leftJoin(s.staff, eq(s.staff.personId, s.person.id))
    .leftJoin(s.student, eq(s.student.personId, s.person.id))
    .where(where)
    .orderBy(s.person.fullName, s.person.id)
    .limit(25)
    .offset(input.offset);
  const count = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(s.person)
    .leftJoin(s.staff, eq(s.staff.personId, s.person.id))
    .leftJoin(s.student, eq(s.student.personId, s.person.id))
    .where(where);
  // IT account lookup has identity/account context only; no student/staff projections.
  return {
    items:
      input.kind === 'person'
        ? items.map((p) => ({
            ...p,
            studentId: null,
            number: null,
            staffId: null,
            title: null,
            startsOn: null,
            endsOn: null,
            staffVersion: null,
          }))
        : input.kind === 'guardian'
          ? items.map((p) => ({
              ...p,
              title: null,
              startsOn: null,
              endsOn: null,
              staffVersion: null,
            }))
          : items,
    total: count[0]!.n,
    limit: 25,
    offset: input.offset,
  };
}
export async function studentAdministration(viewer: Viewer, id: string) {
  requireCapability(viewer, 'people:manage');
  const record = found(
    (
      await db
        .select({
          id: s.student.id,
          personId: s.person.id,
          name: s.person.fullName,
          number: s.student.number,
          status: s.student.status,
          version: s.student.version,
          personVersion: s.person.version,
          contactEmail: s.person.contactEmail,
        })
        .from(s.student)
        .innerJoin(s.person, eq(s.person.id, s.student.personId))
        .where(eq(s.student.id, id))
    )[0],
  );
  const [enrollments, guardians] = await Promise.all([
    db
      .select({
        id: s.enrollment.id,
        sectionId: s.section.id,
        sectionName: s.section.name,
        yearName: s.academicYear.name,
        startsOn: s.enrollment.startsOn,
        endsOn: s.enrollment.endsOn,
      })
      .from(s.enrollment)
      .innerJoin(s.section, eq(s.section.id, s.enrollment.sectionId))
      .innerJoin(s.academicYear, eq(s.academicYear.id, s.section.yearId))
      .where(eq(s.enrollment.studentId, id))
      .orderBy(sql`${s.enrollment.startsOn} desc`),
    db
      .select({
        id: s.guardianLink.id,
        guardianPersonId: s.person.id,
        name: s.person.fullName,
        startsOn: s.guardianLink.startsOn,
        endsOn: s.guardianLink.endsOn,
      })
      .from(s.guardianLink)
      .innerJoin(s.person, eq(s.person.id, s.guardianLink.guardianPersonId))
      .where(eq(s.guardianLink.studentId, id))
      .orderBy(sql`${s.guardianLink.startsOn} desc`),
  ]);
  return { ...record, enrollments, guardians };
}
export async function changePeople(viewer: Viewer, requestId: string, c: PeopleCommand) {
  requireCapability(viewer, c.action === 'staff.save' ? 'staff:manage' : 'people:manage');
  return administration(async (tx) => {
    let objectId = '';
    if (c.action === 'student.create') {
      if ((await tx.select().from(s.student).where(eq(s.student.number, c.number))).length)
        fail('მოსწავლის ნომერი უკვე გამოყენებულია.');
      const section = found(
        (await tx.select().from(s.section).where(eq(s.section.id, c.sectionId)))[0],
      );
      const year = await editableYear(tx, section.yearId);
      if (c.startsOn < year.startsOn || c.startsOn >= year.endsOn)
        fail('ჩარიცხვა სასწავლო წლის საზღვრებს სცდება.');
      let personId = c.personId;
      if (personId) {
        const protectedRoles = await tx
          .select()
          .from(s.roleGrant)
          .innerJoin(s.person, eq(s.person.userId, s.roleGrant.userId))
          .where(eq(s.person.id, personId));
        if (
          protectedRoles.some((r) =>
            ['super_admin', 'director', 'it_admin'].includes(r.role_grant.role),
          ) &&
          !viewer.roles.includes('super_admin')
        )
          fail(
            'დაცული ანგარიშის თანამშრომლის ცვლილებას მთავარი ადმინისტრატორი სჭირდება.',
            'FORBIDDEN',
            403,
          );
        const person = found(
          (await tx.select().from(s.person).where(eq(s.person.id, personId)))[0],
        );
        if (person.archivedAt) fail('პიროვნება არქივშია.');
        if ((await tx.select().from(s.student).where(eq(s.student.personId, personId))).length)
          fail('ამ პიროვნებას მოსწავლის პროფილი უკვე აქვს.');
      } else
        personId = (
          await tx
            .insert(s.person)
            .values({ fullName: c.fullName, contactEmail: c.contactEmail })
            .returning()
        )[0]!.id;
      const student = (
        await tx.insert(s.student).values({ personId, number: c.number }).returning()
      )[0]!;
      objectId = student.id;
      await tx.insert(s.enrollment).values({
        studentId: student.id,
        sectionId: c.sectionId,
        startsOn: c.startsOn,
        endsOn: year.endsOn,
      });
    } else if (c.action === 'student.edit') {
      const student = found((await tx.select().from(s.student).where(eq(s.student.id, c.id)))[0]);
      const person = found(
        (await tx.select().from(s.person).where(eq(s.person.id, student.personId)))[0],
      );
      expectVersion(student.version, c.version);
      expectVersion(person.version, c.personVersion);
      if (person.archivedAt) fail('არქივირებული პიროვნების რედაქტირება შეზღუდულია.');
      if (
        (
          await tx
            .select()
            .from(s.student)
            .where(and(eq(s.student.number, c.number), sql`${s.student.id}<>${c.id}`))
        ).length
      )
        fail('მოსწავლის ნომერი უკვე გამოყენებულია.');
      await tx
        .update(s.student)
        .set({ number: c.number, version: student.version + 1 })
        .where(eq(s.student.id, c.id));
      await tx
        .update(s.person)
        .set({ fullName: c.fullName, contactEmail: c.contactEmail, version: person.version + 1 })
        .where(eq(s.person.id, person.id));
      if (person.userId)
        await tx
          .update(s.user)
          .set({ name: c.fullName, updatedAt: new Date() })
          .where(eq(s.user.id, person.userId));
      objectId = c.id;
    } else if (c.action === 'enrollment.change') {
      const student = found(
        (await tx.select().from(s.student).where(eq(s.student.id, c.studentId)))[0],
      );
      expectVersion(student.version, c.version);
      const person = found(
        (await tx.select().from(s.person).where(eq(s.person.id, student.personId)))[0],
      );
      if (person.archivedAt || student.status === 'archived')
        fail('ჯერ აღადგინეთ მოსწავლის აქტიური სტატუსი.');
      if (c.effectiveOn < schoolToday())
        fail('გადასვლა ან გასვლა წარსული თარიღით დაუშვებელია.', 'HISTORY_LOCKED');
      const all = await tx
        .select()
        .from(s.enrollment)
        .where(eq(s.enrollment.studentId, c.studentId));
      const current = all.find(
        (e) => e.startsOn <= c.effectiveOn && (!e.endsOn || e.endsOn > c.effectiveOn),
      );
      if (current) {
        validInterval(current.startsOn, c.effectiveOn);
        if (current.sectionId === c.sectionId) fail('მოსწავლე უკვე ამ კლასშია.');
        const section = found(
          (await tx.select().from(s.section).where(eq(s.section.id, current.sectionId)))[0],
        );
        await editableYear(tx, section.yearId);
      }
      let end: string | null = null;
      if (c.sectionId) {
        const section = found(
          (await tx.select().from(s.section).where(eq(s.section.id, c.sectionId)))[0],
        );
        const year = await editableYear(tx, section.yearId);
        if (c.effectiveOn < year.startsOn || c.effectiveOn >= year.endsOn)
          fail('თარიღი სასწავლო წლის საზღვრებს სცდება.');
        end = year.endsOn;
        if (
          all.some(
            (e) =>
              e.id !== current?.id && e.startsOn < end! && (!e.endsOn || e.endsOn > c.effectiveOn),
          )
        )
          fail('ჩარიცხვის პერიოდები იკვეთება.', 'OVERLAP');
      } else if (!current) fail('ამ თარიღისთვის მოქმედი ჩარიცხვა არ არსებობს.');
      if (current)
        await tx
          .update(s.enrollment)
          .set({ endsOn: c.effectiveOn })
          .where(eq(s.enrollment.id, current.id));
      // End elective memberships at the same boundary; preserve prior membership history.
      if (
        (
          await tx
            .select()
            .from(s.courseMembership)
            .where(
              and(
                eq(s.courseMembership.studentId, c.studentId),
                sql`${s.courseMembership.startsOn}>=${c.effectiveOn}`,
              ),
            )
        ).length
      )
        fail('ჯერ შეათანხმეთ მომავალი არჩევითი კურსის წევრობა.');
      await tx
        .update(s.courseMembership)
        .set({ endsOn: c.effectiveOn })
        .where(
          and(
            eq(s.courseMembership.studentId, c.studentId),
            sql`${s.courseMembership.startsOn}<${c.effectiveOn} and ${s.courseMembership.endsOn}>${c.effectiveOn}`,
          ),
        );
      if (c.sectionId)
        await tx.insert(s.enrollment).values({
          studentId: c.studentId,
          sectionId: c.sectionId,
          startsOn: c.effectiveOn,
          endsOn: end,
        });
      await tx
        .update(s.student)
        .set({ version: student.version + 1 })
        .where(eq(s.student.id, student.id));
      objectId = student.id;
    } else if (c.action === 'student.status') {
      const old = found((await tx.select().from(s.student).where(eq(s.student.id, c.id)))[0]);
      expectVersion(old.version, c.version);
      if (
        c.status === 'archived' &&
        (
          await tx
            .select()
            .from(s.enrollment)
            .where(
              and(
                eq(s.enrollment.studentId, c.id),
                sql`coalesce(${s.enrollment.endsOn},'infinity'::date)>${schoolToday()}`,
              ),
            )
        ).length
      )
        fail('დაასრულეთ მოქმედი და მომავალი ჩარიცხვები არქივირებამდე.');
      await tx
        .update(s.student)
        .set({ status: c.status, version: old.version + 1 })
        .where(eq(s.student.id, c.id));
      objectId = c.id;
    } else if (c.action === 'person.create') {
      objectId = (
        await tx
          .insert(s.person)
          .values({ fullName: c.fullName, contactEmail: c.contactEmail })
          .returning()
      )[0]!.id;
    } else if (c.action === 'person.edit' || c.action === 'person.archive') {
      const old = found((await tx.select().from(s.person).where(eq(s.person.id, c.id)))[0]);
      expectVersion(old.version, c.version);
      // Student and staff records have their own lifecycle workflows; guardian management cannot edit staff.
      if (
        (await tx.select().from(s.staff).where(eq(s.staff.personId, c.id)).limit(1)).length ||
        (await tx.select().from(s.student).where(eq(s.student.personId, c.id)).limit(1)).length
      )
        fail('გამოიყენეთ მოსწავლის ან თანამშრომლის პროფილი.');
      if (c.action === 'person.archive') {
        if (old.userId === viewer.id) fail('საკუთარი ანგარიშის არქივირება დაუშვებელია.');
        await tx
          .update(s.person)
          .set({ archivedAt: new Date(), version: old.version + 1 })
          .where(eq(s.person.id, c.id));
        if (old.userId) {
          await tx.update(s.user).set({ disabled: true }).where(eq(s.user.id, old.userId));
          await tx.delete(s.session).where(eq(s.session.userId, old.userId));
        }
      } else {
        await tx
          .update(s.person)
          .set({ fullName: c.fullName, contactEmail: c.contactEmail, version: old.version + 1 })
          .where(eq(s.person.id, c.id));
        if (old.userId)
          await tx
            .update(s.user)
            .set({ name: c.fullName, updatedAt: new Date() })
            .where(eq(s.user.id, old.userId));
      }
      objectId = c.id;
    } else if (c.action === 'guardian.link') {
      const guardian = found(
        (await tx.select().from(s.person).where(eq(s.person.id, c.guardianPersonId)))[0],
      );
      const student = found(
        (await tx.select().from(s.student).where(eq(s.student.id, c.studentId)))[0],
      );
      if (guardian.archivedAt || student.status === 'archived' || student.personId === guardian.id)
        fail('ეს კავშირი დაუშვებელია.');
      if (
        (
          await tx
            .select()
            .from(s.guardianLink)
            .where(
              and(
                eq(s.guardianLink.guardianPersonId, c.guardianPersonId),
                eq(s.guardianLink.studentId, c.studentId),
                sql`coalesce(${s.guardianLink.endsOn},'infinity'::date)>${c.startsOn}`,
              ),
            )
        ).length
      )
        fail('ამ პერიოდში კავშირი უკვე არსებობს.', 'OVERLAP');
      objectId = (
        await tx
          .insert(s.guardianLink)
          .values({
            guardianPersonId: c.guardianPersonId,
            studentId: c.studentId,
            startsOn: c.startsOn,
            academicAccess: true,
            financeAccess: true,
          })
          .returning()
      )[0]!.id;
    } else if (c.action === 'guardian.end') {
      const old = found(
        (await tx.select().from(s.guardianLink).where(eq(s.guardianLink.id, c.id)))[0],
      );
      validInterval(old.startsOn, c.endsOn);
      if (c.endsOn < schoolToday() || (old.endsOn && c.endsOn >= old.endsOn))
        fail('კავშირის დასრულების თარიღი შეამოწმეთ.');
      await tx.update(s.guardianLink).set({ endsOn: c.endsOn }).where(eq(s.guardianLink.id, c.id));
      objectId = c.id;
    } else if (c.action === 'staff.save') {
      validInterval(c.startsOn, c.endsOn);
      let personId = c.personId;
      if (c.id) {
        const old = found((await tx.select().from(s.staff).where(eq(s.staff.id, c.id)))[0]);
        expectVersion(old.version, c.version);
        personId = old.personId;
        if (c.startsOn !== old.startsOn)
          fail('სამუშაოს დაწყების ისტორია დაცულია.', 'HISTORY_LOCKED');
        if (old.endsOn && c.endsOn !== old.endsOn)
          fail('დასრულებული სამუშაო პერიოდი უცვლელია.', 'HISTORY_LOCKED');
        if (c.endsOn && c.endsOn < schoolToday())
          fail('წარსული თარიღით თანამშრომლის გასვლა დაუშვებელია.');
      }
      if (personId) {
        const protectedRoles = await tx
          .select()
          .from(s.roleGrant)
          .innerJoin(s.person, eq(s.person.userId, s.roleGrant.userId))
          .where(eq(s.person.id, personId));
        if (
          protectedRoles.some((r) =>
            ['super_admin', 'director', 'it_admin'].includes(r.role_grant.role),
          ) &&
          !viewer.roles.includes('super_admin')
        )
          fail(
            'დაცული ანგარიშის თანამშრომლის ცვლილებას მთავარი ადმინისტრატორი სჭირდება.',
            'FORBIDDEN',
            403,
          );
        const person = found(
          (await tx.select().from(s.person).where(eq(s.person.id, personId)))[0],
        );
        expectVersion(person.version, c.personVersion);
        if (person.archivedAt) fail('პიროვნება არქივშია.');
        if (!c.id && (await tx.select().from(s.staff).where(eq(s.staff.personId, personId))).length)
          fail('თანამშრომლის პროფილი უკვე არსებობს.');
        await tx
          .update(s.person)
          .set({ fullName: c.fullName, contactEmail: c.contactEmail, version: person.version + 1 })
          .where(eq(s.person.id, personId));
        if (person.userId) {
          await tx
            .update(s.user)
            .set({
              name: c.fullName,
              ...(c.endsOn && c.endsOn <= schoolToday() ? { disabled: true } : {}),
            })
            .where(eq(s.user.id, person.userId));
          if (c.endsOn && c.endsOn <= schoolToday())
            await tx.delete(s.session).where(eq(s.session.userId, person.userId));
        }
      } else
        personId = (
          await tx
            .insert(s.person)
            .values({ fullName: c.fullName, contactEmail: c.contactEmail })
            .returning()
        )[0]!.id;
      if (c.endsOn) {
        if (
          (
            await tx
              .select()
              .from(s.teachingAssignment)
              .where(
                and(
                  eq(s.teachingAssignment.staffPersonId, personId),
                  sql`${s.teachingAssignment.startsOn}>=${c.endsOn}`,
                ),
              )
          ).length
        )
          fail('მომავალი დანიშვნა სამუშაო პერიოდს სცდება. ჯერ დაასრულეთ დანიშვნები.');
        await tx
          .update(s.teachingAssignment)
          .set({ endsOn: c.endsOn })
          .where(
            and(
              eq(s.teachingAssignment.staffPersonId, personId),
              sql`${s.teachingAssignment.startsOn}<${c.endsOn} and coalesce(${s.teachingAssignment.endsOn},'infinity'::date)>${c.endsOn}`,
            ),
          );
      }
      const value = { personId, title: c.title, startsOn: c.startsOn, endsOn: c.endsOn };
      if (c.id) {
        await tx
          .update(s.staff)
          .set({ ...value, version: c.version! + 1 })
          .where(eq(s.staff.id, c.id));
        objectId = c.id;
      } else objectId = (await tx.insert(s.staff).values(value).returning())[0]!.id;
    }
    await audit(
      tx,
      viewer,
      requestId,
      c.action,
      c.action.split('.')[0]!,
      objectId,
      c.action === 'enrollment.change'
        ? {
            effectiveOn: c.effectiveOn,
            from: 'previous enrollment retained',
            toSectionId: c.sectionId,
          }
        : {},
    );
    return { id: objectId };
  });
}

export async function personOptions(
  viewer: Viewer,
  kind: 'staff' | 'guardian' | 'person' | 'student',
  q: string,
) {
  if (kind === 'staff') {
    if (!viewer.capabilities.includes('academics:manage'))
      requireCapability(viewer, 'staff:manage');
  } else if (kind === 'person') {
    if (
      !viewer.capabilities.includes('people:manage') &&
      !viewer.capabilities.includes('staff:manage')
    )
      requireCapability(viewer, 'access:manage');
  } else if (kind === 'student') {
    if (!viewer.capabilities.includes('academics:manage'))
      requireCapability(viewer, 'people:manage');
  } else requireCapability(viewer, 'people:manage');
  if (q.trim().length < 2) return { items: [] };
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
  const where = and(
    sql`${s.person.archivedAt} is null`,
    or(ilike(s.person.fullName, pattern), ilike(s.person.contactEmail, pattern)),
    kind === 'staff'
      ? sql`${s.staff.id} is not null and coalesce(${s.staff.endsOn},'infinity'::date)>${schoolToday()}`
      : kind === 'student'
        ? and(eq(s.student.status, 'active'), sql`${s.student.id} is not null`)
        : sql`true`,
  );
  const rows = await db
    .select({
      id: kind === 'student' ? s.student.id : s.person.id,
      name: s.person.fullName,
      email: s.person.contactEmail,
      version: s.person.version,
      number: s.student.number,
    })
    .from(s.person)
    .leftJoin(s.staff, eq(s.staff.personId, s.person.id))
    .leftJoin(s.student, eq(s.student.personId, s.person.id))
    .where(where)
    .orderBy(s.person.fullName, s.person.id)
    .limit(20);
  return {
    items: rows.map((p) => ({
      id: p.id!,
      name: p.name,
      version: p.version,
      context: kind === 'student' ? (p.number ?? '') : (p.email ?? `ჩანაწერი · ${p.id!.slice(-8)}`),
    })),
  };
}

export async function personHistory(viewer: Viewer, id: string, kind: 'staff' | 'guardian') {
  requireCapability(viewer, kind === 'staff' ? 'staff:manage' : 'people:manage');
  found((await db.select({ id: s.person.id }).from(s.person).where(eq(s.person.id, id)))[0]);
  if (kind === 'staff') {
    const items = await db
      .select({
        id: s.teachingAssignment.id,
        label: s.section.name,
        subject: s.subject.name,
        year: s.academicYear.name,
        startsOn: s.teachingAssignment.startsOn,
        endsOn: s.teachingAssignment.endsOn,
      })
      .from(s.teachingAssignment)
      .innerJoin(s.section, eq(s.section.id, s.teachingAssignment.sectionId))
      .innerJoin(s.academicYear, eq(s.academicYear.id, s.section.yearId))
      .leftJoin(s.courseOffering, eq(s.courseOffering.id, s.teachingAssignment.offeringId))
      .leftJoin(s.subject, eq(s.subject.id, s.courseOffering.subjectId))
      .where(eq(s.teachingAssignment.staffPersonId, id))
      .orderBy(sql`${s.teachingAssignment.startsOn} desc`)
      .limit(200);
    return {
      items: items.map(({ subject, year, ...row }) => ({
        ...row,
        context: `${subject ?? 'დამრიგებელი'} · ${year}`,
      })),
    };
  }
  const items = await db
    .select({
      id: s.guardianLink.id,
      label: s.person.fullName,
      context: s.student.number,
      startsOn: s.guardianLink.startsOn,
      endsOn: s.guardianLink.endsOn,
    })
    .from(s.guardianLink)
    .innerJoin(s.student, eq(s.student.id, s.guardianLink.studentId))
    .innerJoin(s.person, eq(s.person.id, s.student.personId))
    .where(eq(s.guardianLink.guardianPersonId, id))
    .orderBy(sql`${s.guardianLink.startsOn} desc`)
    .limit(200);
  return { items };
}
