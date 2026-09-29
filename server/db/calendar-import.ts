import { z } from 'zod';
import { dateOnly } from '../../shared/stage1a.js';
const cohort = z
  .object({
    start_date: dateOnly,
    end_date: dateOnly,
    total_school_days: z.number().int(),
    term_1_days: z.number().int(),
    term_2_days: z.number().int(),
    notes_ka: z.string(),
  })
  .strict();
const sourceSchema = z
  .object({
    $schema: z.string(),
    metadata: z
      .object({
        academic_year: z.string(),
        jurisdiction: z.string(),
        governing_body: z.string(),
        title_ka: z.string(),
        title_en: z.string(),
        date_format: z.literal('YYYY-MM-DD'),
        week_structure: z
          .object({
            days: z.array(z.string()).length(7),
            working_days: z.array(z.string()),
            weekend_days: z.array(z.string()),
          })
          .strict(),
      })
      .strict(),
    grade_cohort_rules: z
      .object({ Grade_1: cohort, Grades_2_to_11: cohort, Grade_12: cohort })
      .strict(),
    visual_legend_mapping: z.record(
      z.string(),
      z
        .object({
          hex: z.string(),
          label_ka: z.string(),
          label_en: z.string(),
          is_school_day: z.boolean(),
        })
        .strict(),
    ),
    official_holidays: z.array(
      z
        .object({
          date: dateOnly,
          name_ka: z.string().min(1),
          name_en: z.string(),
          type: z.literal('PUBLIC_HOLIDAY'),
        })
        .strict(),
    ),
    vacation_periods: z.array(
      z
        .object({
          name_ka: z.string().min(1),
          name_en: z.string(),
          start_date: dateOnly,
          end_date: dateOnly,
          visual_code: z.string(),
        })
        .strict(),
    ),
    academic_milestones: z.array(
      z.object({ date: dateOnly, event: z.string(), visual_code: z.string() }).strict(),
    ),
    monthly_school_days_breakdown: z.array(
      z
        .object({
          year: z.number().int(),
          month: z.number().int().min(1).max(12),
          month_name: z.string(),
          school_days_grade_1: z.number().int().min(0),
          school_days_grades_2_11: z.number().int().min(0),
          school_days_grade_12: z.number().int().min(0),
          calendar_label: z.string(),
        })
        .strict(),
    ),
  })
  .strict();
export function nextDate(value: string) {
  const date = new Date(value + 'T00:00:00Z');
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
const milestoneNames: Record<string, { title: string; gradeFrom: number; gradeTo: number }> = {
  'Academic Year Begins (All Grades)': {
    title: 'სასწავლო წლის დასაწყისი',
    gradeFrom: 1,
    gradeTo: 12,
  },
  'Term 1 Ends (All Grades)': { title: 'I სემესტრის ბოლო სასწავლო დღე', gradeFrom: 1, gradeTo: 12 },
  'Term 2 Begins (All Grades)': { title: 'II სემესტრის დასაწყისი', gradeFrom: 1, gradeTo: 12 },
  'School Year Concludes for Grade 12': {
    title: 'XII კლასის ბოლო სასწავლო დღე',
    gradeFrom: 12,
    gradeTo: 12,
  },
  'School Year Concludes for Grade 1': {
    title: 'I კლასის ბოლო სასწავლო დღე',
    gradeFrom: 1,
    gradeTo: 1,
  },
  'School Year Concludes for Grades 2–11': {
    title: 'II–XI კლასების ბოლო სასწავლო დღე',
    gradeFrom: 2,
    gradeTo: 11,
  },
};
export function parseDemoCalendar(input: unknown) {
  const source = sourceSchema.parse(input);
  const milestones = source.academic_milestones;
  const get = (event: string) => {
    const found = milestones.filter((m) => m.event === event);
    if (found.length !== 1) throw Error(`Missing/duplicate calendar milestone: ${event}`);
    return found[0]!.date;
  };
  const startsOn = get('Academic Year Begins (All Grades)'),
    endsOn = nextDate(get('School Year Concludes for Grades 2–11'));
  const events = [
    ...source.official_holidays.map((h) => ({
      title: h.name_ka,
      kind: 'holiday',
      startsOn: h.date,
      endsOn: nextDate(h.date),
      gradeFrom: 1,
      gradeTo: 12,
    })),
    ...source.vacation_periods.map((v) => ({
      title: v.name_ka,
      kind: 'vacation',
      startsOn: v.start_date,
      endsOn: nextDate(v.end_date),
      gradeFrom: 1,
      gradeTo: 12,
    })),
    ...milestones.map((m) => {
      const name = milestoneNames[m.event];
      if (!name) throw Error('Unrecognized calendar milestone');
      return { ...name, kind: 'milestone', startsOn: m.date, endsOn: nextDate(m.date) };
    }),
  ];
  for (const event of events)
    if (event.startsOn >= event.endsOn || event.startsOn < startsOn || event.endsOn > endsOn)
      throw Error('Calendar interval outside academic year');
  const warnings: string[] = [];
  for (const [key, col] of [
    ['Grade_1', 'school_days_grade_1'],
    ['Grades_2_to_11', 'school_days_grades_2_11'],
    ['Grade_12', 'school_days_grade_12'],
  ] as const) {
    const c = source.grade_cohort_rules[key];
    const sum = source.monthly_school_days_breakdown.reduce((n, m) => n + m[col], 0);
    if (sum !== c.total_school_days)
      warnings.push(`${key}: monthly sum ${sum}, stated total ${c.total_school_days}`);
  }
  return {
    name: source.metadata.academic_year.replace('-', '–'),
    startsOn,
    endsOn,
    semesters: [
      {
        name: 'I სემესტრი',
        ordinal: 1,
        startsOn,
        endsOn: nextDate(get('Term 1 Ends (All Grades)')),
      },
      { name: 'II სემესტრი', ordinal: 2, startsOn: get('Term 2 Begins (All Grades)'), endsOn },
    ],
    events,
    warnings,
  };
}
