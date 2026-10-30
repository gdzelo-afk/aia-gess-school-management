import { schoolDateAt } from '../../shared/attendance';

function minuteAt(now: Date) {
  const [hour, minute] = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(now)
    .split(':')
    .map(Number);
  return hour! * 60 + minute!;
}
const time = (minute: number) =>
  `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;

// The real roll-call journey needs distinct arrival/departure minutes and enough
// time to apply its current-day fixture before that day becomes historical.
export function attendanceFixtureWait(now: Date) {
  const minute = minuteAt(now);
  if (minute >= 2 && minute < 1438) return 0;
  return (
    ((minute < 2 ? 2 : 1442) - minute) * 60_000 -
    now.getUTCSeconds() * 1000 -
    now.getUTCMilliseconds() +
    100
  );
}

export function attendanceFixtureWindow(now: Date) {
  if (attendanceFixtureWait(now)) throw new Error('Wait for the safe attendance fixture window');
  const minute = minuteAt(now);
  const start = Math.max(0, minute - 25);
  const lateness = Math.min(13, minute - start - 1);
  const arrival = start + lateness;
  return {
    date: schoolDateAt(now),
    start: time(start),
    end: time(Math.min(1439, minute + 20)),
    arrival: time(arrival),
    departure: time(Math.max(arrival + 1, minute - 2)),
    lateness,
  };
}
