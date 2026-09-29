import type { SemesterRecord } from '../../shared/stage1a';

export function tbilisiDate(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
const day = (value: string) => Date.parse(`${value}T00:00:00Z`);
export function semesterProgress(terms: SemesterRecord[], on: string) {
  const ordered = terms
    .filter((t) => Number.isFinite(day(t.startsOn)) && day(t.endsOn) > day(t.startsOn))
    .sort((a, b) => a.startsOn.localeCompare(b.startsOn));
  if (!ordered.length || !Number.isFinite(day(on))) return null;
  const matches = ordered.filter((t) => t.startsOn <= on && on < t.endsOn);
  const term =
    matches.length === 1
      ? matches[0]
      : matches.length > 1
        ? undefined
        : on < ordered[0]!.startsOn
          ? ordered[0]
          : on >= ordered.at(-1)!.endsOn
            ? ordered.at(-1)
            : undefined;
  if (!term) return null;
  const percent = Math.max(
    0,
    Math.min(100, ((day(on) - day(term.startsOn)) / (day(term.endsOn) - day(term.startsOn))) * 100),
  );
  return { term, percent };
}
