import { expect, test } from 'vitest';
import { attendanceFixtureWait, attendanceFixtureWindow } from './browser/attendance-fixture';

test('Attendance browser fixture remains valid through every Tbilisi minute and midnight rollover', () => {
  const midnight = Date.parse('2026-10-30T00:00:00+04:00');
  for (let tick = 0; tick < 2880; tick++) {
    const minute = Math.floor(tick / 2);
    const now = new Date(midnight + minute * 60_000 + (tick % 2 ? 59_999 : 0));
    const wait = attendanceFixtureWait(now);
    expect(wait).toBeGreaterThanOrEqual(0);
    expect(wait).toBeLessThanOrEqual(240_100);
    const reference = new Date(now.getTime() + wait);
    const window = attendanceFixtureWindow(reference);
    expect(window.start < window.arrival).toBe(true);
    expect(window.arrival < window.departure).toBe(true);
    expect(window.departure < window.end).toBe(true);
    expect(window.lateness).toBeGreaterThan(0);
    const instant = (time: string) => Date.parse(`${window.date}T${time}:00+04:00`);
    expect(instant(window.departure)).toBeLessThanOrEqual(reference.getTime());
    expect(instant(window.arrival) - instant(window.start)).toBe(window.lateness * 60_000);
    expect(window.date).toBe(minute >= 1438 ? '2026-10-31' : '2026-10-30');
  }
  expect(attendanceFixtureWindow(new Date('2026-10-30T23:13:00+04:00'))).toEqual({
    date: '2026-10-30',
    start: '22:48',
    end: '23:33',
    arrival: '23:01',
    departure: '23:11',
    lateness: 13,
  });
});
