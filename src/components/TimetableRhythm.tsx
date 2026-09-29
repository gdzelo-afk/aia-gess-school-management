import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ArrowUpRight, Clock3 } from 'lucide-react';
import type { Occurrence } from '../../shared/timetable';
import { api } from '../lib/api';
import { tbilisiDate } from '../lib/semester';
import { dateLabel } from '../lib/format';
import { Skeleton, ErrorState } from './ui';
export function TimetableRhythm({ studentId }: { studentId?: string }) {
  const date = tbilisiDate();
  const query = useQuery({
    queryKey: ['timetable', 'today', date, studentId],
    queryFn: () =>
      api<{ items: Occurrence[] }>(
        `/api/timetable/week?from=${date}&days=1${studentId ? `&studentId=${studentId}` : ''}`,
      ),
    refetchInterval: 60000,
  });
  return (
    <section className="overview-rhythm" aria-labelledby="day-rhythm-title">
      <div className="overview-section-head">
        <h2 id="day-rhythm-title">დღის რიტმი</h2>
        <span className="overview-rhythm-context">
          <Clock3 size={14} />
          {dateLabel(date)} · გამოქვეყნებული განრიგი
        </span>
      </div>
      {query.isPending ? (
        <Skeleton rows={2} />
      ) : query.isError ? (
        <ErrorState onRetry={() => void query.refetch()} />
      ) : (
        <>
          <div className="overview-events">
            {query.data.items.slice(0, 5).map((o) => (
              <Link
                key={o.id}
                to={`/timetable?date=${date}`}
                className={o.changed ? 'highlight' : ''}
              >
                <time className="product-number">{o.start}</time>
                <span>
                  <strong>
                    {o.subject}
                    {o.cancelled ? ' · გაუქმებულია' : ''}
                  </strong>
                  <small>
                    {o.group} · {o.teacher} · ოთახი {o.room}
                  </small>
                </span>
                <ArrowUpRight size={14} />
              </Link>
            ))}
          </div>
          {!query.data.items.length && (
            <p className="overview-muted">დღეს გამოქვეყნებული გაკვეთილები არ არის.</p>
          )}
        </>
      )}
      <Link to="/timetable" className="overview-inline-link">
        განრიგის გახსნა <ArrowRight size={15} />
      </Link>
    </section>
  );
}
