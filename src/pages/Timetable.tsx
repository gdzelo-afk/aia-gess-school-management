import { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, Plus, GripVertical, AlertTriangle } from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import type {
  TimetableSetup,
  DraftView,
  TimetableDocument,
  Lesson,
  Occurrence,
  TimetableConflict,
  RequestView,
  LessonChange,
  Availability,
} from '../../shared/timetable';
import { weekdayLabels } from '../../shared/timetable';
import { api, queryClient } from '../lib/api';
import { tbilisiDate } from '../lib/semester';
import { Button, ErrorState, Skeleton, Modal, EmptyState } from '../components/ui';
import { OperationDialog, Field, text } from '../components/Operations';
import '../styles/product-timetable.css';
const shift = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
const monday = (d: string) => shift(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
const post = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
async function command(body: unknown) {
  const result = await post<{ id: string }>('/api/timetable/actions', body);
  await queryClient.invalidateQueries({
    predicate: (q) => ['timetable', 'overview'].includes(String(q.queryKey[0])),
  });
  return result;
}
type Week = {
  items: Occurrence[];
  conflicts: TimetableConflict[];
  children: { id: string; name: string }[];
  overrides?: { key: string; reason: string }[];
};
const toChange = (o: Occurrence): LessonChange => ({
  occurrenceId: o.id,
  expectedRevision: o.revision,
  date: o.date,
  targetDate: o.targetDate,
  teacherId: o.teacherId,
  roomId: o.roomId,
  groupId: o.groupId,
  periodId: o.periodId,
  start: o.start,
  end: o.end,
  cancelled: o.cancelled,
  exceptionalDay: o.exceptionalDay,
});
export function Timetable() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const manage = viewer.capabilities.includes('timetable:manage'),
    request = viewer.capabilities.includes('timetable:request');
  const [yearId, setYearId] = useState(''),
    [versionId, setVersionId] = useState(''),
    [from, setFrom] = useState(
      monday(
        new URLSearchParams(location.search).get('date')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
          tbilisiDate(),
      ),
    ),
    [day, setDay] = useState(0),
    [tab, setTab] = useState('week'),
    [child, setChild] = useState('');
  const [teacher, setTeacher] = useState(''),
    [room, setRoom] = useState(''),
    [group, setGroup] = useState(''),
    [section, setSection] = useState(''),
    [subject, setSubject] = useState(''),
    [dayFilter, setDayFilter] = useState('');
  const [dialog, setDialog] = useState<
      'draft' | 'bell' | 'group' | 'room' | 'publish' | 'availability' | 'extra' | null
    >(null),
    [lesson, setLesson] = useState<Partial<Lesson> | null>(null),
    [selected, setSelected] = useState<Occurrence | null>(null),
    [drag, setDrag] = useState(''),
    [error, setError] = useState(''),
    [feedback, setFeedback] = useState('');
  const [hover, setHover] = useState<{ weekday: number; periodId: string } | null>(null),
    [dropState, setDropState] = useState<'checking' | 'conflict' | 'clear' | 'invalid'>('checking');
  const [move, setMove] = useState<{
    lessonId: string;
    weekday: number;
    periodId: string;
    revision: number;
  } | null>(null);
  const setup = useQuery({
    queryKey: ['timetable', 'setup', yearId],
    queryFn: () => api<TimetableSetup>(`/api/timetable/setup${yearId ? `?yearId=${yearId}` : ''}`),
  });
  const draft = useQuery({
    queryKey: ['timetable', 'draft', versionId],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${versionId}`),
    enabled: !!versionId && manage,
  });
  useEffect(() => {
    if (!drag || !hover || !versionId) return;
    let alive = true;
    const timer = setTimeout(() => {
      void post<{ conflicts: TimetableConflict[] }>('/api/timetable/move-preview', {
        id: versionId,
        revision: draft.data?.revision,
        lessonId: drag,
        ...hover,
      })
        .then((r) => {
          if (alive) setDropState(r.conflicts.length ? 'conflict' : 'clear');
        })
        .catch(() => {
          if (alive) setDropState('invalid');
        });
    }, 220);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [drag, hover, versionId, draft.data?.revision]);
  const week = useQuery({
    queryKey: ['timetable', 'week', from, yearId, child],
    queryFn: () =>
      api<Week>(
        `/api/timetable/week?from=${from}&days=7${yearId ? `&yearId=${yearId}` : ''}${child ? `&studentId=${child}` : ''}`,
      ),
    enabled: !versionId,
  });
  const requests = useQuery({
    queryKey: ['timetable', 'requests'],
    queryFn: () => api<{ items: RequestView[] }>('/api/timetable/requests'),
    enabled: manage || request,
  });
  const available = useQuery({
    queryKey: ['timetable', 'availability'],
    queryFn: () =>
      api<{ items: (Availability & { id: string; revision: number; reason: string })[] }>(
        '/api/timetable/availability',
      ),
    enabled: manage || request,
  });
  const [ending, setEnding] = useState<(Availability & { id: string; revision: number }) | null>(
    null,
  );
  const [review, setReview] = useState<RequestView | null>(null);
  if (setup.isPending) return <Skeleton />;
  if (setup.isError) return <ErrorState onRetry={() => void setup.refetch()} />;
  const data = setup.data,
    doc = draft.data?.document,
    editable = draft.data?.status === 'draft';
  const save = async (document: TimetableDocument) => {
    setError('');
    try {
      await command({
        action: 'draft.save',
        id: versionId,
        revision: draft.data!.revision,
        document,
      });
      setFeedback('სამუშაო ვერსია შენახულია. შეამოწმეთ კონფლიქტები.');
    } catch (e) {
      setError((e as Error).message);
      throw e;
    }
  };
  const names = (l: Lesson) => {
    const g = doc?.groups.find((g) => g.id === l.groupId);
    const offer = data.offerings.find((o) => o.id === g?.sources[0]?.offeringId);
    return {
      group: g?.name ?? '',
      subject: offer?.name ?? '',
      teacher: data.teachers.find((t) => t.id === l.teacherId)?.name ?? '',
      room: data.rooms.find((r) => r.id === l.roomId)?.number ?? '',
      sectionIds:
        g?.sources.map((src) => data.offerings.find((o) => o.id === src.offeringId)?.sectionId) ??
        [],
    };
  };
  const occurrences = week.data?.items ?? [];
  const visible = (item: {
    teacherId: string;
    roomId: string;
    groupId: string;
    subject: string;
    sectionIds: (string | undefined)[];
  }) =>
    (!teacher || item.teacherId === teacher) &&
    (!room || item.roomId === room) &&
    (!group || item.groupId === group) &&
    (!section || item.sectionIds.includes(section)) &&
    (!subject || item.subject === subject);
  const conflicts = versionId ? (draft.data?.conflicts ?? []) : (week.data?.conflicts ?? []);
  const sections = [...new Map(data.offerings.map((o) => [o.sectionId, o.section])).entries()];
  return (
    <div className="timetable-page">
      <header className="page-intro">
        <div>
          <div className="page-kicker">სასწავლო პროცესი · თბილისის დრო</div>
          <h1>გაკვეთილების განრიგი</h1>
          <p>გამოქვეყნებული დღე, სამუშაო ვერსიები და დასაბუთებული ცვლილებები.</p>
        </div>
        <div className="tt-header-actions">
          {manage && <Button onClick={() => setDialog('extra')}>დამატებითი დღე / გაკვეთილი</Button>}
          {manage && (
            <Button onClick={() => setDialog('draft')}>
              <Plus size={16} /> სამუშაო ვერსია
            </Button>
          )}
          <select
            aria-label="განრიგის სასწავლო წელი"
            value={yearId || data.yearId || ''}
            onChange={(e) => {
              setYearId(e.target.value);
              setVersionId('');
            }}
          >
            {data.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </div>
      </header>
      {(manage || request) && (
        <nav className="op-tabs" aria-label="განრიგის ხედები">
          {[
            ['week', 'განრიგი'],
            [
              'requests',
              `მოთხოვნები · ${requests.data?.items.filter((r) => r.state === 'pending').length ?? 0}`,
            ],
            ['availability', 'მიუწვდომლობა'],
            ...(manage ? [['configuration', 'კონფიგურაცია']] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => setTab(id!)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div role="alert" className="tt-alert">
          <p>{error}</p>
          <Button
            onClick={() => {
              void queryClient.invalidateQueries({ queryKey: ['timetable'] });
              setError('');
            }}
          >
            განახლება და გადახედვა
          </Button>
        </div>
      )}
      {drag && hover && (
        <p role="status" className="tt-drag-status">
          {dropState === 'checking'
            ? 'დანიშნულების შემოწმება…'
            : dropState === 'conflict'
              ? 'გადატანა შექმნის კონფლიქტს; დარჩება სამუშაო ვერსიაში.'
              : dropState === 'invalid'
                ? 'ამ პოზიციაში გადატანა დაუშვებელია.'
                : 'პოზიცია შემოწმებულია.'}
        </p>
      )}
      {feedback && (
        <p role="status" className="op-hint">
          {feedback}
        </p>
      )}
      {tab === 'week' && (
        <>
          <div className="tt-toolbar">
            <div className="tt-week-switch">
              <Button aria-label="წინა კვირა" onClick={() => setFrom(shift(from, -7))}>
                <ArrowLeft size={16} />
              </Button>
              <input
                type="date"
                aria-label="განრიგის კვირა"
                value={from}
                onChange={(e) => e.target.value && setFrom(monday(e.target.value))}
              />
              <Button aria-label="შემდეგი კვირა" onClick={() => setFrom(shift(from, 7))}>
                <ArrowRight size={16} />
              </Button>
            </div>
            {manage && (
              <select
                aria-label="განრიგის ვერსია"
                value={versionId}
                onChange={(e) => setVersionId(e.target.value)}
              >
                <option value="">მოქმედი გამოქვეყნებული განრიგი</option>
                {data.versions.map((v) => (
                  <option value={v.id} key={v.id}>
                    {v.status === 'draft' ? 'სამუშაო' : 'გამოქვეყნებული'} · {v.name} · {v.startsOn}
                  </option>
                ))}
              </select>
            )}
            {data.children.length > 0 && (
              <select
                aria-label="შვილის განრიგი"
                value={child}
                onChange={(e) => setChild(e.target.value)}
              >
                <option value="">ყველა ხელმისაწვდომი შვილი</option>
                {data.children.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="tt-filters">
            <select
              aria-label="დღის ფილტრი"
              value={dayFilter}
              onChange={(e) => {
                setDayFilter(e.target.value);
                if (e.target.value) setDay(Number(e.target.value));
              }}
            >
              <option value="">ყველა დღე</option>
              {weekdayLabels.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
            <select
              aria-label="მასწავლებლის ფილტრი"
              value={teacher}
              onChange={(e) => setTeacher(e.target.value)}
            >
              <option value="">ყველა მასწავლებელი</option>
              {(data.teachers.length
                ? data.teachers
                : [
                    ...new Map(
                      occurrences.map((o) => [o.teacherId, { id: o.teacherId, name: o.teacher }]),
                    ).values(),
                  ]
              ).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <select
              aria-label="ოთახის ფილტრი"
              value={room}
              onChange={(e) => setRoom(e.target.value)}
            >
              <option value="">ყველა ოთახი</option>
              {(data.rooms.length
                ? data.rooms
                : [
                    ...new Map(
                      occurrences.map((o) => [o.roomId, { id: o.roomId, number: o.room }]),
                    ).values(),
                  ]
              ).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.number}
                </option>
              ))}
            </select>
            <select
              aria-label="ჯგუფის ფილტრი"
              value={group}
              onChange={(e) => setGroup(e.target.value)}
            >
              <option value="">ყველა ჯგუფი</option>
              {(
                doc?.groups ?? [
                  ...new Map(
                    occurrences.map((o) => [o.groupId, { id: o.groupId, name: o.group }]),
                  ).values(),
                ]
              ).map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
            {manage && (
              <select
                aria-label="კლასის განრიგი"
                value={section}
                onChange={(e) => setSection(e.target.value)}
              >
                <option value="">ყველა კლასი</option>
                {sections.map(([id, name]) => (
                  <option key={id} value={id}>
                    {name}
                  </option>
                ))}
              </select>
            )}
            <select
              aria-label="საგნის ფილტრი"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            >
              <option value="">ყველა საგანი</option>
              {[
                ...new Set(
                  data.offerings.length
                    ? data.offerings.map((o) => o.name)
                    : occurrences.map((o) => o.subject),
                ),
              ].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          {versionId && draft.data && (
            <div className="tt-version">
              <span>
                <strong>
                  {editable
                    ? 'სამუშაო ვერსია — მხოლოდ ადმინისტრაციისთვის'
                    : 'გამოქვეყნებული ვერსიის სტრუქტურა'}
                </strong>
                <small>
                  {draft.data.startsOn} — {draft.data.endsOn} · რედაქცია {draft.data.revision}
                </small>
              </span>
              {editable && (
                <>
                  <Button
                    onClick={() =>
                      setLesson({ weekday: 1, periodId: doc?.periods.find((p) => p.teaching)?.id })
                    }
                  >
                    გაკვეთილის დამატება
                  </Button>
                  <Button variant="primary" onClick={() => setDialog('publish')}>
                    გამოქვეყნება
                  </Button>
                </>
              )}
            </div>
          )}
          {conflicts.length > 0 && (
            <details className="tt-conflict-summary">
              <summary>
                <AlertTriangle size={16} /> {conflicts.length} კონფლიქტი · საჭიროა განხილვა
              </summary>
              <ConflictList conflicts={conflicts} />
              {!versionId && week.data?.overrides?.length && (
                <p className="op-hint">
                  დადასტურებული გამონაკლისები:{' '}
                  {[...new Set(week.data.overrides.map((o) => o.reason))].join(' · ')}
                </p>
              )}
            </details>
          )}
          {versionId ? (
            draft.isPending ? (
              <Skeleton />
            ) : draft.isError ? (
              <ErrorState onRetry={() => void draft.refetch()} />
            ) : (
              <>
                <div className="tt-day-switch" role="group" aria-label="დღის არჩევა">
                  {weekdayLabels.map((label, i) => (
                    <button key={label} aria-pressed={day === i} onClick={() => setDay(i)}>
                      {label.slice(0, 3)}
                    </button>
                  ))}
                </div>
                <div
                  className={`tt-grid ${dayFilter ? 'tt-single-day' : ''}`}
                  aria-label="სამუშაო კვირის რედაქტორი"
                >
                  <div className="tt-grid-corner">პერიოდი</div>
                  {weekdayLabels.map((label, i) => (
                    <div
                      key={label}
                      hidden={!!dayFilter && Number(dayFilter) !== i}
                      className={`tt-column-head ${day === i ? 'tt-mobile-active' : ''}`}
                    >
                      {label}
                    </div>
                  ))}
                  {doc?.periods
                    .sort((a, b) => a.number - b.number)
                    .map((period) => (
                      <div className="tt-grid-row" key={period.id}>
                        <div className="tt-period">
                          <b className="product-number">
                            {period.number.toString().padStart(2, '0')}
                          </b>
                          <span>
                            {period.start}
                            <br />
                            {period.end}
                          </span>
                        </div>
                        {weekdayLabels.map((_, i) => (
                          <div
                            key={i}
                            hidden={!!dayFilter && Number(dayFilter) !== i}
                            data-drop-state={
                              drag && hover?.weekday === i + 1 && hover.periodId === period.id
                                ? dropState
                                : undefined
                            }
                            className={`tt-slot ${day === i ? 'tt-mobile-active' : ''} ${drag ? (period.teaching && period.weekdays.includes(i + 1) ? 'tt-drop-allowed' : 'tt-drop-denied') : ''}`}
                            onDragEnter={(e) => {
                              if (editable && period.teaching && period.weekdays.includes(i + 1))
                                e.preventDefault();
                              if (drag) {
                                setDropState('checking');
                                setHover({ weekday: i + 1, periodId: period.id });
                              }
                            }}
                            onDragOver={(e) => {
                              if (editable && period.teaching && period.weekdays.includes(i + 1))
                                e.preventDefault();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              const id = e.dataTransfer.getData('text/plain');
                              setDrag('');
                              if (
                                editable &&
                                doc &&
                                period.teaching &&
                                period.weekdays.includes(i + 1) &&
                                doc.lessons.some((l) => l.id === id)
                              )
                                setMove({
                                  lessonId: id,
                                  weekday: i + 1,
                                  periodId: period.id,
                                  revision: draft.data!.revision,
                                });
                            }}
                          >
                            {doc.lessons
                              .filter((l) => l.weekday === i + 1 && l.periodId === period.id)
                              .map((l) => ({ l, n: names(l) }))
                              .filter(({ l, n }) => visible({ ...l, ...n }))
                              .map(({ l, n }) => (
                                <button
                                  className={`tt-lesson ${conflicts.some((c) => c.lessonIds.some((id) => id.includes(`:${l.id}:`))) ? 'tt-lesson-conflict' : ''}`}
                                  key={l.id}
                                  draggable={!!editable}
                                  onDragStart={(e) => {
                                    e.dataTransfer.setData('text/plain', l.id);
                                    setDrag(l.id);
                                  }}
                                  onDragEnd={() => setDrag('')}
                                  onClick={() => editable && setLesson(l)}
                                >
                                  <span className="tt-lesson-top">
                                    {n.group}
                                    {editable && <GripVertical size={14} />}
                                  </span>
                                  <strong>{n.subject}</strong>
                                  <span>{n.teacher}</span>
                                  <small>ოთახი {n.room}</small>
                                  {conflicts.some((c) =>
                                    c.lessonIds.some((id) => id.includes(`:${l.id}:`)),
                                  ) && <small>⚠ კონფლიქტი</small>}
                                </button>
                              ))}
                            {editable && period.teaching && period.weekdays.includes(i + 1) && (
                              <button
                                className="tt-add-slot"
                                aria-label={`${weekdayLabels[i]} · ${period.number} · დამატება`}
                                onClick={() => setLesson({ weekday: i + 1, periodId: period.id })}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                </div>
                {!doc?.periods.length && (
                  <EmptyState
                    title="ჯერ დაამატეთ ზარის განრიგი"
                    description="კონფიგურაციაში შექმენით პერიოდები და ჯგუფები; შემდეგ განათავსეთ გაკვეთილები."
                  />
                )}
              </>
            )
          ) : week.isPending ? (
            <Skeleton />
          ) : week.isError ? (
            <ErrorState onRetry={() => void week.refetch()} />
          ) : (
            <PublishedWeek
              dayFilter={dayFilter}
              items={occurrences.filter(visible)}
              from={from}
              day={day}
              setDay={setDay}
              onSelect={setSelected}
            />
          )}
        </>
      )}
      {tab === 'configuration' && manage && (
        <>
          <div className="tt-version">
            <p>
              პერიოდები და ჯგუფები ვერსიის ნაწილია. გამოქვეყნებული ისტორიის შესაცვლელად შექმენით
              ახალი სამუშაო ვერსია.
            </p>
            <select
              aria-label="კონფიგურაციის ვერსია"
              value={versionId}
              onChange={(e) => setVersionId(e.target.value)}
            >
              <option value="">აირჩიეთ სამუშაო ვერსია</option>
              {data.versions.map((v) => (
                <option value={v.id} key={v.id}>
                  {v.name} · {v.status === 'draft' ? 'სამუშაო' : 'გამოქვეყნებული'}
                </option>
              ))}
            </select>
          </div>
          <div className="tt-config">
            <section>
              <h2>ზარის განრიგი</h2>
              <p className="op-hint">
                დროები სადემონსტრაციოა; თითოეული ვერსია ინახავს საკუთარ კონფიგურაციას.
              </p>
              {doc?.periods.map((p) => (
                <div className="tt-config-row" key={p.id}>
                  <strong>
                    {p.number} · {p.start}—{p.end}
                  </strong>
                  <span>{p.teaching ? 'გაკვეთილი' : 'შესვენება'}</span>
                  <small>
                    {p.weekdays.map((d) => weekdayLabels[d - 1]?.slice(0, 3)).join(' · ')}
                  </small>
                </div>
              ))}
              {editable && (
                <Button onClick={() => setDialog('bell')}>პერიოდის დამატება / შეცვლა</Button>
              )}
            </section>
            <section>
              <h2>სასწავლო ჯგუფები</h2>
              {doc?.groups.map((g) => (
                <div className="tt-config-row" key={g.id}>
                  <strong>{g.name}</strong>
                  <small>
                    {g.sources
                      .map((src) => {
                        const o = data.offerings.find((o) => o.id === src.offeringId);
                        return `${o?.section} · ${o?.name} · ${src.studentIds ? `${src.studentIds.length} არჩეული` : 'მოქმედი სია'}`;
                      })
                      .join(' / ')}
                  </small>
                </div>
              ))}
              {editable && (
                <Button onClick={() => setDialog('group')}>ჯგუფის დამატება / შეცვლა</Button>
              )}
            </section>
            <section>
              <h2>ოთახები</h2>
              <p>{data.rooms.map((r) => r.number).join(' · ') || 'ოთახები ჯერ არ არის'}</p>
              <Button onClick={() => setDialog('room')}>ოთახის დამატება</Button>
            </section>
          </div>
        </>
      )}
      {tab === 'availability' && (manage || request) && (
        <>
          <div className="section-heading">
            <h2>{manage ? 'მასწავლებლის მიუწვდომლობა' : 'ჩემი მიუწვდომლობა'}</h2>
            <Button onClick={() => setDialog('availability')}>
              {manage ? 'პერიოდის დამატება' : 'დროებითი მიუწვდომლობის მოთხოვნა'}
            </Button>
          </div>
          <p className="op-hint">
            ეს ჩანაწერი ეხება მხოლოდ განრიგს და არ წარმოადგენს სამუშაო დასწრებას.
          </p>
          {available.isError ? (
            <ErrorState onRetry={() => void available.refetch()} />
          ) : (
            available.data?.items.map((a) => (
              <div className="tt-config-row" key={a.id}>
                <strong>
                  {data.teachers.find((t) => t.id === a.teacherId)?.name ?? viewer.name}
                </strong>
                <span>
                  {a.startsOn} — {a.endsOn} ·{' '}
                  {a.periodNumbers.length ? a.periodNumbers.join(', ') : 'მთელი დღე'}
                </span>
                <small>
                  {a.reason}
                  {a.weekdays ? ` · ${a.weekdays.map((d) => weekdayLabels[d - 1]).join(', ')}` : ''}
                </small>
                <Button
                  onClick={() => {
                    setFrom(monday(a.startsOn));
                    setTeacher(a.teacherId);
                    setVersionId('');
                    setTab('week');
                  }}
                >
                  დაკავშირებული განრიგი
                </Button>
                {manage && a.endsOn > tbilisiDate() && (
                  <Button onClick={() => setEnding(a)}>პერიოდის დასრულება</Button>
                )}
              </div>
            ))
          )}
        </>
      )}
      {tab === 'requests' && (manage || request) && (
        <>
          <h2>განრიგის ცვლილების მოთხოვნები</h2>
          {requests.isPending ? (
            <Skeleton />
          ) : requests.isError ? (
            <ErrorState onRetry={() => void requests.refetch()} />
          ) : requests.data?.items.length ? (
            requests.data.items.map((r) => (
              <button className="tt-request" key={r.id} onClick={() => setReview(r)}>
                <span>
                  <strong>{r.teacher}</strong>
                  <small>{r.reason}</small>
                </span>
                <span>
                  {
                    (
                      {
                        pending: 'განსახილველი',
                        approved: 'დამტკიცებული',
                        denied: 'უარყოფილი',
                        cancelled: 'გაუქმებული',
                      } as Record<string, string>
                    )[r.state]
                  }
                </span>
                <ArrowRight size={16} />
              </button>
            ))
          ) : (
            <EmptyState
              title="მოთხოვნები ჯერ არ არის"
              description="გაკვეთილის დეტალებიდან შეგიძლიათ მოითხოვოთ ცვლილება."
            />
          )}
        </>
      )}
      {ending && (
        <OperationDialog
          title="მიუწვდომლობის დასრულება"
          description="უკვე გასული პერიოდი რჩება ისტორიაში. შეცვლა მოქმედებს არჩეული თარიღიდან."
          onClose={() => setEnding(null)}
          onSave={(f) =>
            command({
              action: 'availability.end',
              id: ending.id,
              revision: ending.revision,
              endsOn: text(f, 'endsOn'),
              reason: text(f, 'reason'),
            })
          }
        >
          <Field
            label="დასრულება (არ შედის)"
            name="endsOn"
            type="date"
            value={[tbilisiDate(), data.years.find((y) => y.id === data.yearId)?.startsOn ?? '']
              .sort()
              .at(-1)}
          />
          <Field label="მიზეზი" name="reason" />
        </OperationDialog>
      )}
      {move && doc && (
        <MoveDialog
          move={move}
          versionId={versionId}
          onClose={() => setMove(null)}
          onSave={async () => {
            await command({
              action: 'draft.save',
              id: versionId,
              revision: move.revision,
              document: {
                ...doc,
                lessons: doc.lessons.map((l) =>
                  l.id === move.lessonId
                    ? { ...l, weekday: move.weekday, periodId: move.periodId }
                    : l,
                ),
              },
            });
            setFeedback('გაკვეთილი გადატანილია სამუშაო ვერსიაში.');
          }}
        />
      )}
      {dialog === 'draft' && (
        <OperationDialog
          title="სამუშაო განრიგი"
          description="სამუშაო ვერსია მოსწავლეებისა და ოჯახებისთვის დამალულია. პერიოდის ბოლო თარიღი არ შედის."
          onClose={() => setDialog(null)}
          onSave={async (f) => {
            const r = await command({
              action: 'draft.create',
              yearId: data.yearId,
              name: text(f, 'name'),
              startsOn: text(f, 'startsOn'),
              endsOn: text(f, 'endsOn'),
              ...(text(f, 'copyId') ? { copyId: text(f, 'copyId') } : {}),
            });
            setVersionId(r.id);
            setTab('week');
          }}
        >
          <Field label="ვერსიის სახელი" name="name" />
          <Field label="დაწყება" name="startsOn" type="date" value={tbilisiDate()} />
          <Field
            label="დასრულება (არ შედის)"
            name="endsOn"
            type="date"
            value={data.years.find((y) => y.id === data.yearId)?.endsOn ?? ''}
          />
          <Field label="არსებული ვერსიის კოპირება" name="copyId" required={false}>
            <option value="">ცარიელი განრიგი</option>
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </Field>
        </OperationDialog>
      )}
      {dialog === 'extra' && (
        <ExtraLesson
          setup={data}
          onClose={() => setDialog(null)}
          onSelect={(o) => {
            setDialog(null);
            setSelected(o);
          }}
        />
      )}
      {dialog === 'room' && (
        <OperationDialog
          title="ოთახის დამატება"
          description="ოთახის ნომერი მონაწილეობს განრიგის კონფლიქტების შემოწმებაში."
          onClose={() => setDialog(null)}
          onSave={(f) => command({ action: 'room.create', number: text(f, 'number') })}
        >
          <Field label="ოთახის ნომერი" name="number" />
        </OperationDialog>
      )}
      {dialog === 'bell' && doc && (
        <BellEditor doc={doc} onClose={() => setDialog(null)} onSave={save} />
      )}
      {dialog === 'group' && doc && (
        <GroupEditor doc={doc} setup={data} onClose={() => setDialog(null)} onSave={save} />
      )}
      {lesson && doc && (
        <OperationDialog
          title={lesson.id ? 'გაკვეთილის რედაქტირება' : 'გაკვეთილის დამატება'}
          description="კონფლიქტები გამოჩნდება სამუშაო ვერსიაში. გამოქვეყნება ცალკე დასტურდება."
          onClose={() => setLesson(null)}
          onSave={async (f) => {
            const item: Lesson = {
              id: lesson.id ?? crypto.randomUUID(),
              groupId: text(f, 'groupId'),
              teacherId: text(f, 'teacherId'),
              roomId: text(f, 'roomId'),
              weekday: Number(text(f, 'weekday')),
              periodId: text(f, 'periodId'),
            };
            await save({
              ...doc,
              lessons: [
                ...doc.lessons.filter((l) => l.id !== item.id),
                ...(text(f, 'remove') === 'on' ? [] : [item]),
              ],
            });
          }}
        >
          <Field label="ჯგუფი" name="groupId" value={lesson.groupId}>
            <option value="">აირჩიეთ ჯგუფი</option>
            {doc.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </Field>
          <TeacherRoom setup={data} teacherId={lesson.teacherId} roomId={lesson.roomId} />
          <Field label="კვირის დღე" name="weekday" value={lesson.weekday}>
            {weekdayLabels.map((d, i) => (
              <option key={d} value={i + 1}>
                {d}
              </option>
            ))}
          </Field>
          <Field label="პერიოდი" name="periodId" value={lesson.periodId}>
            {doc.periods
              .filter((p) => p.teaching)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.number} · {p.start}—{p.end}
                </option>
              ))}
          </Field>
          {lesson.id && (
            <label className="op-check">
              <input type="checkbox" name="remove" /> გაკვეთილის წაშლა სამუშაო ვერსიიდან
            </label>
          )}
        </OperationDialog>
      )}
      {dialog === 'publish' && draft.data && (
        <PublishDialog
          draft={draft.data}
          onClose={() => setDialog(null)}
          onPublished={() => {
            setVersionId('');
            setFeedback('განრიგი გამოქვეყნებულია.');
          }}
        />
      )}
      {selected && (
        <ChangeDialog
          occurrence={selected}
          setup={data}
          manage={manage}
          canRequest={request && selected.teacherId === viewer.personId}
          onClose={() => setSelected(null)}
        />
      )}
      {dialog === 'availability' && (
        <AvailabilityDialog
          setup={data}
          viewer={viewer}
          manage={manage}
          onClose={() => setDialog(null)}
        />
      )}
      {review && (
        <RequestDialog item={review} manage={manage} setup={data} onClose={() => setReview(null)} />
      )}
    </div>
  );
}
function PublishedWeek({
  dayFilter,
  items,
  from,
  day,
  setDay,
  onSelect,
}: {
  dayFilter: string;
  items: Occurrence[];
  from: string;
  day: number;
  setDay: (n: number) => void;
  onSelect: (o: Occurrence) => void;
}) {
  const days = Array.from({ length: 7 }, (_, i) => shift(from, i));
  return (
    <>
      <div className="tt-day-switch" role="group" aria-label="დღის არჩევა">
        {[...weekdayLabels, 'შაბათი', 'კვირა'].map((d, i) => (
          <button key={d} aria-pressed={day === i} onClick={() => setDay(i)}>
            {d.slice(0, 3)}
          </button>
        ))}
      </div>
      <div className={`tt-published-week ${dayFilter ? 'tt-single-day' : ''}`}>
        {days
          .filter((d, i) =>
            dayFilter
              ? i === Number(dayFilter)
              : i < 5 || items.some((o) => o.targetDate === d) || day === i,
          )
          .map((date) => {
            const i = days.indexOf(date);
            return (
              <section key={date} className={`tt-day ${day === i ? 'tt-mobile-active' : ''}`}>
                <header>
                  <strong>{[...weekdayLabels, 'შაბათი', 'კვირა'][i]}</strong>
                  <time className="product-number">{date.slice(5)}</time>
                </header>
                {items
                  .filter((o) => o.targetDate === date)
                  .map((o) => (
                    <button
                      className={`tt-lesson ${o.cancelled ? 'tt-cancelled' : ''}`}
                      key={o.id}
                      onClick={() => onSelect(o)}
                    >
                      <span className="tt-lesson-top product-number">
                        {o.start}—{o.end}
                        <small>{o.number}</small>
                      </span>
                      <strong>{o.subject}</strong>
                      <span>{o.group}</span>
                      <small>
                        {o.teacher} · {o.room}
                      </small>
                      {(o.changed || o.exceptionalDay) && (
                        <em>
                          {o.cancelled
                            ? 'გაუქმებულია'
                            : o.exceptionalDay
                              ? 'საგანგებო დღე'
                              : 'ცვლილება / ჩანაცვლება'}
                        </em>
                      )}
                    </button>
                  ))}
                {!items.some((o) => o.targetDate === date) && (
                  <p className="tt-empty-day">გამოქვეყნებული გაკვეთილი არ არის</p>
                )}
              </section>
            );
          })}
      </div>
    </>
  );
}
function TeacherRoom({
  setup,
  teacherId,
  roomId,
}: {
  setup: TimetableSetup;
  teacherId?: string;
  roomId?: string;
}) {
  return (
    <>
      <Field label="მასწავლებელი" name="teacherId" value={teacherId}>
        <option value="">აირჩიეთ მასწავლებელი</option>
        {setup.teachers.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </Field>
      <Field label="ოთახი" name="roomId" value={roomId}>
        <option value="">აირჩიეთ ოთახი</option>
        {setup.rooms.map((r) => (
          <option key={r.id} value={r.id}>
            {r.number}
          </option>
        ))}
      </Field>
    </>
  );
}
function BellEditor({
  doc,
  onSave,
  onClose,
}: {
  doc: TimetableDocument;
  onSave: (d: TimetableDocument) => Promise<void>;
  onClose: () => void;
}) {
  const [id, setId] = useState('');
  const p = doc.periods.find((p) => p.id === id);
  return (
    <OperationDialog
      key={id}
      title="ზარის პერიოდი"
      description="პერიოდები არ უნდა გადაიფაროს. შესვენებაში გაკვეთილი არ განთავსდება."
      onClose={onClose}
      onSave={(f) =>
        onSave({
          ...doc,
          periods: [
            ...doc.periods.filter((p) => p.id !== id),
            ...(text(f, 'remove') === 'on'
              ? []
              : [
                  {
                    id: id || crypto.randomUUID(),
                    number: Number(text(f, 'number')),
                    start: text(f, 'start'),
                    end: text(f, 'end'),
                    weekdays: f.getAll('weekdays').map(Number),
                    teaching: text(f, 'teaching') === 'on',
                  },
                ]),
          ],
        })
      }
    >
      <label className="op-field">
        <span>არსებული პერიოდი</span>
        <select aria-label="გამოქვეყნებული ვერსია" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">ახალი</option>
          {doc.periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} · {p.start}
            </option>
          ))}
        </select>
      </label>
      <Field
        label="ნომერი"
        name="number"
        type="number"
        value={p?.number ?? doc.periods.length + 1}
      />
      <Field label="დაწყების დრო" name="start" type="time" value={p?.start} />
      <Field label="დასრულების დრო" name="end" type="time" value={p?.end} />
      <div className="tt-checkboxes">
        {weekdayLabels.map((d, i) => (
          <label key={d}>
            <input
              type="checkbox"
              name="weekdays"
              value={i + 1}
              defaultChecked={p ? p.weekdays.includes(i + 1) : true}
            />
            {d}
          </label>
        ))}
      </div>
      <label className="op-check">
        <input type="checkbox" name="teaching" defaultChecked={p?.teaching ?? true} /> სასწავლო
        პერიოდი
      </label>
      {p && (
        <label className="op-check">
          <input type="checkbox" name="remove" /> გამოუყენებელი პერიოდის წაშლა
        </label>
      )}
    </OperationDialog>
  );
}
function GroupEditor({
  doc,
  setup,
  onSave,
  onClose,
}: {
  doc: TimetableDocument;
  setup: TimetableSetup;
  onSave: (d: TimetableDocument) => Promise<void>;
  onClose: () => void;
}) {
  const [id, setId] = useState('');
  const group = doc.groups.find((g) => g.id === id);
  const [offeringIds, setOfferingIds] = useState<string[] | null>(null);
  const chosen = offeringIds ?? group?.sources.map((s) => s.offeringId) ?? [];
  return (
    <OperationDialog
      key={id}
      title="სასწავლო ჯგუფი"
      description="მთლიანი სია გამომდინარეობს კურსის მოქმედი ჩარიცხვიდან. ქვეჯგუფში მხოლოდ არჩეული, მოქმედი წევრები მოხვდებიან. გაერთიანებული კურსები ერთი საგნის უნდა იყოს."
      onClose={onClose}
      onSave={(f) =>
        onSave({
          ...doc,
          groups: [
            ...doc.groups.filter((g) => g.id !== id),
            {
              id: id || crypto.randomUUID(),
              name: text(f, 'name'),
              sources: chosen.map((offeringId) => ({
                offeringId,
                studentIds:
                  text(f, `split-${offeringId}`) === 'on'
                    ? f.getAll(`students-${offeringId}`).map(String)
                    : null,
              })),
            },
          ],
        })
      }
    >
      <label className="op-field">
        <span>არსებული ჯგუფი</span>
        <select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setOfferingIds([]);
          }}
        >
          <option value="">ახალი</option>
          {doc.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <Field label="ჯგუფის სახელი" name="name" value={group?.name} />
      <div className="tt-group-sources">
        <span>კურსები · ერთი ან რამდენიმე კლასი</span>
        {setup.offerings.map((o) => (
          <label key={o.id} className="op-check">
            <input
              type="checkbox"
              checked={chosen.includes(o.id)}
              onChange={(e) =>
                setOfferingIds(
                  e.target.checked ? [...chosen, o.id] : chosen.filter((id) => id !== o.id),
                )
              }
            />
            {o.section} · {o.name}
            {o.elective ? ' · არჩევითი' : ''}
          </label>
        ))}
        {chosen.map((oid) => (
          <fieldset key={oid}>
            <legend>{setup.offerings.find((o) => o.id === oid)?.section}</legend>
            <label className="op-check">
              <input
                type="checkbox"
                name={`split-${oid}`}
                defaultChecked={!!group?.sources.find((s) => s.offeringId === oid)?.studentIds}
              />{' '}
              მხოლოდ არჩეული ქვეჯგუფი
            </label>
            <select
              aria-label={`ქვეჯგუფის მოსწავლეები ${setup.offerings.find((o) => o.id === oid)?.section}`}
              multiple
              name={`students-${oid}`}
              defaultValue={group?.sources.find((s) => s.offeringId === oid)?.studentIds ?? []}
            >
              {setup.students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.number}
                </option>
              ))}
            </select>
            <small>
              Ctrl / Command-ით აირჩიეთ რამდენიმე. მხოლოდ შესაბამის კურსზე მოქმედი წევრები
              ითვლებიან.
            </small>
          </fieldset>
        ))}
      </div>
    </OperationDialog>
  );
}
function ConflictList({ conflicts }: { conflicts: TimetableConflict[] }) {
  return (
    <ul className="tt-conflicts">
      {conflicts.map((c) => (
        <li key={c.key}>
          <strong>{c.date}</strong> {c.message}
          {!c.overridable && <b> · ჯერ შეასწორეთ მონაცემები</b>}
        </li>
      ))}
    </ul>
  );
}
function PublishDialog({
  draft,
  onClose,
  onPublished,
}: {
  draft: DraftView;
  onClose: () => void;
  onPublished: () => void;
}) {
  return (
    <OperationDialog
      title="განრიგის გამოქვეყნება"
      description="გამოქვეყნება შეუქცევადად ინახავს ვერსიას. შემდგომი ცვლილება ახალი ვერსიით ან დათარიღებული გამონაკლისით კეთდება."
      onClose={onClose}
      onSave={async (f) => {
        await command({
          action: 'draft.publish',
          id: draft.id,
          revision: draft.revision,
          overrides:
            text(f, 'override') === 'on'
              ? draft.conflicts.map((c) => ({ key: c.key, reason: text(f, 'reason') }))
              : [],
        });
        onPublished();
      }}
    >
      <p>
        {draft.name} · {draft.startsOn}—{draft.endsOn}
      </p>
      {draft.conflicts.length ? (
        <>
          <ConflictList conflicts={draft.conflicts} />
          <label className="op-check">
            <input name="override" type="checkbox" required /> ვადასტურებ ზემოთ ჩამოთვლილ
            კონფლიქტებს
          </label>
          <Field label="კონფლიქტების დაშვების დასაბუთება" name="reason" />
        </>
      ) : (
        <p>კონფლიქტი ვერ მოიძებნა. გამოქვეყნებისას შემოწმება განმეორდება.</p>
      )}
    </OperationDialog>
  );
}
function ChangeDialog({
  occurrence: o,
  setup,
  manage,
  canRequest,
  onClose,
}: {
  occurrence: Occurrence;
  setup: TimetableSetup;
  manage: boolean;
  canRequest: boolean;
  onClose: () => void;
}) {
  const version = useQuery({
    queryKey: ['timetable', 'draft', o.versionId],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${o.versionId}`),
    enabled: manage,
  });
  if (!manage && !canRequest)
    return (
      <Modal
        open
        onOpenChange={onClose}
        title={o.subject}
        description={`${o.targetDate} · ${o.start}—${o.end}`}
      >
        <p>{o.group}</p>
        <p>
          {o.teacher} · ოთახი {o.room}
        </p>
        <p>
          {o.cancelled
            ? 'გაკვეთილი გაუქმებულია'
            : o.changed
              ? 'განრიგი შეიცვალა'
              : 'გამოქვეყნებული გაკვეთილი'}
        </p>
      </Modal>
    );
  return (
    <ChangesForm
      title={manage ? 'გაკვეთილის ერთჯერადი ცვლილება' : 'ცვლილების მოთხოვნა'}
      changes={[toChange(o)]}
      setup={setup}
      document={version.data?.document}
      onClose={onClose}
      onSave={async (changes, reason, overrides) =>
        command(
          manage
            ? { action: 'exception.apply', changes, reason, overrides }
            : { action: 'request.create', changes, reason, absence: null },
        )
      }
      admin={manage}
    />
  );
}
function ChangesForm({
  title,
  changes: initial,
  setup,
  document,
  onClose,
  onSave,
  admin,
  children,
}: {
  title: string;
  changes: LessonChange[];
  setup: TimetableSetup;
  document?: TimetableDocument;
  onClose: () => void;
  onSave: (
    changes: LessonChange[],
    reason: string,
    overrides: { key: string; reason: string }[],
  ) => Promise<unknown>;
  admin: boolean;
  children?: React.ReactNode;
}) {
  const [changes, setChanges] = useState(initial),
    [reason, setReason] = useState(''),
    [conflicts, setConflicts] = useState<TimetableConflict[] | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  const change = (i: number, patch: Partial<LessonChange>) => {
    setChanges((items) => items.map((c, n) => (n === i ? { ...c, ...patch } : c)));
    setConflicts(null);
    setConfirmed(false);
  };
  return (
    <Modal
      open
      onOpenChange={(v) => !v && !busy && onClose()}
      title={title}
      description="მიზეზი სავალდებულოა. მიმდინარე განრიგი მხოლოდ ადმინისტრაციის დადასტურების შემდეგ შეიცვლება."
      className="op-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          setBusy(true);
          try {
            if (conflicts === null && changes.length) {
              const p = await post<{ conflicts: TimetableConflict[] }>('/api/timetable/preview', {
                changes,
              });
              setConflicts(p.conflicts);
              return;
            }
            await onSave(
              changes,
              reason,
              admin && confirmed ? (conflicts ?? []).map((c) => ({ key: c.key, reason })) : [],
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        {children}
        {changes.map((c, i) => (
          <fieldset className="tt-change-fields" key={c.occurrenceId}>
            <legend>
              {c.date} · {i + 1}
            </legend>
            <div className="op-form-grid">
              <label className="op-field">
                <span>გაკვეთილის თარიღი</span>
                <input
                  type="date"
                  required
                  value={c.targetDate}
                  onChange={(e) => change(i, { targetDate: e.target.value })}
                />
              </label>
              <label className="op-field">
                <span>მასწავლებელი</span>
                <select
                  aria-label={`მასწავლებელი ${i + 1}`}
                  value={c.teacherId}
                  onChange={(e) => change(i, { teacherId: e.target.value })}
                >
                  {setup.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="op-field">
                <span>ოთახი</span>
                <select value={c.roomId} onChange={(e) => change(i, { roomId: e.target.value })}>
                  {setup.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number}
                    </option>
                  ))}
                </select>
              </label>
              {document && (
                <>
                  <label className="op-field">
                    <span>ჯგუფი / კურსი</span>
                    <select
                      value={c.groupId}
                      onChange={(e) => change(i, { groupId: e.target.value })}
                    >
                      {document.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="op-field">
                    <span>პერიოდი</span>
                    <select
                      value={c.periodId}
                      onChange={(e) => {
                        const p = document.periods.find((p) => p.id === e.target.value)!;
                        change(i, { periodId: p.id, start: p.start, end: p.end });
                      }}
                    >
                      {document.periods
                        .filter((p) => p.teaching)
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.number} · {p.start}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              )}
              {(['start', 'end'] as const).map((key) => (
                <label key={key} className="op-field">
                  <span>{key === 'start' ? 'დაწყების დრო' : 'დასრულების დრო'}</span>
                  <input
                    type="time"
                    value={c[key]}
                    required
                    onChange={(e) => change(i, { [key]: e.target.value })}
                  />
                </label>
              ))}
              <label className="op-check">
                <input
                  type="checkbox"
                  checked={c.cancelled}
                  onChange={(e) => change(i, { cancelled: e.target.checked })}
                />{' '}
                გაკვეთილის გაუქმება
              </label>
              {admin && (
                <label className="op-check">
                  <input
                    type="checkbox"
                    checked={c.exceptionalDay}
                    onChange={(e) => change(i, { exceptionalDay: e.target.checked })}
                  />{' '}
                  არასასწავლო დღეს გაკვეთილის აშკარა დაშვება
                </label>
              )}
            </div>
          </fieldset>
        ))}
        <label className="op-field">
          <span>მიზეზი / გადაწყვეტილება</span>
          <textarea
            required
            minLength={8}
            maxLength={1000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {conflicts !== null && (
          <>
            <p className="op-hint">
              {conflicts.length
                ? 'კონფლიქტები გამოვლინდა.'
                : 'შემოწმება დასრულებულია — კონფლიქტი არ არის.'}
            </p>
            <ConflictList conflicts={conflicts} />
            {admin && conflicts.length > 0 && (
              <label className="op-check">
                <input
                  type="checkbox"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />{' '}
                ვადასტურებ ზუსტ კონფლიქტებს მითითებული მიზეზით
              </label>
            )}
          </>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <footer className="op-form-actions">
          <Button type="button" onClick={onClose}>
            გაუქმება
          </Button>
          <Button variant="primary" disabled={busy}>
            {busy
              ? 'მოწმდება…'
              : conflicts === null && changes.length
                ? 'შემოწმება'
                : admin
                  ? 'დადასტურება და შენახვა'
                  : 'მოთხოვნის გაგზავნა'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
function AvailabilityDialog({
  setup,
  viewer,
  manage,
  onClose,
}: {
  setup: TimetableSetup;
  viewer: Viewer;
  manage: boolean;
  onClose: () => void;
}) {
  const [a, setA] = useState<Availability>({
      teacherId: manage ? (setup.teachers[0]?.id ?? '') : viewer.personId!,
      startsOn: tbilisiDate(),
      endsOn: shift(tbilisiDate(), 2),
      weekdays: null,
      periodNumbers: [],
    }),
    [reason, setReason] = useState(''),
    [items, setItems] = useState<Occurrence[] | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const patch = (p: Partial<Availability>) => {
    setA({ ...a, ...p });
    setItems(null);
  };
  return (
    <Modal
      open
      onOpenChange={onClose}
      title="მასწავლებლის მიუწვდომლობა"
      description="ბოლო თარიღი არ შედის. პერიოდის არჩევის გარეშე მიუწვდომლობა სრულ დღეს მოიცავს."
      className="op-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError('');
          try {
            if (!items) {
              setItems((await post<{ items: Occurrence[] }>('/api/timetable/affected', a)).items);
              return;
            }
            await command(
              manage
                ? { action: 'availability.create', availability: a, reason }
                : { action: 'request.create', absence: a, changes: [], reason },
            );
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div className="op-form-grid">
          {manage && (
            <label className="op-field">
              <span>მასწავლებელი</span>
              <select aria-label="მასწავლებელი" value={a.teacherId} onChange={(e) => patch({ teacherId: e.target.value })}>
                {setup.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(['startsOn', 'endsOn'] as const).map((key) => (
            <label key={key} className="op-field">
              <span>{key === 'startsOn' ? 'დაწყება' : 'დასრულება (არ შედის)'}</span>
              <input
                type="date"
                required
                value={a[key]}
                onChange={(e) => patch({ [key]: e.target.value })}
              />
            </label>
          ))}
          {manage && (
            <label className="op-field">
              <span>კვირის დღე</span>
              <select
                value={a.weekdays?.[0] ?? ''}
                onChange={(e) =>
                  patch({ weekdays: e.target.value ? [Number(e.target.value)] : null })
                }
              >
                <option value="">ყველა დღე · დროებითი</option>
                {weekdayLabels.map((d, i) => (
                  <option key={d} value={i + 1}>
                    {d} · ყოველკვირეული
                  </option>
                ))}
              </select>
            </label>
          )}
          <fieldset className="tt-checkboxes">
            <legend>პერიოდები · ცარიელი = მთელი დღე</legend>
            {Array.from({ length: 12 }, (_, i) => (
              <label key={i}>
                <input
                  type="checkbox"
                  checked={a.periodNumbers.includes(i + 1)}
                  onChange={(e) =>
                    patch({
                      periodNumbers: e.target.checked
                        ? [...a.periodNumbers, i + 1]
                        : a.periodNumbers.filter((n) => n !== i + 1),
                    })
                  }
                />
                {i + 1}
              </label>
            ))}
          </fieldset>
        </div>
        <label className="op-field">
          <span>მიზეზი</span>
          <textarea
            minLength={8}
            maxLength={1000}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </label>
        {items && (
          <div className="tt-affected">
            <h3>დაკავშირებული გაკვეთილები · {items.length}</h3>
            {items.map((o) => (
              <p key={o.id}>
                {o.targetDate} · {o.start} · {o.group} · {o.subject}
              </p>
            ))}
            {manage && (
              <p>
                შენახვის შემდეგ ეს გაკვეთილები განრიგში კონფლიქტად გამოჩნდება. თითოეულის ცვლილება
                გაკვეთილის დეტალებიდან მართეთ.
              </p>
            )}
          </div>
        )}
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <footer className="op-form-actions">
          <Button type="button" onClick={onClose}>
            გაუქმება
          </Button>
          <Button variant="primary" disabled={busy}>
            {!items
              ? 'დაკავშირებული გაკვეთილების ნახვა'
              : manage
                ? 'მიუწვდომლობის დადასტურება'
                : 'მოთხოვნის გაგზავნა'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
function RequestDialog({
  item: r,
  manage,
  setup,
  onClose,
}: {
  item: RequestView;
  manage: boolean;
  setup: TimetableSetup;
  onClose: () => void;
}) {
  const affected = useQuery({
    queryKey: ['timetable', 'affected', r.id],
    queryFn: () => post<{ items: Occurrence[] }>('/api/timetable/affected', r.absence),
    enabled: !!r.absence && r.state === 'pending',
  });
  const [deny, setDeny] = useState(false);
  if (r.state !== 'pending')
    return (
      <Modal open onOpenChange={onClose} title="მოთხოვნის ისტორია" description={r.teacher}>
        <p>{r.reason}</p>
        <p>{r.decision}</p>
      </Modal>
    );
  if (!manage || deny)
    return (
      <OperationDialog
        title={manage ? 'მოთხოვნის უარყოფა' : 'მოთხოვნის გაუქმება'}
        description={r.reason}
        onClose={onClose}
        onSave={(f) =>
          command(
            manage
              ? {
                  action: 'request.decide',
                  id: r.id,
                  revision: r.revision,
                  approve: false,
                  reason: text(f, 'reason'),
                  changes: [],
                  overrides: [],
                }
              : {
                  action: 'request.cancel',
                  id: r.id,
                  revision: r.revision,
                  reason: text(f, 'reason'),
                },
          )
        }
      >
        <Field label="გადაწყვეტილების მიზეზი" name="reason" />
      </OperationDialog>
    );
  if (r.absence && affected.isPending)
    return (
      <Modal
        open
        onOpenChange={onClose}
        title="დაკავშირებული გაკვეთილები"
        description="მოთხოვნის მოქმედი გაკვეთილები იტვირთება."
      >
        <Skeleton />
      </Modal>
    );
  if (affected.isError)
    return (
      <Modal
        open
        onOpenChange={onClose}
        title="მოთხოვნის გადახედვა"
        description="გაკვეთილების ჩატვირთვა ვერ მოხერხდა."
      >
        <ErrorState onRetry={() => void affected.refetch()} />
      </Modal>
    );
  const changes = [
    ...r.changes,
    ...(affected.data?.items ?? [])
      .filter((o) => !r.changes.some((c) => c.occurrenceId === o.id))
      .map((o) => ({ ...toChange(o), cancelled: true })),
  ];
  return (
    <ChangesForm
      title="მოთხოვნის განხილვა"
      changes={changes}
      setup={setup}
      admin
      onClose={onClose}
      onSave={(changes, reason, overrides) =>
        command({
          action: 'request.decide',
          id: r.id,
          revision: r.revision,
          approve: true,
          reason,
          changes,
          overrides,
        })
      }
    >
      <p>
        <strong>{r.teacher}</strong> · {r.reason}
      </p>
      <p className="op-hint">
        მიუწვდომლობის გაკვეთილები საწყისად გაუქმებისთვის არის მონიშნული. ჩანაცვლებისთვის მოხსენით
        ნიშანი და აირჩიეთ მოქმედი მასწავლებელი.
      </p>
      <Button type="button" onClick={() => setDeny(true)}>
        უარყოფა
      </Button>
    </ChangesForm>
  );
}
function ExtraLesson({
  setup,
  onClose,
  onSelect,
}: {
  setup: TimetableSetup;
  onClose: () => void;
  onSelect: (o: Occurrence) => void;
}) {
  const [id, setId] = useState(setup.versions.find((v) => v.status === 'published')?.id ?? '');
  const version = useQuery({
    queryKey: ['timetable', 'draft', id],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${id}`),
    enabled: !!id,
  });
  return (
    <OperationDialog
      title="დამატებითი / საგანგებო გაკვეთილი"
      description="არსებული გაკვეთილის ჯგუფი და კურსი გამოიყენება შერჩეულ თარიღში. დროები და შემცვლელი შემდეგ ნაბიჯზე დასტურდება. არასასწავლო დღე აშკარად მოინიშნება."
      onClose={onClose}
      onSave={async (f) => {
        const o = await api<Occurrence>(
          `/api/timetable/template?versionId=${id}&lessonId=${text(f, 'lessonId')}&date=${text(f, 'date')}`,
        );
        onSelect(o);
      }}
    >
      <label className="op-field">
        <span>გამოქვეყნებული ვერსია</span>
        <select aria-label="გამოქვეყნებული ვერსია" value={id} onChange={(e) => setId(e.target.value)}>
          {setup.versions
            .filter((v) => v.status === 'published')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </select>
      </label>
      <Field label="თარიღი" name="date" type="date" value={tbilisiDate()} />
      <Field label="საბაზო გაკვეთილი" name="lessonId">
        <option value="">აირჩიეთ</option>
        {version.data?.document.lessons.map((l) => (
          <option key={l.id} value={l.id}>
            {version.data.document.groups.find((g) => g.id === l.groupId)?.name} ·{' '}
            {weekdayLabels[l.weekday - 1]} ·{' '}
            {version.data.document.periods.find((p) => p.id === l.periodId)?.number}
          </option>
        ))}
      </Field>
    </OperationDialog>
  );
}

function MoveDialog({
  move,
  versionId,
  onClose,
  onSave,
}: {
  move: { lessonId: string; weekday: number; periodId: string; revision: number };
  versionId: string;
  onClose: () => void;
  onSave: () => Promise<void>;
}) {
  const preview = useQuery({
    queryKey: ['timetable', 'move-preview', versionId, move],
    queryFn: () =>
      post<{ conflicts: TimetableConflict[] }>('/api/timetable/move-preview', {
        id: versionId,
        ...move,
      }),
    retry: false,
  });
  return (
    <OperationDialog
      title="გაკვეთილის გადატანა"
      description="სერვერი ამოწმებს არჩეულ პოზიციას. კონფლიქტიანი ცვლილება დარჩება პირად სამუშაო ვერსიაში; გამოქვეყნებას ცალკე განხილვა სჭირდება."
      onClose={onClose}
      onSave={async () => {
        if (!preview.data) throw Error('ჯერ დაელოდეთ წარმატებულ შემოწმებას.');
        await onSave();
      }}
    >
      {preview.isPending ? (
        <Skeleton rows={2} />
      ) : preview.isError ? (
        <ErrorState onRetry={() => void preview.refetch()} />
      ) : (
        <>
          <p>
            {weekdayLabels[move.weekday - 1]} ·{' '}
            {preview.data.conflicts.length ? 'პოზიციას აქვს კონფლიქტები' : 'პოზიცია შემოწმებულია'}
          </p>
          <ConflictList conflicts={preview.data.conflicts} />
          {preview.data.conflicts.length > 0 && (
            <label className="op-check">
              <input type="checkbox" required /> ვტოვებ ჩამოთვლილ კონფლიქტებს სამუშაო ვერსიაში
              გადასაწყვეტად
            </label>
          )}
        </>
      )}
    </OperationDialog>
  );
}
