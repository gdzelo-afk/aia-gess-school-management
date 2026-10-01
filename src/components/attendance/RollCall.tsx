import { useEffect, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Check,
  Clock3,
  ChevronDown,
  ShieldCheck,
  History,
  AlertTriangle,
} from 'lucide-react';
import {
  attendanceLabels,
  approximateLateness,
  type AttendanceEntry,
  type AttendanceCommand,
} from '../../../shared/attendance';
import { api } from '../../lib/api';
import { Button, Skeleton, ErrorState } from '../ui';
import { dateLabel } from '../../lib/format';
import { type LessonView, command, localTime, timestamp, historyLabels } from './model';

export function RollCall({ id, onClose }: { id: string; onClose: () => void }) {
  const [refresh, setRefresh] = useState(0);
  const q = useQuery({
    queryKey: ['attendance', 'lesson', id],
    queryFn: () => api<LessonView>(`/api/attendance/lesson?occurrenceId=${encodeURIComponent(id)}`),
    staleTime: 0,
    refetchInterval: (query) => (query.state.data?.window?.started === false ? 15_000 : false),
  });
  if (q.isPending) return <Skeleton />;
  if (q.isError) return <ErrorState onRetry={() => void q.refetch()} />;
  return (
    <RollCallEditor
      key={`${id}:${q.data.revision}:${q.data.expectedToken}:${q.data.window?.started}:${refresh}`}
      data={q.data}
      onClose={onClose}
      reload={() => void q.refetch().then(() => setRefresh((n) => n + 1))}
    />
  );
}
function RollCallEditor({
  data,
  onClose,
  reload,
}: {
  data: LessonView;
  onClose: () => void;
  reload: () => void;
}) {
  const [mode, setMode] = useState<'read' | 'edit' | 'request'>(
    !data.revision && data.canWrite ? 'edit' : 'read',
  );
  const [values, setValues] = useState<Record<string, AttendanceEntry>>(() =>
    Object.fromEntries(data.entries.map((r) => [r.studentId, r])),
  );
  const [dirty, setDirty] = useState(false),
    [detail, setDetail] = useState<string | null>(null),
    [reason, setReason] = useState(''),
    [reconcile, setReconcile] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [success, setSuccess] = useState('');
  const retry = useRef<{ body: string; id: string } | null>(null);
  const roster =
    reconcile && data.currentRoster
      ? data.currentRoster.map((r) => ({ ...r, authorized: false }))
      : data.roster;
  const occurrence = reconcile && data.currentOccurrence ? data.currentOccurrence : data.occurrence;
  const editing = mode !== 'read';
  const entries = roster.flatMap((r) => (values[r.studentId] ? [values[r.studentId]!] : []));
  const unresolved = roster.length - entries.length;
  const counts = Object.keys(attendanceLabels).map((status) => ({
    status,
    label: attendanceLabels[status as AttendanceEntry['status']],
    count: entries.filter((e) => e.status === status).length,
  }));
  useEffect(() => {
    if (!dirty) return;
    const before = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      const link = (e.target as HTMLElement).closest('a[href]');
      if (link && !confirm('ცვლილებები არ არის შენახული. დატოვებთ გვერდს?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', before);
    document.addEventListener('click', click, true);
    return () => {
      window.removeEventListener('beforeunload', before);
      document.removeEventListener('click', click, true);
    };
  }, [dirty]);
  const close = () => {
    if (!dirty || confirm('ცვლილებები არ არის შენახული. დატოვებთ გვერდს?')) onClose();
  };
  const update = (id: string, patch: Partial<AttendanceEntry>) => {
    setValues((v) => ({
      ...v,
      [id]: {
        studentId: id,
        status: 'present',
        arrival: null,
        departure: null,
        timeSource: 'reported',
        ...v[id],
        ...patch,
      },
    }));
    setDirty(true);
    setSuccess('');
  };
  const choose = (id: string, status: AttendanceEntry['status']) => {
    update(id, {
      status,
      arrival:
        status === 'late'
          ? (values[id]?.arrival ?? (localTime() > occurrence.end ? occurrence.end : localTime()))
          : null,
      departure:
        status === 'absent' || status === 'authorized' ? null : (values[id]?.departure ?? null),
    });
    if (status === 'late') setDetail(id);
  };
  const submit = async () => {
    setBusy(true);
    setError('');
    const proposal = {
      occurrenceId: occurrence.id,
      expectedToken: data.expectedToken,
      revision: data.revision,
      entries,
      reason: reason.trim() || undefined,
      reconcileRoster: reconcile,
    };
    const body =
      mode === 'request'
        ? { action: 'request.create', proposal, reason }
        : { action: 'submit', ...proposal };
    const signature = JSON.stringify(body);
    if (retry.current?.body !== signature)
      retry.current = { body: signature, id: crypto.randomUUID() };
    try {
      await command({ ...body, commandId: retry.current.id } as AttendanceCommand);
      setDirty(false);
      setMode('read');
      setSuccess(
        mode === 'request' ? 'მოთხოვნა გაგზავნილია ადმინისტრაციასთან.' : 'დასწრება შენახულია.',
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const needsReason = mode === 'request' || data.revision > 0 || data.canManage;
  return (
    <section className="att-rollcall" aria-label="გაკვეთილის დასწრება">
      <button className="att-back" onClick={close}>
        <ArrowLeft size={17} /> დასწრებაზე დაბრუნება
      </button>
      <header className="att-lesson-header">
        <div>
          <span className="eyebrow">
            {dateLabel(occurrence.targetDate)} · {occurrence.number} გაკვეთილი
          </span>
          <h1>{occurrence.subject}</h1>
          <p>
            {occurrence.group} · {occurrence.teacher}
          </p>
        </div>
        <div className="att-lesson-time">
          <strong>
            {occurrence.start}—{occurrence.end}
          </strong>
          <span>ოთახი {occurrence.room}</span>
        </div>
      </header>
      <div className="att-state-line" role="status">
        <span>
          {dirty
            ? 'შეუნახავი ცვლილებები'
            : data.revision
              ? `შენახულია · ${timestamp(data.submittedAt!)}`
              : data.window && !data.window.started
                ? 'გაკვეთილი ჯერ არ დაწყებულა'
                : data.window?.locked
                  ? 'პირდაპირი შესწორების ვადა ამოიწურა'
                  : data.window?.overdue
                    ? 'დასწრება შესავსებია · ვადაგადაცილებულია'
                    : 'დასწრება ჯერ არ არის შევსებული'}
        </span>
        <span>
          {data.window ? 'შესწორება: ' + timestamp(data.window.locksAt) + '-მდე' : 'პირადი ისტორია'}
        </span>
      </div>
      {success && (
        <p role="status" className="att-feedback">
          {success}
        </p>
      )}
      {data.discrepancy && (
        <div className="att-warning">
          <AlertTriangle size={18} />
          <div>
            განრიგი ან სია შეიცვალა. შენახული ისტორია დაცულია.
            {data.canManage && data.currentRoster && (
              <label>
                <input
                  type="checkbox"
                  checked={reconcile}
                  onChange={(e) => {
                    setReconcile(e.target.checked);
                    setMode('edit');
                    setDirty(true);
                  }}
                />{' '}
                მიმდინარე სიის მიხედვით შეჯერება
              </label>
            )}
          </div>
        </div>
      )}
      <div className="att-roster-tools">
        <div>
          <h2>
            მოსწავლეები <span>{roster.length}</span>
          </h2>
          <p>
            {editing
              ? 'მონიშნეთ დასწრება, შემდეგ შეინახეთ ერთიანად.'
              : 'გაკვეთილის დადასტურებული მდგომარეობა.'}
          </p>
        </div>
        {editing ? (
          <Button
            onClick={() => {
              setValues((v) => {
                const next = { ...v };
                for (const r of roster)
                  if (!next[r.studentId])
                    next[r.studentId] = {
                      studentId: r.studentId,
                      status: 'present',
                      arrival: null,
                      departure: null,
                      timeSource: 'reported',
                    };
                return next;
              });
              setDirty(true);
            }}
          >
            ყველა ესწრება
          </Button>
        ) : (
          <div className="att-actions">
            {data.canWrite && (
              <Button
                onClick={() => {
                  setMode('edit');
                  setReason('');
                }}
              >
                შესწორება
              </Button>
            )}
            {data.canRequest && (
              <Button onClick={() => setMode('request')}>შესწორების მოთხოვნა</Button>
            )}
          </div>
        )}
      </div>
      {editing && (
        <p className="att-key-hint">
          Tab — მოსწავლე / მოქმედება · მიმართულების ღილაკები — სტატუსის არჩევა · Space — მონიშვნა
        </p>
      )}
      <div className="att-roster" role="list" aria-label="დასწრების სია">
        {roster.map((r, index) => {
          const v = values[r.studentId],
            expanded = detail === r.studentId;
          return (
            <div
              className={`att-pupil ${v ? '' : 'is-unresolved'}`}
              role="listitem"
              key={r.studentId}
            >
              <div className="att-pupil-main">
                <span className="att-index">{String(index + 1).padStart(2, '0')}</span>
                <div className="att-pupil-name">
                  <strong>{r.name}</strong>
                  <small>
                    {r.number}
                    {r.authorized && (
                      <span>
                        <ShieldCheck size={12} /> გაცდენა შეთანხმებულია
                      </span>
                    )}
                  </small>
                </div>
                {editing ? (
                  <fieldset className="att-status-controls">
                    <legend className="sr-only">{r.name} — სტატუსი</legend>
                    {Object.entries(attendanceLabels).map(([key, label]) => (
                      <label key={key} className={v?.status === key ? 'selected' : ''}>
                        <input
                          type="radio"
                          name={`status-${r.studentId}`}
                          value={key}
                          checked={v?.status === key}
                          disabled={key === 'authorized' && !r.authorized && !data.canManage}
                          onChange={() => choose(r.studentId, key as AttendanceEntry['status'])}
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </fieldset>
                ) : (
                  <span className={`att-mark mark-${v?.status ?? 'unknown'}`}>
                    {v ? attendanceLabels[v.status] : 'მონაცემები ჯერ არ არის'}
                  </span>
                )}
                <button
                  className="att-row-detail"
                  aria-label={`${r.name} — დრო და დეტალები`}
                  aria-expanded={expanded}
                  onClick={() => setDetail(expanded ? null : r.studentId)}
                >
                  <ChevronDown size={17} />
                </button>
              </div>
              {!v && editing && <span className="att-unresolved">მონიშვნა საჭიროა</span>}
              {v?.arrival && (
                <p className="att-time-note">
                  <Clock3 size={13} /> {v.arrival} · ≈{' '}
                  {approximateLateness(occurrence.start, v.arrival)} წუთით დაგვიანება
                  {v.timeSource === 'estimated' ? ' · სავარაუდო დრო' : ''}
                </p>
              )}
              {v?.departure && <p className="att-time-note">ადრე გავიდა · {v.departure}</p>}
              {expanded && (
                <div className="att-inline-detail">
                  {editing && v ? (
                    <>
                      {v.status === 'late' && (
                        <>
                          <label>
                            მოსვლის დრო
                            <input
                              type="time"
                              value={v.arrival ?? ''}
                              min={occurrence.start}
                              max={occurrence.end}
                              onChange={(e) =>
                                update(r.studentId, { arrival: e.target.value || null })
                              }
                            />
                          </label>
                          <label>
                            დროის წყარო
                            <select
                              value={v.timeSource}
                              onChange={(e) =>
                                update(r.studentId, {
                                  timeSource: e.target.value as 'reported' | 'estimated',
                                })
                              }
                            >
                              <option value="reported">მითითებული</option>
                              <option value="estimated">სავარაუდო</option>
                            </select>
                          </label>
                        </>
                      )}
                      {['present', 'late'].includes(v.status) && (
                        <>
                          <label className="att-check">
                            <input
                              type="checkbox"
                              checked={!!v.departure}
                              onChange={(e) =>
                                update(r.studentId, {
                                  departure: e.target.checked ? localTime() : null,
                                })
                              }
                            />{' '}
                            ადრე გასვლა
                          </label>
                          <p className="att-time-note">
                            გასვლის დროის აღრიცხვა ნებართვის გაცემას არ ნიშნავს. მოსწავლის გაშვება
                            ადმინისტრაციასთან უნდა იყოს შეთანხმებული.
                          </p>
                          {v.departure !== null && (
                            <label>
                              გასვლის დრო
                              <input
                                type="time"
                                value={v.departure}
                                min={v.arrival ?? occurrence.start}
                                max={occurrence.end}
                                onChange={(e) => update(r.studentId, { departure: e.target.value })}
                              />
                            </label>
                          )}
                        </>
                      )}
                      {!['present', 'late'].includes(v.status) && (
                        <p>გაცდენისას მოსვლისა და გასვლის დრო არ ივსება.</p>
                      )}
                    </>
                  ) : (
                    <p>
                      {r.authorized
                        ? 'ადმინისტრაციამ გაცდენის განმარტება დაადასტურა.'
                        : 'დროის დამატებითი ჩანაწერი არ არის.'}{' '}
                      პირადი განმარტებები ამ სიაში არ ქვეყნდება.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {!roster.length && <p className="att-warning">ამ გაკვეთილისთვის მოსწავლეთა სია ცარიელია.</p>}
      {editing && (
        <>
          {needsReason && (
            <label className="att-reason">
              {mode === 'request'
                ? 'განუმარტეთ ადმინისტრაციას შესწორების მიზეზი'
                : 'შესწორების / შევსების მიზეზი'}
              <textarea
                value={reason}
                minLength={5}
                maxLength={600}
                onChange={(e) => {
                  setReason(e.target.value);
                  setDirty(true);
                }}
                placeholder="მოკლედ მიუთითეთ ცვლილების მიზეზი"
              />
            </label>
          )}
          {error && (
            <div role="alert" className="att-warning">
              {error}
              <Button
                onClick={() => {
                  if (
                    !dirty ||
                    confirm('ჩაიტვირთოს მიმდინარე ჩანაწერი? შეუნახავი ცვლილებები დაიკარგება.')
                  ) {
                    setDirty(false);
                    reload();
                  }
                }}
              >
                მიმდინარე ჩანაწერის ჩატვირთვა
              </Button>
            </div>
          )}
          <footer className="att-submit">
            <div className="att-counts">
              {counts.map((c) => (
                <span key={c.status}>
                  <strong>{c.count}</strong>
                  {c.label}
                </span>
              ))}
              <span className={unresolved ? 'att-attention' : ''}>
                <strong>{unresolved}</strong>მოსანიშნი
              </span>
            </div>
            <div className="att-submit-actions">
              <span>{dirty ? 'შეუნახავი ცვლილებები' : 'შეამოწმეთ სია'}</span>
              <Button
                disabled={
                  busy ||
                  unresolved > 0 ||
                  !roster.length ||
                  (needsReason && reason.trim().length < 5)
                }
                variant="primary"
                onClick={() => void submit()}
              >
                <Check size={16} />
                {busy
                  ? 'ინახება…'
                  : mode === 'request'
                    ? 'მოთხოვნის გაგზავნა'
                    : data.revision
                      ? 'შესწორების შენახვა'
                      : 'დასწრების შენახვა'}
              </Button>
            </div>
          </footer>
        </>
      )}
      {!!data.history.length && (
        <details className="att-history">
          <summary>
            <History size={17} /> აღრიცხვის ისტორია · {data.history.length}
          </summary>
          {[...data.history]
            .sort((a, b) => b.revision - a.revision)
            .map((h) => (
              <article key={h.revision}>
                <header>
                  <strong>{historyLabels[h.action] ?? 'ჩანაწერის ცვლილება'}</strong>
                  <span>
                    {timestamp(h.at)} · {h.actor ?? 'თანამშრომელი'}
                  </span>
                </header>
                {h.reason && <p>{h.reason}</p>}
                <ul>
                  {h.after.entries
                    .filter(
                      (e) =>
                        !h.before ||
                        JSON.stringify(e) !==
                          JSON.stringify(h.before.entries.find((b) => b.studentId === e.studentId)),
                    )
                    .map((e) => {
                      const before = h.before?.entries.find((b) => b.studentId === e.studentId);
                      return (
                        <li key={e.studentId}>
                          {h.after.snapshot.roster.find((r) => r.studentId === e.studentId)?.name} ·{' '}
                          {before ? attendanceLabels[before.status] + ' → ' : ''}
                          {attendanceLabels[e.status]}
                          {e.arrival ? ' · მოსვლა ' + e.arrival : ''}
                          {e.departure ? ' · გასვლა ' + e.departure : ''}
                        </li>
                      );
                    })}
                </ul>
              </article>
            ))}
        </details>
      )}
    </section>
  );
}
