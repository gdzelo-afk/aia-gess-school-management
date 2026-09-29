const months = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];
/** Georgian remains Georgian even on browsers built without Georgian ICU data. */
export function dateLabel(date: string): string {
  const [year, month, day] = date.split('-').map(Number);
  if (!year || !month || !day || month < 1 || month > 12 || day < 1 || day > 31)
    return 'თარიღი უცნობია';
  return `${day} ${months[month - 1]}`;
}
export function money(tetri: number): string {
  if (!Number.isSafeInteger(tetri)) throw new Error('Money must be safe integer tetri.');
  const amount = Math.abs(tetri);
  const units = Math.floor(amount / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
  return `${tetri < 0 ? '−' : ''}${units},${String(amount % 100).padStart(2, '0')}\u00a0₾`;
}
export const initials = (name: string) =>
  name
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('');
