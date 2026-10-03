import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import type { Viewer } from '../../shared/contracts';
import { api } from '../lib/api';
import { dateLabel } from '../lib/format';
export function GradebookNotices({ viewer, open }: { viewer: Viewer; open: boolean }) {
  const q = useQuery({
    queryKey: ['gradebook', 'notifications', viewer.id],
    queryFn: () =>
      api<{ id: string; at: string; student: string; title: string; path: string }[]>(
        '/api/gradebook/notifications',
      ),
    enabled:
      open &&
      (viewer.capabilities.includes('gradebook:children') ||
        viewer.capabilities.includes('gradebook:self')),
  });
  if (!q.data?.length) return null;
  return (
    <section aria-label="ჟურნალის განახლებები">
      <h3>ჟურნალის განახლებები</h3>
      {q.data.map((n) => (
        <article className="notice-item" key={n.id}>
          <div>
            <small>
              {dateLabel(n.at.slice(0, 10))} · {n.student}
            </small>
            <h3>{n.title}</h3>
            <Link to={n.path}>შედეგი და ისტორია</Link>
          </div>
        </article>
      ))}
      <p className="fine-print">
        გამოქვეყნებული აკადემიური განახლებები. გარე შეტყობინება არ გაგზავნილა.
      </p>
    </section>
  );
}
