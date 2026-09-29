import { describe, it, expect } from 'vitest';
import { dateLabel, money } from '../src/lib/format';
describe('Georgian output without host locale dependency', () => {
  it('formats date-only values in Georgian without UTC day drift', () => {
    expect(dateLabel('2026-09-28')).toBe('28 სექტემბერი');
    expect(dateLabel('2027-01-01')).toBe('1 იანვარი');
  });
  it('formats tetri exactly, including reversals', () => {
    expect(money(65000)).toBe('650,00\u00a0₾');
    expect(money(-100001)).toBe('−1\u00a0000,01\u00a0₾');
    expect(() => money(0.3)).toThrow();
  });
});
