import { randomUUID } from 'node:crypto';
import { and, eq, sql, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as s from '../db/schema.js';
import type { Viewer } from '../../shared/contracts.js';
import type {
  TimetableCommand,
  LessonChange,
  TimetableSetup,
  DraftView,
  RequestView,
  Availability,
} from '../../shared/timetable.js';
import {
  administration,
  audit,
  fail,
  found,
  expectVersion,
  requireCapability,
  schoolToday,
  validInterval,
  type Transaction,
} from './operations.js';
import {
  loadContext,
  labelsFor,
  validateDocument,
  resolveRange,
  conflictsFor,
  checkOverrides,
  publicOccurrence,
  effectiveVersion,
  occurrence,
  activeStaff,
  addDays,
  fingerprint,
  type Version,
  type InternalOccurrence,
} from './timetable-engine.js';
const summary = (v: Version) => ({
  id: v.id,
  name: v.name,
  startsOn: v.startsOn,
  endsOn: v.endsOn,
  status: v.status,
  revision: v.revision,
});
const canManage = (v: Viewer) => v.capabilities.includes('timetable:manage');
function requireView(v: Viewer) {
  if (!v.capabilities.some((c) => c.startsWith('timetable:')))
    fail('განრიგის ნახვის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
}
async function children(tx: Transaction, v: Viewer) {
  if (!v.personId) return [];
  const predicate = v.capabilities.includes('timetable:self')
    ? eq(s.student.personId, v.personId)
    : v.capabilities.includes('timetable:children')
      ? sql`exists(select 1 from guardian_link g where g.student_id=${s.student.id} and g.guardian_person_id=${v.personId} and g.academic_access and g.starts_on<=${schoolToday()} and (g.ends_on is null or g.ends_on>${schoolToday()}))`
      : sql`false`;
  return tx
    .select({ id: s.student.id, name: s.person.fullName })
    .from(s.student)
    .innerJoin(s.person, eq(s.person.id, s.student.personId))
    .where(and(predicate, eq(s.student.status, 'active'), sql`${s.person.archivedAt} is null`));
}
async function yearFor(tx: Transaction, yearId?: string) {
  return found(
    (
      await tx
        .select()
        .from(s.academicYear)
        .where(yearId ? eq(s.academicYear.id, yearId) : eq(s.academicYear.status, 'active'))
    )[0],
  );
}
async function published(tx: Transaction, yearId: string) {
  return tx
    .select()
    .from(s.timetableVersion)
    .where(and(eq(s.timetableVersion.yearId, yearId), eq(s.timetableVersion.status, 'published')));
}
async function exceptions(tx: Transaction, versions: Version[]) {
  return versions.length
    ? tx
        .select()
        .from(s.timetableException)
        .where(
          inArray(
            s.timetableException.versionId,
            versions.map((v) => v.id),
          ),
        )
    : [];
}
export async function timetableSetup(viewer: Viewer, yearId?: string): Promise<TimetableSetup> {
  requireView(viewer);
  return db.transaction(async (tx) => {
    const year = await yearFor(tx, yearId),
      family = await children(tx, viewer);
    const years = await tx
      .select({
        id: s.academicYear.id,
        name: s.academicYear.name,
        startsOn: s.academicYear.startsOn,
        endsOn: s.academicYear.endsOn,
      })
      .from(s.academicYear);
    if (!canManage(viewer)) {
      const staff = viewer.capabilities.includes('timetable:request')
        ? await tx
            .select({ id: s.person.id, name: s.person.fullName })
            .from(s.staff)
            .innerJoin(s.person, eq(s.staff.personId, s.person.id))
            .where(
              sql`${s.person.archivedAt} is null and ${s.staff.startsOn}<=${schoolToday()} and (${s.staff.endsOn} is null or ${s.staff.endsOn}>${schoolToday()})`,
            )
        : [];
      const rooms = staff.length
        ? await tx
            .select({ id: s.timetableRoom.id, number: s.timetableRoom.number })
            .from(s.timetableRoom)
        : [];
      return {
        years,
        yearId: year.id,
        versions: [],
        rooms,
        teachers: staff,
        offerings: [],
        students: [],
        children: family,
      };
    }
    const ctx = await loadContext(tx, year.id);
    const versions = await tx
      .select()
      .from(s.timetableVersion)
      .where(eq(s.timetableVersion.yearId, year.id));
    return {
      years,
      yearId: year.id,
      versions: versions.sort((a, b) => b.startsOn.localeCompare(a.startsOn)).map(summary),
      rooms: ctx.rooms.map((r) => ({ id: r.id, number: r.number })),
      teachers: ctx.staff.map((t) => ({
        id: t.personId,
        name: ctx.people.find((p) => p.id === t.personId)!.fullName,
      })),
      offerings: ctx.offerings
        .filter((o) => ctx.sections.some((s) => s.id === o.sectionId))
        .map((o) => ({
          id: o.id,
          name: ctx.subjects.find((s) => s.id === o.subjectId)!.name,
          sectionId: o.sectionId,
          section: ctx.sections.find((s) => s.id === o.sectionId)!.name,
          elective: o.elective,
          subjectId: o.subjectId,
        })),
      students: ctx.students.map((st) => ({
        id: st.id,
        name: ctx.people.find((p) => p.id === st.personId)!.fullName,
        number: st.number,
      })),
      children: family,
    };
  });
}
export async function timetableDraft(viewer: Viewer, id: string): Promise<DraftView> {
  requireCapability(viewer, 'timetable:manage');
  return db.transaction(async (tx) => {
    const v = found(
        (await tx.select().from(s.timetableVersion).where(eq(s.timetableVersion.id, id)))[0],
      ),
      ctx = await loadContext(tx, v.yearId);
    const rendered = { ...v, labels: v.status === 'draft' ? labelsFor(ctx) : v.labels };
    const os = resolveRange(ctx, [rendered], [], v.startsOn, v.endsOn);
    return { ...summary(v), document: v.document, conflicts: conflictsFor(ctx, os) };
  });
}
export async function timetableWeek(
  viewer: Viewer,
  q: {
    from: string;
    days: number;
    yearId?: string;
    studentId?: string;
    teacherId?: string;
    roomId?: string;
    groupId?: string;
    sectionId?: string;
  },
) {
  requireView(viewer);
  return db.transaction(async (tx) => {
    // Establish the permitted identity set before loading any schedule data.
    const allowed = await children(tx, viewer);
    if (q.studentId && !canManage(viewer) && !allowed.some((s) => s.id === q.studentId))
      fail('მოსწავლე ვერ მოიძებნა.', 'NOT_FOUND', 404);
    if (q.teacherId && !canManage(viewer) && q.teacherId !== viewer.personId)
      fail('განრიგი ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const year = await yearFor(tx, q.yearId),
      ctx = await loadContext(tx, year.id),
      vs = await published(tx, year.id),
      es = await exceptions(tx, vs);
    const os = resolveRange(ctx, vs, es, q.from, addDays(q.from, q.days));
    const ids = q.studentId ? [q.studentId] : allowed.map((s) => s.id);
    const scoped = os.filter(
      (o) =>
        canManage(viewer) ||
        (viewer.capabilities.includes('timetable:own') && o.teacherId === viewer.personId) ||
        o.studentIds.some((id) => ids.includes(id)),
    );
    const items = scoped.filter(
      (o) =>
        (!q.teacherId || o.teacherId === q.teacherId) &&
        (!q.roomId || o.roomId === q.roomId) &&
        (!q.groupId || o.groupId === q.groupId) &&
        (!q.sectionId || o.sectionIds.includes(q.sectionId)) &&
        (!q.studentId || o.studentIds.includes(q.studentId)),
    );
    return {
      from: q.from,
      items: items.map(publicOccurrence),
      conflicts: canManage(viewer) ? conflictsFor(ctx, os) : [],
      versions: canManage(viewer) ? vs.map(summary) : [],
      children: allowed,
      overrides: canManage(viewer)
        ? [...vs.flatMap((v) => v.overrides), ...es.flatMap((e) => e.overrides)]
        : [],
    };
  });
}
async function changeContext(tx: Transaction, changes: LessonChange[]) {
  if (!changes.length) fail('აირჩიეთ გაკვეთილი.', 'VALIDATION', 400);
  const ids = [...new Set(changes.map((c) => c.occurrenceId.split(':')[0]!))];
  const all = await tx.select().from(s.timetableVersion).where(inArray(s.timetableVersion.id, ids));
  if (all.length !== ids.length || new Set(all.map((v) => v.yearId)).size !== 1)
    fail('ვერსია ვერ მოიძებნა.', 'NOT_FOUND', 404);
  const ctx = await loadContext(tx, all[0]!.yearId),
    vs = await published(tx, ctx.year.id),
    es = await exceptions(tx, vs);
  const before: InternalOccurrence[] = [];
  for (const c of changes) {
    const [versionId, lessonId, date] = c.occurrenceId.split(':');
    if (
      !versionId ||
      !lessonId ||
      date !== c.date ||
      c.date < schoolToday() ||
      c.targetDate < schoolToday() ||
      c.targetDate < ctx.year.startsOn ||
      c.targetDate >= ctx.year.endsOn ||
      c.end <= c.start
    )
      fail('თარიღი ან დრო არასწორია; წარსული ცვლილებები დაცულია.');
    const v = found(vs.find((v) => v.id === versionId));
    if (
      effectiveVersion(vs, c.date)?.id !== v.id ||
      effectiveVersion(vs, c.targetDate)?.id !== v.id
    )
      fail('გაკვეთილის მოქმედი ვერსია შეიცვალა.', 'STALE_VERSION');
    const ex = es
      .filter((e) => e.versionId === v.id && e.lessonId === lessonId && e.date === c.date)
      .sort((a, b) => b.sequence - a.sequence)[0];
    const prior =
      occurrence(ctx, v, lessonId, c.date, ex?.change, ex?.id, ex?.labels) ??
      (c.exceptionalDay
        ? occurrence(
            ctx,
            v,
            lessonId,
            c.date,
            { ...c, cancelled: false },
            undefined,
            labelsFor(ctx),
          )
        : null);
    if (!prior || prior.revision !== c.expectedRevision)
      fail('გაკვეთილი შეიცვალა. განაახლეთ და შეამოწმეთ მოთხოვნა.', 'STALE_VERSION');
    if (
      !v.document.groups.some((g) => g.id === c.groupId) ||
      !v.document.periods.some((p) => p.id === c.periodId && p.teaching) ||
      !ctx.rooms.some((r) => r.id === c.roomId) ||
      !activeStaff(ctx, c.teacherId, c.targetDate)
    )
      fail('ცვლილების ჯგუფი, პერიოდი, ოთახი ან მასწავლებელი მიუწვდომელია.');
    const after = occurrence(ctx, v, lessonId, c.date, c, undefined, labelsFor(ctx));
    if (!after) fail('არასასწავლო დღისთვის საჭიროა საგანგებო დღის აშკარა დადასტურება.');
    before.push(prior);
  }
  if (new Set(changes.map((c) => c.occurrenceId)).size !== changes.length)
    fail('ერთი გაკვეთილი ორჯერ არ შეცვალოთ.');
  return { ctx, vs, es, before };
}
async function previewChanges(tx: Transaction, changes: LessonChange[]) {
  const data = await changeContext(tx, changes);
  const temporary = changes.map((c, i) => ({
    sequence: Math.max(0, ...data.es.map((e) => e.sequence)) + i + 1,
    id: randomUUID(),
    versionId: c.occurrenceId.split(':')[0]!,
    lessonId: c.occurrenceId.split(':')[1]!,
    date: c.date,
    targetDate: c.targetDate,
    change: c,
    labels: labelsFor(data.ctx),
    reason: 'preview',
    overrides: [],
    createdAt: new Date(Date.now() + 1000),
    actorId: '',
  }));
  const dates = [...new Set(changes.flatMap((c) => [c.date, c.targetDate]))];
  const os = dates.flatMap((d) =>
    resolveRange(data.ctx, data.vs, [...data.es, ...temporary], d, addDays(d, 1)),
  );
  const changed = new Set(changes.map((c) => c.occurrenceId));
  return {
    ...data,
    conflicts: conflictsFor(data.ctx, os).filter((c) => c.lessonIds.some((id) => changed.has(id))),
  };
}
export async function timetableChangePreview(viewer: Viewer, changes: LessonChange[]) {
  requireView(viewer);
  return db.transaction(async (tx) => {
    const p = await previewChanges(tx, changes);
    if (
      !canManage(viewer) &&
      (!viewer.capabilities.includes('timetable:request') ||
        p.before.some((o) => o.teacherId !== viewer.personId))
    )
      fail('ამ გაკვეთილის შეცვლის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
    // Teachers receive collision summaries only, never another lesson or student identity.
    return {
      conflicts: p.conflicts.map((c) =>
        canManage(viewer)
          ? c
          : {
              ...c,
              lessonIds: c.lessonIds.filter((id) => changes.some((x) => x.occurrenceId === id)),
            },
      ),
    };
  });
}
async function applyChanges(
  tx: Transaction,
  viewer: Viewer,
  requestId: string,
  changes: LessonChange[],
  reason: string,
  overrides: { key: string; reason: string }[],
) {
  const p = await previewChanges(tx, changes);
  checkOverrides(p.conflicts, overrides);
  if (overrides.length) requireCapability(viewer, 'timetable:override');
  for (const c of changes) {
    const id = randomUUID();
    await tx.insert(s.timetableException).values({
      id,
      versionId: c.occurrenceId.split(':')[0]!,
      lessonId: c.occurrenceId.split(':')[1]!,
      date: c.date,
      targetDate: c.targetDate,
      change: c,
      labels: labelsFor(p.ctx),
      reason,
      overrides,
      actorId: viewer.id,
    });
    await audit(
      tx,
      viewer,
      requestId,
      c.exceptionalDay ? 'timetable.special-day' : 'timetable.exception',
      'timetable_exception',
      id,
      { reason, change: c, overrides },
    );
  }
}
async function validateAvailability(tx: Transaction, a: Availability) {
  validInterval(a.startsOn, a.endsOn);
  if (a.startsOn < schoolToday() || a.endsOn > addDays(a.startsOn, 366))
    fail('მიუწვდომლობა უნდა იყოს მიმდინარე ან მომავალი თარიღით.');
  const employee = found(
    (await tx.select().from(s.staff).where(eq(s.staff.personId, a.teacherId)))[0],
  );
  if (employee.startsOn > a.startsOn || (employee.endsOn && employee.endsOn < a.endsOn))
    fail('მიუწვდომლობა სამუშაო პერიოდის ფარგლებში უნდა იყოს.');
}
async function affected(tx: Transaction, a: Availability) {
  const years = await tx
    .select()
    .from(s.academicYear)
    .where(sql`${s.academicYear.startsOn}<${a.endsOn} and ${s.academicYear.endsOn}>${a.startsOn}`);
  const result: InternalOccurrence[] = [];
  for (const year of years) {
    const ctx = await loadContext(tx, year.id),
      vs = await published(tx, year.id),
      es = await exceptions(tx, vs);
    result.push(
      ...resolveRange(ctx, vs, es, a.startsOn, a.endsOn).filter(
        (o) =>
          o.teacherId === a.teacherId &&
          !o.cancelled &&
          (!a.periodNumbers.length || a.periodNumbers.includes(o.number)) &&
          (!a.weekdays || a.weekdays.includes(new Date(`${o.targetDate}T12:00:00Z`).getUTCDay())),
      ),
    );
  }
  return result;
}
export async function timetableAffected(viewer: Viewer, a: Availability) {
  if (
    !canManage(viewer) &&
    (!viewer.capabilities.includes('timetable:request') || a.teacherId !== viewer.personId)
  )
    fail('უფლება არ გაქვთ.', 'FORBIDDEN', 403);
  return db.transaction(async (tx) => {
    await validateAvailability(tx, a);
    return { items: (await affected(tx, a)).map(publicOccurrence) };
  });
}
export async function timetableRequests(viewer: Viewer): Promise<{ items: RequestView[] }> {
  if (!canManage(viewer)) requireCapability(viewer, 'timetable:request');
  const rows = await db
    .select({ request: s.timetableRequest, teacher: s.person.fullName })
    .from(s.timetableRequest)
    .innerJoin(s.person, eq(s.person.id, s.timetableRequest.teacherId))
    .where(canManage(viewer) ? sql`true` : eq(s.timetableRequest.teacherId, viewer.personId!))
    .orderBy(sql`${s.timetableRequest.createdAt} desc`)
    .limit(100);
  return {
    items: rows.map(({ request: r, teacher }) => ({
      id: r.id,
      revision: r.revision,
      state: r.state,
      teacher,
      reason: r.reason,
      decision: r.decision,
      changes: r.changes,
      absence: r.absence ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
export async function timetableAvailabilityList(viewer: Viewer) {
  if (!canManage(viewer)) requireCapability(viewer, 'timetable:request');
  const rows = await db
    .select()
    .from(s.timetableAvailability)
    .where(canManage(viewer) ? sql`true` : eq(s.timetableAvailability.teacherId, viewer.personId!))
    .limit(200);
  return {
    items: rows.map((a) => ({
      id: a.id,
      revision: a.revision,
      teacherId: a.teacherId,
      startsOn: a.startsOn,
      endsOn: a.endsOn,
      weekdays: a.weekdays ?? null,
      periodNumbers: a.periodNumbers,
      reason: a.reason,
    })),
  };
}
export async function changeTimetable(viewer: Viewer, requestId: string, c: TimetableCommand) {
  if (c.action.startsWith('request.') && c.action !== 'request.decide')
    requireCapability(viewer, 'timetable:request');
  else requireCapability(viewer, 'timetable:manage');
  return administration(async (tx) => {
    let objectId = '';
    if (c.action === 'room.create') {
      objectId = (await tx.insert(s.timetableRoom).values({ number: c.number }).returning())[0]!.id;
    }
    if (c.action === 'draft.create') {
      const year = await yearFor(tx, c.yearId);
      validInterval(c.startsOn, c.endsOn);
      if (c.startsOn < schoolToday() || c.startsOn < year.startsOn || c.endsOn > year.endsOn)
        fail('ახალი ვერსია მიმდინარე ან მომავალი სასწავლო პერიოდისთვის შექმენით.');
      const source = c.copyId
        ? found(
            (
              await tx.select().from(s.timetableVersion).where(eq(s.timetableVersion.id, c.copyId))
            )[0],
          )
        : null;
      if (source && source.yearId !== year.id) fail('სხვა წლის განრიგის კოპირება დაუშვებელია.');
      objectId = (
        await tx
          .insert(s.timetableVersion)
          .values({
            yearId: year.id,
            name: c.name,
            startsOn: c.startsOn,
            endsOn: c.endsOn,
            document: source?.document ?? { periods: [], groups: [], lessons: [] },
          })
          .returning()
      )[0]!.id;
    }
    if (c.action === 'draft.save' || c.action === 'draft.publish') {
      const v = found(
        (await tx.select().from(s.timetableVersion).where(eq(s.timetableVersion.id, c.id)))[0],
      );
      expectVersion(v.revision, c.revision);
      if (v.status !== 'draft') fail('გამოქვეყნებული განრიგი უცვლელია. შექმენით ახალი ვერსია.');
      const ctx = await loadContext(tx, v.yearId),
        document = c.action === 'draft.save' ? c.document : v.document;
      validateDocument(ctx, document, v.startsOn, v.endsOn);
      if (c.action === 'draft.save')
        await tx
          .update(s.timetableVersion)
          .set({ document, revision: v.revision + 1 })
          .where(eq(s.timetableVersion.id, v.id));
      else {
        requireCapability(viewer, 'timetable:publish');
        if (v.startsOn < schoolToday() || !document.lessons.length)
          fail('ცარიელი ან წარსული ვერსია ვერ გამოქვეყნდება.');
        const vs = await published(tx, v.yearId);
        if (vs.some((p) => p.startsOn === v.startsOn))
          fail('ამ თარიღით ვერსია უკვე გამოქვეყნებულია.');
        const labels = labelsFor(ctx);
        const existingExceptions = await exceptions(tx, vs);
        const conflicts = conflictsFor(
          ctx,
          resolveRange(ctx, [...vs, { ...v, labels }], existingExceptions, v.startsOn, v.endsOn),
        );
        checkOverrides(conflicts, c.overrides);
        if (c.overrides.length) requireCapability(viewer, 'timetable:override');
        await tx
          .update(s.timetableVersion)
          .set({
            status: 'published',
            labels,
            publishedAt: new Date(),
            publishedBy: viewer.id,
            overrides: c.overrides,
            revision: v.revision + 1,
          })
          .where(eq(s.timetableVersion.id, v.id));
      }
      objectId = v.id;
    }
    if (c.action === 'availability.create') {
      await validateAvailability(tx, c.availability);
      objectId = (
        await tx
          .insert(s.timetableAvailability)
          .values({ ...c.availability, reason: c.reason })
          .returning()
      )[0]!.id;
    }
    if (c.action === 'availability.end') {
      const row = found(
        (
          await tx
            .select()
            .from(s.timetableAvailability)
            .where(eq(s.timetableAvailability.id, c.id))
        )[0],
      );
      expectVersion(row.revision, c.revision);
      if (c.endsOn < schoolToday() || c.endsOn <= row.startsOn || c.endsOn > row.endsOn)
        fail('მიუწვდომლობის დასრულების თარიღი არასწორია.');
      await tx
        .update(s.timetableAvailability)
        .set({ endsOn: c.endsOn, revision: row.revision + 1 })
        .where(eq(s.timetableAvailability.id, c.id));
      objectId = c.id;
    }
    if (c.action === 'exception.apply') {
      await applyChanges(tx, viewer, requestId, c.changes, c.reason, c.overrides);
      objectId = c.changes[0]!.occurrenceId;
    }
    if (c.action === 'request.create') {
      if (!viewer.personId || (!c.changes.length && !c.absence))
        fail('აირჩიეთ გაკვეთილი ან მიუწვდომლობის პერიოდი.');
      if (c.changes.length) {
        const p = await changeContext(tx, c.changes);
        if (p.before.some((o) => o.teacherId !== viewer.personId))
          fail('სხვა მასწავლებლის გაკვეთილზე მოთხოვნა დაუშვებელია.', 'FORBIDDEN', 403);
      }
      if (c.absence) {
        if (c.absence.teacherId !== viewer.personId || c.absence.weekdays)
          fail('მხოლოდ საკუთარი დროებითი მიუწვდომლობა მოითხოვეთ.', 'FORBIDDEN', 403);
        await validateAvailability(tx, c.absence);
      }
      const impacted = c.absence ? await affected(tx, c.absence) : [];
      objectId = (
        await tx
          .insert(s.timetableRequest)
          .values({
            teacherId: viewer.personId,
            reason: c.reason,
            changes: c.changes,
            absence: c.absence,
            affected: impacted.map((o) => ({ id: o.id, revision: o.revision })),
          })
          .returning()
      )[0]!.id;
    }
    if (c.action === 'request.cancel' || c.action === 'request.decide') {
      const r = found(
        (await tx.select().from(s.timetableRequest).where(eq(s.timetableRequest.id, c.id)))[0],
      );
      expectVersion(r.revision, c.revision);
      if (r.state !== 'pending') fail('მოთხოვნა უკვე განხილულია.');
      if (c.action === 'request.cancel' && r.teacherId !== viewer.personId)
        fail('სხვა პირის მოთხოვნას ვერ გააუქმებთ.', 'FORBIDDEN', 403);
      if (c.action === 'request.decide' && c.approve) {
        if (r.changes.length) {
          await changeContext(tx, r.changes);
          if (r.changes.some((x) => !c.changes.some((y) => y.occurrenceId === x.occurrenceId)))
            fail('ყველა მოთხოვნილი ცვლილება უნდა განიხილოთ.');
        }
        if (r.absence) {
          const now = await affected(tx, r.absence);
          if (
            fingerprint(now.map((o) => ({ id: o.id, revision: o.revision }))) !==
            fingerprint(r.affected)
          )
            fail('მოთხოვნის შემდეგ განრიგი შეიცვალა. საჭიროა ხელახალი მოთხოვნა.', 'STALE_REQUEST');
          await validateAvailability(tx, r.absence);
          await tx.insert(s.timetableAvailability).values({ ...r.absence, reason: r.reason });
          const ids = new Set(r.affected.map((x) => x.id));
          if (
            c.changes.some(
              (x) =>
                !ids.has(x.occurrenceId) &&
                !r.changes.some((y) => y.occurrenceId === x.occurrenceId),
            )
          )
            fail('მოთხოვნას დაუკავშირებელი გაკვეთილი აქვს.');
          if (now.some((o) => !c.changes.some((x) => x.occurrenceId === o.id)))
            fail('მიუწვდომლობის ყველა გაკვეთილს სჭირდება ჩანაცვლება, გადატანა ან გაუქმება.');
        } else if (c.changes.some((x) => !r.changes.some((y) => y.occurrenceId === x.occurrenceId)))
          fail('მოთხოვნას დაუკავშირებელი გაკვეთილი აქვს.');
        if (c.changes.length)
          await applyChanges(tx, viewer, requestId, c.changes, c.reason, c.overrides);
      }
      await tx
        .update(s.timetableRequest)
        .set({
          state: c.action === 'request.cancel' ? 'cancelled' : c.approve ? 'approved' : 'denied',
          decision: c.reason,
          revision: r.revision + 1,
        })
        .where(eq(s.timetableRequest.id, r.id));
      objectId = r.id;
    }
    await audit(
      tx,
      viewer,
      requestId,
      `timetable.${c.action}`,
      'timetable',
      objectId,
      JSON.parse(JSON.stringify(c)) as Record<string, unknown>,
    );
    return { id: objectId };
  });
}

export async function timetableTemplate(
  viewer: Viewer,
  versionId: string,
  lessonId: string,
  date: string,
) {
  requireCapability(viewer, 'timetable:manage');
  return db.transaction(async (tx) => {
    const v = found(
      (await tx.select().from(s.timetableVersion).where(eq(s.timetableVersion.id, versionId)))[0],
    );
    if (v.status !== 'published' || date < schoolToday() || date < v.startsOn || date >= v.endsOn)
      fail('აირჩიეთ მიმდინარე ან მომავალი გამოქვეყნებული თარიღი.');
    const ctx = await loadContext(tx, v.yearId),
      l = found(v.document.lessons.find((l) => l.id === lessonId)),
      p = found(v.document.periods.find((p) => p.id === l.periodId));
    const vs = await published(tx, v.yearId);
    if (effectiveVersion(vs, date)?.id !== v.id) fail('ამ თარიღისთვის სხვა ვერსია მოქმედებს.');
    const existing = resolveRange(ctx, vs, await exceptions(tx, vs), date, addDays(date, 1)).find(
      (o) => o.lessonId === lessonId && o.date === date,
    );
    if (existing) return publicOccurrence(existing);
    const value = found(
      occurrence(ctx, v, lessonId, date, {
        date,
        targetDate: date,
        occurrenceId: `${v.id}:${lessonId}:${date}`,
        expectedRevision: 'template',
        cancelled: false,
        teacherId: l.teacherId,
        roomId: l.roomId,
        groupId: l.groupId,
        periodId: p.id,
        start: p.start,
        end: p.end,
        exceptionalDay: true,
      }) ?? undefined,
    );
    return publicOccurrence(value);
  });
}
export async function timetableMovePreview(
  viewer: Viewer,
  id: string,
  revision: number,
  lessonId: string,
  weekday: number,
  periodId: string,
) {
  requireCapability(viewer, 'timetable:manage');
  return db.transaction(async (tx) => {
    const v = found(
      (await tx.select().from(s.timetableVersion).where(eq(s.timetableVersion.id, id)))[0],
    );
    expectVersion(v.revision, revision);
    if (v.status !== 'draft') fail('მხოლოდ სამუშაო ვერსია იცვლება.');
    if (!v.document.lessons.some((l) => l.id === lessonId)) fail('გაკვეთილი ვერ მოიძებნა.');
    const document = {
      ...v.document,
      lessons: v.document.lessons.map((l) => (l.id === lessonId ? { ...l, weekday, periodId } : l)),
    };
    const ctx = await loadContext(tx, v.yearId);
    validateDocument(ctx, document, v.startsOn, v.endsOn);
    return {
      conflicts: conflictsFor(
        ctx,
        resolveRange(ctx, [{ ...v, document, labels: labelsFor(ctx) }], [], v.startsOn, v.endsOn),
      ).filter((c) => c.lessonIds.some((id) => id.includes(`:${lessonId}:`))),
    };
  });
}
