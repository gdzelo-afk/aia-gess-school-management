import { describe, it, expect } from 'vitest';
import { schoolTime } from '../src/lib/school-time';
describe('Tbilisi dashboard clock', () => {
  it.each([
    ['2026-09-27T19:59:00Z', '2026-09-27', 'გამარჯობა', 'კვირა, 27 სექტემბერი'],
    ['2026-09-27T20:00:00Z', '2026-09-28', 'გამარჯობა', 'ორშაბათი, 28 სექტემბერი'],
    ['2026-09-28T01:00:00Z', '2026-09-28', 'დილა მშვიდობისა', 'ორშაბათი, 28 სექტემბერი'],
    ['2026-09-28T08:00:00Z', '2026-09-28', 'შუადღე მშვიდობისა', 'ორშაბათი, 28 სექტემბერი'],
    ['2026-09-28T14:00:00Z', '2026-09-28', 'საღამო მშვიდობისა', 'ორშაბათი, 28 სექტემბერი'],
    ['2026-12-31T20:00:00Z', '2027-01-01', 'გამარჯობა', 'პარასკევი, 1 იანვარი'],
  ])('uses school time across date/greeting boundaries: %s', (instant, date, greeting, label) => {
    expect(schoolTime(new Date(instant))).toMatchObject({ date, greeting, fullLabel: label });
  });
});
