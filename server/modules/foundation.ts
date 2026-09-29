import { and, asc, count, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { student, person, section, enrollment, staff, academicYear } from '../db/schema.js';
import { studentScope } from './access.js';
import type {
  Viewer,
  StudentPage,
  FoundationOverview,
  AgendaItem,
} from '../../shared/contracts.js';
import { config } from '../config.js';
export interface ListInput {
  q: string;
  limit: number;
  offset: number;
  sort: 'asc' | 'desc';
  section?: string;
  status?: 'active' | 'archived' | 'all';
}
const projection = {
  id: student.id,
  name: person.fullName,
  number: student.number,
  status: student.status,
  section: section.name,
};
const activeEnrollment = and(
  eq(enrollment.studentId, student.id),
  sql`${enrollment.startsOn} <= (current_timestamp at time zone 'Asia/Tbilisi')::date`,
  sql`(${enrollment.endsOn} is null or ${enrollment.endsOn} > (current_timestamp at time zone 'Asia/Tbilisi')::date)`,
);
export async function listStudents(viewer: Viewer, input: ListInput): Promise<StudentPage> {
  const search = input.q.replace(/[\\%_]/g, '\\$&');
  const where = and(
    studentScope(viewer),
    input.status === 'all' && viewer.capabilities.includes('people:manage')
      ? undefined
      : eq(
          student.status,
          input.status === 'archived' && viewer.capabilities.includes('people:manage')
            ? 'archived'
            : 'active',
        ),
    sql`${person.archivedAt} is null`,
    or(ilike(person.fullName, `%${search}%`), ilike(student.number, `%${search}%`)),
    input.section ? eq(section.name, input.section) : undefined,
  );
  const base = () =>
    db
      .select(projection)
      .from(student)
      .innerJoin(person, eq(person.id, student.personId))
      .leftJoin(enrollment, activeEnrollment)
      .leftJoin(section, eq(section.id, enrollment.sectionId));
  const [items, total] = await Promise.all([
    base()
      .where(where)
      .orderBy(input.sort === 'asc' ? asc(person.fullName) : desc(person.fullName), asc(student.id))
      .limit(input.limit)
      .offset(input.offset),
    db
      .select({ value: count() })
      .from(student)
      .innerJoin(person, eq(person.id, student.personId))
      .leftJoin(enrollment, activeEnrollment)
      .leftJoin(section, eq(section.id, enrollment.sectionId))
      .where(where),
  ]);
  return {
    items: items.map((x) => ({ ...x, status: x.status as 'active' | 'archived' })),
    total: total[0]?.value ?? 0,
    limit: input.limit,
    offset: input.offset,
  };
}
export async function findStudent(viewer: Viewer, id: string) {
  const result = await db
    .select(projection)
    .from(student)
    .innerJoin(person, eq(person.id, student.personId))
    .leftJoin(enrollment, activeEnrollment)
    .leftJoin(section, eq(section.id, enrollment.sectionId))
    .where(
      and(
        studentScope(viewer),
        eq(student.id, id),
        sql`${person.archivedAt} is null`,
        viewer.capabilities.includes('people:manage') ? undefined : eq(student.status, 'active'),
      ),
    )
    .limit(1);
  return result[0] ?? null;
}
export async function canSeeChildFinance(viewer: Viewer, id: string) {
  const result = await db
    .select({ id: student.id })
    .from(student)
    .where(and(studentScope(viewer, 'finance'), eq(student.id, id)))
    .limit(1);
  return result.length > 0;
}
const executiveAgenda: AgendaItem[] = [
  {
    id: 'agenda-1',
    time: '09:00',
    title: 'სასწავლო დღის დასაწყისი',
    detail: 'I გაკვეთილი · ყველა საფეხური',
    kind: 'lesson',
  },
  {
    id: 'agenda-2',
    time: '11:30',
    title: 'აკადემიური გუნდის შეხვედრა',
    detail: 'საკონფერენციო ოთახი · 30 წუთი',
    kind: 'meeting',
  },
  {
    id: 'agenda-3',
    time: '15:00',
    title: 'სამეცნიერო კლუბი',
    detail: 'VIII–IX კლასები · ლაბორატორია',
    kind: 'event',
  },
];
export async function overview(viewer: Viewer): Promise<FoundationOverview> {
  const page = await listStudents(viewer, { q: '', limit: 6, offset: 0, sort: 'asc' });
  const currentYear = (
    await db.select().from(academicYear).where(eq(academicYear.status, 'active')).limit(1)
  )[0];
  let school: FoundationOverview['school'] = null;
  if (viewer.capabilities.includes('school:overview')) {
    const [students, sections, teachers] = await Promise.all([
      db.select({ value: count() }).from(student).where(eq(student.status, 'active')),
      db
        .select({ value: count() })
        .from(section)
        .where(currentYear ? eq(section.yearId, currentYear.id) : sql`false`),
      db
        .select({ value: count() })
        .from(staff)
        .where(
          sql`${staff.startsOn}<=(current_timestamp at time zone 'Asia/Tbilisi')::date and coalesce(${staff.endsOn},'infinity'::date)>(current_timestamp at time zone 'Asia/Tbilisi')::date and exists(select 1 from teaching_assignment t where t.staff_person_id=${staff.personId} and t.starts_on<=(current_timestamp at time zone 'Asia/Tbilisi')::date and coalesce(t.ends_on,'infinity'::date)>(current_timestamp at time zone 'Asia/Tbilisi')::date)`,
        ),
    ]);
    const distribution = await db
      .select({ grade: section.gradeLevel, students: count() })
      .from(student)
      .innerJoin(enrollment, activeEnrollment)
      .innerJoin(section, eq(section.id, enrollment.sectionId))
      .where(eq(student.status, 'active'))
      .groupBy(section.gradeLevel)
      .orderBy(asc(section.gradeLevel));
    school = {
      gradeDistribution: distribution,
      students: students[0]?.value ?? 0,
      sections: sections[0]?.value ?? 0,
      teachers: teachers[0]?.value ?? 0,
    };
  }
  const teacher = viewer.capabilities.includes('students:assigned');
  const family = viewer.roles.includes('guardian') || viewer.roles.includes('student');
  return {
    viewer,
    demo: config.DEMO_MODE,
    snapshotDate: '2026-09-28',
    schoolName: 'აია-ჯესსი',
    academicYear: currentYear?.name ?? 'სასწავლო წელი არ არის არჩეული',
    students: page.items,
    totalStudents: page.total,
    school,
    agenda: !config.DEMO_MODE
      ? []
      : teacher
        ? [
            {
              id: 'lesson-1',
              time: '09:00',
              title: 'ქართული ენა და ლიტერატურა',
              detail: 'VII ა · ოთახი 204',
              kind: 'lesson',
            },
            {
              id: 'lesson-2',
              time: '12:00',
              title: 'გაკვეთილის მომზადება',
              detail: 'ლიტერატურული ტექსტის განხილვა',
              kind: 'lesson',
            },
          ]
        : family
          ? [
              {
                id: 'event-1',
                time: '15:00',
                title: 'შემოქმედებითი სახელოსნო',
                detail: 'სასკოლო ღონისძიება · ბიბლიოთეკა',
                kind: 'event',
              },
            ]
          : executiveAgenda,
    announcements: config.DEMO_MODE
      ? [
          {
            id: 'notice-1',
            title: 'ახალი კვირა, ახალი აღმოჩენები',
            category: 'სასკოლო ცხოვრება',
            date: '2026-09-28',
            body: 'ამ კვირაში სამეცნიერო და შემოქმედებითი კლუბები იწყებს მუშაობას. შეხვედრების დრო იხილეთ სასკოლო კალენდარში. ეს გამოგონილი სადემონსტრაციო განცხადებაა.',
          },
          {
            id: 'notice-2',
            title: 'შემოდგომის კითხვის კვირეული',
            category: 'ბიბლიოთეკა',
            date: '2026-09-29',
            body: 'წიგნების გაცვლა და საყვარელი ისტორიების გაზიარება — სამშაბათს სკოლის ბიბლიოთეკაში. ეს გამოგონილი სადემონსტრაციო ღონისძიებაა.',
          },
        ]
      : [],
  };
}
