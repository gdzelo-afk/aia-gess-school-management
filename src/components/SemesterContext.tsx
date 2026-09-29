import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { AcademicSetup } from '../../shared/stage1a';
import { api } from '../lib/api';
import { dateLabel } from '../lib/format';
import { semesterProgress, tbilisiDate } from '../lib/semester';
export function SemesterContext() {
  const [on, setOn] = useState(() => tbilisiDate());
  useEffect(() => {
    const timer = setInterval(() => setOn(tbilisiDate()), 30000);
    return () => clearInterval(timer);
  }, []);
  const result = useQuery({
    queryKey: ['academics', 'sidebar'],
    queryFn: () => api<AcademicSetup>('/api/academics'),
    refetchInterval: 60000,
  });
  const year = result.data?.years.find((y) => y.status === 'active');
  const progress =
    year && result.data?.selectedYearId === year.id
      ? semesterProgress(result.data.semesters, on)
      : null;
  return (
    <section className="sidebar-term" aria-label="სასწავლო პერიოდი">
      <span>{progress?.term.name ?? 'სასწავლო პერიოდი'}</span>
      <strong className="product-number">{year?.name ?? '—'}</strong>
      {progress ? (
        <>
          <progress
            className="semester-progress"
            aria-label={`${progress.term.name} · გასული პერიოდი`}
            value={progress.percent}
            max={100}
          />
          <small>
            {dateLabel(progress.term.startsOn)} — {dateLabel(progress.term.endsOn)}
            <br />
            {on < progress.term.startsOn
              ? 'სემესტრი ჯერ არ დაწყებულა'
              : progress.percent === 100
                ? 'სემესტრი დასრულებულია'
                : `გასულია ${Math.round(progress.percent)}%`}
          </small>
        </>
      ) : (
        <small>
          {result.isError
            ? 'პერიოდი ვერ ჩაიტვირთა'
            : result.isPending
              ? 'პერიოდი იტვირთება…'
              : year
                ? 'სემესტრებს შორის პერიოდი'
                : 'მიმდინარე წელი არ არის განსაზღვრული'}
        </small>
      )}
    </section>
  );
}
