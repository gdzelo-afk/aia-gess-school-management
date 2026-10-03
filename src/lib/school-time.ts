import { dateLabel } from './format';
const weekdays = [
  'კვირა',
  'ორშაბათი',
  'სამშაბათი',
  'ოთხშაბათი',
  'ხუთშაბათი',
  'პარასკევი',
  'შაბათი',
];
/** IANA's Tbilisi identifier is Asia/Tbilisi. Never use the browser's local zone. */
export function schoolTime(now: Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tbilisi',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  const date = `${part('year')}-${part('month')}-${part('day')}`;
  const hour = Number(part('hour'));
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return {
    date,
    day: part('day'),
    month: part('month'),
    year: part('year'),
    label: dateLabel(date),
    fullLabel: `${weekdays[weekday]}, ${dateLabel(date)}`,
    greeting:
      hour >= 5 && hour < 12
        ? 'დილა მშვიდობისა'
        : hour >= 12 && hour < 18
          ? 'შუადღე მშვიდობისა'
          : hour >= 18 && hour < 23
            ? 'საღამო მშვიდობისა'
            : 'გამარჯობა',
  };
}
