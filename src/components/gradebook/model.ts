import { dateLabel } from '../../lib/format';
import type { academicOverview } from '../../../server/modules/gradebook/overview';
import type {
  journal,
  recoveryQueue,
  writings,
  assessmentHistory,
  writingHistory,
} from '../../../server/modules/gradebook/reads';
import type { assessmentDetail } from '../../../server/modules/gradebook/assessments';
import type {
  gradebookYears,
  criteriaLibrary,
  policySetup,
} from '../../../server/modules/gradebook/setup';
import type { academicReport } from '../../../server/modules/gradebook/reports';
import {
  gradeStateLabels,
  type GradebookCommand,
  type ResultValue,
} from '../../../shared/gradebook';
import { api, queryClient } from '../../lib/api';
type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
export type Overview = Json<Awaited<ReturnType<typeof academicOverview>>>;
export type Journal = Json<Awaited<ReturnType<typeof journal>>>;
export type Assessment = Json<Awaited<ReturnType<typeof assessmentDetail>>>;
export type Recovery = Json<Awaited<ReturnType<typeof recoveryQueue>>>;
export type Writings = Json<Awaited<ReturnType<typeof writings>>>;
export type WritingHistory = Json<Awaited<ReturnType<typeof writingHistory>>>;
export type History = Json<Awaited<ReturnType<typeof assessmentHistory>>>;
export type Years = Json<Awaited<ReturnType<typeof gradebookYears>>>;
export type Criteria = Json<Awaited<ReturnType<typeof criteriaLibrary>>>;
export type Setup = Json<Awaited<ReturnType<typeof policySetup>>>;
export type Report = Json<Awaited<ReturnType<typeof academicReport>>>;
export function valueLabel(value?: ResultValue, compact = false) {
  if (!value) return '—';
  if (value.kind === 'numeric') return String(value.score);
  if (value.kind === 'pass_fail') return value.passed ? 'ჩათვლა' : 'არჩათვლა';
  if (value.kind === 'formative') return compact ? 'კომენტარი' : value.text;
  return compact
    ? ({ unassessed: '—', absent: 'გაცდ.', recovery_required: 'აღდგ.', exempt: 'ნ/ვ' } as const)[
        value.state
      ]
    : gradeStateLabels[value.state];
}
export const stateLabels: Record<string, string> = {
  draft: 'მონახაზი',
  published: 'გამოქვეყნებული',
  void: 'გაუქმებული',
  submitted: 'განხილვის მოლოდინში',
  follow_up: 'პირადი განხილვა',
  review: 'განხილვა',
  approved: 'დამტკიცებული',
  denied: 'უარყოფილი',
  completed: 'აღდგენილი',
  expired: 'ვადაგასული',
};
export async function command(input: Omit<GradebookCommand, 'commandId'> | object) {
  const result = await api<{ id: string; revision: number }>('/api/gradebook/actions', {
    method: 'POST',
    body: JSON.stringify({ commandId: crypto.randomUUID(), ...input }),
  });
  await queryClient.invalidateQueries({ queryKey: ['gradebook'], refetchType: 'none' });
  return result;
}
export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'შენახვა ვერ მოხერხდა.');

export function historyTime(value: string) {
  const date = new Date(value);
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
  return `${dateLabel(day)} ${day.slice(0, 4)} · ${time}`;
}
