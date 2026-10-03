import { z } from 'zod';
import { dateOnly } from '../stage1a.js';

export const categoryLabels = {
  classwork: 'საკლასო',
  homework: 'საშინაო',
  summative: 'შემაჯამებელი',
} as const;
export const gradeStateLabels = {
  unassessed: 'ჯერ არ შეფასებულა',
  absent: 'არ ესწრებოდა',
  recovery_required: 'შემაჯამებელი აღსადგენია',
  exempt: 'არ ექვემდებარება შეფასებას',
} as const;
export const gradingMode = z.enum(['formative_only', 'numeric_10', 'pass_fail']);
export type GradingMode = z.infer<typeof gradingMode>;
export const category = z.enum(['classwork', 'homework', 'summative']);
export type Category = z.infer<typeof category>;
export const resultValue = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('numeric'), score: z.number().int().min(1).max(10) }).strict(),
  z.object({ kind: z.literal('pass_fail'), passed: z.boolean() }).strict(),
  z.object({ kind: z.literal('formative'), text: z.string().trim().min(1).max(2000) }).strict(),
  z
    .object({
      kind: z.literal('state'),
      state: z.enum(['unassessed', 'absent', 'recovery_required', 'exempt']),
    })
    .strict(),
]);
export type ResultValue = z.infer<typeof resultValue>;

// A policy version is an explicit academic document, not executable expressions.
// The service will snapshot the resolved version at assessment publication.
export const assessmentPolicy = z
  .object({
    numericFromGrade: z.number().int().min(1).max(12),
    numericFromSemester: z.union([z.literal(1), z.literal(2)]),
    homeworkFromGrade: z.number().int().min(1).max(12),
    scale: z.literal('integer_1_10'),
    rounding: z.literal('half_up'),
    recoveryCalendarDays: z.number().int().min(1).max(90),
    annualSecondSemesterOnlyGrades: z.array(z.number().int().min(1).max(12)).max(12),
  })
  .strict()
  .refine((v) => v.homeworkFromGrade >= v.numericFromGrade, {
    message: 'საშინაოს რიცხვითი შეფასება რიცხვით საფეხურს ვერ უსწრებს.',
  });
export type AssessmentPolicy = z.infer<typeof assessmentPolicy>;
export const currentAssessmentPolicy: AssessmentPolicy = {
  numericFromGrade: 5,
  numericFromSemester: 2,
  homeworkFromGrade: 7,
  scale: 'integer_1_10',
  rounding: 'half_up',
  recoveryCalendarDays: 10,
  annualSecondSemesterOnlyGrades: [5],
};
export function resolveAssessmentPolicy(
  policy: AssessmentPolicy,
  grade: number,
  semester: 1 | 2,
  offeringMode: 'policy_default' | 'formative_only' | 'pass_fail' = 'policy_default',
) {
  assessmentPolicy.parse(policy);
  z.number().int().min(1).max(12).parse(grade);
  z.union([z.literal(1), z.literal(2)]).parse(semester);
  z.enum(['policy_default', 'formative_only', 'pass_fail']).parse(offeringMode);
  const formative =
    grade < policy.numericFromGrade ||
    (grade === policy.numericFromGrade && semester < policy.numericFromSemester);
  const mode: GradingMode =
    formative || offeringMode === 'formative_only'
      ? 'formative_only'
      : offeringMode === 'pass_fail'
        ? 'pass_fail'
        : 'numeric_10';
  const categories: Category[] =
    mode === 'numeric_10' && grade < policy.homeworkFromGrade
      ? ['classwork', 'summative']
      : ['classwork', 'homework', 'summative'];
  return {
    mode,
    categories,
    recoveryCalendarDays: policy.recoveryCalendarDays,
    rounding: policy.rounding,
  };
}
export type ResolvedAssessmentPolicy = ReturnType<typeof resolveAssessmentPolicy>;
export function validateResult(
  policy: ResolvedAssessmentPolicy,
  itemCategory: Category,
  input: unknown,
): ResultValue {
  category.parse(itemCategory);
  const value = resultValue.parse(input);
  if (
    !policy.categories.includes(itemCategory) &&
    policy.mode !== 'formative_only' &&
    value.kind !== 'formative'
  )
    throw Error('ამ საფეხურზე შეფასების კატეგორია დაუშვებელია.');
  if (value.kind === 'numeric' && policy.mode !== 'numeric_10')
    throw Error('ამ კურსზე რიცხვითი შეფასება არ გამოიყენება.');
  if (value.kind === 'pass_fail' && policy.mode !== 'pass_fail')
    throw Error('ამ კურსზე ჩათვლის შეფასება არ გამოიყენება.');
  if (value.kind === 'state' && value.state === 'recovery_required' && itemCategory !== 'summative')
    throw Error('აღდგენა მხოლოდ შემაჯამებელ შეფასებას ეხება.');
  return value;
}
export function recoveryDeadline(assessmentDate: string, days = 10) {
  dateOnly.parse(assessmentDate);
  z.number().int().min(1).max(90).parse(days);
  return new Date(Date.parse(`${assessmentDate}T12:00:00Z`) + days * 86400000)
    .toISOString()
    .slice(0, 10);
}
// Positive rational arithmetic: retain the exact numerator/denominator and never
// round a displayed decimal again when deriving a whole provisional grade.
export function rationalMean(sum: number, count: number) {
  if (!Number.isSafeInteger(sum) || sum < 0 || !Number.isSafeInteger(count) || count < 1)
    throw Error('შეფასების გამოთვლის მონაცემები არასწორია.');
  const n = BigInt(sum),
    d = BigInt(count);
  const cents = (n * 200n + d) / (2n * d);
  return {
    numerator: sum,
    denominator: count,
    display: `${cents / 100n}.${String(cents % 100n).padStart(2, '0')}`,
    rounded: Number((2n * n + d) / (2n * d)),
  };
}
export interface CalculationItem {
  id: string;
  category: Category;
  published: boolean;
  voided: boolean;
  value: ResultValue;
}
export function semesterProjection(
  items: CalculationItem[],
  requiredSummatives: number | null,
  mode: GradingMode = 'numeric_10',
) {
  if (requiredSummatives !== null) z.number().int().min(0).max(100).parse(requiredSummatives);
  if (new Set(items.map((i) => i.id)).size !== items.length) throw Error('შეფასება განმეორებულია.');
  const published = items.filter((i) => i.published && !i.voided);
  const scored = published
    .map((i) => resultValue.parse(i.value))
    .filter((v) => v.kind === 'numeric');
  const sum = scored.reduce((n, v) => n + v.score, 0);
  const summatives = published.filter((i) => i.category === 'summative');
  const completed = summatives.filter(
    (i) =>
      i.value.kind ===
        (mode === 'numeric_10' ? 'numeric' : mode === 'pass_fail' ? 'pass_fail' : 'formative') ||
      (i.value.kind === 'state' && i.value.state === 'exempt'),
  ).length;
  const unresolved = published.filter(
    (i) => i.value.kind === 'state' && i.value.state !== 'exempt',
  ).length;
  const missingRequired =
    requiredSummatives === null ? null : Math.max(0, requiredSummatives - completed);
  return {
    mean: scored.length ? rationalMean(sum, scored.length) : null,
    scoreCount: scored.length,
    publishedCount: published.length,
    createdSummatives: items.filter((i) => !i.voided && i.category === 'summative').length,
    publishedSummatives: summatives.length,
    completedSummatives: completed,
    missingRequired,
    unresolved,
    incomplete:
      requiredSummatives === null || !!missingRequired || unresolved > 0 || published.length === 0,
    official: false as const,
  };
}
export type SemesterProjection = ReturnType<typeof semesterProjection>;
export function annualProjection(
  policy: AssessmentPolicy,
  grade: number,
  first: SemesterProjection | null,
  second: SemesterProjection | null,
) {
  assessmentPolicy.parse(policy);
  z.number().int().min(1).max(12).parse(grade);
  const terms = policy.annualSecondSemesterOnlyGrades.includes(grade) ? [second] : [first, second];
  const enough = terms.every((t) => t?.mean);
  return {
    mean: enough
      ? rationalMean(
          terms.reduce((n, t) => n + t!.mean!.rounded, 0),
          terms.length,
        )
      : null,
    incomplete: !enough || terms.some((t) => t?.incomplete),
    official: false as const,
    excludesExams: true as const,
  };
}
