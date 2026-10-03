import { CalendarDays } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Viewer } from '../../shared/contracts';
import { useSchoolDate } from './ProductIdentity';

export function DashboardHeading({ viewer, childId }: { viewer: Viewer; childId?: string }) {
  const today = useSchoolDate();
  const name = viewer.name.trim().split(/\s+/)[0];
  const parent = viewer.roles.includes('guardian');
  const pupil = viewer.roles.includes('student');
  const teacher = viewer.capabilities.includes('students:assigned');
  const query = new URLSearchParams({ date: today.date });
  if (parent && childId) query.set('studentId', childId);
  return (
    <header className="overview-heading">
      <div>
        <time className="product-eyebrow" dateTime={today.date}>
          {today.fullLabel}
        </time>
        <h1 className="greeting">
          {today.greeting},{' '}
          <span className="greeting-tail">
            {name}.<span className="presence-cursor" aria-hidden="true" />
          </span>
        </h1>
        <p>
          {parent
            ? 'თქვენი შვილების დღე — ყველაფერი მნიშვნელოვანი, ახლოს.'
            : pupil
              ? 'დღის გეგმა და ახალი შესაძლებლობები.'
              : teacher
                ? 'გაკვეთილები, მოსწავლეები და დღის შემდეგი ნაბიჯი.'
                : 'ადამიანები, დღის რიტმი და ყურადღების მთავარი აქცენტები.'}
        </p>
      </div>
      {viewer.capabilities.some((c) => c.startsWith('timetable:')) && (
        <Link className="product-secondary overview-schedule" to={`/timetable?${query}`}>
          <CalendarDays size={17} aria-hidden="true" />
          დღის განრიგი
        </Link>
      )}
    </header>
  );
}
