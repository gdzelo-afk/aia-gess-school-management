import { and, eq, gte, lt, inArray, sql, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import * as s from '../db/schema.js';
import type { Viewer } from '../../shared/contracts.js';
import {
  attendanceCommand,
  attendanceWindow,
  attendanceSummary,
  schoolDateAt,
  schoolInstant,
  type AttendanceCommand,
  type AttendanceEntry,
  type AttendanceSnapshot,
  type AttendanceState,
  type RollCallInput,
} from '../../shared/attendance.js';
import {
  loadContext,
  resolveRange,
  publicOccurrence,
  addDays,
  fingerprint,
  activeStaff,
  type InternalOccurrence,
  type Context,
} from './timetable-engine.js';
import {
  administration,
  audit,
  expectVersion,
  fail,
  found,
  requireCapability,
  validInterval,
  type Transaction,
} from './operations.js';

type Session = typeof s.attendanceSession.$inferSelect;
const manages = (v: Viewer) => v.capabilities.includes('attendance:manage');
const schoolRead = (v: Viewer) => v.capabilities.includes('attendance:school');
function requireView(v: Viewer) {
  if (!v.personId || !v.capabilities.some((c) => c.startsWith('attendance:')))
    fail('დასწრების ნახვის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
}
async function family(tx: Transaction, v: Viewer, now: Date, guardianOnly = false) {
  const today = schoolDateAt(now);
  const own =
    !guardianOnly && v.capabilities.includes('attendance:self')
      ? eq(s.student.personId, v.personId!)
      : sql`false`;
  const children = v.capabilities.includes('attendance:children')
    ? sql`exists(select 1 from guardian_link g where g.student_id=${s.student.id} and g.guardian_person_id=${v.personId} and g.academic_access and g.starts_on<=${today} and (g.ends_on is null or g.ends_on>${today}))`
    : sql`false`;
  return tx
    .select({ studentId: s.student.id, name: s.person.fullName, number: s.student.number })
    .from(s.student)
    .innerJoin(s.person, eq(s.student.personId, s.person.id))
    .where(and(or(own, children), sql`${s.person.archivedAt} is null`));
}
function sessionScope(v: Viewer, ids: string[]): SQL {
  if (schoolRead(v)) return sql`true`;
  return or(
    v.capabilities.includes('attendance:own')
      ? eq(s.attendanceSession.teacherId, v.personId!)
      : sql`false`,
    ids.length
      ? sql`exists(select 1 from attendance_record ar where ar.session_id=${s.attendanceSession.id} and ar.student_id in (${sql.join(
          ids.map((id) => sql`${id}`),
          sql`, `,
        )}))`
      : sql`false`,
  )!;
}
async function source(tx: Transaction, versionId: string) {
  const v = found(
    (
      await tx
        .select()
        .from(s.timetableVersion)
        .where(
          and(eq(s.timetableVersion.id, versionId), eq(s.timetableVersion.status, 'published')),
        )
    )[0],
  );
  const ctx = await loadContext(tx, v.yearId);
  const versions = await tx
    .select()
    .from(s.timetableVersion)
    .where(
      and(eq(s.timetableVersion.yearId, v.yearId), eq(s.timetableVersion.status, 'published')),
    );
  const exceptions = await tx
    .select()
    .from(s.timetableException)
    .where(
      inArray(
        s.timetableException.versionId,
        versions.map((x) => x.id),
      ),
    );
  return { ctx, versions, exceptions };
}
async function liveOccurrence(tx: Transaction, id: string) {
  const [versionId, , date] = id.split(':');
  const data = await source(tx, versionId!);
  const latest = data.exceptions
    .filter((e) => `${e.versionId}:${e.lessonId}:${e.date}` === id)
    .sort((a, b) => b.sequence - a.sequence)[0];
  const target = latest?.targetDate ?? date!;
  const occurrence =
    resolveRange(data.ctx, data.versions, data.exceptions, target, addDays(target, 1)).find(
      (o) => o.id === id,
    ) ?? null;
  return { ...data, occurrence };
}
function snapshot(o: InternalOccurrence, ctx: Context): AttendanceSnapshot {
  const group = found(o.document.groups.find((g) => g.id === o.groupId));
  const offering = found(ctx.offerings.find((c) => c.id === group.sources[0]?.offeringId));
  return {
    academic: {
      yearId: ctx.year.id,
      subjectId: offering.subjectId,
      instructionalMinutes:
        (schoolInstant(o.targetDate, o.end) - schoolInstant(o.targetDate, o.start)) / 60000,
    },
    occurrence: publicOccurrence(o),
    roster: o.studentIds.map((id) => {
      const student = found(ctx.students.find((s) => s.id === id));
      return {
        studentId: id,
        name: found(ctx.people.find((p) => p.id === student.personId)).fullName,
        number: student.number,
      };
    }),
  };
}
// PostgreSQL JSONB reorders object keys; compare semantic fields, not serialization order.
function meaning(o: AttendanceSnapshot['occurrence'], ids: string[]) {
  return fingerprint([Object.entries(o).sort(([a], [b]) => a.localeCompare(b)), [...ids].sort()]);
}
function token(current: InternalOccurrence | null, saved?: Session) {
  return fingerprint([
    current
      ? [
          current.id,
          current.revision,
          current.targetDate,
          current.start,
          current.end,
          current.teacherId,
          current.cancelled,
          [...current.studentIds].sort(),
        ]
      : null,
    saved?.revision ?? 0,
  ]);
}
async function records(tx: Transaction, sessionId: string): Promise<AttendanceEntry[]> {
  return tx
    .select({
      studentId: s.attendanceRecord.studentId,
      status: s.attendanceRecord.status,
      arrival: s.attendanceRecord.arrival,
      departure: s.attendanceRecord.departure,
      timeSource: s.attendanceRecord.timeSource,
    })
    .from(s.attendanceRecord)
    .where(eq(s.attendanceRecord.sessionId, sessionId));
}
async function context(tx: Transaction, v: Viewer, id: string, now: Date) {
  requireView(v);
  const members = await family(tx, v, now),
    ids = members.map((x) => x.studentId);
  const live = await liveOccurrence(tx, id);
  const current = live.occurrence;
  const currentOwn = v.capabilities.includes('attendance:own') && current?.teacherId === v.personId;
  const saved = (
    await tx
      .select()
      .from(s.attendanceSession)
      .where(
        and(
          eq(s.attendanceSession.occurrenceId, id),
          currentOwn ? sql`true` : sessionScope(v, ids),
        ),
      )
  )[0];
  const permitted =
    schoolRead(v) ||
    (v.capabilities.includes('attendance:own') &&
      (current?.teacherId === v.personId || saved?.teacherId === v.personId)) ||
    current?.studentIds.some((id) => ids.includes(id));
  if (!permitted && !saved) fail('გაკვეთილი ვერ მოიძებნა.', 'NOT_FOUND', 404);
  if (!saved && (!current || current.cancelled)) fail('გაკვეთილი მიუწვდომელია.', 'NOT_FOUND', 404);
  return { ...live, current, saved, members, ids };
}
async function approved(tx: Transaction, ids: string[], date: string) {
  if (!ids.length) return new Set<string>();
  const rows = await tx
    .select({ studentId: s.attendanceExplanation.studentId })
    .from(s.attendanceExplanation)
    .where(
      and(
        inArray(s.attendanceExplanation.studentId, ids),
        eq(s.attendanceExplanation.state, 'approved'),
        sql`${s.attendanceExplanation.startsOn}<=${date}`,
        sql`${s.attendanceExplanation.endsOn}>${date}`,
      ),
    );
  return new Set(rows.map((r) => r.studentId));
}
export async function attendanceLesson(v: Viewer, id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const c = await context(tx, v, id, now);
    const snap = c.saved?.snapshot ?? snapshot(c.current!, c.ctx);
    const staffView =
      schoolRead(v) ||
      (v.capabilities.includes('attendance:own') &&
        (snap.occurrence.teacherId === v.personId || c.current?.teacherId === v.personId));
    const roster = staffView ? snap.roster : snap.roster.filter((s) => c.ids.includes(s.studentId));
    const entries = c.saved
      ? (await records(tx, c.saved.id)).filter((r) =>
          roster.some((s) => s.studentId === r.studentId),
        )
      : [];
    const allowed = await approved(
      tx,
      roster.map((s) => s.studentId),
      snap.occurrence.targetDate,
    );
    for (const e of entries) if (e.status === 'authorized') allowed.add(e.studentId);
    const window = attendanceWindow(snap.occurrence, now);
    const owns =
      v.capabilities.includes('attendance:write') &&
      c.current?.teacherId === v.personId &&
      activeStaff(c.ctx, v.personId!, schoolDateAt(now));
    const discrepancy =
      !!c.saved &&
      (!c.current ||
        c.current.cancelled ||
        meaning(
          snap.occurrence,
          snap.roster.map((s) => s.studentId),
        ) !== meaning(publicOccurrence(c.current), c.current.studentIds));
    const history =
      c.saved && (schoolRead(v) || owns)
        ? await tx
            .select({
              revision: s.attendanceRevision.revision,
              actor: s.person.fullName,
              at: s.attendanceRevision.createdAt,
              action: s.attendanceRevision.action,
              reason: s.attendanceRevision.reason,
              before: s.attendanceRevision.before,
              after: s.attendanceRevision.after,
            })
            .from(s.attendanceRevision)
            .leftJoin(s.person, eq(s.person.userId, s.attendanceRevision.actorId))
            .where(eq(s.attendanceRevision.sessionId, c.saved.id))
            .orderBy(s.attendanceRevision.revision)
        : [];
    return {
      occurrence: snap.occurrence,
      roster: roster.map((r) => ({ ...r, authorized: allowed.has(r.studentId) })),
      entries,
      revision: c.saved?.revision ?? 0,
      expectedToken: token(c.current, c.saved),
      submittedAt: c.saved?.submittedAt ?? null,
      submittedOverdue: c.saved?.overdue ?? false,
      window: staffView ? window : null,
      discrepancy: staffView && discrepancy,
      canWrite: window.started && (manages(v) || (owns && !window.locked && !discrepancy)),
      canRequest: !!owns && window.locked && v.capabilities.includes('attendance:request'),
      canManage: manages(v),
      currentRoster:
        manages(v) && c.current && !c.current.cancelled ? snapshot(c.current, c.ctx).roster : null,
      currentOccurrence:
        manages(v) && c.current && !c.current.cancelled ? publicOccurrence(c.current) : null,
      now: now.toISOString(),
      history: history.map((h) => ({
        ...h,
        reason: !manages(v) && h.action !== 'teacher.corrected' ? null : h.reason,
      })),
    };
  });
}
function validateEntries(
  input: AttendanceEntry[],
  snap: AttendanceSnapshot,
  authorized: Set<string>,
  admin: boolean,
  now: Date,
) {
  const expected = snap.roster.map((r) => r.studentId).sort(),
    actual = input.map((r) => r.studentId).sort();
  if (fingerprint(expected) !== fingerprint(actual))
    fail('ყველა მოსწავლე ერთხელ უნდა იყოს მონიშნული. განაახლეთ სია.', 'ROSTER_CONFLICT');
  return input.map((r) => {
    if (r.status === 'authorized' && !admin && !authorized.has(r.studentId))
      fail('საპატიო გაცდენა ადმინისტრაციამ უნდა დაადასტუროს.', 'AUTHORIZATION_REQUIRED', 403);
    const o = snap.occurrence;
    if (
      r.arrival &&
      (r.arrival <= o.start ||
        r.arrival > o.end ||
        schoolInstant(o.targetDate, r.arrival) > now.getTime())
    )
      fail('შეამოწმეთ მოსვლის დრო.', 'TIME', 400);
    if (
      r.departure &&
      (r.departure < (r.arrival ?? o.start) ||
        r.departure >= o.end ||
        schoolInstant(o.targetDate, r.departure) > now.getTime())
    )
      fail('შეამოწმეთ გასვლის დრო.', 'TIME', 400);
    return {
      ...r,
      status:
        r.status === 'absent' && authorized.has(r.studentId) ? ('authorized' as const) : r.status,
    };
  });
}
async function notify(tx: Transaction, state: AttendanceState, now: Date) {
  for (const r of state.entries) {
    const kinds = [
      ...(r.status === 'absent' ? ['absence'] : r.status === 'late' ? ['late'] : []),
      ...(r.departure ? ['early'] : []),
    ];
    if (!kinds.length) continue;
    const today = schoolDateAt(now);
    const recipients = await tx
      .select({ personId: s.guardianLink.guardianPersonId })
      .from(s.guardianLink)
      .innerJoin(s.person, eq(s.person.id, s.guardianLink.guardianPersonId))
      .where(
        and(
          eq(s.guardianLink.studentId, r.studentId),
          eq(s.guardianLink.academicAccess, true),
          sql`${s.guardianLink.startsOn}<=${today} and (${s.guardianLink.endsOn} is null or ${s.guardianLink.endsOn}>${today}) and ${s.person.archivedAt} is null`,
        ),
      );
    for (const kind of kinds)
      await tx
        .insert(s.outboxJob)
        .values({
          kind: `attendance.${kind}`,
          deduplicationKey: `attendance:${kind}:${r.studentId}:${state.snapshot.occurrence.targetDate}`,
          payload: {
            studentId: r.studentId,
            date: state.snapshot.occurrence.targetDate,
            guardianIds: [...new Set(recipients.map((r) => r.personId))],
            delivery: 'in_app_only',
          },
          createdAt: now,
        })
        .onConflictDoNothing({ target: s.outboxJob.deduplicationKey });
  }
}
async function persist(
  tx: Transaction,
  v: Viewer,
  requestId: string,
  state: AttendanceState,
  saved: Session | undefined,
  action: string,
  reason: string | undefined,
  now: Date,
) {
  const before = saved ? { snapshot: saved.snapshot, entries: await records(tx, saved.id) } : null;
  const revision = (saved?.revision ?? 0) + 1;
  const o = state.snapshot.occurrence;
  const session = saved
    ? (
        await tx
          .update(s.attendanceSession)
          .set({
            revision,
            snapshot: state.snapshot,
            schoolDate: o.targetDate,
            teacherId: o.teacherId,
          })
          .where(eq(s.attendanceSession.id, saved.id))
          .returning()
      )[0]!
    : (
        await tx
          .insert(s.attendanceSession)
          .values({
            occurrenceId: o.id,
            versionId: o.versionId,
            schoolDate: o.targetDate,
            teacherId: o.teacherId,
            snapshot: state.snapshot,
            submittedBy: v.id,
            submittedAt: now,
            overdue: attendanceWindow(o, now).overdue,
          })
          .returning()
      )[0]!;
  // Replacement happens inside the same transaction; immutable history retains removed participants.
  if (saved) await tx.delete(s.attendanceRecord).where(eq(s.attendanceRecord.sessionId, saved.id));
  await tx
    .insert(s.attendanceRecord)
    .values(state.entries.map((r) => ({ ...r, sessionId: session.id })));
  await tx.insert(s.attendanceRevision).values({
    sessionId: session.id,
    revision,
    actorId: v.id,
    action,
    reason: reason ?? null,
    before,
    after: state,
    createdAt: now,
  });
  await audit(tx, v, requestId, `attendance.${action}`, 'attendance_session', session.id, {
    occurrenceId: o.id,
    revision,
    overdue: !saved && session.overdue,
    studentIds: state.entries.map((e) => e.studentId),
  });
  await notify(tx, state, now);
  return { id: session.id, revision };
}
async function submit(
  tx: Transaction,
  v: Viewer,
  requestId: string,
  input: RollCallInput,
  now: Date,
) {
  const c = await context(tx, v, input.occurrenceId, now),
    admin = manages(v);
  const owns =
    v.capabilities.includes('attendance:write') &&
    c.current?.teacherId === v.personId &&
    activeStaff(c.ctx, v.personId!, schoolDateAt(now));
  if (!admin && !owns) fail('დასწრების შეცვლის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
  expectVersion(c.saved?.revision ?? 0, input.revision);
  if (token(c.current, c.saved) !== input.expectedToken)
    fail('განრიგი ან სია შეიცვალა. განაახლეთ გაკვეთილი.', 'STALE_OCCURRENCE');
  const original = c.saved?.snapshot ?? snapshot(c.current!, c.ctx);
  const window = attendanceWindow(original.occurrence, now);
  if (!window.started) fail('გაკვეთილი ჯერ არ დაწყებულა.', 'NOT_STARTED', 409);
  if (!admin && window.locked) fail('შესწორების ვადა ამოიწურა. გაგზავნეთ მოთხოვნა.', 'LOCKED', 403);
  if ((admin || c.saved) && !input.reason)
    fail('მიუთითეთ მოქმედების მიზეზი.', 'REASON_REQUIRED', 400);
  if (input.reconcileRoster && !admin)
    fail('ისტორიული სიის შეჯერება მხოლოდ ადმინისტრაციას შეუძლია.', 'FORBIDDEN', 403);
  if (
    !admin &&
    c.saved &&
    (!c.current ||
      c.current.cancelled ||
      meaning(publicOccurrence(c.current), c.current.studentIds) !==
        meaning(
          original.occurrence,
          original.roster.map((r) => r.studentId),
        ))
  )
    fail(
      'ისტორიული განრიგი ან სია შეიცვალა. საჭიროა ადმინისტრაციის შეჯერება.',
      'HISTORY_DISCREPANCY',
    );
  if (input.reconcileRoster && (!c.current || c.current.cancelled))
    fail('მოქმედი გაკვეთილი მიუწვდომელია.', 'OCCURRENCE_UNAVAILABLE');
  const snap = input.reconcileRoster ? snapshot(c.current!, c.ctx) : original;
  if (!attendanceWindow(snap.occurrence, now).started)
    fail('გაკვეთილი ჯერ არ დაწყებულა.', 'NOT_STARTED');
  const authorized = await approved(
    tx,
    snap.roster.map((r) => r.studentId),
    snap.occurrence.targetDate,
  );
  if (c.saved)
    for (const r of await records(tx, c.saved.id))
      if (r.status === 'authorized') authorized.add(r.studentId);
  const entries = validateEntries(input.entries, snap, authorized, admin, now);
  return persist(
    tx,
    v,
    requestId,
    { snapshot: snap, entries },
    c.saved,
    input.reconcileRoster
      ? 'roster.reconciled'
      : c.saved
        ? admin
          ? 'admin.corrected'
          : 'teacher.corrected'
        : admin
          ? 'admin.submitted'
          : 'submitted',
    input.reason,
    now,
  );
}
export async function changeAttendance(
  v: Viewer,
  requestId: string,
  raw: AttendanceCommand,
  now = new Date(),
) {
  // Also parse here so internal callers cannot bypass static entry invariants.
  const cmd = attendanceCommand.parse(raw);
  requireView(v);
  return administration(async (tx) => {
    const hash = fingerprint(cmd);
    const receipt = (
      await tx.select().from(s.attendanceReceipt).where(eq(s.attendanceReceipt.id, cmd.commandId))
    )[0];
    if (receipt) {
      if (receipt.actorId !== v.id || receipt.fingerprint !== hash)
        fail('მოთხოვნის იდენტიფიკატორი უკვე გამოყენებულია.', 'IDEMPOTENCY_CONFLICT');
      return receipt.result;
    }
    let result: { id: string; revision: number };
    if (cmd.action === 'submit') result = await submit(tx, v, requestId, cmd, now);
    else if (cmd.action === 'explanation.create') {
      requireCapability(v, 'attendance:explain');
      found((await family(tx, v, now, true)).find((r) => r.studentId === cmd.studentId));
      validInterval(cmd.startsOn, cmd.endsOn);
      if (Date.parse(cmd.endsOn) - Date.parse(cmd.startsOn) > 366 * 86400000)
        fail('პერიოდი ზედმეტად გრძელია.', 'RANGE', 400);
      const row = (
        await tx
          .insert(s.attendanceExplanation)
          .values({
            studentId: cmd.studentId,
            guardianId: v.personId!,
            startsOn: cmd.startsOn,
            endsOn: cmd.endsOn,
            reason: cmd.reason,
            createdAt: now,
          })
          .returning()
      )[0]!;
      await audit(
        tx,
        v,
        requestId,
        'attendance.explanation.created',
        'attendance_explanation',
        row.id,
        { studentId: row.studentId },
      );
      result = { id: row.id, revision: row.revision };
    } else if (cmd.action === 'explanation.decide') {
      requireCapability(v, 'attendance:manage');
      const row = found(
        (
          await tx
            .select()
            .from(s.attendanceExplanation)
            .where(eq(s.attendanceExplanation.id, cmd.id))
        )[0],
      );
      expectVersion(row.revision, cmd.revision);
      if (row.state !== 'pending') fail('მოთხოვნა უკვე განხილულია.');
      await tx
        .update(s.attendanceExplanation)
        .set({
          state: cmd.approve ? 'approved' : 'denied',
          revision: row.revision + 1,
          reviewerId: v.id,
          decision: cmd.reason,
          decidedAt: now,
        })
        .where(eq(s.attendanceExplanation.id, row.id));
      if (cmd.approve) {
        const affected = await tx
          .select({ session: s.attendanceSession })
          .from(s.attendanceSession)
          .innerJoin(s.attendanceRecord, eq(s.attendanceRecord.sessionId, s.attendanceSession.id))
          .where(
            and(
              eq(s.attendanceRecord.studentId, row.studentId),
              eq(s.attendanceRecord.status, 'absent'),
              gte(s.attendanceSession.schoolDate, row.startsOn),
              lt(s.attendanceSession.schoolDate, row.endsOn),
            ),
          );
        for (const { session } of affected) {
          const entries = (await records(tx, session.id)).map((r) =>
            r.studentId === row.studentId ? { ...r, status: 'authorized' as const } : r,
          );
          await persist(
            tx,
            v,
            requestId,
            { snapshot: session.snapshot, entries },
            session,
            'explanation.authorized',
            `განმარტება ${row.id}: ${cmd.reason}`,
            now,
          );
        }
      }
      await audit(
        tx,
        v,
        requestId,
        'attendance.explanation.decided',
        'attendance_explanation',
        row.id,
        { approved: cmd.approve, revision: row.revision + 1 },
      );
      result = { id: row.id, revision: row.revision + 1 };
    } else if (cmd.action === 'request.create') {
      requireCapability(v, 'attendance:request');
      const c = await context(tx, v, cmd.proposal.occurrenceId, now);
      const snap = c.saved?.snapshot ?? snapshot(c.current!, c.ctx);
      if (
        snap.occurrence.teacherId !== v.personId ||
        !activeStaff(c.ctx, v.personId!, schoolDateAt(now))
      )
        fail('მოთხოვნის უფლება არ გაქვთ.', 'FORBIDDEN', 403);
      if (!attendanceWindow(snap.occurrence, now).locked)
        fail('შესწორება ჯერ კიდევ პირდაპირ შეგიძლიათ.', 'NOT_LOCKED');
      expectVersion(c.saved?.revision ?? 0, cmd.proposal.revision);
      if (token(c.current, c.saved) !== cmd.proposal.expectedToken)
        fail('გაკვეთილი შეიცვალა.', 'STALE_OCCURRENCE');
      const authorization = await approved(
        tx,
        snap.roster.map((r) => r.studentId),
        snap.occurrence.targetDate,
      );
      if (c.saved)
        for (const r of await records(tx, c.saved.id))
          if (r.status === 'authorized') authorization.add(r.studentId);
      validateEntries(cmd.proposal.entries, snap, authorization, false, now);
      const row = (
        await tx
          .insert(s.attendanceRequest)
          .values({
            teacherId: v.personId!,
            occurrenceId: cmd.proposal.occurrenceId,
            proposal: cmd.proposal,
            snapshot: { ...snap, originalEntries: c.saved ? await records(tx, c.saved.id) : [] },
            reason: cmd.reason,
            createdAt: now,
          })
          .returning()
      )[0]!;
      await audit(tx, v, requestId, 'attendance.request.created', 'attendance_request', row.id, {
        occurrenceId: row.occurrenceId,
      });
      result = { id: row.id, revision: row.revision };
    } else {
      requireCapability(v, 'attendance:manage');
      const row = found(
        (await tx.select().from(s.attendanceRequest).where(eq(s.attendanceRequest.id, cmd.id)))[0],
      );
      expectVersion(row.revision, cmd.revision);
      if (row.state !== 'pending') fail('მოთხოვნა უკვე განხილულია.');
      if (cmd.approve) {
        const proposal = cmd.proposal ?? row.proposal;
        if (proposal.occurrenceId !== row.occurrenceId) fail('მოთხოვნა სხვა გაკვეთილს ეკუთვნის.');
        await submit(tx, v, requestId, { ...proposal, reason: cmd.reason }, now);
      }
      await tx
        .update(s.attendanceRequest)
        .set({
          state: cmd.approve ? 'approved' : 'denied',
          revision: row.revision + 1,
          reviewerId: v.id,
          decision: cmd.reason,
          decidedAt: now,
        })
        .where(eq(s.attendanceRequest.id, row.id));
      await audit(tx, v, requestId, 'attendance.request.decided', 'attendance_request', row.id, {
        approved: cmd.approve,
        revision: row.revision + 1,
      });
      result = { id: row.id, revision: row.revision + 1 };
    }
    await tx
      .insert(s.attendanceReceipt)
      .values({ id: cmd.commandId, actorId: v.id, fingerprint: hash, result, createdAt: now });
    return result;
  });
}

export async function attendanceRange(
  v: Viewer,
  from: string,
  days: number,
  studentId?: string,
  now = new Date(),
) {
  requireView(v);
  const end = addDays(from, days);
  return db.transaction(async (tx) => {
    const children = await family(tx, v, now),
      ids = children.map((x) => x.studentId);
    if (studentId && !schoolRead(v) && !ids.includes(studentId))
      fail('მოსწავლე ვერ მოიძებნა.', 'NOT_FOUND', 404);
    const saved = await tx
      .select()
      .from(s.attendanceSession)
      .where(
        and(
          gte(s.attendanceSession.schoolDate, from),
          lt(s.attendanceSession.schoolDate, end),
          sessionScope(v, ids),
          studentId
            ? sql`exists(select 1 from attendance_record ar where ar.session_id=${s.attendanceSession.id} and ar.student_id=${studentId})`
            : undefined,
        ),
      );
    const allRecords = saved.length
      ? await tx
          .select()
          .from(s.attendanceRecord)
          .where(
            and(
              inArray(
                s.attendanceRecord.sessionId,
                saved.map((s) => s.id),
              ),
              schoolRead(v) || v.capabilities.includes('attendance:own')
                ? undefined
                : ids.length
                  ? inArray(s.attendanceRecord.studentId, ids)
                  : sql`false`,
              studentId ? eq(s.attendanceRecord.studentId, studentId) : undefined,
            ),
          )
      : [];
    const versions = await tx
      .select()
      .from(s.timetableVersion)
      .where(
        and(
          eq(s.timetableVersion.status, 'published'),
          lt(s.timetableVersion.startsOn, end),
          sql`${s.timetableVersion.endsOn}>${from}`,
        ),
      );
    // Include source versions of lessons moved into this range from another effective date.
    const moved = await tx
      .select({ version: s.timetableVersion })
      .from(s.timetableException)
      .innerJoin(s.timetableVersion, eq(s.timetableVersion.id, s.timetableException.versionId))
      .where(
        and(
          gte(s.timetableException.targetDate, from),
          lt(s.timetableException.targetDate, end),
          eq(s.timetableVersion.status, 'published'),
        ),
      );
    const yearIds = [
      ...new Set([...versions, ...moved.map((m) => m.version)].map((v) => v.yearId)),
    ];
    const live: { o: InternalOccurrence; ctx: Context }[] = [];
    for (const yearId of yearIds) {
      const ctx = await loadContext(tx, yearId);
      const vs = await tx
        .select()
        .from(s.timetableVersion)
        .where(
          and(eq(s.timetableVersion.yearId, yearId), eq(s.timetableVersion.status, 'published')),
        );
      const es = await tx
        .select()
        .from(s.timetableException)
        .where(
          inArray(
            s.timetableException.versionId,
            vs.map((v) => v.id),
          ),
        );
      for (const o of resolveRange(ctx, vs, es, from, end)) {
        if (o.cancelled || (studentId && !o.studentIds.includes(studentId))) continue;
        if (
          schoolRead(v) ||
          (v.capabilities.includes('attendance:own') && o.teacherId === v.personId) ||
          o.studentIds.some((id) => ids.includes(id))
        )
          live.push({ o, ctx });
      }
    }
    const map = new Map<
      string,
      { snapshot: AttendanceSnapshot; saved?: Session; current?: InternalOccurrence }
    >();
    for (const { o, ctx } of live) map.set(o.id, { snapshot: snapshot(o, ctx), current: o });
    for (const session of saved)
      map.set(session.occurrenceId, {
        ...map.get(session.occurrenceId),
        snapshot: session.snapshot,
        saved: session,
      });
    // A submitted occurrence moved out of the requested date range must not reappear as a new roll call.
    const outside = live.length
      ? await tx
          .select({ occurrenceId: s.attendanceSession.occurrenceId })
          .from(s.attendanceSession)
          .where(
            and(
              inArray(
                s.attendanceSession.occurrenceId,
                live.map((x) => x.o.id),
              ),
              or(
                lt(s.attendanceSession.schoolDate, from),
                gte(s.attendanceSession.schoolDate, end),
              ),
            ),
          )
      : [];
    for (const x of outside) map.delete(x.occurrenceId);
    const items = [...map.values()]
      .map((item) => {
        const own =
          v.capabilities.includes('attendance:own') &&
          item.snapshot.occurrence.teacherId === v.personId;
        const staff = schoolRead(v) || own;
        const roster = item.snapshot.roster.filter(
          (r) => (!studentId || r.studentId === studentId) && (staff || ids.includes(r.studentId)),
        );
        const entries = allRecords
          .filter(
            (r) =>
              r.sessionId === item.saved?.id && roster.some((p) => p.studentId === r.studentId),
          )
          .map(({ studentId, status, arrival, departure, timeSource }) => ({
            studentId,
            status,
            arrival,
            departure,
            timeSource,
          }));
        const window = attendanceWindow(item.snapshot.occurrence, now);
        return {
          occurrence: item.snapshot.occurrence,
          roster,
          entries,
          submitted: !!item.saved,
          revision: item.saved?.revision ?? 0,
          overdue: staff ? !item.saved && window.overdue : null,
          window: staff ? window : null,
          discrepancy:
            staff &&
            !!item.saved &&
            (!item.current ||
              meaning(publicOccurrence(item.current), item.current.studentIds) !==
                meaning(
                  item.snapshot.occurrence,
                  item.snapshot.roster.map((r) => r.studentId),
                )),
        };
      })
      .filter((x) => x.roster.length)
      .sort(
        (a, b) =>
          a.occurrence.targetDate.localeCompare(b.occurrence.targetDate) ||
          a.occurrence.start.localeCompare(b.occurrence.start),
      );
    const students = [
      ...new Map(items.flatMap((i) => i.roster).map((p) => [p.studentId, p])).values(),
    ];
    const daily = students.flatMap((student) =>
      [
        ...new Set(
          items
            .filter((i) => i.roster.some((r) => r.studentId === student.studentId))
            .map((i) => i.occurrence.targetDate),
        ),
      ].map((date) => {
        const required = items.filter(
          (i) =>
            i.occurrence.targetDate === date &&
            i.roster.some((r) => r.studentId === student.studentId),
        );
        return {
          student,
          date,
          ...attendanceSummary(
            required.flatMap((i) => i.entries.filter((r) => r.studentId === student.studentId)),
            required.length,
          ),
        };
      }),
    );
    const conducted = items.filter(
      (i) => schoolInstant(i.occurrence.targetDate, i.occurrence.end) <= now.getTime(),
    );
    return {
      from,
      end,
      children,
      items,
      daily,
      totals: attendanceSummary(
        conducted.flatMap((i) => i.entries),
        conducted.reduce((n, i) => n + i.roster.length, 0),
      ),
      school: schoolRead(v),
      manage: manages(v),
      now: now.toISOString(),
    };
  });
}
export async function attendanceQueues(v: Viewer, now = new Date()) {
  requireView(v);
  return db.transaction(async (tx) => {
    const children = await family(tx, v, now, true),
      ids = children.map((c) => c.studentId);
    const explanations = await tx
      .select({
        id: s.attendanceExplanation.id,
        studentId: s.attendanceExplanation.studentId,
        guardianId: s.attendanceExplanation.guardianId,
        startsOn: s.attendanceExplanation.startsOn,
        endsOn: s.attendanceExplanation.endsOn,
        state: s.attendanceExplanation.state,
        revision: s.attendanceExplanation.revision,
        reason: s.attendanceExplanation.reason,
        decision: s.attendanceExplanation.decision,
        createdAt: s.attendanceExplanation.createdAt,
        decidedAt: s.attendanceExplanation.decidedAt,
      })
      .from(s.attendanceExplanation)
      .where(
        manages(v)
          ? sql`true`
          : ids.length && v.capabilities.includes('attendance:explain')
            ? and(
                inArray(s.attendanceExplanation.studentId, ids),
                eq(s.attendanceExplanation.guardianId, v.personId!),
              )
            : sql`false`,
      );
    const requests = await tx
      .select()
      .from(s.attendanceRequest)
      .where(
        manages(v)
          ? sql`true`
          : v.capabilities.includes('attendance:request')
            ? eq(s.attendanceRequest.teacherId, v.personId!)
            : sql`false`,
      );
    const studentIds = [...new Set(explanations.map((e) => e.studentId))];
    const personIds = [
      ...new Set([...explanations.map((e) => e.guardianId), ...requests.map((r) => r.teacherId)]),
    ];
    const pupils = studentIds.length
      ? await tx
          .select({ id: s.student.id, name: s.person.fullName })
          .from(s.student)
          .innerJoin(s.person, eq(s.person.id, s.student.personId))
          .where(inArray(s.student.id, studentIds))
      : [];
    const people = personIds.length
      ? await tx
          .select({ id: s.person.id, name: s.person.fullName })
          .from(s.person)
          .where(inArray(s.person.id, personIds))
      : [];
    const requestsWithContext = [];
    for (const r of requests) {
      let snap = r.snapshot;
      if (!snap) {
        const c = await context(tx, v, r.occurrenceId, now);
        snap = c.saved?.snapshot ?? snapshot(c.current!, c.ctx);
      }
      requestsWithContext.push({
        ...r,
        decision: manages(v) ? r.decision : null,
        teacher: people.find((p) => p.id === r.teacherId)?.name ?? 'მასწავლებელი',
        occurrence: snap.occurrence,
        roster: snap.roster,
        originalEntries: r.snapshot?.originalEntries ?? null,
      });
    }
    // Internal decision notes are deliberately excluded from the guardian projection.
    return {
      explanations: explanations.map((x) => ({
        ...x,
        student: pupils.find((p) => p.id === x.studentId)?.name ?? 'მოსწავლე',
        guardian: people.find((p) => p.id === x.guardianId)?.name ?? 'მშობელი',
        decision: manages(v) ? x.decision : null,
      })),
      requests: requestsWithContext,
    };
  });
}

/** A minimal in-app event trail, scoped again at read time; no external delivery claim. */
export async function attendanceNotifications(v: Viewer, now = new Date()) {
  requireView(v);
  return db.transaction(async (tx) => {
    const children = await family(tx, v, now, true);
    if (!children.length) return [];
    const events = await tx
      .select({
        id: s.outboxJob.id,
        kind: s.outboxJob.kind,
        payload: s.outboxJob.payload,
        at: s.outboxJob.createdAt,
      })
      .from(s.outboxJob)
      .where(
        and(
          inArray(s.outboxJob.kind, ['attendance.absence', 'attendance.late', 'attendance.early']),
          sql`${s.outboxJob.payload}->>'studentId' in (${sql.join(
            children.map((c) => sql`${c.studentId}`),
            sql`, `,
          )})`,
          sql`${s.outboxJob.payload}->'guardianIds' @> ${JSON.stringify([v.personId])}::jsonb`,
        ),
      )
      .orderBy(sql`${s.outboxJob.createdAt} desc`)
      .limit(30);
    return events.map((e) => ({
      id: e.id,
      kind: e.kind,
      date: String(e.payload.date),
      student: children.find((c) => c.studentId === e.payload.studentId)!.name,
      studentId: String(e.payload.studentId),
      at: e.at,
    }));
  });
}
