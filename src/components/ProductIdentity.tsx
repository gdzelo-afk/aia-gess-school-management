import { useEffect, useState } from 'react';
import { dateLabel } from '../lib/format';

export function ProductMark() {
  return (
    <div className="product-mark">
      <img src="/logo.png" alt="აია-ჯესსის ემბლემა" />
      <span>
        <strong>AIA-GESS</strong>
        <small>სასკოლო სივრცე</small>
      </span>
    </div>
  );
}

/** Original Vector A lens geometry, isolated from the preserved lab styles. */
export function LensArtifact({ paused }: { paused: boolean }) {
  return (
    <div className={`entrance-artifact ${paused ? 'is-paused' : ''}`} aria-hidden="true">
      <div className="entrance-lens">
        <i />
        <i />
        <i />
        <i />
        <div />
        <span>ა</span>
      </div>
    </div>
  );
}

export function useSchoolDate() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  return {
    date,
    day: part('day'),
    month: part('month'),
    year: part('year'),
    label: dateLabel(date),
  };
}
