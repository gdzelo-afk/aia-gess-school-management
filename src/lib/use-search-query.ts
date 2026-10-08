import { useEffect, useState } from 'react';

/** Keep typing immediate; only settled directory searches reach the scoped API. */
export function useSearchQuery(value: string) {
  const [query, setQuery] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setQuery(value), 180);
    return () => clearTimeout(timer);
  }, [value]);
  return query;
}
