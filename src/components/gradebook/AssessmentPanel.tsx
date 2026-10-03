import { useEffect, useState, useSyncExternalStore, type KeyboardEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Check, Pencil, History as HistoryIcon, Save, Send, X } from 'lucide-react';
import {
  categoryLabels,
  gradeStateLabels,
  type GradebookEntry,
  type ResultValue,
} from '../../../shared/gradebook';
import { api } from '../../lib/api';
import { dateLabel } from '../../lib/format';
import { Button, ErrorState, Skeleton, Modal } from '../ui';
import {
  command,
  errorText,
  historyTime,
  stateLabels,
  valueLabel,
  type Assessment,
  type History,
} from './model';

const subscribeWidth = (fn: () => void) => {
  const q = matchMedia('(max-width: 1150px)');
  q.addEventListener('change', fn);
  return () => q.removeEventListener('change', fn);
};
export function AssessmentPanel({
  id,
  onClose,
  onSaved,
}: {
  id: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const narrow = useSyncExternalStore(
    subscribeWidth,
    () => matchMedia('(max-width: 1150px)').matches,
    () => false,
  );
  const data = useQuery({
    queryKey: ['gradebook', 'assessment', id],
    queryFn: () => api<Assessment>(`/api/gradebook/assessments/${id}`),
    staleTime: 0,
  });
  if (data.isPending)
    return (
      <aside className="gb-inspector">
        <Skeleton rows={6} />
      </aside>
    );
  if (data.isError)
    return (
      <aside className="gb-inspector">
        <ErrorState onRetry={() => void data.refetch()} />
      </aside>
    );
  return (
    <Editor
      key={`${id}:${data.data.revision}`}
      data={data.data}
      narrow={narrow}
      onClose={onClose}
      onSaved={() => {
        void data.refetch();
        onSaved();
      }}
    />
  );
}
function Editor({
  data,
  narrow,
  onClose,
  onSaved,
}: {
  data: Assessment;
  narrow: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [editing, setEditing] = useState(data.status === 'draft'),
    [entries, setEntries] = useState<GradebookEntry[]>(data.entries),
    [reason, setReason] = useState(''),
    [feedback, setFeedback] = useState(''),
    [busy, setBusy] = useState(false),
    [history, setHistory] = useState(false),
    [confirm, setConfirm] = useState(false),
    [details, setDetails] = useState(false),
    [detailsDirty, setDetailsDirty] = useState(false),
    [descriptionDraft, setDescriptionDraft] = useState({
      action: 'assessment.describe' as 'assessment.describe' | 'assessment.void',
      title: data.title,
      description: data.description,
      activity: data.activity,
      reason: '',
    });
  const dirty = JSON.stringify(entries) !== JSON.stringify(data.entries);
  const canEdit = data.canEdit;
  useEffect(() => {
    if (!dirty && !detailsDirty) return;
    const unload = (e: BeforeUnloadEvent) => e.preventDefault();
    const navigate = (e: MouseEvent) => {
      if (
        (e.target as HTMLElement).closest('a[href]') &&
        !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?')
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', unload);
    document.addEventListener('click', navigate, true);
    return () => {
      window.removeEventListener('beforeunload', unload);
      document.removeEventListener('click', navigate, true);
    };
  }, [dirty, detailsDirty]);
  const close = onClose;
  const save = async (publish = false) => {
    setBusy(true);
    setFeedback('');
    try {
      if (publish) {
        if (dirty) throw Error('ჯერ შეინახეთ მონახაზი.');
        await command({
          action: 'assessment.publish',
          id: data.id,
          revision: data.revision,
          rosterToken: data.rosterToken,
        });
      } else
        await command(
          data.status === 'draft'
            ? {
                action: 'assessment.save',
                id: data.id,
                revision: data.revision,
                rosterToken: data.rosterToken,
                entries,
              }
            : {
                action: 'assessment.correct',
                id: data.id,
                revision: data.revision,
                entries,
                reason,
              },
        );
      onSaved();
    } catch (e) {
      setFeedback(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const update = (studentId: string, value: ResultValue) =>
    setEntries((old) => old.map((e) => (e.studentId === studentId ? { ...e, value } : e)));
  const move = (e: KeyboardEvent<HTMLElement>, index: number) => {
    if (
      (e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'Enter') &&
      e.target instanceof HTMLInputElement
    ) {
      e.preventDefault();
      const next = Math.min(
        data.roster.length - 1,
        Math.max(0, index + (e.key === 'ArrowUp' ? -1 : 1)),
      );
      const input = document.querySelector<HTMLInputElement>(`[data-grade-index="${next}"]`);
      input?.focus();
      input?.select();
    }
  };
  const invalid = entries.some((e) =>
    e.value.kind === 'numeric'
      ? !Number.isInteger(e.value.score) || e.value.score < 1 || e.value.score > 10
      : e.value.kind === 'formative' && !e.value.text.trim(),
  );
  const counts = {
    assessed: entries.filter((e) => e.value.kind !== 'state').length,
    missing: entries.filter((e) => e.value.kind === 'state' && e.value.state !== 'exempt').length,
  };
  const content = (
    <aside
      className="gb-inspector"
      data-dirty={dirty || detailsDirty}
      aria-label="შეფასების დეტალები"
    >
      <header className="gb-inspector-head">
        <button className="gb-back" onClick={close}>
          <ArrowLeft size={16} /> ჟურნალში დაბრუნება
        </button>
        <span className={`gb-status ${data.status}`}>{stateLabels[data.status]}</span>
      </header>
      <div className="gb-inspector-body">
        <div className="eyebrow">
          {categoryLabels[data.category]} · {dateLabel(data.date)}
        </div>
        <h2>{data.title}</h2>
        <p className="gb-muted">
          {data.labels.subject} · {data.labels.teacher}
        </p>
        {data.description && <p>{data.description}</p>}
        <div className="gb-panel-tools">
          {canEdit && !editing && (
            <Button onClick={() => setEditing(true)}>
              <Pencil size={15} /> შესწორება
            </Button>
          )}
          <Button variant="ghost" onClick={() => setHistory(!history)}>
            <HistoryIcon size={15} /> ისტორია
          </Button>
          {editing && data.status === 'published' && (
            <Button
              variant="ghost"
              onClick={() => {
                setEntries(data.entries);
                setEditing(false);
              }}
            >
              გაუქმება
            </Button>
          )}
        </div>
        {canEdit && data.status === 'published' && !editing && (
          <Button
            variant="ghost"
            onClick={() => {
              if (detailsDirty && !window.confirm('შეუნახავი ცვლილებები დაიკარგება. გაგრძელება?'))
                return;
              if (details) {
                setDescriptionDraft({
                  action: 'assessment.describe',
                  title: data.title,
                  description: data.description,
                  activity: data.activity,
                  reason: '',
                });
              }
              setDetailsDirty(false);
              setDetails(!details);
            }}
          >
            აღწერა / გაუქმება
          </Button>
        )}
        {details && (
          <AssessmentDescription
            data={data}
            onSaved={onSaved}
            draft={descriptionDraft}
            onDraft={(value) => {
              setDescriptionDraft(value);
              setDetailsDirty(true);
            }}
          />
        )}
        {history && <HistoryDetail id={data.id} roster={data.roster} />}
        {data.criteriaId && <CriteriaDetail id={data.criteriaId} />}
        {data.reconciliation && (
          <div className="gb-notice">
            <strong>სია ან წესი შეიცვალა</strong>
            <p>
              მოქმედ სიაში {data.reconciliation.roster.length} მოსწავლეა. შეუსაბამო შეფასებები
              დარჩება შესავსები.
            </p>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await command({
                    action: 'assessment.reconcile',
                    id: data.id,
                    revision: data.revision,
                    rosterToken: data.reconciliation!.rosterToken,
                  });
                  onSaved();
                } catch (e) {
                  setFeedback(errorText(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              სიის შეჯერება
            </Button>
          </div>
        )}
        {editing && (
          <p className="gb-working-state">
            {dirty
              ? 'შეუნახავი ცვლილებები'
              : data.status === 'draft'
                ? 'შენახული მონახაზი'
                : 'შესწორების რეჟიმი'}{' '}
            · {counts.assessed} შეფასებული · {counts.missing} შესავსები
          </p>
        )}
        <div className="gb-entry-roster">
          {data.roster.map((p, index) => {
            const value = entries.find((e) => e.studentId === p.studentId)!.value;
            return (
              <div className="gb-entry-row" key={p.studentId} onKeyDown={(e) => move(e, index)}>
                <div className="gb-entry-identity">
                  <span className="gb-index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <strong>{p.name}</strong>
                    <small>
                      {p.section} · {p.number}
                      {editing && !p.canEdit
                        ? ' · ისტორიული შედეგი, ცვლილება ადმინისტრაციასთან'
                        : ''}
                    </small>
                  </div>
                </div>
                {editing && p.canEdit ? (
                  <ResultControl
                    label={p.name}
                    mode={data.mode}
                    category={data.category}
                    value={value}
                    index={index}
                    onChange={(v) => update(p.studentId, v)}
                  />
                ) : (
                  <div className={`gb-result gb-${value.kind}`}>{valueLabel(value)}</div>
                )}
                {p.recovery?.missing && (
                  <p className="gb-muted">
                    აღდგენის ვადა: {dateLabel(p.recovery.deadline)}
                    {p.recovery.requestStatus ? ` · ${stateLabels[p.recovery.requestStatus]}` : ''}
                    {p.recovery.extendedUntil
                      ? ` · დამატებითი ვადა: ${dateLabel(p.recovery.extendedUntil)}`
                      : ''}
                  </p>
                )}
                {p.recovery?.canRequest && (
                  <RecoveryRequest assessmentId={data.id} onSaved={onSaved} />
                )}
              </div>
            );
          })}
        </div>
        {editing && data.status === 'published' && (
          <label className="gb-field">
            შესწორების მიზეზი
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              minLength={5}
              maxLength={1000}
              placeholder="რა შეიცვალა და რატომ"
            />
          </label>
        )}
        {feedback && (
          <p role="alert" className="gb-error">
            {feedback}
          </p>
        )}
      </div>
      {editing && (
        <footer className="gb-savebar">
          <div>
            <strong>
              {dirty
                ? 'შეუნახავია'
                : data.status === 'draft'
                  ? 'პირადი მონახაზი'
                  : 'შესწორების რეჟიმი'}
            </strong>
            <small>
              {data.status === 'draft'
                ? 'გამოქვეყნებამდე ოჯახი ვერ ხედავს მონახაზს.'
                : 'ცვლილება დასაბუთებით ჩაიწერება ისტორიაში.'}
            </small>
          </div>
          <Button
            disabled={
              busy ||
              invalid ||
              !!data.reconciliation ||
              (!dirty && data.status !== 'draft') ||
              (data.status === 'published' && reason.trim().length < 5)
            }
            onClick={() => void save()}
          >
            <Save size={16} />
            {data.status === 'draft' ? 'მონახაზის შენახვა' : 'შესწორების შენახვა'}
          </Button>
          {data.status === 'draft' && (
            <Button
              variant="primary"
              disabled={busy || dirty || !!data.reconciliation}
              onClick={() => setConfirm(true)}
            >
              <Send size={16} /> გამოქვეყნება
            </Button>
          )}
        </footer>
      )}
      {confirm && (
        <div className="gb-publish-review" role="region" aria-label="გამოქვეყნების გადახედვა">
          <strong>შეფასება ოჯახისთვის ხილული გახდება</strong>
          <p>
            {counts.assessed} შეფასებული · {counts.missing} ჯერ შესავსები. გამოქვეყნების შემდეგ
            ცვლილებას მიზეზი და ისტორია სჭირდება.
          </p>
          <Button variant="primary" disabled={busy} onClick={() => void save(true)}>
            <Check size={16} /> დადასტურება და გამოქვეყნება
          </Button>
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            <X size={16} /> უკან
          </Button>
        </div>
      )}
    </aside>
  );
  return narrow ? (
    <Modal
      open
      onOpenChange={onClose}
      title="შეფასების დეტალები"
      description="შეფასება, შედეგები და ისტორია"
      className="gb-inspector-sheet"
    >
      {content}
    </Modal>
  ) : (
    content
  );
}
function ResultControl({
  label,
  mode,
  category,
  value,
  onChange,
  index,
}: {
  label: string;
  mode: Assessment['mode'];
  category: Assessment['category'];
  value: ResultValue;
  onChange: (v: ResultValue) => void;
  index: number;
}) {
  const type = value.kind === 'state' ? value.state : value.kind;
  const change = (next: string) => {
    if (next === 'numeric') onChange({ kind: 'numeric', score: 0 });
    else if (next === 'pass_fail') onChange({ kind: 'pass_fail', passed: true });
    else if (next === 'formative') onChange({ kind: 'formative', text: '' });
    else onChange({ kind: 'state', state: next as 'unassessed' });
  };
  return (
    <div className="gb-result-control">
      <select
        aria-label={`${label} · შეფასების ტიპი`}
        value={type}
        onChange={(e) => change(e.target.value)}
      >
        {mode === 'numeric_10' && <option value="numeric">ქულა</option>}
        {mode === 'pass_fail' && <option value="pass_fail">ჩათვლა / არჩათვლა</option>}
        <option value="formative">კომენტარი</option>
        {Object.entries(gradeStateLabels)
          .filter(([key]) => key !== 'recovery_required' || category === 'summative')
          .map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
      </select>
      {(value.kind === 'numeric' ||
        (mode === 'numeric_10' && value.kind === 'state' && value.state === 'unassessed')) && (
        <input
          data-grade-index={index}
          aria-label={`${label} · ქულა`}
          type="number"
          inputMode="numeric"
          min={1}
          max={10}
          step={1}
          placeholder="—"
          value={value.kind === 'numeric' && value.score ? value.score : ''}
          onChange={(e) =>
            onChange(
              e.target.value === ''
                ? { kind: 'state', state: 'unassessed' }
                : { kind: 'numeric', score: Number(e.target.value) },
            )
          }
        />
      )}
      {value.kind === 'pass_fail' && (
        <select
          aria-label={`${label} · ჩათვლა`}
          value={String(value.passed)}
          onChange={(e) => onChange({ kind: 'pass_fail', passed: e.target.value === 'true' })}
        >
          <option value="true">ჩათვლა</option>
          <option value="false">არჩათვლა</option>
        </select>
      )}
      {value.kind === 'formative' && (
        <textarea
          aria-label={`${label} · განმავითარებელი კომენტარი`}
          value={value.text}
          maxLength={2000}
          onChange={(e) => onChange({ kind: 'formative', text: e.target.value })}
        />
      )}
    </div>
  );
}
export function HistoryDetail({ id, roster }: { id: string; roster: Assessment['roster'] }) {
  const q = useQuery({
    queryKey: ['gradebook', 'history', id],
    queryFn: () => api<History>(`/api/gradebook/assessments/${id}/history`),
  });
  return (
    <div className="gb-history">
      {q.data?.map((h) => (
        <article key={h.revision}>
          <strong>
            {h.action === 'publish'
              ? 'პირველი გამოქვეყნება'
              : h.action === 'void'
                ? 'გაუქმება'
                : 'შესწორება'}{' '}
            · {historyTime(h.at)}
            {h.actor ? ` · ${h.actor}` : ''}
          </strong>
          <p>{h.title}</p>
          {h.reason && <p>{h.reason}</p>}
          {h.after
            .filter(
              (e) =>
                h.before.find((b) => b.studentId === e.studentId) &&
                JSON.stringify(h.before.find((b) => b.studentId === e.studentId)!.value) !==
                  JSON.stringify(e.value),
            )
            .map((e) => (
              <p key={e.studentId}>
                <strong>{roster.find((p) => p.studentId === e.studentId)?.name}</strong>
                <br />
                {valueLabel(h.before.find((b) => b.studentId === e.studentId)?.value)} →{' '}
                {valueLabel(e.value)}
              </p>
            ))}
        </article>
      ))}
      {q.isPending && <Skeleton rows={2} />}
    </div>
  );
}
function CriteriaDetail({ id }: { id: string }) {
  const q = useQuery({
    queryKey: ['gradebook', 'criteria', id],
    queryFn: () =>
      api<{ text: string; revision: number; fileId: string | null }>(
        `/api/gradebook/criteria/${id}`,
      ),
  });
  return (
    <details className="gb-criteria">
      <summary>შეფასების კრიტერიუმი · ვერსია {q.data?.revision}</summary>
      <p>{q.data?.text}</p>
      {q.data?.fileId && (
        <a href={`/api/gradebook/criteria/files/${q.data.fileId}`} download>
          კრიტერიუმის PDF
        </a>
      )}
    </details>
  );
}
function RecoveryRequest({ assessmentId, onSaved }: { assessmentId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false),
    [reason, setReason] = useState(''),
    [error, setError] = useState('');
  return (
    <div className="gb-request">
      {!open ? (
        <Button variant="ghost" onClick={() => setOpen(true)}>
          დამატებითი ვადის მოთხოვნა
        </Button>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            try {
              await command({ action: 'recovery.request', assessmentId, reason });
              setOpen(false);
              onSaved();
            } catch (err) {
              setError(errorText(err));
            }
          }}
        >
          <label className="gb-field">
            მოთხოვნის მიზეზი
            <textarea
              required
              minLength={5}
              maxLength={1000}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <p className="gb-muted">
            ჩვეულებრივი აღდგენის ვადის შემდეგ ადმინისტრაცია განიხილავს მოთხოვნას.
          </p>
          <Button type="submit">მოთხოვნის გაგზავნა</Button>
          {error && <p role="alert">{error}</p>}
        </form>
      )}
    </div>
  );
}

function AssessmentDescription({
  data,
  onSaved,
  draft,
  onDraft,
}: {
  data: Assessment;
  onSaved: () => void;
  draft: {
    action: 'assessment.describe' | 'assessment.void';
    title: string;
    description: string;
    activity: string;
    reason: string;
  };
  onDraft: (value: {
    action: 'assessment.describe' | 'assessment.void';
    title: string;
    description: string;
    activity: string;
    reason: string;
  }) => void;
}) {
  const { action, reason } = draft;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  return (
    <form
      className="gb-form"
      onSubmit={async (event) => {
        event.preventDefault();

        if (
          action === 'assessment.void' &&
          !window.confirm('შეფასება გამოირიცხება შედეგებიდან. ისტორია შენარჩუნდება. გაგრძელება?')
        )
          return;
        setBusy(true);
        try {
          await command({
            action,
            id: data.id,
            revision: data.revision,
            reason,
            ...(action === 'assessment.describe'
              ? {
                  title: draft.title,
                  description: draft.description,
                  activity: draft.activity,
                }
              : {}),
          });
          onSaved();
        } catch (e) {
          setError(errorText(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      <label className="gb-field">
        მოქმედება
        <select
          value={action}
          onChange={(e) => onDraft({ ...draft, action: e.target.value as typeof action })}
        >
          <option value="assessment.describe">აღწერის დაზუსტება</option>
          <option value="assessment.void">შეფასების გაუქმება</option>
        </select>
      </label>
      {action === 'assessment.describe' ? (
        <>
          <label className="gb-field">
            დასახელება
            <input
              name="title"
              value={draft.title}
              onChange={(e) => onDraft({ ...draft, title: e.target.value })}
              required
              minLength={2}
              maxLength={180}
            />
          </label>
          <label className="gb-field">
            აღწერა
            <textarea
              name="description"
              value={draft.description}
              onChange={(e) => onDraft({ ...draft, description: e.target.value })}
              maxLength={2000}
            />
          </label>
          <label className="gb-field">
            აქტივობა
            <input
              name="activity"
              value={draft.activity}
              onChange={(e) => onDraft({ ...draft, activity: e.target.value })}
              maxLength={100}
            />
          </label>
        </>
      ) : (
        <p className="gb-notice">
          გაუქმებული შეფასება საშუალოში აღარ ჩაითვლება. წინა შედეგები და ცვლილების ისტორია არ
          იშლება.
        </p>
      )}
      <label className="gb-field">
        ცვლილების დასაბუთება
        <textarea
          value={reason}
          onChange={(e) => onDraft({ ...draft, reason: e.target.value })}
          required
          minLength={5}
          maxLength={1000}
        />
      </label>
      {error && (
        <p role="alert" className="gb-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || reason.trim().length < 5}>
        დასაბუთებული ცვლილების შენახვა
      </Button>
    </form>
  );
}
