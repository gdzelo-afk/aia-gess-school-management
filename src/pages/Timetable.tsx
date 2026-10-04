import { DateInput } from '../components/DateInput';
import { Select } from '../components/Select';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ArrowRight,
  Search,
  SlidersHorizontal,
  ChevronDown,
  AlertTriangle,
  Check,
  Plus,
  LockKeyhole,
  FilePenLine,
  X,
} from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import type {
  TimetableSetup,
  DraftView,
  TimetableDocument,
  Lesson,
  RequestView,
  Availability,
} from '../../shared/timetable';
import { weekdayLabels } from '../../shared/timetable';
import { api, queryClient } from '../lib/api';
import { tbilisiDate } from '../lib/semester';
import { Button, IconButton, Modal, Skeleton, ErrorState, EmptyState } from '../components/ui';
import { OperationDialog, Field, text } from '../components/Operations';
import { Matrix, type Move } from '../components/timetable/Matrix';
import { Panel, ReviewPanel } from '../components/timetable/Panel';
import {
  type Lens,
  type Tile,
  type WeekView,
  tiles,
  fromOccurrence,
  inLens,
  lenses,
  lensLabels,
  compareDraft,
} from '../components/timetable/model';
import {
  command,
  monday,
  shift,
  TeacherRoom,
  BellEditor,
  GroupEditor,
  PublishDialog,
  ChangeDialog,
  AvailabilityDialog,
  RequestDialog,
  ExtraLesson,
  MoveDialog,
} from '../components/timetable/Forms';
import '../styles/product-timetable.css';
export function Timetable() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>(),
    manage = viewer.capabilities.includes('timetable:manage'),
    canRequest = viewer.capabilities.includes('timetable:request');
  const [yearId, setYearId] = useState(''),
    [versionId, setVersionId] = useState(''),
    [from, setFrom] = useState(
      monday(
        new URLSearchParams(location.search).get('date')?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0] ??
          tbilisiDate(),
      ),
    ),
    [tab, setTab] = useState('schedule'),
    [child, setChild] = useState(() =>
      viewer.roles.includes('guardian')
        ? (new URLSearchParams(location.search).get('studentId') ?? '')
        : '',
    );
  const requestedDate = new URLSearchParams(location.search)
    .get('date')
    ?.match(/^\d{4}-\d{2}-\d{2}$/)?.[0];
  const [lens, setLens] = useState<Lens | null>(null),
    [search, setSearch] = useState(''),
    [scopeOpen, setScopeOpen] = useState(false),
    [filtersOpen, setFiltersOpen] = useState(false),
    [subject, setSubject] = useState(''),
    [filterState, setFilterState] = useState('');
  const [dialog, setDialog] = useState<
      'draft' | 'bell' | 'group' | 'room' | 'publish' | 'availability' | 'extra' | 'compare' | null
    >(null),
    [selected, setSelected] = useState<Tile | null>(null),
    [editing, setEditing] = useState<Partial<Lesson> | null>(null),
    [move, setMove] = useState<Move | null>(null),
    [review, setReview] = useState<RequestView | null>(null),
    [ending, setEnding] = useState<(Availability & { id: string; revision: number }) | null>(null),
    [feedback, setFeedback] = useState(''),
    [error, setError] = useState(''),
    [conflictKind, setConflictKind] = useState(''),
    [requestState, setRequestState] = useState('pending'),
    [availabilityTeacher, setAvailabilityTeacher] = useState('');
  const setup = useQuery({
    queryKey: ['timetable', 'setup', yearId],
    queryFn: () => api<TimetableSetup>(`/api/timetable/setup${yearId ? `?yearId=${yearId}` : ''}`),
    staleTime: 60000,
  });
  const draft = useQuery({
    queryKey: ['timetable', 'draft', versionId],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${versionId}`),
    enabled: !!versionId && manage,
  });
  const week = useQuery({
    queryKey: ['timetable', 'week', from, yearId, child],
    queryFn: () =>
      api<WeekView>(
        `/api/timetable/week?from=${from}&days=7${yearId ? `&yearId=${yearId}` : ''}${child ? `&studentId=${child}` : ''}`,
      ),
  });
  const baselineId = setup.data?.versions
    .filter(
      (v) =>
        v.status === 'published' &&
        draft.data &&
        v.startsOn <= draft.data.startsOn &&
        v.endsOn > draft.data.startsOn,
    )
    .sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0]?.id;
  const baseline = useQuery({
    queryKey: ['timetable', 'draft', baselineId],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${baselineId}`),
    enabled: !!baselineId && draft.data?.status === 'draft',
  });
  const requests = useQuery({
    queryKey: ['timetable', 'requests'],
    queryFn: () => api<{ items: RequestView[] }>('/api/timetable/requests'),
    enabled: manage || canRequest,
  });
  const availability = useQuery({
    queryKey: ['timetable', 'availability'],
    queryFn: () =>
      api<{ items: (Availability & { id: string; revision: number; reason: string })[] }>(
        '/api/timetable/availability',
      ),
    enabled: manage || canRequest,
  });
  if (setup.isPending) return <Skeleton rows={4} />;
  if (setup.isError) return <ErrorState onRetry={() => void setup.refetch()} />;
  const data = setup.data,
    doc = draft.data?.document,
    editable = !!versionId && draft.data?.status === 'draft',
    historical = !editable && from < shift(monday(tbilisiDate()), -0),
    all = versionId && doc ? tiles(doc, data) : (week.data?.items ?? []).map(fromOccurrence),
    options = lenses(data, all),
    activeLens =
      lens ??
      (manage
        ? (options.find((o) => o.kind === 'section') ?? {
            kind: 'school',
            id: '',
            name: 'სკოლის მიმოხილვა',
          })
        : {
            kind: 'own',
            id: '',
            name: viewer.roles.includes('guardian') ? 'შვილის განრიგი' : 'ჩემი განრიგი',
          }),
    conflicts = versionId ? (draft.data?.conflicts ?? []) : (week.data?.conflicts ?? []),
    overrides = new Map((week.data?.overrides ?? []).map((o) => [o.key, o.reason]));
  const differences =
      editable && draft.data && (!baselineId || baseline.data)
        ? compareDraft(draft.data, baseline.data, data)
        : [],
    changed = new Set(differences.map((d) => d.id)),
    pending = requests.data?.items.filter((r) => r.state === 'pending').length ?? 0;
  const filtered = all.filter(
    (t) =>
      inLens(t, activeLens) &&
      (!subject || t.subject === subject) &&
      (!filterState ||
        (filterState === 'changed'
          ? t.changed || changed.has(t.lessonId)
          : filterState === 'cancelled'
            ? t.cancelled
            : conflicts.some((c) =>
                c.lessonIds.some((id) => id === t.id || id.includes(`:${t.lessonId}:`)),
              ))),
  );
  const periods = doc?.periods ?? [
    ...new Map(
      (week.data?.days ?? []).flatMap((d) => d.periods).map((p) => [p.number, p]),
    ).values(),
  ];
  const closeInspector = () => {
    setSelected(null);
    setReview(null);
  };
  const switchVersion = (id: string) => {
    setVersionId(id);
    closeInspector();
    setLens(null);
    setSubject('');
  };
  const save = async (document: TimetableDocument, revision = draft.data!.revision) => {
    await command({ action: 'draft.save', id: versionId, revision, document });
    setFeedback('სამუშაო ვერსია შენახულია. მოსწავლეებისთვის ჯერ არ ჩანს.');
  };
  const openLesson = (tile: Tile) => {
    setReview(null);
    setSelected(tile);
  };
  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ['timetable'] });
    setError('');
    closeInspector();
    setFeedback('მიმდინარე მონაცემები განახლებულია. გადახედეთ ცვლილებას თავიდან.');
  };
  return (
    <div className={`timetable-page tt-workspace ${selected || review ? 'has-inspector' : ''}`}>
      <header className="tt-workspace-heading">
        <div>
          <span className="product-eyebrow">
            სასწავლო პროცესი / {manage ? 'დაგეგმვა' : 'ჩემი კვირა'}
          </span>
          <h1>გაკვეთილების განრიგი</h1>
        </div>
        {manage ? (
          <div className="tt-version-picker">
            <label>
              <span>განრიგის ვერსია</span>
              <Select
                aria-label="განრიგის ვერსია"
                value={versionId}
                onChange={(e) => switchVersion(e.target.value)}
              >
                <option value="">მოქმედი გამოქვეყნებული განრიგი</option>
                {data.versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.status === 'draft' ? 'სამუშაო' : 'გამოქვეყნებული'} · {v.name} · {v.startsOn}
                  </option>
                ))}
              </Select>
            </label>
            <Button onClick={() => setDialog('draft')}>
              <Plus size={14} />
              სამუშაო ვერსია
            </Button>
          </div>
        ) : data.children.length > 1 ? (
          <label className="tt-child">
            <span>შვილი</span>
            <Select
              aria-label="შვილის განრიგი"
              value={child}
              onChange={(e) => setChild(e.target.value)}
            >
              <option value="">ყველა დაკავშირებული შვილი</option>
              {data.children.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </label>
        ) : null}
      </header>
      <div className={`tt-state-band ${editable ? 'is-draft' : ''}`}>
        <div>
          {editable ? <FilePenLine size={19} /> : <LockKeyhole size={17} />}
          <span>
            <strong>
              {editable
                ? 'სამუშაო ვერსია'
                : historical
                  ? 'ისტორიული განრიგი'
                  : 'გამოქვეყნებული განრიგი'}
            </strong>
            <small>
              {editable
                ? 'პირადი სამუშაო · ოჯახებისთვის დამალულია'
                : versionId
                  ? 'ვერსიის სტრუქტურა · მხოლოდ ნახვა'
                  : 'მხოლოდ მოქმედი, გამოქვეყნებული გაკვეთილები'}
              {draft.data ? ` · ${draft.data.startsOn} — ${draft.data.endsOn}` : ''}
            </small>
          </span>
        </div>
        {manage && (
          <div className="tt-state-actions">
            <button
              className={conflicts.length ? 'tt-conflict-link' : ''}
              onClick={() => setTab('conflicts')}
            >
              {conflicts.length ? <AlertTriangle size={15} /> : <Check size={15} />}{' '}
              {conflicts.length} კონფლიქტი
            </button>
            {editable && (
              <>
                <Button onClick={() => setDialog('compare')}>
                  {differences.length} ცვლილება · გადახედვა
                </Button>
                <Button variant="primary" onClick={() => setDialog('compare')}>
                  გამოქვეყნების განხილვა
                </Button>
              </>
            )}
          </div>
        )}
      </div>
      {(manage || canRequest) && (
        <nav className="tt-workspace-nav" aria-label="განრიგის სამუშაო სივრცე">
          {[
            ['schedule', 'განრიგი'],
            ...(manage ? [['conflicts', `კონფლიქტები · ${conflicts.length}`]] : []),
            ['requests', `მოთხოვნები · ${pending}`],
            ['availability', manage ? 'ხელმისაწვდომლობა' : 'ჩემი მიუწვდომლობა'],
            ...(manage ? [['setup', 'კონფიგურაცია']] : []),
          ].map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? 'page' : undefined}
              onClick={() => {
                setTab(key!);
                closeInspector();
              }}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {error && (
        <div className="tt-alert" role="alert">
          <p>{error}</p>
          <Button onClick={() => void refresh()}>განახლება და გადახედვა</Button>
        </div>
      )}
      {feedback && (
        <p className="tt-feedback" role="status">
          {feedback}
          <button aria-label="შეტყობინების დახურვა" onClick={() => setFeedback('')}>
            <X size={12} />
          </button>
        </p>
      )}
      <div className="tt-layout">
        <div className="tt-main">
          <div hidden={tab !== 'schedule'} className="ux-workspace-view">
            <div className="tt-schedule-toolbar">
              <div className="tt-lens-heading">
                {manage ? (
                  <button
                    onClick={() => {
                      setSearch('');
                      setScopeOpen(true);
                    }}
                  >
                    <span>{lensLabels[activeLens.kind]}</span>
                    <strong>{activeLens.name}</strong>
                    <ChevronDown size={16} />
                  </button>
                ) : (
                  <strong>
                    {child ? data.children.find((c) => c.id === child)?.name : activeLens.name}
                  </strong>
                )}
              </div>
              <div className="tt-week-control">
                <IconButton label="წინა კვირა" onClick={() => setFrom(shift(from, -7))}>
                  <ArrowLeft size={15} />
                </IconButton>
                <DateInput
                  aria-label="განრიგის კვირა"
                  type="date"
                  value={from}
                  onChange={(e) => e.target.value && setFrom(monday(e.target.value))}
                />
                <IconButton label="შემდეგი კვირა" onClick={() => setFrom(shift(from, 7))}>
                  <ArrowRight size={15} />
                </IconButton>
                <button
                  onClick={() => {
                    setFrom(monday(tbilisiDate()));
                    if (versionId && !editable) switchVersion('');
                  }}
                >
                  დღეს
                </button>
              </div>
              <Button aria-expanded={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}>
                <SlidersHorizontal size={15} />
                ფილტრები{subject || filterState ? ' · მოქმედი' : ''}
              </Button>
            </div>
            {filtersOpen && (
              <div className="tt-filter-panel">
                <label>
                  <span>საგანი</span>
                  <Select
                    aria-label="საგნის ფილტრი"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                  >
                    <option value="">ყველა საგანი</option>
                    {[...new Set(all.map((t) => t.subject))].map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </Select>
                </label>
                <label>
                  <span>მდგომარეობა</span>
                  <Select
                    aria-label="მდგომარეობის ფილტრი"
                    value={filterState}
                    onChange={(e) => setFilterState(e.target.value)}
                  >
                    <option value="">ყველა გაკვეთილი</option>
                    <option value="changed">ცვლილებები</option>
                    <option value="cancelled">გაუქმებული</option>
                    {manage && <option value="conflict">კონფლიქტიანი</option>}
                  </Select>
                </label>
                {(subject || filterState) && (
                  <Button
                    onClick={() => {
                      setSubject('');
                      setFilterState('');
                    }}
                  >
                    ფილტრების გასუფთავება
                  </Button>
                )}
              </div>
            )}
            {manage && activeLens.kind === 'school' ? (
              <section className="tt-oversight">
                <div className="tt-oversight-numbers">
                  <div>
                    <b className="product-number">{all.length}</b>
                    <span>{versionId ? 'განთავსებული გაკვეთილი' : 'კვირის გაკვეთილი'}</span>
                  </div>
                  <button onClick={() => setTab('conflicts')}>
                    <b className="product-number">{conflicts.length}</b>
                    <span>საჭიროებს განხილვას</span>
                  </button>
                  <button onClick={() => setTab('requests')}>
                    <b className="product-number">{pending}</b>
                    <span>მოთხოვნა რიგში</span>
                  </button>
                </div>
                <h2>გახსენით კონკრეტული განრიგი</h2>
                <p>კლასის, მასწავლებლის ან ოთახის ჭრილში პერიოდის დატვირთვა მკაფიოდ ჩანს.</p>
                <div className="tt-scope-directory">
                  {options
                    .filter((o) => o.kind === 'section' || o.kind === 'teacher')
                    .map((o) => (
                      <button key={o.kind + o.id} onClick={() => setLens(o)}>
                        <small>{lensLabels[o.kind]}</small>
                        <strong>{o.name}</strong>
                        <span>
                          {all.filter((t) => inLens(t, o)).length} გაკვეთილი{' '}
                          <ArrowRight size={13} />
                        </span>
                      </button>
                    ))}
                </div>
              </section>
            ) : versionId ? (
              draft.isPending ? (
                <Skeleton />
              ) : draft.isError ? (
                <ErrorState onRetry={() => void draft.refetch()} />
              ) : (
                <Matrix
                  items={filtered}
                  periods={periods}
                  from={from}
                  lens={activeLens}
                  editable={editable}
                  versionId={versionId}
                  revision={draft.data!.revision}
                  conflicts={conflicts}
                  changed={changed}
                  selected={selected?.id}
                  onSelect={openLesson}
                  onAdd={(weekday, periodId) => setEditing({ weekday, periodId })}
                  onMove={setMove}
                />
              )
            ) : week.isPending ? (
              <Skeleton />
            ) : week.isError ? (
              <ErrorState onRetry={() => void week.refetch()} />
            ) : (
              <Matrix
                items={filtered}
                periods={periods}
                from={from}
                lens={activeLens}
                initialDay={
                  requestedDate && monday(requestedDate) === from
                    ? (new Date(`${requestedDate}T12:00:00Z`).getUTCDay() + 6) % 7
                    : 0
                }
                editable={false}
                versionId=""
                revision={0}
                conflicts={conflicts}
                changed={changed}
                selected={selected?.id}
                onSelect={openLesson}
                onAdd={() => {}}
                onMove={() => {}}
              />
            )}
            <footer className="tt-matrix-foot">
              <span>
                {editable
                  ? 'გადაათრიეთ გაკვეთილი ან გახსენით დეტალები · ყველა გადატანა მოწმდება სერვერზე'
                  : 'თბილისის დრო · თარიღისთვის მოქმედი განრიგი'}
              </span>
              <span>{filtered.length} გაკვეთილი</span>
            </footer>
          </div>
          {tab === 'conflicts' && manage && (
            <section className="tt-operational">
              <header>
                <div>
                  <span className="product-eyebrow">გადაწყვეტილებები</span>
                  <h2>კონფლიქტების განხილვა</h2>
                  <p>ჯერ შეასწორეთ გაკვეთილი; გამონაკლისის დაშვებას სჭირდება ცალკე მიზეზი.</p>
                </div>
                <Select
                  aria-label="კონფლიქტის ტიპი"
                  value={conflictKind}
                  onChange={(e) => setConflictKind(e.target.value)}
                >
                  <option value="">ყველა ტიპი</option>
                  {Object.entries({
                    teacher: 'მასწავლებელი',
                    room: 'ოთახი',
                    student: 'მოსწავლეთა გადაფარვა',
                    availability: 'მიუწვდომლობა',
                    domain: 'მოქმედი კავშირი',
                  }).map(([k, l]) => (
                    <option key={k} value={k}>
                      {l}
                    </option>
                  ))}
                </Select>
              </header>
              {conflicts.length ? (
                conflicts
                  .filter((c) => !conflictKind || c.kind === conflictKind)
                  .map((c) => (
                    <article className="tt-conflict-row" key={c.key}>
                      <AlertTriangle size={18} />
                      <div>
                        <time>{c.date}</time>
                        <h3>{c.message}</h3>
                        <span className="tt-conflict-state">
                          {overrides.has(c.key)
                            ? 'დასაბუთებული გამონაკლისი'
                            : c.overridable
                              ? 'საჭიროა გადაჭრა ან დასაბუთებული დაშვება'
                              : 'ბლოკავს გამოქვეყნებას · დაშვება შეუძლებელია'}
                        </span>
                        {overrides.has(c.key) && <p>{overrides.get(c.key)}</p>}
                        <div className="tt-conflict-lessons">
                          {c.lessonIds.map((id) => {
                            const t = all.find(
                              (t) => t.id === id || id.includes(`:${t.lessonId}:`),
                            );
                            return t ? (
                              <button key={id} onClick={() => openLesson(t)}>
                                {t.subject} · {t.group} · {t.teacher} · {t.start}
                                <ArrowRight size={13} />
                              </button>
                            ) : (
                              <span key={id}>
                                ამ თარიღის გაკვეთილი{' '}
                                <Button
                                  onClick={() => {
                                    switchVersion('');
                                    setFrom(monday(c.date));
                                    setTab('schedule');
                                  }}
                                >
                                  განრიგის გახსნა
                                </Button>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    </article>
                  ))
              ) : (
                <EmptyState
                  title="კონფლიქტი არ არის"
                  description={
                    editable
                      ? 'სამუშაო ვერსია შემოწმებულია. გამოქვეყნებისას სერვერი შემოწმებას გაიმეორებს.'
                      : 'შერჩეულ კვირაში გადაფარვა ან მიუწვდომლობა არ გამოვლენილა.'
                  }
                />
              )}
            </section>
          )}
          {tab === 'requests' && (manage || canRequest) && (
            <section className="tt-operational">
              <header>
                <div>
                  <span className="product-eyebrow">მოთხოვნები / ჩანაცვლებები</span>
                  <h2>{manage ? 'გადაწყვეტილების მოლოდინში' : 'ჩემი მოთხოვნები'}</h2>
                  <p>ერთჯერადი ცვლილებები ინარჩუნებს ძირითად კვირეულ განრიგს.</p>
                </div>
                {canRequest && (
                  <Button onClick={() => setDialog('availability')}>1–2 დღით მიუწვდომლობა</Button>
                )}
              </header>
              <div className="tt-queue-states">
                {[
                  ['pending', 'განსახილველი'],
                  ['approved', 'დამტკიცებული'],
                  ['denied', 'უარყოფილი'],
                  ['', 'ყველა'],
                ].map(([s, l]) => (
                  <button
                    key={s}
                    aria-pressed={requestState === s}
                    onClick={() => setRequestState(s!)}
                  >
                    {l}
                  </button>
                ))}
              </div>
              {requests.isPending ? (
                <Skeleton />
              ) : requests.isError ? (
                <ErrorState onRetry={() => void requests.refetch()} />
              ) : requests.data?.items.filter((r) => !requestState || r.state === requestState)
                  .length ? (
                <div className="tt-request-queue">
                  {requests.data.items
                    .filter((r) => !requestState || r.state === requestState)
                    .map((r) => (
                      <button
                        key={r.id}
                        className="tt-request"
                        onClick={() => {
                          setSelected(null);
                          setReview(r);
                        }}
                      >
                        <span className="tt-request-date">
                          {(r.absence?.startsOn ?? r.changes[0]?.targetDate ?? '').slice(5)}
                          <small>{r.absence ? 'მიუწვდომლობა' : 'გაკვეთილის ცვლილება'}</small>
                        </span>
                        <span>
                          <strong>{r.teacher}</strong>
                          <small>{r.reason}</small>
                        </span>
                        <span>
                          <b>
                            {
                              {
                                pending: 'განსახილველი',
                                approved: 'დამტკიცებული',
                                denied: 'უარყოფილი',
                                cancelled: 'გაუქმებული',
                              }[r.state]
                            }
                          </b>
                          <small>
                            {r.absence
                              ? `${r.absence.startsOn} — ${r.absence.endsOn}`
                              : `${r.changes.length} გაკვეთილი`}{' '}
                            · {r.createdAt.slice(0, 10)}
                          </small>
                        </span>
                        <ArrowRight size={16} />
                      </button>
                    ))}
                </div>
              ) : (
                <EmptyState
                  title="ამ რიგში მოთხოვნა არ არის"
                  description="მოთხოვნები გამოჩნდება გაკვეთილის დეტალებიდან ან დროებითი მიუწვდომლობის პროცესიდან."
                />
              )}
            </section>
          )}
          {tab === 'availability' && (manage || canRequest) && (
            <section className="tt-operational">
              <header>
                <div>
                  <span className="product-eyebrow">მასწავლებლის დრო</span>
                  <h2>{manage ? 'ხელმისაწვდომლობა' : 'ჩემი მიუწვდომლობა'}</h2>
                  <p>კვირეული შეზღუდვები და დროებითი არყოფნა · მხოლოდ განრიგისთვის.</p>
                </div>
                <Button onClick={() => setDialog('availability')}>
                  {manage ? 'პერიოდის დამატება' : 'დროებითი მიუწვდომლობის მოთხოვნა'}
                </Button>
              </header>
              {manage && (
                <label className="tt-availability-teacher">
                  <span>მასწავლებელი</span>
                  <Select
                    aria-label="ხელმისაწვდომობის მასწავლებელი"
                    value={availabilityTeacher || data.teachers[0]?.id || ''}
                    onChange={(e) => setAvailabilityTeacher(e.target.value)}
                  >
                    {data.teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </Select>
                </label>
              )}
              {availability.isError ? (
                <ErrorState onRetry={() => void availability.refetch()} />
              ) : (
                <>
                  <h3>განმეორებადი კვირა</h3>
                  <div className="tt-availability-matrix">
                    <table>
                      <thead>
                        <tr>
                          <th>პერიოდი</th>
                          {weekdayLabels.map((d) => (
                            <th key={d}>{d.slice(0, 3)}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {Array.from(
                          { length: Math.max(7, ...periods.map((p) => p.number)) },
                          (_, i) => i + 1,
                        ).map((n) => (
                          <tr key={n}>
                            <th>{n}</th>
                            {weekdayLabels.map((d, i) => {
                              const rules = (availability.data?.items ?? []).filter(
                                (a) =>
                                  a.teacherId ===
                                    (manage
                                      ? availabilityTeacher || data.teachers[0]?.id
                                      : viewer.personId) &&
                                  a.weekdays?.includes(i + 1) &&
                                  (!a.periodNumbers.length || a.periodNumbers.includes(n)) &&
                                  a.endsOn > from &&
                                  a.startsOn < shift(from, 7),
                              );
                              return (
                                <td
                                  key={d}
                                  className={rules.length ? 'is-unavailable' : ''}
                                  title={rules.map((a) => a.reason).join(' · ')}
                                >
                                  {rules.length ? (
                                    <>
                                      <LockKeyhole size={12} />
                                      <span>დაკავებულია</span>
                                    </>
                                  ) : (
                                    <span className="tt-available-mark">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <h3>შეზღუდვების პერიოდები</h3>
                  {(availability.data?.items ?? [])
                    .filter(
                      (a) =>
                        a.teacherId ===
                        (manage ? availabilityTeacher || data.teachers[0]?.id : viewer.personId),
                    )
                    .map((a) => (
                      <article className="tt-availability-rule" key={a.id}>
                        <div>
                          <strong>
                            {a.weekdays ? 'კვირეული შეზღუდვა' : 'დროებითი მიუწვდომლობა'}
                          </strong>
                          <p>
                            {a.startsOn} — {a.endsOn} <span>ბოლო დღე არ შედის</span>
                          </p>
                          <small>
                            {a.reason} ·{' '}
                            {a.periodNumbers.length
                              ? `პერიოდები ${a.periodNumbers.join(', ')}`
                              : 'მთელი დღე'}
                          </small>
                        </div>
                        <div>
                          <Button
                            onClick={() => {
                              setLens({
                                kind: 'teacher',
                                id: a.teacherId,
                                name:
                                  data.teachers.find((t) => t.id === a.teacherId)?.name ??
                                  'ჩემი განრიგი',
                              });
                              setFrom(monday(a.startsOn));
                              switchVersion('');
                              setLens({
                                kind: 'teacher',
                                id: a.teacherId,
                                name:
                                  data.teachers.find((t) => t.id === a.teacherId)?.name ??
                                  'ჩემი განრიგი',
                              });
                              setTab('schedule');
                            }}
                          >
                            დაკავშირებული განრიგი
                          </Button>
                          {manage && a.endsOn > tbilisiDate() && (
                            <Button onClick={() => setEnding(a)}>პერიოდის დასრულება</Button>
                          )}
                        </div>
                      </article>
                    ))}
                  {!(availability.data?.items ?? []).some(
                    (a) =>
                      a.teacherId ===
                      (manage ? availabilityTeacher || data.teachers[0]?.id : viewer.personId),
                  ) && (
                    <p className="tt-quiet-empty">
                      ამ მასწავლებლისთვის შეზღუდვა არ არის მითითებული.
                    </p>
                  )}
                </>
              )}
            </section>
          )}
          {tab === 'setup' && manage && (
            <section className="tt-setup">
              <header>
                <span className="product-eyebrow">საფუძვლები</span>
                <h2>განრიგის კონფიგურაცია</h2>
                <p>ზარი და ჯგუფები ვერსიის ნაწილია. გამოქვეყნებული კონფიგურაცია უცვლელად რჩება.</p>
              </header>
              <section>
                <div className="tt-setup-heading">
                  <h3>ვერსიები და მოქმედების პერიოდი</h3>
                  <div>
                    <Select
                      aria-label="სასწავლო წელი"
                      value={data.yearId ?? ''}
                      onChange={(e) => {
                        setYearId(e.target.value);
                        switchVersion('');
                      }}
                    >
                      {data.years.map((y) => (
                        <option key={y.id} value={y.id}>
                          {y.name}
                        </option>
                      ))}
                    </Select>
                    <Button onClick={() => setDialog('draft')}>სამუშაო ვერსია</Button>
                  </div>
                </div>
                {data.versions.map((v) => (
                  <button
                    className={`tt-version-row ${v.id === versionId ? 'is-selected' : ''}`}
                    key={v.id}
                    onClick={() => switchVersion(v.id)}
                  >
                    <span>
                      {v.status === 'draft' ? <FilePenLine size={16} /> : <LockKeyhole size={16} />}
                      <strong>{v.name}</strong>
                    </span>
                    <span>
                      {v.startsOn} — {v.endsOn}
                    </span>
                    <small>
                      {v.status === 'draft'
                        ? 'სამუშაო'
                        : v.startsOn > tbilisiDate()
                          ? 'დაგეგმილი გამოქვეყნება'
                          : v.endsOn <= tbilisiDate()
                            ? 'ისტორიული'
                            : 'გამოქვეყნებული'}
                    </small>
                  </button>
                ))}
              </section>
              <section>
                <div className="tt-setup-heading">
                  <h3>ზარის განრიგი</h3>
                  {editable && (
                    <Button onClick={() => setDialog('bell')}>პერიოდის დამატება / შეცვლა</Button>
                  )}
                </div>
                {!versionId ? (
                  <p>აირჩიეთ ზემოთ ვერსია მისი კონფიგურაციის სანახავად.</p>
                ) : (
                  doc?.periods.map((p) => (
                    <div className="tt-bell-row" key={p.id}>
                      <b className="product-number">{String(p.number).padStart(2, '0')}</b>
                      <time>
                        {p.start} — {p.end}
                      </time>
                      <span>{p.teaching ? 'სასწავლო პერიოდი' : 'შესვენება'}</span>
                      <small>
                        {p.weekdays.map((d) => weekdayLabels[d - 1]?.slice(0, 3)).join(' · ')}
                      </small>
                    </div>
                  ))
                )}
                <small>დროები კონფიგურირებადია; საწყისი მნიშვნელობები სადემონსტრაციოა.</small>
              </section>
              <section>
                <div className="tt-setup-heading">
                  <h3>სასწავლო ჯგუფები</h3>
                  {editable && (
                    <Button onClick={() => setDialog('group')}>ჯგუფის დამატება / შეცვლა</Button>
                  )}
                </div>
                {!doc && <p>ჯგუფების სანახავად აირჩიეთ განრიგის ვერსია.</p>}
                {doc && !doc.groups.length && <p>ამ ვერსიაში სასწავლო ჯგუფი ჯერ არ არის.</p>}
                {doc?.groups.map((g) => (
                  <div className="tt-group-row" key={g.id}>
                    <strong>{g.name}</strong>
                    <span>
                      {g.sources
                        .map(
                          (s) =>
                            `${data.offerings.find((o) => o.id === s.offeringId)?.section ?? ''} · ${s.studentIds ? `${s.studentIds.length} არჩეული` : 'კურსის სრული სია'}`,
                        )
                        .join(' / ')}
                    </span>
                  </div>
                ))}
              </section>
              <section>
                <div className="tt-setup-heading">
                  <h3>ოთახები</h3>
                  <Button onClick={() => setDialog('room')}>ოთახის დამატება</Button>
                </div>
                <div className="tt-room-directory">
                  {data.rooms.map((r) => (
                    <span className="product-number" key={r.id}>
                      {r.number}
                    </span>
                  ))}
                </div>
              </section>
              <section>
                <div className="tt-setup-heading">
                  <div>
                    <h3>ერთჯერადი / საგანგებო დღე</h3>
                    <p>
                      არსებული გაკვეთილიდან შექმენით თარიღის გამონაკლისი; ძირითადი კვირა უცვლელია.
                    </p>
                  </div>
                  <Button onClick={() => setDialog('extra')}>დამატებითი დღე / გაკვეთილი</Button>
                </div>
              </section>
            </section>
          )}
        </div>
        {selected &&
          !editing &&
          (selected.lesson ? (
            <Panel
              title={selected.subject}
              description={`${selected.group} · ${weekdayLabels[selected.weekday - 1]} · ${selected.start}–${selected.end}`}
              onOpenChange={closeInspector}
            >
              <dl className="tt-lesson-facts">
                <div>
                  <dt>მასწავლებელი</dt>
                  <dd>{selected.teacher}</dd>
                </div>
                <div>
                  <dt>ოთახი</dt>
                  <dd>{selected.room}</dd>
                </div>
                <div>
                  <dt>პერიოდი</dt>
                  <dd>{selected.number}</dd>
                </div>
                <div>
                  <dt>მოქმედება</dt>
                  <dd>
                    {draft.data?.startsOn} — {draft.data?.endsOn}
                  </dd>
                </div>
              </dl>
              <p className="tt-detail-state">
                {editable ? 'პირადი სამუშაო ვერსია' : 'უცვლელი გამოქვეყნებული ვერსია'}
              </p>
              {conflicts
                .filter((c) => c.lessonIds.some((id) => id.includes(`:${selected.lessonId}:`)))
                .map((c) => (
                  <p className="tt-inspector-warning" key={c.key}>
                    <AlertTriangle size={14} />
                    {c.date} · {c.message}
                  </p>
                ))}
              {editable && (
                <>
                  <Button variant="primary" onClick={() => setEditing(selected.lesson!)}>
                    რედაქტირება / გადატანა
                  </Button>
                  <p className="tt-quiet-empty">
                    მასწავლებლის, ოთახის ან ჯგუფის შეცვლა და წაშლა ხდება განხილვის შემდეგ.
                  </p>
                </>
              )}
            </Panel>
          ) : (
            selected.occurrence && (
              <ChangeDialog
                key={selected.id}
                occurrence={selected.occurrence}
                conflicts={conflicts.filter((c) => c.lessonIds.includes(selected.id))}
                requestCount={
                  requests.data?.items.filter(
                    (r) =>
                      r.state === 'pending' &&
                      (r.changes.some((c) => c.occurrenceId === selected.id) ||
                        (r.absence &&
                          r.absence.teacherId === selected.teacherId &&
                          r.absence.startsOn <= selected.occurrence!.targetDate &&
                          r.absence.endsOn > selected.occurrence!.targetDate)),
                  ).length ?? 0
                }
                setup={data}
                manage={manage && selected.occurrence.targetDate >= tbilisiDate()}
                canRequest={
                  canRequest &&
                  selected.teacherId === viewer.personId &&
                  selected.occurrence.targetDate >= tbilisiDate()
                }
                onClose={closeInspector}
              />
            )
          ))}
        {review && (
          <RequestDialog
            key={review.id}
            item={review}
            setup={data}
            manage={manage}
            onClose={closeInspector}
          />
        )}
        {editing && doc && (
          <ReviewPanel
            title={editing.id ? 'გაკვეთილის რედაქტირება' : 'გაკვეთილის დამატება'}
            description="ცვლილება მხოლოდ სამუშაო ვერსიას ეხება. გამოქვეყნება ცალკე მოქმედებაა."
            onClose={() => setEditing(null)}
            onSave={async (f) => {
              const item: Lesson = {
                id: editing.id ?? crypto.randomUUID(),
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
              closeInspector();
            }}
          >
            <Field
              label="ჯგუფი"
              name="groupId"
              value={editing.groupId ?? (activeLens.kind === 'group' ? activeLens.id : undefined)}
            >
              <option value="">აირჩიეთ ჯგუფი</option>
              {doc.groups.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </Field>
            <TeacherRoom
              setup={data}
              teacherId={
                editing.teacherId ?? (activeLens.kind === 'teacher' ? activeLens.id : undefined)
              }
              roomId={editing.roomId ?? (activeLens.kind === 'room' ? activeLens.id : undefined)}
            />
            <Field label="კვირის დღე" name="weekday" value={editing.weekday}>
              {weekdayLabels.map((d, i) => (
                <option key={d} value={i + 1}>
                  {d}
                </option>
              ))}
            </Field>
            <Field label="პერიოდი" name="periodId" value={editing.periodId}>
              {doc.periods
                .filter((p) => p.teaching)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.number} · {p.start}—{p.end}
                  </option>
                ))}
            </Field>
            {editing.id && (
              <label className="op-check">
                <input name="remove" type="checkbox" />
                გაკვეთილის წაშლა სამუშაო ვერსიიდან
              </label>
            )}
          </ReviewPanel>
        )}
      </div>
      {scopeOpen && (
        <Modal
          open
          onOpenChange={() => setScopeOpen(false)}
          title="განრიგის ჭრილის არჩევა"
          description="იპოვეთ კლასი, მასწავლებელი, ჯგუფი ან ოთახი."
          className="tt-scope-dialog"
        >
          <div className="tt-scope-search">
            <Search size={18} />
            <input
              autoFocus
              placeholder="ძებნა სახელით ან ნომრით…"
              aria-label="განრიგის ჭრილის ძებნა"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="tt-scope-results">
            <button
              onClick={() => {
                setLens({ kind: 'school', id: '', name: 'სკოლის მიმოხილვა' });
                setScopeOpen(false);
                closeInspector();
              }}
            >
              <span>მთელი სკოლა</span>
              <small>ოპერაციული მიმოხილვა</small>
            </button>
            {options
              .filter((o) =>
                `${o.name} ${lensLabels[o.kind]}`
                  .toLocaleLowerCase('ka')
                  .includes(search.toLocaleLowerCase('ka')),
              )
              .map((o) => (
                <button
                  key={o.kind + o.id}
                  onClick={() => {
                    setLens(o);
                    setScopeOpen(false);
                    closeInspector();
                  }}
                >
                  <span>{o.name}</span>
                  <small>{lensLabels[o.kind]}</small>
                </button>
              ))}
          </div>
        </Modal>
      )}
      {dialog === 'draft' && (
        <OperationDialog
          title="სამუშაო განრიგი"
          description="შექმენით პირადი სამუშაო ვერსია. ბოლო თარიღი არ შედის."
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
            switchVersion(r.id);
            setTab('schedule');
          }}
        >
          <Field label="ვერსიის სახელი" name="name" />
          <Field
            label="დაწყება"
            name="startsOn"
            type="date"
            value={[tbilisiDate(), data.years.find((y) => y.id === data.yearId)?.startsOn ?? '']
              .sort()
              .at(-1)}
          />
          <Field
            label="დასრულება (არ შედის)"
            name="endsOn"
            type="date"
            value={data.years.find((y) => y.id === data.yearId)?.endsOn}
          />
          <Field label="არსებული ვერსიის კოპირება" name="copyId" required={false}>
            <option value="">ცარიელი განრიგი</option>
            {data.versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} · {v.startsOn}
              </option>
            ))}
          </Field>
        </OperationDialog>
      )}
      {move && doc && (
        <MoveDialog
          move={move}
          versionId={versionId}
          onClose={() => setMove(null)}
          onSave={async () => {
            await save(
              {
                ...doc,
                lessons: doc.lessons.map((l) =>
                  l.id === move.lessonId
                    ? { ...l, weekday: move.weekday, periodId: move.periodId }
                    : l,
                ),
              },
              move.revision,
            );
            closeInspector();
          }}
        />
      )}
      {dialog === 'compare' && draft.data && (
        <Modal
          open
          onOpenChange={() => setDialog(null)}
          title="ცვლილებების განხილვა"
          description={`${draft.data.name} · ${draft.data.startsOn} — ${draft.data.endsOn} · შედარება პერიოდის დასაწყისში მოქმედ ვერსიასთან`}
          className="tt-compare-dialog"
        >
          {baseline.isPending && baselineId ? (
            <Skeleton />
          ) : baseline.isError ? (
            <ErrorState onRetry={() => void baseline.refetch()} />
          ) : (
            <>
              <div className="tt-compare-head">
                <span>{baseline.data?.name ?? 'ამ პერიოდის საწყისი ვერსია არ არის'}</span>
                <ArrowRight size={16} />
                <strong>{draft.data.name}</strong>
              </div>
              <p>
                დათარიღებული გამონაკლისები რჩება საკუთარ ისტორიულ ვერსიასთან. მომავალი ვერსიები
                ძალაში რჩება საკუთარი დაწყების თარიღიდან.
              </p>
              {differences.length ? (
                <div className="tt-differences">
                  {differences.map((d) => (
                    <article key={d.id}>
                      <span>{d.kind}</span>
                      <h3>{d.title}</h3>
                      <div>
                        <del>{d.before}</del>
                        <ins>{d.after}</ins>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="სტრუქტურული ცვლილება არ არის"
                  description="გამოქვეყნება მაინც ქმნის ახალ მოქმედების პერიოდს."
                />
              )}
              <div className="tt-publish-summary">
                <span>
                  {conflicts.length} კონფლიქტი · {differences.length} ცვლილება
                </span>
                <Button variant="primary" onClick={() => setDialog('publish')}>
                  გამოქვეყნების დადასტურება
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
      {dialog === 'publish' && draft.data && (
        <PublishDialog
          draft={draft.data}
          onClose={() => setDialog(null)}
          onPublished={() => {
            switchVersion('');
            setFeedback('განრიგი გამოქვეყნებულია.');
          }}
        />
      )}
      {dialog === 'bell' && doc && (
        <BellEditor doc={doc} onSave={save} onClose={() => setDialog(null)} />
      )}
      {dialog === 'group' && doc && (
        <GroupEditor doc={doc} setup={data} onSave={save} onClose={() => setDialog(null)} />
      )}
      {dialog === 'room' && (
        <OperationDialog
          title="ოთახის დამატება"
          description="ოთახის ნომერი გამოიყენება განრიგსა და გადაფარვის შემოწმებაში."
          onClose={() => setDialog(null)}
          onSave={(f) => command({ action: 'room.create', number: text(f, 'number') })}
        >
          <Field label="ოთახის ნომერი" name="number" />
        </OperationDialog>
      )}
      {dialog === 'availability' && (
        <AvailabilityDialog
          setup={data}
          viewer={viewer}
          manage={manage}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'extra' && (
        <ExtraLesson
          setup={data}
          onClose={() => setDialog(null)}
          onSelect={(o) => {
            setDialog(null);
            setTab('schedule');
            setSelected(fromOccurrence(o));
          }}
        />
      )}
      {ending && (
        <OperationDialog
          title="მიუწვდომლობის დასრულება"
          description="წარსული რჩება ისტორიაში. ახალი შეზღუდვა საჭიროებისას ცალკე დაამატეთ."
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
          <Field label="დასრულება (არ შედის)" name="endsOn" type="date" value={tbilisiDate()} />
          <Field label="მიზეზი" name="reason" />
        </OperationDialog>
      )}
    </div>
  );
}
