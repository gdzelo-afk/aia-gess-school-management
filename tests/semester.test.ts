import { describe, it, expect } from 'vitest';
import { semesterProgress, tbilisiDate } from '../src/lib/semester';
const terms = [
  {
    id: '1',
    yearId: 'year',
    ordinal: 1,
    name: 'I სემესტრი',
    startsOn: '2026-09-15',
    endsOn: '2026-12-30',
  },
  {
    id: '2',
    yearId: 'year',
    ordinal: 2,
    name: 'II სემესტრი',
    startsOn: '2027-01-15',
    endsOn: '2027-06-16',
  },
];
describe('configured semester progress', () => {
  it('uses date-only elapsed days, starts at zero and clamps after completion', () => {
    expect(semesterProgress(terms, '2026-09-01')!.percent).toBe(0);
    expect(semesterProgress(terms, '2026-09-15')!.percent).toBe(0);
    expect(semesterProgress(terms, '2026-09-29')!.percent).toBeCloseTo((14 / 106) * 100);
    expect(semesterProgress(terms, '2027-06-16')!.percent).toBe(100);
    expect(semesterProgress(terms, '2027-07-01')!.percent).toBe(100);
  });
  it('selects the second semester and leaves gaps or missing/invalid data neutral', () => {
    expect(semesterProgress(terms, '2027-01-15')!.term.id).toBe('2');
    expect(semesterProgress(terms, '2027-01-01')).toBeNull();
    expect(semesterProgress([], '2026-09-29')).toBeNull();
    expect(semesterProgress([{ ...terms[0]!, endsOn: '2026-01-01' }], '2026-09-29')).toBeNull();
    expect(semesterProgress([terms[0]!, terms[0]!], '2026-09-29')).toBeNull();
  });
  it('switches school days at Tbilisi midnight without local timezone drift', () => {
    expect(tbilisiDate(new Date('2026-09-28T19:59:59Z'))).toBe('2026-09-28');
    expect(tbilisiDate(new Date('2026-09-28T20:00:00Z'))).toBe('2026-09-29');
  });
});
