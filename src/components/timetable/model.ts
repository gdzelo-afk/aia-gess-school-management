import type {
  DraftView,
  TimetableDocument,
  TimetableSetup,
  Lesson,
  Occurrence,
  TimetableConflict,
  VersionSummary,
} from '../../../shared/timetable';
export type Lens = {
  kind: 'section' | 'group' | 'teacher' | 'room' | 'school' | 'own';
  id: string;
  name: string;
};
export type WeekView = {
  items: Occurrence[];
  conflicts: TimetableConflict[];
  children: { id: string; name: string }[];
  versions: VersionSummary[];
  overrides: { key: string; reason: string }[];
  days: { date: string; startsOn: string; endsOn: string; periods: TimetableDocument['periods'] }[];
};
export type Tile = {
  id: string;
  lessonId: string;
  weekday: number;
  number: number;
  start: string;
  end: string;
  subject: string;
  group: string;
  groupId: string;
  teacher: string;
  teacherId: string;
  room: string;
  roomId: string;
  sectionIds: string[];
  occurrence?: Occurrence;
  lesson?: Lesson;
  changed: boolean;
  cancelled: boolean;
};
export function tiles(doc: TimetableDocument, setup: TimetableSetup): Tile[] {
  return doc.lessons.map((l) => {
    const g = doc.groups.find((g) => g.id === l.groupId);
    const p = doc.periods.find((p) => p.id === l.periodId)!;
    const sources =
      g?.sources
        .map((s) => setup.offerings.find((o) => o.id === s.offeringId))
        .filter((o) => !!o) ?? [];
    return {
      id: l.id,
      lessonId: l.id,
      weekday: l.weekday,
      number: p.number,
      start: p.start,
      end: p.end,
      subject: sources[0]?.name ?? 'საგანი',
      group: g?.name ?? '',
      groupId: l.groupId,
      teacher: setup.teachers.find((t) => t.id === l.teacherId)?.name ?? '',
      teacherId: l.teacherId,
      room: setup.rooms.find((r) => r.id === l.roomId)?.number ?? '',
      roomId: l.roomId,
      sectionIds: sources.map((o) => o.sectionId),
      lesson: l,
      changed: false,
      cancelled: false,
    };
  });
}
export function fromOccurrence(o: Occurrence): Tile {
  return {
    ...o,
    lessonId: o.lessonId,
    weekday: ((new Date(o.targetDate + 'T12:00:00Z').getUTCDay() + 6) % 7) + 1,
    occurrence: o,
  };
}
export function inLens(t: Tile, lens: Lens) {
  return (
    lens.kind === 'own' ||
    lens.kind === 'school' ||
    (lens.kind === 'section'
      ? t.sectionIds.includes(lens.id)
      : lens.kind === 'group'
        ? t.groupId === lens.id
        : lens.kind === 'teacher'
          ? t.teacherId === lens.id
          : t.roomId === lens.id)
  );
}
export function lenses(setup: TimetableSetup, items: Tile[]): Lens[] {
  const result: Lens[] = [
    ...new Map(
      setup.offerings.map((o) => [
        o.sectionId,
        { kind: 'section' as const, id: o.sectionId, name: o.section },
      ]),
    ).values(),
    ...setup.teachers.map((t) => ({ kind: 'teacher' as const, id: t.id, name: t.name })),
    ...setup.rooms.map((r) => ({ kind: 'room' as const, id: r.id, name: `ოთახი ${r.number}` })),
    ...new Map(
      items.map((t) => [t.groupId, { kind: 'group' as const, id: t.groupId, name: t.group }]),
    ).values(),
  ];
  return result;
}
export const lensLabels = {
  section: 'კლასი',
  group: 'ჯგუფი',
  teacher: 'მასწავლებელი',
  room: 'ოთახი',
  school: 'სკოლა',
  own: 'ჩემი განრიგი',
};
export type Difference = { id: string; kind: string; title: string; before: string; after: string };
export function compareDraft(
  draft: DraftView,
  base: DraftView | undefined,
  setup: TimetableSetup,
): Difference[] {
  const before = base ? tiles(base.document, setup) : [],
    after = tiles(draft.document, setup),
    diff: Difference[] = [];
  const detail = (t: Tile) =>
    `${['ორშაბათი', 'სამშაბათი', 'ოთხშაბათი', 'ხუთშაბათი', 'პარასკევი'][t.weekday - 1]} · ${t.number} / ${t.start} · ${t.group} · ${t.teacher} · ${t.room}`;
  for (const a of after) {
    const b = before.find((b) => b.id === a.id);
    if (!b)
      diff.push({ id: a.id, kind: 'დამატება', title: a.subject, before: '—', after: detail(a) });
    else if (
      JSON.stringify(a.lesson) !== JSON.stringify(b.lesson) ||
      a.start !== b.start ||
      a.end !== b.end ||
      a.group !== b.group
    )
      diff.push({
        id: a.id,
        kind: a.weekday !== b.weekday || a.number !== b.number ? 'გადატანა' : 'ცვლილება',
        title: a.subject,
        before: detail(b),
        after: detail(a),
      });
  }
  for (const b of before)
    if (!after.some((a) => a.id === b.id))
      diff.push({ id: b.id, kind: 'წაშლა', title: b.subject, before: detail(b), after: '—' });
  if (JSON.stringify(draft.document.periods) !== JSON.stringify(base?.document.periods ?? []))
    diff.push({
      id: 'periods',
      kind: 'კონფიგურაცია',
      title: 'ზარის განრიგი',
      before:
        base?.document.periods.map((p) => `${p.number} · ${p.start}–${p.end}`).join(' / ') || '—',
      after: draft.document.periods.map((p) => `${p.number} · ${p.start}–${p.end}`).join(' / '),
    });
  for (const g of draft.document.groups) {
    const b = base?.document.groups.find((b) => b.id === g.id);
    if (JSON.stringify(g) !== JSON.stringify(b))
      diff.push({
        id: g.id,
        kind: 'ჯგუფი',
        title: g.name,
        before: b ? `${b.name} · ${b.sources.length} კურსი` : '—',
        after: g.sources
          .map(
            (s) =>
              `${setup.offerings.find((o) => o.id === s.offeringId)?.section ?? ''} · ${s.studentIds ? `${s.studentIds.length} არჩეული მოსწავლე` : 'კურსის სრული სია'}`,
          )
          .join(' / '),
      });
  }
  for (const g of base?.document.groups ?? [])
    if (!draft.document.groups.some((a) => a.id === g.id))
      diff.push({ id: g.id, kind: 'ჯგუფის წაშლა', title: g.name, before: g.name, after: '—' });
  return diff;
}
