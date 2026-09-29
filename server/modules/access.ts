import { and, eq, sql, or, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import { person, roleGrant, student, user as appUser } from '../db/schema.js';
import { capabilitiesFor, type Viewer } from '../../shared/contracts.js';
export async function resolveViewer(user: { id: string; name: string }): Promise<Viewer> {
  const [people, grants] = await Promise.all([
    db
      .select({ id: person.id })
      .from(person)
      .innerJoin(appUser, eq(appUser.id, person.userId))
      .where(
        and(
          eq(person.userId, user.id),
          eq(appUser.disabled, false),
          sql`${person.archivedAt} is null`,
          sql`not exists(select 1 from staff f where f.person_id=${person.id} and f.ends_on <= (current_timestamp at time zone 'Asia/Tbilisi')::date)`,
        ),
      )
      .limit(1),
    db.select({ role: roleGrant.role }).from(roleGrant).where(eq(roleGrant.userId, user.id)),
  ]);
  const roles = people.length ? grants.map((g) => g.role) : [];
  const capabilities = capabilitiesFor(roles);
  // A substitution grants only the actual occurrence read scope, never a directory role.
  if (people[0] && !capabilities.includes('timetable:own')) {
    const assigned = await db.execute(sql`select 1 from timetable_exception e
      join staff f on f.person_id=${people[0].id}
      where f.starts_on <= (current_timestamp at time zone 'Asia/Tbilisi')::date
      and (f.ends_on is null or f.ends_on > (current_timestamp at time zone 'Asia/Tbilisi')::date)
      and e.change->>'teacherId'=${people[0].id}
      and e.change->>'cancelled'='false'
      and not exists(select 1 from timetable_exception later
        where later.version_id=e.version_id and later.lesson_id=e.lesson_id
        and later.date=e.date and later.sequence>e.sequence)
      limit 1`);
    if (assigned.rows.length) capabilities.push('timetable:own');
  }
  return {
    id: user.id,
    name: user.name,
    personId: people[0]?.id ?? null,
    roles,
    capabilities,
  };
}
/** This predicate is applied BEFORE pagination/counting/detail selection. */
export function studentScope(viewer: Viewer, purpose: 'academic' | 'finance' = 'academic'): SQL {
  const caps = viewer.capabilities;
  if (purpose === 'finance' ? caps.includes('finance:school') : caps.includes('students:school'))
    return sql`true`;
  if (!viewer.personId) return sql`false`;
  const predicates: SQL[] = [];
  if (purpose === 'academic' && caps.includes('students:self'))
    predicates.push(eq(student.personId, viewer.personId));
  if (purpose === 'academic' && caps.includes('students:assigned'))
    predicates.push(sql`exists (
    select 1 from enrollment e join teaching_assignment t on t.section_id=e.section_id
    where e.student_id=${student.id} and t.staff_person_id=${viewer.personId}
      and e.starts_on <= (current_timestamp at time zone 'Asia/Tbilisi')::date and (e.ends_on is null or e.ends_on > (current_timestamp at time zone 'Asia/Tbilisi')::date)
      and exists(select 1 from staff f join person p on p.id=f.person_id where f.person_id=t.staff_person_id and p.archived_at is null and f.starts_on<=(current_timestamp at time zone 'Asia/Tbilisi')::date and (f.ends_on is null or f.ends_on>(current_timestamp at time zone 'Asia/Tbilisi')::date))
      and (t.offering_id is null or exists(select 1 from course_offering o where o.id=t.offering_id and o.starts_on<=(current_timestamp at time zone 'Asia/Tbilisi')::date and o.ends_on>(current_timestamp at time zone 'Asia/Tbilisi')::date and (not o.elective or exists(select 1 from course_membership m where m.offering_id=o.id and m.student_id=e.student_id and m.starts_on<=(current_timestamp at time zone 'Asia/Tbilisi')::date and m.ends_on>(current_timestamp at time zone 'Asia/Tbilisi')::date))))
      and t.starts_on <= (current_timestamp at time zone 'Asia/Tbilisi')::date and (t.ends_on is null or t.ends_on > (current_timestamp at time zone 'Asia/Tbilisi')::date)
  )`);
  if (
    purpose === 'finance' ? caps.includes('finance:children') : caps.includes('students:children')
  )
    predicates.push(sql`exists (
    select 1 from guardian_link g where g.student_id=${student.id} and g.guardian_person_id=${viewer.personId}
      and ${purpose === 'finance' ? sql`g.finance_access` : sql`g.academic_access`}=true
      and g.starts_on <= (current_timestamp at time zone 'Asia/Tbilisi')::date and (g.ends_on is null or g.ends_on > (current_timestamp at time zone 'Asia/Tbilisi')::date)
  )`);
  return or(...predicates) ?? sql`false`;
}
