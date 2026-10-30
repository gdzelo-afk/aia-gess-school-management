import { WorkspaceNav } from '../components/WorkspaceNav';
import { DateInput } from '../components/DateInput';
import { Select } from '../components/Select';
import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, BookOpen, ChevronRight, Plus, Search, ShieldCheck } from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import { categoryLabels } from '../../shared/gradebook';
import { api } from '../lib/api';
import { dateLabel } from '../lib/format';
import { Button, EmptyState, ErrorState, Modal, Skeleton } from '../components/ui';
import { WritingEditor } from '../components/gradebook/WritingEditor';
import { AssessmentPanel } from '../components/gradebook/AssessmentPanel';
import {
  CreateAssessment,
  WritingForm,
  PolicyForm,
  CriteriaForm,
} from '../components/gradebook/Forms';
import { Reports, FamilyJournal } from '../components/gradebook/Reports';
import {
  command,
  errorText,
  valueLabel,
  stateLabels,
  type Overview,
  type Journal,
  type Setup,
  type Years,
  type Recovery,
  type Writings,
  type Criteria,
} from '../components/gradebook/model';
import '../styles/product-gradebook.css';

export function Gradebook() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>(),
    cache = useQueryClient();
  const [params, setParams] = useSearchParams();
  const [yearChoice, setYear] = useState(''),
    [termChoice, setTerm] = useState(''),
    [courseChoice, setCourse] = useState(params.get('course') ?? ''),
    [child, setChild] = useState(''),
    [search, setSearch] = useState(''),
    [tab, setTab] = useState(
      params.get('tab') === 'writings'
        ? 'writings'
        : params.get('tab') === 'recovery'
          ? 'recovery'
          : viewer.capabilities.includes('gradebook:school') && !params.get('assessment')
            ? 'overview'
            : 'journal',
    ),
    [form, setForm] = useState<null | 'create' | 'writing' | 'policy' | 'criteria'>(null);
  const school = viewer.capabilities.includes('gradebook:school'),
    teacher = viewer.capabilities.includes('gradebook:own'),
    homeroom = viewer.capabilities.includes('gradebook:homeroom'),
    manage = viewer.capabilities.includes('gradebook:correct'),
    policy = viewer.capabilities.includes('gradebook:policy'),
    family = !school && !teacher && !homeroom;
  const years = useQuery({
    queryKey: ['gradebook', 'years'],
    queryFn: () => api<Years>('/api/gradebook/years'),
  });
  const year =
    years.data?.find((y) => y.id === yearChoice) ??
    years.data?.find((y) => y.status === 'active') ??
    years.data?.[0];
  const semester = year?.semesters.find((s) => s.id === termChoice) ?? year?.semesters[0];
  const yearId = year?.id ?? '',
    semesterId = semester?.id ?? '';
  const base = `yearId=${yearId}&semesterId=${semesterId}`;
  const overview = useQuery({
    queryKey: ['gradebook', 'overview', yearId, semesterId],
    queryFn: () => api<Overview>(`/api/gradebook/overview?${base}`),
    enabled: school && !!semesterId && tab === 'overview',
  });
  const catalog = useQuery({
    queryKey: ['gradebook', 'catalog', yearId, semesterId],
    queryFn: () => api<Journal>(`/api/gradebook/journal?${base}`),
    enabled: !!semesterId,
  });
  const offeringId = catalog.data?.offerings.some((o) => o.id === courseChoice)
    ? courseChoice
    : (catalog.data?.offerings.find((o) => o.writable)?.id ?? catalog.data?.offerings[0]?.id ?? '');
  const journal = useQuery({
    queryKey: ['gradebook', 'journal', yearId, semesterId, offeringId, child],
    queryFn: () =>
      api<Journal>(
        `/api/gradebook/journal?${base}&offeringId=${offeringId}${child ? '&studentId=' + child : ''}`,
      ),
    enabled: !!offeringId,
  });
  const setup = useQuery({
    queryKey: ['gradebook', 'setup', yearId, semesterId],
    queryFn: () => api<Setup>(`/api/gradebook/setup?${base}`),
    enabled: !!semesterId && !family,
  });
  const queue = useQuery({
    queryKey: ['gradebook', 'recovery', yearId],
    queryFn: () => api<Recovery>(`/api/gradebook/recovery?yearId=${yearId}`),
    enabled: !!yearId && tab === 'recovery',
  });
  const writings = useQuery({
    queryKey: ['gradebook', 'writings', yearId, child],
    queryFn: () =>
      api<Writings>(
        `/api/gradebook/writings?yearId=${yearId}${child ? '&studentId=' + child : ''}`,
      ),
    enabled: !!yearId && tab === 'writings',
  });
  const criteria = useQuery({
    queryKey: ['gradebook', 'criteria-list', yearId],
    queryFn: () => api<Criteria>(`/api/gradebook/criteria?yearId=${yearId}`),
    enabled: !!yearId && tab === 'setup',
  });
  const selected = params.get('assessment');
  const [focusedPupil, setFocusedPupil] = useState<string | undefined>();
  const [closingDetail, setClosingDetail] = useState(false);
  const panelOpener = useRef<HTMLElement | null>(null);
  const panelAssessment = useRef(selected);
  const returnFocusRequested = useRef(false);
  const open = (id: string | null, pupilId?: string) => {
    const panel = document.querySelector('.gb-inspector[data-dirty="true"]');
    if (id !== selected && panel && !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?'))
      return false;
    returnFocusRequested.current = false;
    setClosingDetail(false);
    if (id) panelAssessment.current = id;
    if (
      id &&
      document.activeElement instanceof HTMLElement &&
      !document.activeElement.closest('.gb-inspector')
    )
      panelOpener.current = document.activeElement;
    setFocusedPupil(pupilId);
    setParams((p) => {
      if (id) p.set('assessment', id);
      else p.delete('assessment');
      return p;
    });
    return true;
  };
  const restorePanelFocus = useCallback(() => {
    if (!returnFocusRequested.current || document.querySelector('.gb-inspector')) return;
    if (panelOpener.current?.isConnected && panelOpener.current.getClientRects().length)
      panelOpener.current.focus({ preventScroll: true });
    else {
      // After a resize the original matrix cell can be hidden; return to its mobile assessment.
      const mobileOpener = panelAssessment.current
        ? document.querySelector<HTMLButtonElement>(
            `.gb-mobile-assessments [data-assessment-id="${CSS.escape(panelAssessment.current)}"]`,
          )
        : null;
      if (mobileOpener?.getClientRects().length) mobileOpener.focus({ preventScroll: true });
      else document.getElementById('main')?.focus({ preventScroll: true });
    }
  }, []);
  useEffect(() => {
    if (!selected) restorePanelFocus();
  }, [selected, restorePanelFocus]);
  useEffect(() => {
    if (!closingDetail) return;
    const timer = window.setTimeout(() => {
      setParams((p) => {
        p.delete('assessment');
        return p;
      });
      setFocusedPupil(undefined);
      setClosingDetail(false);
    }, 220);
    return () => window.clearTimeout(timer);
  }, [closingDetail, setParams]);
  const closePanel = () => {
    if (closingDetail) return;
    if (
      document.querySelector('.gb-inspector[data-dirty="true"]') &&
      !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?')
    )
      return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setParams((p) => {
        p.delete('assessment');
        return p;
      });
      setFocusedPupil(undefined);
    } else setClosingDetail(true);
    returnFocusRequested.current = true;
    // Restore after the closed state commits; sheets also wait for their focus trap.
  };
  const refresh = () => void cache.invalidateQueries({ queryKey: ['gradebook'] });
  const course = journal.data?.offerings.find((o) => o.id === offeringId),
    courseSetup = setup.data?.offerings.find((o) => o.id === offeringId);
  const canWrite = teacher && !!course?.writable;
  if (!viewer.capabilities.some((c) => c.startsWith('gradebook:')))
    return <EmptyState denied title="ჟურნალი მიუწვდომელია" />;
  return (
    <section
      className={`gradebook-workspace ${selected ? 'has-inspector' : ''} ${focusedPupil ? 'has-mark-detail' : ''} ${closingDetail ? 'is-detail-closing' : ''}`}
      aria-label="აკადემიური ჟურნალი"
    >
      <header className="gb-page-heading">
        <div>
          <span className="eyebrow">
            {family
              ? 'სწავლის სურათი'
              : school
                ? 'აკადემიური სამუშაო სივრცე'
                : 'შეფასება და უკუკავშირი'}
          </span>
          <h1>
            {family ? 'ჩემი შეფასებები' : 'ჟურნალი'}
            <i />
          </h1>
          <p>საგნის პროგრესი, გასაგები უკუკავშირი და გამოქვეყნებული შედეგები.</p>
        </div>
        {canWrite ? (
          <Button variant="primary" onClick={() => setForm('create')}>
            <Plus size={16} /> შეფასება
          </Button>
        ) : (
          <span className="gb-readonly">
            <ShieldCheck size={16} />
            {manage ? 'აკადემიური ზედამხედველობა' : 'ნახვის რეჟიმი'}
          </span>
        )}
      </header>
      <div className="gb-navigation">
        <WorkspaceNav active={tab} aria-label="ჟურნალის სამუშაო არეები">
          {[
            ...(school ? [['overview', 'მიმოხილვა']] : []),
            ['journal', family ? 'შეფასებები' : 'ჟურნალი'],
            ['reports', 'პროგრესი / ანგარიშები'],
            ['recovery', 'აღდგენა'],
            ['writings', family ? 'აკადემიური ჩანაწერები' : 'წერილობითი უკუკავშირი'],
            ...(!family ? [['setup', 'წესები / კრიტერიუმები']] : []),
          ].map(([id, label]) => (
            <button
              key={id}
              aria-current={tab === id ? 'page' : undefined}
              onClick={() => {
                if (open(null)) setTab(id!);
              }}
            >
              {label}
            </button>
          ))}
        </WorkspaceNav>
        <div className="gb-term-select">
          <label>
            <span className="sr-only">სასწავლო წელი</span>
            <Select
              value={yearId}
              onChange={(e) => {
                if (!open(null)) return;
                setYear(e.target.value);
                setTerm('');
                setCourse('');
              }}
            >
              {years.data?.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </label>
          <label>
            <span className="sr-only">სემესტრი</span>
            <Select
              value={semesterId}
              onChange={(e) => {
                if (open(null)) setTerm(e.target.value);
              }}
            >
              {year?.semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </label>
        </div>
      </div>
      {tab !== 'overview' && (
        <div className="gb-lensbar">
          <label className="gb-lens">
            <BookOpen size={18} />
            <span className="sr-only">საგნის კურსი</span>
            <Select
              value={offeringId}
              onChange={(e) => {
                if (open(null)) setCourse(e.target.value);
              }}
            >
              {catalog.data?.offerings.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.section} · {o.subject}
                </option>
              ))}
            </Select>
          </label>
          {family && viewer.capabilities.includes('gradebook:children') && (
            <label className="gb-field">
              <span className="sr-only">მოსწავლე</span>
              <Select
                value={child}
                onChange={(e) => {
                  if (!open(null)) return;
                  setChild(e.target.value);
                  setCourse('');
                }}
              >
                <option value="">ჩემი შვილები</option>
                {catalog.data?.pupils.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {!family && tab === 'journal' && (
            <label className="gb-search">
              <Search size={15} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="მოსწავლის მოძებნა"
                aria-label="მოსწავლის მოძებნა"
              />
            </label>
          )}
        </div>
      )}
      {years.isError || catalog.isError ? (
        <ErrorState
          onRetry={() => {
            void years.refetch();
            void catalog.refetch();
          }}
        />
      ) : !semesterId || catalog.isPending ? (
        <Skeleton rows={8} />
      ) : (
        <div className="gb-layout">
          <div className="gb-content">
            {tab === 'overview' &&
              (overview.isPending ? (
                <Skeleton rows={7} />
              ) : overview.isError ? (
                <ErrorState onRetry={() => void overview.refetch()} />
              ) : (
                overview.data && (
                  <>
                    <div className="gb-statline" aria-label="გამოქვეყნების მდგომარეობა">
                      <div>
                        <strong>{overview.data.published}</strong>
                        <span>გამოქვეყნებული შეფასება</span>
                      </div>
                      <div>
                        <strong>{overview.data.draft}</strong>
                        <span>პირადი მონახაზი · მხოლოდ რაოდენობა</span>
                      </div>
                      <div>
                        <strong>{overview.data.pendingRequests.length}</strong>
                        <span>აღდგენის მოთხოვნა</span>
                      </div>
                    </div>
                    {overview.data.pendingRequests.length > 0 && (
                      <div className="gb-notice">
                        <strong>აღდგენის გადაწყვეტილებები</strong>
                        <p>
                          მოსწავლეების მოთხოვნები პირად განხილვასა და დასაბუთებულ გადაწყვეტილებას
                          ელოდება.
                        </p>
                        <Button onClick={() => setTab('recovery')}>მოთხოვნების განხილვა</Button>
                      </div>
                    )}
                    <div className="gb-section-heading">
                      <div>
                        <h2>კურსების სამუშაო მდგომარეობა</h2>
                        <p>
                          აირჩიეთ კურსი შედეგებისა და შემაჯამებელი მოთხოვნების სანახავად.
                          მონახაზების შინაარსი ავტორთან რჩება.
                        </p>
                      </div>
                    </div>
                    <div className="gb-course-overview">
                      {overview.data.courses.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setCourse(c.id);
                            setTab('reports');
                          }}
                        >
                          <span>
                            <strong>{c.subject}</strong>
                            <small>{c.section}</small>
                          </span>
                          <span>
                            {c.published} გამოქვეყნებული
                            <small>
                              {c.draft} მონახაზი · {c.unresolvedSummatives} შეუფასებელი შემაჯამებელი
                            </small>
                          </span>
                          <ChevronRight size={16} />
                        </button>
                      ))}
                    </div>
                  </>
                )
              ))}
            {tab === 'journal' &&
              (!offeringId && catalog.isSuccess ? (
                <EmptyState title="ხელმისაწვდომი საგნის კურსი ჯერ არ არის" />
              ) : journal.isPending ? (
                <Skeleton rows={8} />
              ) : journal.isError ? (
                <ErrorState onRetry={() => void journal.refetch()} />
              ) : journal.data ? (
                <>
                  <div className="gb-section-heading">
                    <div>
                      <h2>{course?.subject}</h2>
                      <p>
                        {course?.section} · {journal.data.pupils.length} მოსწავლე ·{' '}
                        {journal.data.items.filter((i) => i.status === 'published').length}{' '}
                        გამოქვეყნებული შეფასება
                      </p>
                    </div>
                    <span className="gb-muted">შეფასება ≠ ოფიციალური ნიშანი</span>
                  </div>
                  {family ? (
                    <FamilyJournal data={journal.data} onOpen={open} />
                  ) : (
                    <Matrix
                      data={journal.data}
                      search={search}
                      selected={selected}
                      focusedPupil={focusedPupil}
                      onOpen={open}
                    />
                  )}
                </>
              ) : (
                <EmptyState title="შეფასებების კურსი ჯერ არ არის" />
              ))}
            {tab === 'reports' && (
              <Reports
                yearId={yearId}
                semesterId={semesterId}
                offeringId={offeringId}
                studentId={child}
                cohort={!family}
                onOpen={open}
              />
            )}
            {tab === 'recovery' &&
              (queue.isPending ? (
                <Skeleton />
              ) : queue.isError ? (
                <ErrorState onRetry={() => void queue.refetch()} />
              ) : (
                <RecoveryQueue data={queue.data ?? []} onOpen={open} onSaved={refresh} />
              ))}
            {tab === 'writings' && (
              <>
                <div className="gb-section-heading">
                  <div>
                    <h2>აკადემიური უკუკავშირი</h2>
                    <p>წლიური შეფასებები და ერთმხრივი კომენტარები.</p>
                  </div>
                  {(canWrite || homeroom) && (
                    <Button onClick={() => setForm('writing')}>
                      <Plus size={15} /> ჩანაწერი
                    </Button>
                  )}
                </div>
                {writings.isPending ? (
                  <Skeleton />
                ) : writings.isError ? (
                  <ErrorState onRetry={() => void writings.refetch()} />
                ) : (
                  <WritingList data={writings.data ?? []} onSaved={refresh} />
                )}
              </>
            )}
            {tab === 'setup' && (
              <>
                <div className="gb-section-heading">
                  <div>
                    <h2>საგნის აკადემიური წესი</h2>
                    <p>ვერსიები ინახავს გამოქვეყნებული შეფასების მნიშვნელობას.</p>
                  </div>
                  {policy && courseSetup && (
                    <Button onClick={() => setForm('policy')}>წესის ცვლილება</Button>
                  )}
                </div>
                {courseSetup?.policy ? (
                  <div className="gb-policy-summary">
                    <dl>
                      <div>
                        <dt>რეჟიმი</dt>
                        <dd>
                          {course?.mode === 'numeric_10'
                            ? '1–10 · მთელი ქულა'
                            : course?.mode === 'pass_fail'
                              ? 'ჩათვლა / არჩათვლა'
                              : 'განმავითარებელი'}
                        </dd>
                      </div>
                      <div>
                        <dt>შემაჯამებელი მოთხოვნა</dt>
                        <dd>{courseSetup.policy.requiredSummatives ?? 'დაუდგენელია'}</dd>
                      </div>
                      <div>
                        <dt>აღდგენა</dt>
                        <dd>{courseSetup.policy.policy.recoveryCalendarDays} კალენდარული დღე</dd>
                      </div>
                      <div>
                        <dt>წესი</dt>
                        <dd>თანაბარი წონა · ნახევარი ზემოთ მრგვალდება</dd>
                      </div>
                    </dl>
                    {courseSetup.policy.requirementBasis === 'demo' && (
                      <p className="gb-muted">
                        სადემონსტრაციო წესი · არ წარმოადგენს დადასტურებულ სასკოლო პოლიტიკას.
                      </p>
                    )}
                  </div>
                ) : (
                  <EmptyState title="ამ კურსის წესი ჯერ არ არის განსაზღვრული" />
                )}
                <div className="gb-section-heading">
                  <h2>შეფასების კრიტერიუმები</h2>
                  {policy && courseSetup && (
                    <Button onClick={() => setForm('criteria')}>
                      <Plus size={15} /> ახალი ვერსია
                    </Button>
                  )}
                </div>
                {criteria.isPending ? (
                  <Skeleton />
                ) : (
                  criteria.data
                    ?.filter((c) => c.subjectId === course?.subjectId)
                    .map((c) => (
                      <article className="gb-criteria-version" key={c.id}>
                        <header>
                          <strong>ვერსია {c.revision}</strong>
                          <span>{dateLabel(c.approvedAt.slice(0, 10))}</span>
                        </header>
                        <p>{c.text}</p>
                        {c.fileId && (
                          <a href={`/api/gradebook/criteria/files/${c.fileId}`} download>
                            კრიტერიუმის PDF <ArrowUpRight size={14} />
                          </a>
                        )}
                      </article>
                    ))
                )}
              </>
            )}
          </div>
          <div className="gb-detail-slot" inert={closingDetail}>
            {selected && (
              <div className="gb-detail-content">
                <AssessmentPanel
                  id={selected}
                  focusedPupil={focusedPupil}
                  closing={closingDetail}
                  onShowRoster={() => setFocusedPupil(undefined)}
                  onClose={closePanel}
                  onRestoreFocus={restorePanelFocus}
                  onSaved={refresh}
                />
              </div>
            )}
          </div>
        </div>
      )}
      {form === 'create' && setup.data && (
        <CreateAssessment
          setup={setup.data}
          yearId={yearId}
          semesterId={semesterId}
          offeringId={offeringId}
          onClose={() => setForm(null)}
          onCreated={(id) => {
            setForm(null);
            refresh();
            open(id);
          }}
        />
      )}
      {form === 'writing' && journal.data && (
        <WritingForm
          data={journal.data}
          yearId={yearId}
          offeringId={offeringId}
          homeroom={homeroom}
          canTeach={canWrite}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}
      {form === 'policy' && courseSetup && (
        <PolicyForm
          course={courseSetup}
          semesterId={semesterId}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}
      {form === 'criteria' && courseSetup && (
        <CriteriaForm
          yearId={yearId}
          course={courseSetup}
          criteria={criteria.data ?? []}
          onClose={() => setForm(null)}
          onSaved={refresh}
        />
      )}
    </section>
  );
}
function Matrix({
  data,
  search,
  selected,
  focusedPupil,
  onOpen,
}: {
  data: Journal;
  search: string;
  selected: string | null;
  focusedPupil?: string;
  onOpen: (id: string, pupilId?: string) => void;
}) {
  const pupils = data.pupils.filter((p) => p.name.includes(search) || p.number.includes(search));
  const groups = [
    ...(['classwork', 'homework', 'summative'] as const).map((category) => ({
      key: category,
      label: categoryLabels[category],
      items: data.items.filter(
        (a) => a.status !== 'void' && a.mode !== 'formative_only' && a.category === category,
      ),
    })),
    {
      key: 'formative',
      label: 'განმავითარებელი · ქულის გარეშე',
      items: data.items.filter((a) => a.status !== 'void' && a.mode === 'formative_only'),
    },
  ].filter((group) => group.items.length);
  const assessments = groups.flatMap((group) => group.items);
  const groupStarts = new Set(groups.map((group) => group.items[0]!.id));
  const dateSequences = new Map<string, number>();
  for (const group of groups) {
    for (const assessment of group.items) {
      const peers = group.items.filter((item) => item.date === assessment.date);
      if (peers.length > 1)
        dateSequences.set(assessment.id, peers.findIndex((item) => item.id === assessment.id) + 1);
    }
  }
  const move = (e: KeyboardEvent<HTMLButtonElement>, r: number, c: number) => {
    const delta = (
      { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] } as Record<
        string,
        number[]
      >
    )[e.key];
    if (!delta) return;
    e.preventDefault();
    document
      .querySelector<HTMLButtonElement>(
        `[data-gb-cell="${Math.max(0, Math.min(pupils.length - 1, r + delta[0]!))}:${Math.max(0, Math.min(assessments.length - 1, c + delta[1]!))}"]`,
      )
      ?.focus();
  };
  return (
    <>
      <div className="gb-desktop-matrix gb-scroll">
        <table className="gb-table">
          <caption className="sr-only">
            მოსწავლეები და შეფასებები. ისრებით გადაადგილება; Enter — დეტალები.
          </caption>
          <colgroup>
            <col />
          </colgroup>
          {groups.map((group) => (
            <colgroup key={group.key} span={group.items.length} />
          ))}
          <thead>
            <tr className="gb-category-row">
              <th rowSpan={2} scope="col" className="gb-pupil-heading">
                მოსწავლე <small>{pupils.length}</small>
              </th>
              {groups.map((group) => (
                <th
                  key={group.key}
                  scope="colgroup"
                  colSpan={group.items.length}
                  className="gb-category-heading"
                >
                  <span>{group.label}</span>
                </th>
              ))}
            </tr>
            <tr className="gb-date-row">
              {assessments.map((a) => (
                <th
                  key={a.id}
                  scope="col"
                  className={`${selected === a.id ? 'is-selected' : ''} ${groupStarts.has(a.id) ? 'gb-group-start' : ''}`}
                >
                  <button
                    onClick={() => onOpen(a.id)}
                    title={`${a.title} · ${dateLabel(a.date)} · ${stateLabels[a.status]}${dateSequences.has(a.id) ? ` · შეფასება ${dateSequences.get(a.id)}` : ''}`}
                    aria-label={`${a.title} · ${dateLabel(a.date)} · ${stateLabels[a.status]}${dateSequences.has(a.id) ? ` · შეფასება ${dateSequences.get(a.id)}` : ''}`}
                  >
                    <span className="gb-assessment-date">
                      {a.date.slice(8, 10)}
                      <span> / </span>
                      {a.date.slice(5, 7)}
                    </span>
                    {dateSequences.has(a.id) && (
                      <sup className="gb-date-sequence" aria-hidden="true">
                        {dateSequences.get(a.id)}
                      </sup>
                    )}
                    {a.status === 'draft' && <span className="gb-draft-dot" aria-hidden="true" />}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pupils.map((p, r) => (
              <tr
                key={p.id}
                className={selected && focusedPupil === p.id ? 'is-current-pupil' : ''}
              >
                <th scope="row">
                  <span className="gb-index">{String(r + 1).padStart(2, '0')}</span>
                  <span>
                    {p.name}
                    <small>{p.number}</small>
                  </span>
                </th>
                {assessments.map((a, c) => {
                  const e = a.entries.find((e) => e.studentId === p.id);
                  return (
                    <td
                      key={a.id}
                      className={`${selected === a.id ? 'is-selected' : ''} ${groupStarts.has(a.id) ? 'gb-group-start' : ''}`}
                    >
                      <button
                        data-gb-cell={`${r}:${c}`}
                        onKeyDown={(event) => move(event, r, c)}
                        onClick={() => onOpen(a.id, p.id)}
                        aria-label={`${p.name} · ${a.title} · ${valueLabel(e?.value)}`}
                        className={`gb-value-${e?.value.kind ?? 'state'} ${e?.value.kind === 'state' && e.value.state === 'recovery_required' ? 'needs-recovery' : ''} ${selected === a.id && focusedPupil === p.id ? 'is-current' : ''}`}
                      >
                        {valueLabel(e?.value, true)}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        {!assessments.length && (
          <EmptyState
            title="კურსის პირველი შეფასება"
            description={
              data.offerings.some((o) => o.writable)
                ? 'შექმენით შეფასება და შეავსეთ პირადი მონახაზი.'
                : 'გამოქვეყნებული შეფასებები აქ გამოჩნდება.'
            }
          />
        )}
      </div>
      <div className="gb-mobile-assessments">
        {assessments.map((a) => (
          <button key={a.id} data-assessment-id={a.id} onClick={() => onOpen(a.id)}>
            <div>
              <small>
                {dateLabel(a.date)} · {categoryLabels[a.category]}
              </small>
              <strong>{a.title}</strong>
              <span>
                {stateLabels[a.status]} · {a.roster.length} მოსწავლე
              </span>
            </div>
            <ChevronRight size={18} />
          </button>
        ))}
        {!assessments.length && <EmptyState title="ჯერ შეფასება არ არის" />}
      </div>
      <p className="gb-matrix-legend">
        <span className="gb-draft-key">
          <i className="gb-draft-dot" /> პირადი მონახაზი
        </span>
        — ჯერ არ შეფასებულა · გაცდ. არ ესწრებოდა · აღდგ. აღსადგენია · ნ/ვ არ ექვემდებარება.
        მდგომარეობები ქულად არ ითვლება.
      </p>
    </>
  );
}
function RecoveryQueue({
  data,
  onOpen,
  onSaved,
}: {
  data: Recovery;
  onOpen: (id: string) => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState<Recovery[number] | null>(null),
    [error, setError] = useState('');
  return (
    <>
      <div className="gb-section-heading">
        <div>
          <h2>აღდგენის მოთხოვნები</h2>
          <p>მოსწავლის მოთხოვნა → პირადი განხილვა → მასწავლებლის შეფასება.</p>
        </div>
        <strong className="gb-count">
          {data.filter((r) => ['submitted', 'follow_up', 'review'].includes(r.status)).length}
        </strong>
      </div>
      <div className="gb-queue">
        {data.map((r) => (
          <article key={r.id}>
            <div>
              <small>
                {stateLabels[r.status]} · {dateLabel(r.date)}
              </small>
              <h3>{r.pupil.name}</h3>
              <p>
                {r.subject} · {r.title}
              </p>
              {r.extendedUntil && <p>დამატებითი ვადა: {dateLabel(r.extendedUntil)}</p>}
              {r.reason && <p>{r.reason}</p>}
              {r.decision && <p>{r.decision}</p>}
            </div>
            <div>
              <Button variant="ghost" onClick={() => onOpen(r.assessmentId)}>
                შეფასება <ArrowUpRight size={14} />
              </Button>
              {r.canDecide && (
                <Button
                  onClick={() => {
                    setError('');
                    setSelected(r);
                  }}
                >
                  განხილვა
                </Button>
              )}
            </div>
          </article>
        ))}
        {!data.length && (
          <EmptyState
            title="აღდგენის მოთხოვნა არ არის"
            description="ვადაგასული შემაჯამებლის დამატებით აღდგენას მოსწავლე ითხოვს."
          />
        )}
      </div>
      {selected && (
        <Modal
          open
          onOpenChange={() => setSelected(null)}
          title="აღდგენის მოთხოვნის განხილვა"
          description={`${selected.pupil.name} · ${selected.title}`}
          className="gb-modal"
        >
          <form
            className="gb-form"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                await command({
                  action: 'recovery.decide',
                  id: selected.id,
                  revision: selected.revision,
                  status: f.get('status'),
                  physicalFollowUp: f.get('follow') === 'on',
                  extendedUntil: f.get('date') || null,
                  reason: f.get('reason'),
                });
                setSelected(null);
                onSaved();
              } catch (err) {
                setError(errorText(err));
              }
            }}
          >
            <label className="gb-field">
              გადაწყვეტილება
              <Select name="status">
                <option value="follow_up">პირადი განხილვის მოლოდინში</option>
                <option value="review">განხილვაშია</option>
                <option value="approved">დამტკიცება</option>
                <option value="denied">უარყოფა</option>
              </Select>
            </label>
            <label className="gb-checkbox">
              <input name="follow" type="checkbox" />
              პირადი / ოფლაინ განხილვა შედგა
            </label>
            <label className="gb-field">
              დამატებითი ვადა
              <DateInput name="date" type="date" />
            </label>
            <label className="gb-field">
              დასაბუთება
              <textarea name="reason" required minLength={5} maxLength={1000} />
            </label>
            {error && <p role="alert">{error}</p>}
            <Button type="submit" variant="primary">
              გადაწყვეტილების შენახვა
            </Button>
          </form>
        </Modal>
      )}
    </>
  );
}
function WritingList({ data, onSaved }: { data: Writings; onSaved: () => void }) {
  const [selected, setSelected] = useState<Writings[number] | null>(null);
  return (
    <div className="gb-writings">
      {data.map((w) => (
        <article key={w.id}>
          <header>
            <div>
              <small>
                {w.kind === 'narrative'
                  ? 'წლიური განმავითარებელი შეფასება'
                  : w.kind === 'homeroom_note'
                    ? 'დამრიგებლის კომენტარი'
                    : 'კომენტარი მშობელს'}{' '}
                · {stateLabels[w.status]}
              </small>
              <h3>{w.snapshot.student}</h3>
              <span>
                {w.snapshot.subject ?? 'ზოგადი აკადემიური უკუკავშირი'} · {w.snapshot.teacher}
              </span>
            </div>
            <Button onClick={() => setSelected(w)}>
              {w.status === 'draft' && w.canEdit ? 'გაგრძელება' : 'დეტალები / ისტორია'}
            </Button>
          </header>
          <p>{w.body}</p>
        </article>
      ))}
      {selected && (
        <WritingEditor item={selected} onClose={() => setSelected(null)} onSaved={onSaved} />
      )}
      {!data.length && <EmptyState title="აკადემიური ჩანაწერი ჯერ არ არის" />}
    </div>
  );
}
