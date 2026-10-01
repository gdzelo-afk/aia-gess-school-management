import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowUpRight, ClipboardCheck } from 'lucide-react';
import type { RangeView } from './attendance/model';
import { api } from '../lib/api';
import { tbilisiDate } from '../lib/semester';
export function AttendancePulse({ studentId }: { studentId?: string }) {
  const date = tbilisiDate();
  const q = useQuery({
    queryKey: ['attendance', 'pulse', date, studentId],
    queryFn: () =>
      api<RangeView>(
        `/api/attendance/range?from=${date}&days=1${studentId ? '&studentId=' + studentId : ''}`,
      ),
    refetchInterval: 60000,
  });
  if (!q.data) return null;
  const d = q.data,
    overdue = d.items.filter((i) => i.overdue).length,
    next = d.items.find((i) => !i.submitted && i.window?.started && !i.window.locked);
  return (
    <Link
      className="overview-attendance"
      to={
        next
          ? `/attendance?lesson=${encodeURIComponent(next.occurrence.id)}&date=${date}`
          : '/attendance'
      }
    >
      <ClipboardCheck size={20} />
      <span>
        <strong>დღის დასწრება</strong>
        <small>
          {d.school || d.items.some((i) => i.window)
            ? `${d.items.filter((i) => i.submitted).length} / ${d.items.length} გაკვეთილი შევსებულია${overdue ? ' · ' + overdue + ' შესავსებია' : ''}`
            : d.items.length
              ? `${d.totals.finalized} აღრიცხული · ${d.totals.missing} დაუფიქსირებელი`
              : 'დღეს გაკვეთილი არ არის'}
        </small>
      </span>
      <ArrowUpRight size={18} />
    </Link>
  );
}
