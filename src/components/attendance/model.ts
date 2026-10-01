import { dateLabel } from '../../lib/format';
import type {
  attendanceLesson,
  attendanceRange,
  attendanceQueues,
} from '../../../server/modules/attendance';
import { api, queryClient } from '../../lib/api';
import type { AttendanceCommand } from '../../../shared/attendance';
type Json<T> = T extends Date
  ? string
  : T extends (infer U)[]
    ? Json<U>[]
    : T extends object
      ? { [K in keyof T]: Json<T[K]> }
      : T;
export type LessonView = Json<Awaited<ReturnType<typeof attendanceLesson>>>;
export type RangeView = Json<Awaited<ReturnType<typeof attendanceRange>>>;
export type QueuesView = Json<Awaited<ReturnType<typeof attendanceQueues>>>;
export const dayLabels: Record<string, string> = {
  present: 'სრულად ესწრება',
  partial: 'ნაწილობრივი გაცდენა',
  absent: 'მთელი დღე გაცდენილია',
  incomplete: 'მონაცემები არასრულია',
  no_lessons: 'გაკვეთილი არ არის',
};
export const decisionLabels: Record<string, string> = {
  pending: 'განხილვის მოლოდინში',
  approved: 'დადასტურებულია',
  denied: 'უარყოფილია',
};
export const historyLabels: Record<string, string> = {
  submitted: 'პირველი აღრიცხვა',
  'admin.submitted': 'ადმინისტრაციის მიერ შევსება',
  'teacher.corrected': 'მასწავლებლის შესწორება',
  'admin.corrected': 'ადმინისტრაციული შესწორება',
  'explanation.authorized': 'გაცდენის ავტორიზაცია',
  'roster.reconciled': 'ისტორიული სიის შეჯერება',
};
export const shiftDate = (date: string, days: number) =>
  new Date(Date.parse(`${date}T12:00:00Z`) + days * 86400000).toISOString().slice(0, 10);
export const localTime = () =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date());
export const timestamp = (value: string) => {
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
    hourCycle: 'h23',
  }).format(date);
  return `${dateLabel(day)} · ${time}`;
};
export async function command(value: AttendanceCommand) {
  const result = await api<{ id: string; revision: number }>('/api/attendance/actions', {
    method: 'POST',
    body: JSON.stringify(value),
  });
  await queryClient.invalidateQueries({ queryKey: ['attendance'] });
  return result;
}
