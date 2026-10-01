import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Viewer } from '../../shared/contracts';
import { api } from '../lib/api';
import { dateLabel } from '../lib/format';
export function AttendanceNotices({ viewer, open }: { viewer: Viewer; open: boolean }) {
  const q = useQuery({
    queryKey: ['attendance', 'notifications', viewer.id],
    queryFn: () =>
      api<{ id: string; student: string; studentId: string; date: string; kind: string }[]>(
        '/api/attendance/notifications',
      ),
    enabled: open && viewer.capabilities.includes('attendance:children'),
  });
  if (!q.data?.length) return null;
  const labels: Record<string, string> = {
    'attendance.absence': 'გაცდენა დაფიქსირდა',
    'attendance.late': 'დაგვიანება დაფიქსირდა',
    'attendance.early': 'ადრე გასვლა დაფიქსირდა',
  };
  return (
    <section aria-label="დასწრების განახლებები">
      <h3>დასწრების განახლებები</h3>
      {q.data.map((n) => (
        <article className="notice-item" key={n.id}>
          <div>
            <small>
              {dateLabel(n.date)} · {n.student}
            </small>
            <h3>{labels[n.kind]}</h3>
            <Link to={`/attendance?date=${n.date}&student=${n.studentId}`}>
              მიმდინარე ჩანაწერი და ისტორია
            </Link>
          </div>
        </article>
      ))}
      <p className="fine-print">
        სისტემაში დაფიქსირებული მოვლენები. გარე შეტყობინება არ გაგზავნილა; ჩანაწერი შესაძლოა შემდეგ
        შესწორებულიყო.
      </p>
    </section>
  );
}
