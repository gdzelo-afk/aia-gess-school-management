import { it, expect } from 'vitest';
import { compareDraft, tiles, inLens } from '../src/components/timetable/model';
import type { DraftView, TimetableSetup } from '../shared/timetable';
const setup: TimetableSetup = {
  yearId: 'year',
  years: [],
  versions: [],
  rooms: [
    { id: 'room', number: '101' },
    { id: 'other', number: '102' },
  ],
  teachers: [{ id: 'teacher', name: 'მარიამი' }],
  offerings: [
    {
      id: 'course',
      name: 'ქართული ენა',
      sectionId: 'section',
      section: 'VII ა',
      elective: false,
      subjectId: 'subject',
    },
  ],
  students: [],
  children: [],
};
const base: DraftView = {
  id: 'version',
  name: 'საწყისი',
  startsOn: '2026-10-05',
  endsOn: '2026-10-12',
  revision: 1,
  status: 'published',
  conflicts: [],
  document: {
    periods: [
      {
        id: 'period',
        number: 1,
        start: '09:00',
        end: '09:45',
        weekdays: [1, 2, 3, 4, 5],
        teaching: true,
      },
    ],
    groups: [
      {
        id: 'group',
        name: 'VII ა · ქართული',
        sources: [{ offeringId: 'course', studentIds: null }],
      },
    ],
    lessons: [
      {
        id: 'lesson',
        groupId: 'group',
        teacherId: 'teacher',
        roomId: 'room',
        weekday: 1,
        periodId: 'period',
      },
    ],
  },
};
it('comparison identifies a move and resource change with readable before/after values', () => {
  const d = structuredClone(base);
  Object.assign(d.document.lessons[0]!, { weekday: 2, roomId: 'other' });
  const result = compareDraft(d, base, setup);
  expect(result).toHaveLength(1);
  expect(result[0]).toMatchObject({ kind: 'გადატანა', title: 'ქართული ენა' });
  expect(result[0]!.before).toContain('ორშაბათი');
  expect(result[0]!.after).toContain('სამშაბათი');
  expect(result[0]!.after).toContain('102');
  expect(result[0]!.after).not.toContain('teacher');
});
it('comparison includes added/removed lessons and changed bell times', () => {
  const d = structuredClone(base);
  d.document.lessons[0]!.id = 'new-lesson';
  expect(compareDraft(d, base, setup).map((d) => d.kind)).toEqual(['დამატება', 'წაშლა']);
  d.document.lessons[0]!.id = 'lesson';
  d.document.periods[0]!.start = '09:05';
  expect(compareDraft(d, base, setup).map((d) => d.kind)).toEqual(['ცვლილება', 'კონფიგურაცია']);
});
it('lenses preserve the same underlying lesson identity and do not invent empty slots', () => {
  const [t] = tiles(base.document, setup);
  expect(t!.id).toBe('lesson');
  for (const [kind, id] of [
    ['section', 'section'],
    ['teacher', 'teacher'],
    ['room', 'room'],
    ['group', 'group'],
  ] as const) {
    expect(inLens(t!, { kind, id, name: '' })).toBe(true);
    expect(inLens(t!, { kind, id: 'unrelated', name: '' })).toBe(false);
  }
});
