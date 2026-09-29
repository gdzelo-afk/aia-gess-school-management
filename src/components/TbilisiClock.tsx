import { useEffect, useState } from 'react';

const schoolTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Tbilisi',
  hourCycle: 'h23',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

// Keep the one-second update local to the clock, not the application shell.
export function TbilisiClock() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return (
    <span className="tbilisi-clock" aria-live="off">
      თბილისი <span aria-hidden="true">·</span>
      <time dateTime={now.toISOString()}>{schoolTime.format(now)}</time>
    </span>
  );
}
