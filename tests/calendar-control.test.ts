import { describe, it, expect } from 'vitest';
import {
  validDate,
  monthDays,
  moveMonth,
  addDays,
  georgianWeekdays,
} from '../src/lib/calendar-control';
describe('compact Georgian calendar date-only navigation', () => {
  it('rejects impossible dates rather than silently rolling into another month', () => {
    expect(validDate('2026-02-29')).toBe(false);
    expect(validDate('2028-02-29')).toBe(true);
    expect(validDate('2026-13-01')).toBe(false);
  });
  it('renders six Sunday-first weeks including spillover dates', () => {
    const days = monthDays('2026-10');
    expect(days).toHaveLength(42);
    expect(days[0]).toBe('2026-09-27');
    expect(days.at(-1)).toBe('2026-11-07');
    expect(new Set(days).size).toBe(42);
  });
  it('clamps month navigation and crosses years without timezone drift', () => {
    expect(moveMonth('2026-01-31', 1)).toBe('2026-02-28');
    expect(moveMonth('2028-01-31', 1)).toBe('2028-02-29');
    expect(moveMonth('2026-12-31', 1)).toBe('2027-01-31');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
  });
  it('keeps the approved Georgian weekday labels', () => {
    expect(georgianWeekdays).toEqual(['კვი.', 'ორშ.', 'სამშ.', 'ოთხ.', 'ხუთ.', 'პარ.', 'შაბ.']);
  });
});
