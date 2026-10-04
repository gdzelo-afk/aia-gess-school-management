import { DateInput } from '../DateInput';
import { Select } from '../Select';
import { Link } from 'react-router-dom';
import { Panel } from './Panel';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Viewer } from '../../../shared/contracts';
import type {
  TimetableSetup,
  DraftView,
  TimetableDocument,
  Occurrence,
  TimetableConflict,
  RequestView,
  LessonChange,
  Availability,
} from '../../../shared/timetable';
import { weekdayLabels } from '../../../shared/timetable';
import { api, queryClient } from '../../lib/api';
import { tbilisiDate } from '../../lib/semester';
import { Button, ErrorState, Skeleton, Modal } from '../ui';
import { OperationDialog, Field, text } from '../Operations';
export const shift = (d: string, n: number) =>
  new Date(Date.parse(`${d}T12:00:00Z`) + n * 86400000).toISOString().slice(0, 10);
export const monday = (d: string) => shift(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
export const post = <T,>(path: string, body: unknown) =>
  api<T>(path, { method: 'POST', body: JSON.stringify(body) });
export async function command(body: unknown) {
  const result = await post<{ id: string }>('/api/timetable/actions', body);
  await queryClient.invalidateQueries({
    predicate: (q) => ['timetable', 'overview'].includes(String(q.queryKey[0])),
  });
  return result;
}
export const toChange = (o: Occurrence): LessonChange => ({
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
export function TeacherRoom({
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
export function BellEditor({
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
        <Select aria-label="არსებული პერიოდი" value={id} onChange={(e) => setId(e.target.value)}>
          <option value="">ახალი</option>
          {doc.periods.map((p) => (
            <option key={p.id} value={p.id}>
              {p.number} · {p.start}
            </option>
          ))}
        </Select>
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
export function GroupEditor({
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
        <Select
          value={id}
          onChange={(e) => {
            setId(e.target.value);
            setOfferingIds(null);
          }}
        >
          <option value="">ახალი</option>
          {doc.groups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </Select>
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
            <Select
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
            </Select>
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
export function ConflictList({ conflicts }: { conflicts: TimetableConflict[] }) {
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
export function PublishDialog({
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
export function ChangeDialog({
  occurrence: o,
  setup,
  manage,
  canRequest,
  onClose,
  conflicts = [],
  requestCount = 0,
}: {
  occurrence: Occurrence;
  setup: TimetableSetup;
  manage: boolean;
  canRequest: boolean;
  onClose: () => void;
  conflicts?: TimetableConflict[];
  requestCount?: number;
}) {
  const [editing, setEditing] = useState(false);
  const version = useQuery({
    queryKey: ['timetable', 'draft', o.versionId],
    queryFn: () => api<DraftView>(`/api/timetable/drafts/${o.versionId}`),
    enabled: manage,
  });
  if (!editing || (!manage && !canRequest))
    return (
      <Panel
        open
        onOpenChange={onClose}
        title={o.subject}
        description={`${o.targetDate} · ${o.start}—${o.end}`}
      >
        <dl className="tt-lesson-facts">
          <div>
            <dt>ჯგუფი</dt>
            <dd>{o.group}</dd>
          </div>
          <div>
            <dt>მასწავლებელი</dt>
            <dd>{o.teacher}</dd>
          </div>
          <div>
            <dt>ოთახი</dt>
            <dd>{o.room}</dd>
          </div>
          <div>
            <dt>პერიოდი</dt>
            <dd>{o.number}</dd>
          </div>
        </dl>
        {conflicts.map((c) => (
          <p className="tt-inspector-warning" key={c.key}>
            {c.message}
          </p>
        ))}
        {requestCount > 0 && (
          <p className="tt-detail-state">განსახილველი მოთხოვნა: {requestCount}</p>
        )}
        {(manage || canRequest) && (
          <Button variant="primary" onClick={() => setEditing(true)}>
            {manage ? 'ერთჯერადი ცვლილება' : 'ცვლილების მოთხოვნა'}
          </Button>
        )}
        <p className="tt-quiet-empty">
          {o.changed
            ? 'ამ გაკვეთილზე მოქმედებს თარიღის გამონაკლისი.'
            : 'გამოქვეყნებული განმეორებადი გაკვეთილი.'}{' '}
          ცვლილება არ გადააკეთებს ძირითად კვირას.
        </p>
        {!o.cancelled && (
          <Link
            className="overview-inline-link"
            to={`/attendance?lesson=${encodeURIComponent(o.id)}&date=${o.targetDate}`}
          >
            დასწრების გახსნა
          </Link>
        )}
        {o.cancelled && <p className="tt-inspector-warning">გაკვეთილი გაუქმებულია</p>}
      </Panel>
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
export function ChangesForm({
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
    <Panel
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
          <details
            className="tt-change-fields"
            key={c.occurrenceId}
            open={changes.length === 1 ? true : undefined}
          >
            <summary>
              {c.targetDate} · {c.start} · {setup.teachers.find((t) => t.id === c.teacherId)?.name}{' '}
              {c.cancelled ? '· გაუქმება' : ''}
            </summary>
            <div className="op-form-grid">
              <label className="op-field">
                <span>გაკვეთილის თარიღი</span>
                <DateInput
                  type="date"
                  required
                  value={c.targetDate}
                  onChange={(e) => change(i, { targetDate: e.target.value })}
                />
              </label>
              <label className="op-field">
                <span>მასწავლებელი</span>
                <Select
                  aria-label={`მასწავლებელი ${i + 1}`}
                  value={c.teacherId}
                  onChange={(e) => change(i, { teacherId: e.target.value })}
                >
                  {setup.teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="op-field">
                <span>ოთახი</span>
                <Select value={c.roomId} onChange={(e) => change(i, { roomId: e.target.value })}>
                  {setup.rooms.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.number}
                    </option>
                  ))}
                </Select>
              </label>
              {document && (
                <>
                  <label className="op-field">
                    <span>ჯგუფი / კურსი</span>
                    <Select
                      value={c.groupId}
                      onChange={(e) => change(i, { groupId: e.target.value })}
                    >
                      {document.groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </Select>
                  </label>
                  <label className="op-field">
                    <span>პერიოდი</span>
                    <Select
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
                    </Select>
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
          </details>
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
        <div className="ux-feedback-slot">
          {error && (
            <p role="alert" className="field-error">
              {error}
              <Button
                type="button"
                onClick={async () => {
                  await queryClient.invalidateQueries({ queryKey: ['timetable'] });
                  onClose();
                }}
              >
                მიმდინარე მონაცემების ჩატვირთვა
              </Button>
            </p>
          )}
        </div>
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
    </Panel>
  );
}
export function AvailabilityDialog({
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
    [proposals, setProposals] = useState<Record<string, LessonChange>>({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const patch = (p: Partial<Availability>) => {
    setA({ ...a, ...p });
    setItems(null);
    setProposals({});
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
                : {
                    action: 'request.create',
                    absence: a,
                    changes: Object.values(proposals),
                    reason,
                  },
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
              <Select
                aria-label="მასწავლებელი"
                value={a.teacherId}
                onChange={(e) => patch({ teacherId: e.target.value })}
              >
                {setup.teachers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </label>
          )}
          {(['startsOn', 'endsOn'] as const).map((key) => (
            <label key={key} className="op-field">
              <span>{key === 'startsOn' ? 'დაწყება' : 'დასრულება (არ შედის)'}</span>
              <DateInput
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
              <Select
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
              </Select>
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
            {!manage && (
              <p className="op-hint">
                შესთავაზეთ ჩანაცვლება, გაუქმება ან გადატანა. დაუგეგმავ გაკვეთილებს ადმინისტრაცია
                გადაწყვეტს.
              </p>
            )}
            {items.map((o) => (
              <details className="tt-absence-proposal" key={o.id}>
                <summary>
                  {o.targetDate} · {o.start} · {o.subject}
                  <small>
                    {o.group} · {proposals[o.id] ? 'შეთავაზება მზადაა' : 'საჭიროა გადაწყვეტა'}
                  </small>
                </summary>
                {manage ? (
                  <p>
                    {o.teacher} · ოთახი {o.room}
                  </p>
                ) : (
                  <>
                    <label className="op-check">
                      <input
                        type="checkbox"
                        checked={!!proposals[o.id]}
                        onChange={(e) =>
                          setProposals((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[o.id] = toChange(o);
                            else delete next[o.id];
                            return next;
                          })
                        }
                      />
                      ამ გაკვეთილის ცვლილების შეთავაზება
                    </label>
                    {proposals[o.id] && (
                      <div className="op-form-grid">
                        <label className="op-field">
                          <span>შემცვლელი</span>
                          <Select
                            aria-label={`შემცვლელი ${o.start} ${o.targetDate}`}
                            value={proposals[o.id]!.teacherId}
                            onChange={(e) =>
                              setProposals((prev) => ({
                                ...prev,
                                [o.id]: { ...prev[o.id]!, teacherId: e.target.value },
                              }))
                            }
                          >
                            {setup.teachers.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                        </label>
                        <label className="op-field">
                          <span>ახალი თარიღი</span>
                          <DateInput
                            type="date"
                            value={proposals[o.id]!.targetDate}
                            onChange={(e) =>
                              setProposals((prev) => ({
                                ...prev,
                                [o.id]: { ...prev[o.id]!, targetDate: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label className="op-check">
                          <input
                            type="checkbox"
                            checked={proposals[o.id]!.cancelled}
                            onChange={(e) =>
                              setProposals((prev) => ({
                                ...prev,
                                [o.id]: { ...prev[o.id]!, cancelled: e.target.checked },
                              }))
                            }
                          />
                          გაუქმების შეთავაზება
                        </label>
                      </div>
                    )}
                  </>
                )}
              </details>
            ))}
            {manage && (
              <p>
                შენახვის შემდეგ ეს გაკვეთილები განრიგში კონფლიქტად გამოჩნდება. თითოეულის ცვლილება
                გაკვეთილის დეტალებიდან მართეთ.
              </p>
            )}
          </div>
        )}
        <div className="ux-feedback-slot">
          {error && (
            <p role="alert" className="field-error">
              {error}
            </p>
          )}
        </div>
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
export function RequestDialog({
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
  const current = useQuery({
    queryKey: ['timetable', 'request-current', r.id],
    queryFn: () =>
      api<{ items: Occurrence[] }>(
        `/api/timetable/week?from=${r.absence?.startsOn ?? r.changes[0]?.date}&days=14`,
      ),
    enabled: manage && r.state === 'pending',
  });
  const [deny, setDeny] = useState(false);
  if (r.state !== 'pending')
    return (
      <Panel open onOpenChange={onClose} title="მოთხოვნის ისტორია" description={r.teacher}>
        <p>{r.reason}</p>
        <p>{r.decision}</p>
      </Panel>
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
      <Panel
        open
        onOpenChange={onClose}
        title="დაკავშირებული გაკვეთილები"
        description="მოთხოვნის მოქმედი გაკვეთილები იტვირთება."
      >
        <Skeleton />
      </Panel>
    );
  if (affected.isError)
    return (
      <Panel
        open
        onOpenChange={onClose}
        title="მოთხოვნის გადახედვა"
        description="გაკვეთილების ჩატვირთვა ვერ მოხერხდა."
      >
        <ErrorState onRetry={() => void affected.refetch()} />
      </Panel>
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
      <p className="tt-quiet-empty">
        მიღებულია {r.createdAt.slice(0, 10)} ·{' '}
        {r.absence
          ? `${r.absence.startsOn} — ${r.absence.endsOn}`
          : `${r.changes.length} გაკვეთილი`}
      </p>
      <details className="tt-request-before">
        <summary>მიმდინარე და მოთხოვნილი განრიგი</summary>
        {changes.map((c) => {
          const o = current.data?.items.find((o) => o.id === c.occurrenceId);
          return (
            <div key={c.occurrenceId}>
              <strong>
                {o?.subject ?? 'გაკვეთილი'} · {o?.group ?? ''}
              </strong>
              <p>
                ახლა: {o?.targetDate ?? c.date} · {o?.start ?? c.start} · {o?.teacher ?? r.teacher}
              </p>
              <p>
                შეთავაზება:{' '}
                {c.cancelled
                  ? 'გაუქმება'
                  : `${c.targetDate} · ${c.start} · ${setup.teachers.find((t) => t.id === c.teacherId)?.name ?? ''}`}
              </p>
            </div>
          );
        })}
      </details>
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
export function ExtraLesson({
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
        <Select
          aria-label="გამოქვეყნებული ვერსია"
          value={id}
          onChange={(e) => setId(e.target.value)}
        >
          {setup.versions
            .filter((v) => v.status === 'published')
            .map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
        </Select>
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

export function MoveDialog({
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
