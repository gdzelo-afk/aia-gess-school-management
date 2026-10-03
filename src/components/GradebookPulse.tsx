import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ArrowUpRight } from 'lucide-react';
import { api } from '../lib/api';
export function GradebookPulse() {
  const q = useQuery({
    queryKey: ['gradebook', 'pulse'],
    queryFn: () =>
      api<{ draft: number; pending: number; published: number; school: boolean } | null>(
        '/api/gradebook/pulse',
      ),
    staleTime: 60000,
  });
  if (!q.data || (!q.data.draft && !q.data.pending && !q.data.published)) return null;
  return (
    <Link className="overview-attendance" to="/gradebook">
      <BookOpen size={20} />
      <span>
        <strong>აკადემიური ჟურნალი</strong>
        <small>
          {q.data.published} გამოქვეყნებული{q.data.draft ? ` · ${q.data.draft} მონახაზი` : ''}
          {q.data.pending ? ` · ${q.data.pending} აღდგენის მოთხოვნა` : ''}
        </small>
      </span>
      <ArrowUpRight size={18} />
    </Link>
  );
}
