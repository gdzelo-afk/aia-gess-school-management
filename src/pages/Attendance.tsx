import { useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  Minus,
  Clock3,
  Search,
  ShieldCheck,
  AlertTriangle,
  Plus,
} from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import {
  attendanceLabels,
  schoolInstant,
  type AttendanceCommand,
  type AttendanceEntry,
} from '../../shared/attendance';
import { api } from '../lib/api';
import { tbilisiDate } from '../lib/semester';
import { dateLabel } from '../lib/format';
import { Button, IconButton, Modal, Skeleton, ErrorState, EmptyState } from '../components/ui';
import { RollCall } from '../components/attendance/RollCall';
import {
  type RangeView,
  type QueuesView,
  type LessonView,
  dayLabels,
  decisionLabels,
  command,
  shiftDate,
  timestamp,
} from '../components/attendance/model';
import '../styles/product-attendance.css';

type QueueItem =
  | { kind: 'explanation'; value: QueuesView['explanations'][number] }
  | { kind: 'request'; value: QueuesView['requests'][number] };
export function Attendance() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const school = viewer.capabilities.includes('attendance:school'),
    manage = viewer.capabilities.includes('attendance:manage'),
    teaching = viewer.capabilities.includes('attendance:own'),
    explain = viewer.capabilities.includes('attendance:explain');
  const family = !school && !teaching;
  const [params, setParams] = useSearchParams();
  const [date, setDate] = useState(
    () => params.get('date')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ?? tbilisiDate(),
  );
  const [tab, setTab] = useState(family ? 'history' : 'today'),
    [child, setChild] = useState(params.get('student') ?? ''),
    [search, setSearch] = useState(''),
    [filter, setFilter] = useState(''),
    [review, setReview] = useState<QueueItem | null>(null),
    [create, setCreate] = useState(false),
    [feedback, setFeedback] = useState('');
  const month = tab === 'history';
  const from = month ? date.slice(0, 7) + '-01' : date;
  const days = month
    ? new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate()
    : 1;
  const enabled = viewer.capabilities.some((c) => c.startsWith('attendance:'));
  const range = useQuery({
    queryKey: ['attendance', 'range', from, days, child],
    queryFn: () =>
      api<RangeView>(
        `/api/attendance/range?from=${from}&days=${days}${child ? '&studentId=' + child : ''}`,
      ),
    enabled,
    refetchInterval: 60000,
  });
  const queues = useQuery({
    queryKey: ['attendance', 'queues'],
    queryFn: () => api<QueuesView>('/api/attendance/queues'),
    enabled: enabled && (manage || explain || teaching),
  });
  const occurrenceId = params.get('lesson');
  if (!enabled)
    return (
      <EmptyState
        denied
        title="დასწრებაზე წვდომა შეზღუდულია"
        description="ამ ანგარიშს დასწრების ნახვის უფლება არ აქვს."
      />
    );
  const openLesson = (id: string) => setParams({ lesson: id, date });
  if (occurrenceId)
    return (
      <section className="attendance-workspace" aria-label="დასწრება">
        <RollCall id={occurrenceId} onClose={() => setParams({ date })} />
      </section>
    );
  const data = range.data;
  const children = data?.children ?? [];
  const selectedChild = child || children[0]?.studentId;
  // Family month views always present one child at a time, including the initial load.
  const scopedItems = (data?.items ?? [])
    .filter((i) => !family || i.roster.some((r) => r.studentId === selectedChild))
    .map((i) =>
      family
        ? {
            ...i,
            roster: i.roster.filter((r) => r.studentId === selectedChild),
            entries: i.entries.filter((e) => e.studentId === selectedChild),
          }
        : i,
    );
  const daily = (data?.daily ?? []).filter((d) => !family || d.student.studentId === selectedChild);
  const todayItems = scopedItems.filter((i) => i.occurrence.targetDate === date);
  const matching = todayItems.filter(
    (i) =>
      (tab !== 'missing' || i.overdue) &&
      (!filter || i.occurrence.teacherId === filter) &&
      `${i.occurrence.subject} ${i.occurrence.group} ${i.occurrence.teacher}`
        .toLocaleLowerCase()
        .includes(search.toLocaleLowerCase()),
  );
  const teachers = [
    ...new Map(todayItems.map((i) => [i.occurrence.teacherId, i.occurrence.teacher])).entries(),
  ];
  const next = teaching
    ? (todayItems.find((i) => !i.submitted && i.window?.started && !i.window.locked) ??
      todayItems.find((i) => !i.window?.started))
    : null;
  const tabs = family
    ? [['history', 'ისტორია'], ...(explain ? [['explanations', 'განმარტებები']] : [])]
    : [
        ['today', 'დღეს'],
        ['missing', 'შესავსები'],
        ...(school ? [['students', 'მოსწავლეები']] : []),
        ['history', 'ისტორია'],
        ...(manage
          ? [
              ['explanations', 'განმარტებები'],
              ['requests', 'შესწორებები'],
            ]
          : teaching
            ? [['requests', 'მოთხოვნები']]
            : []),
      ];
  const changeDate = (value: string) => {
    if (value) setDate(value);
  };
  return (
    <section className="attendance-workspace" aria-label="დასწრება">
      <header className="att-page-header">
        <div>
          <span className="eyebrow">
            {family
              ? 'პირადი სასკოლო ისტორია'
              : school
                ? 'აღრიცხვა და ყოველდღიური კონტროლი'
                : 'ჩემი გაკვეთილები'}
          </span>
          <h1>
            დასწრება
            <span className="att-header-dot" />
          </h1>
          <p>
            {family
              ? 'ყოველი გაკვეთილი — ერთ მშვიდ და გასაგებ ისტორიაში.'
              : school
                ? 'დღის სურათი, შესავსები გაკვეთილები და დასაბუთებული ცვლილებები.'
                : 'გახსენით გაკვეთილი, მონიშნეთ გამონაკლისები და შეინახეთ დასწრება.'}
          </p>
        </div>
        <div className="att-header-actions">
          {school && !manage && (
            <span className="att-read-only">
              <ShieldCheck size={15} /> მხოლოდ ნახვა
            </span>
          )}
          {explain && (
            <Button onClick={() => setCreate(true)}>
              <Plus size={16} /> განმარტების დამატება
            </Button>
          )}
        </div>
      </header>
      <div className="att-navigation">
        <div className="att-tabs" role="tablist" aria-label="დასწრების სამუშაო სივრცე">
          {tabs.map(([key, label]) => (
            <button
              role="tab"
              aria-selected={tab === key}
              key={key}
              onClick={() => {
                setTab(key!);
                // Queue entry should include decisions/requests from other sessions.
                if (key === 'explanations' || key === 'requests') void queues.refetch();
                setSearch('');
                setFilter('');
              }}
            >
              {label}
              {key === 'missing' && todayItems.some((i) => i.overdue) && (
                <span>{todayItems.filter((i) => i.overdue).length}</span>
              )}
            </button>
          ))}
        </div>
        <div className="att-date-control">
          <IconButton label="წინა დღე" onClick={() => setDate(shiftDate(date, -1))}>
            <ArrowLeft size={16} />
          </IconButton>
          <label className="sr-only" htmlFor="attendance-date">
            დასწრების თარიღი
          </label>
          <input
            id="attendance-date"
            type="date"
            value={date}
            onChange={(e) => changeDate(e.target.value)}
          />
          <IconButton label="შემდეგი დღე" onClick={() => setDate(shiftDate(date, 1))}>
            <ArrowRight size={16} />
          </IconButton>
          <Button variant="ghost" onClick={() => setDate(tbilisiDate())}>
            დღეს
          </Button>
        </div>
      </div>
      {!!children.length && family && (
        <div className="att-family-switch" aria-label="მოსწავლის არჩევა">
          {children.map((c) => (
            <button
              key={c.studentId}
              aria-pressed={selectedChild === c.studentId}
              onClick={() => setChild(c.studentId)}
            >
              {c.name}
              <span>{selectedChild === c.studentId ? 'არჩეულია' : 'ისტორიის ნახვა'}</span>
            </button>
          ))}
        </div>
      )}
      {feedback && (
        <p role="status" className="att-feedback">
          {feedback}
        </p>
      )}
      {range.isPending ? (
        <Skeleton />
      ) : range.isError ? (
        <ErrorState onRetry={() => void range.refetch()} />
      ) : (
        data && (
          <>
            {(tab === 'today' || tab === 'missing') && (
              <>
                <section className="att-metrics" aria-label="დღის შეჯამება">
                  <div>
                    <strong>{todayItems.length}</strong>
                    <span>გაკვეთილი</span>
                  </div>
                  <div>
                    <strong>{todayItems.filter((i) => i.submitted).length}</strong>
                    <span>შევსებულია</span>
                  </div>
                  <div className={todayItems.some((i) => i.overdue) ? 'att-attention' : ''}>
                    <strong>{todayItems.filter((i) => i.overdue).length}</strong>
                    <span>ვადაგადაცილებული</span>
                  </div>
                  <div>
                    <strong>
                      {
                        todayItems.flatMap((i) => i.entries).filter((e) => e.status === 'absent')
                          .length
                      }
                    </strong>
                    <span>არასაპატიო გაცდენა · გაკვეთილი</span>
                  </div>
                </section>
                {next && tab === 'today' && (
                  <button className="att-current" onClick={() => openLesson(next.occurrence.id)}>
                    <span>
                      <Clock3 size={17} />
                      {next.window?.started ? 'შესავსები გაკვეთილი' : 'შემდეგი გაკვეთილი'}
                    </span>
                    <strong>{next.occurrence.subject}</strong>
                    <span>
                      {next.occurrence.group} · {next.occurrence.start}–{next.occurrence.end}
                    </span>
                    <ArrowUpRight size={23} />
                  </button>
                )}
                <div className="att-list-heading">
                  <div>
                    <h2>{tab === 'missing' ? 'შესავსები გაკვეთილები' : 'გაკვეთილების აღრიცხვა'}</h2>
                    <p>
                      {dateLabel(date)} ·{' '}
                      {tab === 'missing'
                        ? 'დაწყებიდან 15 წუთზე მეტი გავიდა.'
                        : 'დაუფიქსირებელი დასწრება არ ითვლება გაცდენად.'}
                    </p>
                  </div>
                  <div className="att-filters">
                    <label>
                      <Search size={15} />
                      <input
                        aria-label="გაკვეთილის ძიება"
                        placeholder="საგანი, ჯგუფი, მასწავლებელი"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    {school && (
                      <details>
                        <summary>მასწავლებელი</summary>
                        <select
                          aria-label="მასწავლებლის ფილტრი"
                          value={filter}
                          onChange={(e) => setFilter(e.target.value)}
                        >
                          <option value="">ყველა მასწავლებელი</option>
                          {teachers.map(([id, name]) => (
                            <option value={id} key={id}>
                              {name}
                            </option>
                          ))}
                        </select>
                      </details>
                    )}
                  </div>
                </div>
                <LessonList items={matching} onOpen={openLesson} />
              </>
            )}
            {tab === 'students' && (
              <>
                <div className="att-list-heading">
                  <div>
                    <h2>მოსწავლის დღე</h2>
                    <p>სრული დასწრება ნაჩვენებია მხოლოდ ყველა გაკვეთილის შევსების შემდეგ.</p>
                  </div>
                  <label className="att-search">
                    <Search size={15} />
                    <input
                      aria-label="დასწრების მოსწავლის ძიება"
                      placeholder="მოსწავლის სახელი"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                    />
                  </label>
                </div>
                <div className="att-daily-list">
                  {daily
                    .filter((d) => d.date === date && d.student.name.includes(search))
                    .map((d) => (
                      <button
                        key={d.student.studentId}
                        onClick={() => {
                          setChild(d.student.studentId);
                          setTab('history');
                        }}
                      >
                        <div>
                          <strong>{d.student.name}</strong>
                          <small>{d.student.number}</small>
                        </div>
                        <span>{dayLabels[d.state]}</span>
                        <span>
                          {d.percentage ?? '—'}%
                          <small>
                            {d.missing
                              ? `${d.missing} შეუვსებელი გაკვეთილი`
                              : 'დადასტურებული მონაცემები'}
                          </small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    ))}
                </div>
              </>
            )}
            {tab === 'history' && (
              <HistoryView
                data={data}
                items={scopedItems}
                daily={daily}
                date={date}
                setDate={setDate}
                openLesson={openLesson}
                school={school}
                child={child}
                setChild={setChild}
              />
            )}
            {(tab === 'explanations' || tab === 'requests') && (
              <>
                <div className="att-list-heading">
                  <div>
                    <h2>
                      {tab === 'explanations' ? 'გაცდენის განმარტებები' : 'შესწორების მოთხოვნები'}
                    </h2>
                    <p>
                      {tab === 'explanations'
                        ? 'დადასტურებული გეგმა არ ნიშნავს დაფიქსირებულ გაცდენას.'
                        : '24-საათიანი ვადის შემდეგ ცვლილებას ადმინისტრაცია განიხილავს.'}
                    </p>
                  </div>
                </div>
                {queues.isPending ? (
                  <Skeleton />
                ) : queues.isError ? (
                  <ErrorState onRetry={() => void queues.refetch()} />
                ) : (
                  <div className="att-queue">
                    {tab === 'explanations'
                      ? queues.data?.explanations.map((e) => (
                          <button
                            key={e.id}
                            onClick={() => setReview({ kind: 'explanation', value: e })}
                          >
                            <span className="att-queue-icon">
                              <ShieldCheck size={20} />
                            </span>
                            <div>
                              <strong>{e.student}</strong>
                              <span>
                                {dateLabel(e.startsOn)} — {dateLabel(shiftDate(e.endsOn, -1))}
                              </span>
                              <small>
                                {e.guardian} · {timestamp(e.createdAt)}
                              </small>
                            </div>
                            <span className="att-queue-state">
                              {decisionLabels[e.state]}
                              <ArrowUpRight size={17} />
                            </span>
                          </button>
                        ))
                      : queues.data?.requests.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setReview({ kind: 'request', value: r })}
                          >
                            <span className="att-queue-icon">
                              <Clock3 size={20} />
                            </span>
                            <div>
                              <strong>
                                {r.occurrence.subject} · {r.occurrence.group}
                              </strong>
                              <span>
                                {dateLabel(r.occurrence.targetDate)} · {r.occurrence.start}
                              </span>
                              <small>
                                {r.teacher} · {timestamp(r.createdAt)}
                              </small>
                            </div>
                            <span className="att-queue-state">
                              {decisionLabels[r.state]}
                              <ArrowUpRight size={17} />
                            </span>
                          </button>
                        ))}
                    {!(tab === 'explanations'
                      ? queues.data?.explanations.length
                      : queues.data?.requests.length) && (
                      <EmptyState
                        title="მოთხოვნები ჯერ არ არის"
                        description="ახალი მოთხოვნები აქ გამოჩნდება."
                      />
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )
      )}
      {create && (
        <ExplanationForm
          childrenList={children}
          selected={selectedChild ?? ''}
          date={date}
          onClose={() => setCreate(false)}
          onSaved={() => {
            setCreate(false);
            setTab('explanations');
            setFeedback(
              'განმარტება გაგზავნილია. დასწრებას ადმინისტრაციის გადაწყვეტილება და ფაქტობრივი აღრიცხვა განსაზღვრავს.',
            );
          }}
        />
      )}
      {review && (
        <Review
          item={review}
          manage={manage}
          onClose={() => setReview(null)}
          onOpenLesson={(id) => {
            setReview(null);
            openLesson(id);
          }}
          onSaved={() => {
            setReview(null);
            setFeedback('გადაწყვეტილება შენახულია.');
          }}
        />
      )}
    </section>
  );
}
function LessonList({
  items,
  onOpen,
}: {
  items: RangeView['items'];
  onOpen: (id: string) => void;
}) {
  return (
    <div className="att-lessons">
      {items.map((i) => (
        <button
          className={i.overdue ? 'is-overdue' : ''}
          key={i.occurrence.id}
          onClick={() => onOpen(i.occurrence.id)}
        >
          <div className="att-slot">
            <strong>{i.occurrence.start}</strong>
            <span>{i.occurrence.end}</span>
          </div>
          <div className="att-lesson-name">
            <strong>{i.occurrence.subject}</strong>
            <span>{i.occurrence.group}</span>
            <small>
              {i.occurrence.teacher} · ოთახი {i.occurrence.room}
              {i.occurrence.changed ? ' · შეცვლილი გაკვეთილი' : ''}
            </small>
          </div>
          <span className="att-lesson-state">
            {i.submitted ? (
              <>
                {!i.window && i.entries.length === 1 ? (
                  i.entries[0]!.status === 'late' ? (
                    <Clock3 size={16} />
                  ) : i.entries[0]!.status === 'authorized' ? (
                    <ShieldCheck size={16} />
                  ) : i.entries[0]!.status === 'absent' ? (
                    <Minus size={16} />
                  ) : (
                    <Check size={16} />
                  )
                ) : (
                  <Check size={16} />
                )}
                {!i.window && i.entries.length === 1
                  ? attendanceLabels[i.entries[0]!.status]
                  : 'შევსებულია'}
              </>
            ) : i.overdue ? (
              <>
                <AlertTriangle size={16} />
                შესავსებია
              </>
            ) : i.window && !i.window.started ? (
              <>
                <Clock3 size={16} />
                ჯერ არ დაწყებულა
              </>
            ) : (
              'მონაცემები ჯერ არ არის'
            )}
          </span>
          <ArrowUpRight size={17} />
        </button>
      ))}
      {!items.length && (
        <EmptyState
          title="ამ ხედში გაკვეთილები არ არის"
          description="შეცვალეთ თარიღი ან ფილტრი. გაუქმებულ გაკვეთილს აღრიცხვა არ სჭირდება."
        />
      )}
    </div>
  );
}
function HistoryView({
  data,
  items,
  daily,
  date,
  setDate,
  openLesson,
  school,
  child,
  setChild,
}: {
  data: RangeView;
  items: RangeView['items'];
  daily: RangeView['daily'];
  date: string;
  setDate: (s: string) => void;
  openLesson: (s: string) => void;
  school: boolean;
  child: string;
  setChild: (s: string) => void;
}) {
  const students = [...new Map(data.daily.map((d) => [d.student.studentId, d.student])).values()];
  const conducted = items.filter(
    (i) => schoolInstant(i.occurrence.targetDate, i.occurrence.end) <= Date.parse(data.now),
  );
  const entries = conducted.flatMap((i) => i.entries),
    expected = conducted.reduce((n, i) => n + i.roster.length, 0),
    missed = entries.filter((e) => e.status === 'absent' || e.status === 'authorized').length;
  const percentage = entries.length
    ? Math.round(((entries.length - missed) / entries.length) * 1000) / 10
    : null;
  const monthStart = date.slice(0, 7) + '-01',
    count = new Date(Number(date.slice(0, 4)), Number(date.slice(5, 7)), 0).getDate(),
    offset = (new Date(monthStart + 'T12:00:00Z').getUTCDay() + 6) % 7;
  return (
    <>
      <div className="att-history-tools">
        <label>
          თვე
          <select value={date.slice(0, 7)} onChange={(e) => setDate(e.target.value + '-01')}>
            {Array.from({ length: 36 }, (_, i) => {
              const year = Number(date.slice(0, 4)) - 1 + Math.floor(i / 12);
              const value = `${year}-${String((i % 12) + 1).padStart(2, '0')}`;
              return (
                <option key={value} value={value}>
                  {dateLabel(value + '-01').slice(2)} {year}
                </option>
              );
            })}
          </select>
        </label>
        {school && (
          <label>
            მოსწავლე
            <select value={child} onChange={(e) => setChild(e.target.value)}>
              <option value="">ყველა მოსწავლე</option>
              {students.map((s) => (
                <option key={s.studentId} value={s.studentId}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className="att-history-layout">
        <section className="att-month">
          <header>
            <h2>გაკვეთილების ისტორია</h2>
            <span>{date.slice(0, 7)}</span>
          </header>
          <div className="att-calendar" aria-label="დასწრების კალენდარი">
            {['ორშ', 'სამ', 'ოთხ', 'ხუთ', 'პარ', 'შაბ', 'კვ'].map((d) => (
              <span className="att-weekday" key={d}>
                {d}
              </span>
            ))}
            {Array.from({ length: offset }, (_, i) => (
              <span key={'empty' + i} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const day = monthStart.slice(0, 8) + String(i + 1).padStart(2, '0'),
                rows = daily.filter((d) => d.date === day),
                incomplete = rows.some((d) => d.provisional),
                absences = rows.reduce((n, r) => n + r.absent + r.authorized, 0),
                late = rows.reduce((n, r) => n + r.late, 0),
                early = rows.reduce((n, r) => n + r.early, 0);
              const state = !rows.length
                ? 'no_lessons'
                : incomplete
                  ? 'incomplete'
                  : absences
                    ? rows.every((r) => r.state === 'absent')
                      ? 'absent'
                      : 'partial'
                    : 'present';
              return (
                <button
                  key={day}
                  aria-pressed={date === day}
                  aria-label={`${dateLabel(day)} · ${dayLabels[state]}`}
                  className={`day-${state}`}
                  onClick={() => setDate(day)}
                >
                  <strong>{i + 1}</strong>
                  <i className="att-day-symbol" aria-hidden="true">
                    {!rows.length ? '—' : incomplete ? '?' : absences ? '−' : '✓'}
                  </i>
                  <span className="att-day-description">
                    {!rows.length
                      ? '—'
                      : incomplete
                        ? 'არასრული'
                        : absences
                          ? `${absences} გაცდენა`
                          : 'ესწრება'}
                  </span>
                  {!!(late || early) && (
                    <small>
                      {late ? 'დაგვ. ' : ''}
                      {early ? 'გასვ.' : ''}
                    </small>
                  )}
                </button>
              );
            })}
          </div>
          <p className="att-calendar-note">
            ✓ დასწრება · − გაცდენა · ? არასრული · — გაკვეთილი არ არის. აირჩიეთ დღე დეტალებისთვის.
          </p>
        </section>
        <aside className="att-percentage">
          <span className="eyebrow">დასრულებული გაკვეთილები</span>
          <strong>
            {percentage ?? '—'}
            <small>{percentage !== null ? '%' : ''}</small>
          </strong>
          <p>დასწრება{expected > entries.length ? ' · წინასწარი მაჩვენებელი' : ''}</p>
          <div className="att-percentage-bar">
            <span style={{ width: `${percentage ?? 0}%` }} />
          </div>
          <dl>
            {Object.entries(attendanceLabels).map(([key, label]) => (
              <div key={key}>
                <dt>{label}</dt>
                <dd>{entries.filter((e) => e.status === key).length}</dd>
              </div>
            ))}
            <div>
              <dt>ადრე გასვლა</dt>
              <dd>{entries.filter((e) => e.departure).length}</dd>
            </div>
            <div>
              <dt>შეუვსებელი</dt>
              <dd>{expected - entries.length}</dd>
            </div>
          </dl>
          <p>საპატიო გაცდენა ითვლება გაცდენად. შეუვსებელი გაკვეთილი პროცენტს არ ამცირებს.</p>
        </aside>
      </div>
      <div className="att-list-heading">
        <div>
          <h2>{dateLabel(date)}</h2>
          <p>
            {!school
              ? daily
                  .filter((d) => d.date === date)
                  .map((d) => dayLabels[d.state])
                  .join(' · ') + ' · '
              : ''}
            აირჩიეთ გაკვეთილი დეტალების სანახავად.
          </p>
        </div>
      </div>
      <LessonList
        items={items.filter((i) => i.occurrence.targetDate === date)}
        onOpen={openLesson}
      />
    </>
  );
}
function ExplanationForm({
  childrenList,
  selected,
  date,
  onClose,
  onSaved,
}: {
  childrenList: RangeView['children'];
  selected: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [child, setChild] = useState(selected),
    [start, setStart] = useState(date),
    [end, setEnd] = useState(date),
    [reason, setReason] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const [commandId] = useState(() => crypto.randomUUID());
  return (
    <Modal
      open
      onOpenChange={onClose}
      title="გაცდენის განმარტება"
      description="შეგიძლიათ მიუთითოთ წარსული, მიმდინარე ან დაგეგმილი გაცდენა. ეს დასწრებას ავტომატურად არ ცვლის."
      className="att-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          try {
            await command({
              action: 'explanation.create',
              commandId,
              studentId: child,
              startsOn: start,
              endsOn: shiftDate(end, 1),
              reason,
            });
            onSaved();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <label>
          მოსწავლე
          <select value={child} onChange={(e) => setChild(e.target.value)} required>
            {childrenList.map((c) => (
              <option key={c.studentId} value={c.studentId}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="att-form-pair">
          <label>
            პირველი დღე
            <input type="date" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label>
            ბოლო დღე · ჩათვლით
            <input
              type="date"
              value={end}
              min={start}
              onChange={(e) => setEnd(e.target.value)}
              required
            />
          </label>
        </div>
        <label>
          მოკლე განმარტება
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            required
            minLength={5}
            maxLength={600}
          />
        </label>
        <p>
          განმარტებას მხოლოდ უფლებამოსილი ადმინისტრაცია განიხილავს. სამედიცინო დოკუმენტები და
          დიაგნოზი საჭირო არ არის.
        </p>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <footer>
          <Button type="button" onClick={onClose}>
            გაუქმება
          </Button>
          <Button variant="primary" disabled={busy || !child}>
            {busy ? 'იგზავნება…' : 'განმარტების გაგზავნა'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
function Review({
  item,
  manage,
  onClose,
  onSaved,
  onOpenLesson,
}: {
  item: QueueItem;
  manage: boolean;
  onClose: () => void;
  onSaved: () => void;
  onOpenLesson: (id: string) => void;
}) {
  const [reason, setReason] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const [commandId] = useState(() => crypto.randomUUID());
  const [adjust, setAdjust] = useState(false);
  const [proposalEntries, setProposalEntries] = useState<AttendanceEntry[]>(
    item.kind === 'request' ? item.value.proposal.entries : [],
  );
  const id = item.kind === 'request' ? item.value.occurrenceId : null;
  const detail = useQuery({
    queryKey: ['attendance', 'lesson', id],
    queryFn: () =>
      api<LessonView>(`/api/attendance/lesson?occurrenceId=${encodeURIComponent(id!)}`),
    enabled: !!id,
  });
  const decide = async (approve: boolean) => {
    setBusy(true);
    try {
      await command({
        action: item.kind === 'explanation' ? 'explanation.decide' : 'request.decide',
        commandId,
        id: item.value.id,
        revision: item.value.revision,
        approve,
        reason,
        ...(adjust && item.kind === 'request' && approve
          ? { proposal: { ...item.value.proposal, entries: proposalEntries } }
          : {}),
      } as AttendanceCommand);
      onSaved();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onOpenChange={onClose}
      title={item.kind === 'explanation' ? 'განმარტების განხილვა' : 'შესწორების განხილვა'}
      description={decisionLabels[item.value.state]!}
      className="att-dialog att-review"
    >
      <div className="att-review-context">
        {item.kind === 'explanation' ? (
          <>
            <h3>{item.value.student}</h3>
            <p>{item.value.guardian}</p>
            <p>
              {dateLabel(item.value.startsOn)} — {dateLabel(shiftDate(item.value.endsOn, -1))}
            </p>
          </>
        ) : (
          <>
            <h3>{item.value.occurrence.subject}</h3>
            <p>
              {item.value.teacher} · {item.value.occurrence.group}
            </p>
            <p>
              {dateLabel(item.value.occurrence.targetDate)} · {item.value.occurrence.start}
            </p>
          </>
        )}
        <span>{timestamp(item.value.createdAt)}</span>
      </div>
      <blockquote>{item.value.reason}</blockquote>
      {item.kind === 'request' && (
        <>
          <h3>შემოთავაზებული ჩანაწერი</h3>
          <ul className="att-proposal">
            {proposalEntries.map((e, index) => (
              <li key={e.studentId}>
                <span>
                  {item.value.roster.find((r) => r.studentId === e.studentId)?.name ?? 'მოსწავლე'}
                </span>
                <strong>
                  {item.value.originalEntries
                    ? (item.value.originalEntries.find((r) => r.studentId === e.studentId)
                        ? attendanceLabels[
                            item.value.originalEntries.find((r) => r.studentId === e.studentId)!
                              .status
                          ]
                        : 'შეუვსებელი') + ' → '
                    : ''}
                  {attendanceLabels[e.status]}
                  {e.arrival ? ' · ' + e.arrival : ''}
                  {e.departure ? ' · გასვლა ' + e.departure : ''}
                </strong>
                {adjust && (
                  <div className="att-adjust-entry">
                    <label>
                      ახალი მდგომარეობა
                      <select
                        value={e.status}
                        onChange={(ev) => {
                          const status = ev.target.value as AttendanceEntry['status'];
                          setProposalEntries((rows) =>
                            rows.map((r, i) =>
                              i === index
                                ? {
                                    ...r,
                                    status,
                                    arrival:
                                      status === 'late'
                                        ? (r.arrival ?? item.value.occurrence.start)
                                        : null,
                                    departure: ['present', 'late'].includes(status)
                                      ? r.departure
                                      : null,
                                  }
                                : r,
                            ),
                          );
                        }}
                      >
                        {Object.entries(attendanceLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                    {e.status === 'late' && (
                      <label>
                        მოსვლის დრო
                        <input
                          type="time"
                          value={e.arrival ?? ''}
                          onChange={(ev) =>
                            setProposalEntries((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, arrival: ev.target.value } : r,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                    {['present', 'late'].includes(e.status) && (
                      <label>
                        გასვლის დრო · არასავალდებულო
                        <input
                          type="time"
                          value={e.departure ?? ''}
                          onChange={(ev) =>
                            setProposalEntries((rows) =>
                              rows.map((r, i) =>
                                i === index ? { ...r, departure: ev.target.value || null } : r,
                              ),
                            )
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
          {manage && item.value.state === 'pending' && (
            <Button onClick={() => setAdjust(!adjust)}>
              {adjust ? 'შესწორებული წინადადების ნახვა' : 'წინადადების დაზუსტება'}
            </Button>
          )}
          {item.value.state === 'pending' &&
            detail.data &&
            detail.data.revision !== item.value.proposal.revision && (
              <p className="att-warning">
                ჩანაწერი მოთხოვნის შემდეგ შეიცვალა. გახსენით მიმდინარე გაკვეთილი და შეაჯერეთ
                ცვლილებები; ძველი მოთხოვნის ავტომატური დადასტურება მიუწვდომელია.
              </p>
            )}
          <Button onClick={() => onOpenLesson(item.value.occurrenceId)}>
            გაკვეთილი და მიმდინარე ისტორია <ArrowUpRight size={15} />
          </Button>
        </>
      )}
      {item.value.decision && <p className="att-decision">გადაწყვეტილება: {item.value.decision}</p>}
      {manage && item.value.state === 'pending' && (
        <>
          <label>
            გადაწყვეტილების მიზეზი
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={600}
            />
          </label>
          <p>
            {item.kind === 'explanation'
              ? 'დადასტურება მხოლოდ ფაქტობრივ გაცდენას აქცევს საპატიოდ; დასწრება არ გამოიგონება.'
              : 'დადასტურება შეინახავს შემოთავაზებულ ცვლილებებს და მათ ისტორიას.'}
          </p>
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
          <footer>
            <Button disabled={busy || reason.trim().length < 5} onClick={() => void decide(false)}>
              უარყოფა
            </Button>
            <Button
              variant="primary"
              disabled={busy || reason.trim().length < 5}
              onClick={() => void decide(true)}
            >
              {busy ? 'ინახება…' : 'დადასტურება'}
            </Button>
          </footer>
        </>
      )}
    </Modal>
  );
}
