import { DateInput } from '../components/DateInput';
import { Select } from '../components/Select';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, ArrowUpRight } from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import type {
  AcademicSetup,
  AcademicCommand,
  YearRecord,
  SectionRecord,
  SubjectRecord,
  CalendarRecord,
  OfferingRecord,
  RosterPage,
} from '../../shared/stage1a';
import { api } from '../lib/api';
import { Button, Badge, ErrorState, Skeleton, EmptyState, Modal } from '../components/ui';
import {
  OperationDialog,
  Field,
  PersonPicker,
  mutate,
  text,
  today,
} from '../components/Operations';
const statusLabels: Record<string, string> = {
  draft: 'მოსამზადებელი',
  active: 'მიმდინარე',
  archived: 'არქივში',
};
const kindLabels: Record<string, string> = {
  holiday: 'უქმე',
  vacation: 'არდადეგები',
  milestone: 'სასწავლო ეტაპი',
};
type Editor =
  | { kind: 'year'; record?: YearRecord }
  | { kind: 'section'; record?: SectionRecord }
  | { kind: 'subject'; record?: SubjectRecord }
  | { kind: 'calendar'; record?: CalendarRecord }
  | { kind: 'offering' }
  | { kind: 'assignment' };
export function AcademicManagement({ calendarOnly = false }: { calendarOnly?: boolean }) {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const can = viewer.capabilities.includes('academics:manage');
  const [yearId, setYearId] = useState(''),
    [tab, setTab] = useState(calendarOnly ? 'calendar' : 'year'),
    [editor, setEditor] = useState<Editor | null>(null),
    [confirm, setConfirm] = useState<{
      title: string;
      description: string;
      command: AcademicCommand;
    } | null>(null),
    [roster, setRoster] = useState<OfferingRecord | null>(null);
  const config = useQuery({
    queryKey: ['config'],
    queryFn: () => api<{ demo: boolean }>('/api/config'),
  });
  const result = useQuery({
    queryKey: ['academics', yearId, viewer.id],
    queryFn: () => api<AcademicSetup>(`/api/academics${yearId ? `?yearId=${yearId}` : ''}`),
  });
  if (result.isPending) return <Skeleton />;
  if (result.isError) return <ErrorState onRetry={() => void result.refetch()} />;
  const data = result.data,
    year = data.years.find((y) => y.id === data.selectedYearId),
    writable = can && year?.status !== 'archived';
  const save = (c: AcademicCommand) => mutate('/api/academics/actions', c);
  const tabs = calendarOnly
    ? [['calendar', 'სკოლის კალენდარი']]
    : [
        ['year', 'წელი და სემესტრები'],
        ['calendar', 'კალენდარი'],
        ['sections', 'კლასები'],
        ['subjects', 'საგნები'],
        ['offerings', 'კურსები'],
        ...(can ? [['assignments', 'დანიშვნები']] : []),
      ];
  return (
    <div className="op-workspace">
      <header className="page-intro">
        <div>
          <div className="page-kicker">სასწავლო სივრცე</div>
          <h1>{calendarOnly ? 'კალენდარი' : 'სასწავლო პროცესი'}</h1>
          <p>სასწავლო სტრუქტურა, მოქმედი პერიოდები და კლასების შემადგენლობა.</p>
        </div>
        <label className="op-year-select">
          <span>სასწავლო წელი</span>
          <Select
            aria-label="სასწავლო წლის არჩევა"
            value={data.selectedYearId ?? ''}
            onChange={(e) => setYearId(e.target.value)}
          >
            {data.years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name} · {statusLabels[y.status]}
              </option>
            ))}
          </Select>
        </label>
      </header>
      <nav className="op-tabs" aria-label="სასწავლო სტრუქტურა">
        {tabs.map(([key, label]) => (
          <button
            key={key}
            aria-current={tab === key ? 'page' : undefined}
            onClick={() => setTab(key!)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="op-section-heading">
        <div>
          <h2>{tabs.find((t) => t[0] === tab)?.[1]}</h2>
          <p>
            {year
              ? `${year.name} · ${statusLabels[year.status]}`
              : 'სასწავლო წელი ჯერ არ არის შექმნილი'}
          </p>
        </div>
        {can && (tab === 'year' || writable) && (
          <Button
            onClick={() =>
              setEditor({
                kind: (
                  {
                    year: 'year',
                    calendar: 'calendar',
                    sections: 'section',
                    subjects: 'subject',
                    offerings: 'offering',
                    assignments: 'assignment',
                  } as const
                )[tab as 'year'],
              })
            }
          >
            <Plus size={16} />
            {tab === 'year' ? 'წლის დამატება' : 'დამატება'}
          </Button>
        )}
      </div>
      {tab === 'year' && year && (
        <>
          <div className="op-year-overview">
            <div>
              <span>სასწავლო წელი</span>
              <strong className="product-number">{year.name}</strong>
              <p>
                {year.startsOn} — {year.endsOn} <small>(დასრულების საზღვარი)</small>
              </p>
              <Badge>{statusLabels[year.status]}</Badge>
            </div>
            <div>
              {data.semesters.map((t) => (
                <article key={t.id}>
                  <span className="product-number">0{t.ordinal}</span>
                  <div>
                    <h3>{t.name}</h3>
                    <p>
                      {t.startsOn} — {t.endsOn}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
          <p className="op-hint">
            პერიოდის დასაწყისი შედის, დასრულების თარიღი — აღარ. მოქმედი ან გამოყენებული წლის
            იდენტობა დაცულია; ავტომატური გადაყვანა არ ხდება.
          </p>
          {writable && (
            <div className="op-actions">
              {year.status === 'draft' && (
                <Button onClick={() => setEditor({ kind: 'year', record: year })}>
                  წლის რედაქტირება
                </Button>
              )}
              <Button
                onClick={() =>
                  setConfirm({
                    title: year.status === 'draft' ? 'წლის გააქტიურება' : 'წლის არქივირება',
                    description:
                      'ცვლილება შეეხება სასწავლო კონტექსტს. მოსწავლეთა ჩარიცხვები ავტომატურად არ გადაიწერება.',
                    command: {
                      action: 'year.status',
                      id: year.id,
                      version: year.version,
                      status: year.status === 'draft' ? 'active' : 'archived',
                    },
                  })
                }
              >
                {year.status === 'draft' ? 'გააქტიურება' : 'არქივირება'}
              </Button>
            </div>
          )}
        </>
      )}
      {tab === 'calendar' && (
        <>
          <p className="op-hint">
            {config.data?.demo &&
              'სადემონსტრაციო კალენდარი არ წარმოადგენს სკოლის დადასტურებულ პოლიტიკას. '}
            პერიოდების ბოლო თარიღი არ შედის.
          </p>
          <div className="op-record-list">
            {data.events.map((e) => (
              <article key={e.id}>
                <span className="op-date product-number">
                  {e.startsOn}
                  <small>{e.endsOn}</small>
                </span>
                <div>
                  <h3>{e.title}</h3>
                  <p>
                    {kindLabels[e.kind]} · {e.gradeFrom}–{e.gradeTo} კლასები
                  </p>
                </div>
                {writable && e.startsOn >= today() && (
                  <div className="op-actions">
                    <Button
                      variant="ghost"
                      onClick={() => setEditor({ kind: 'calendar', record: e })}
                    >
                      რედაქტირება
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() =>
                        setConfirm({
                          title: 'კალენდარული ჩანაწერის წაშლა',
                          description: `${e.title} · ${e.startsOn}. წაიშლება მხოლოდ ეს მომავალი ჩანაწერი.`,
                          command: { action: 'calendar.remove', id: e.id, version: e.version },
                        })
                      }
                    >
                      წაშლა
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        </>
      )}
      {tab === 'sections' && (
        <div className="op-record-list">
          {data.sections.map((s) => (
            <article key={s.id}>
              <span className="op-index product-number">
                {s.gradeLevel.toString().padStart(2, '0')}
              </span>
              <div>
                <h3>{s.name}</h3>
                <p>
                  {s.gradeLevel <= 6 ? 'დაწყებითი' : s.gradeLevel <= 9 ? 'საბაზო' : 'საშუალო'}{' '}
                  საფეხური
                </p>
              </div>
              {writable && (
                <Button variant="ghost" onClick={() => setEditor({ kind: 'section', record: s })}>
                  რედაქტირება
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === 'subjects' && (
        <div className="op-record-list">
          {data.subjects.map((s) => (
            <article key={s.id}>
              <span className="op-code">{s.code}</span>
              <div>
                <h3>{s.name}</h3>
                <p>{s.archived ? 'არქივში' : 'აქტიური საგანი'}</p>
              </div>
              {writable && (
                <Button variant="ghost" onClick={() => setEditor({ kind: 'subject', record: s })}>
                  რედაქტირება
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === 'offerings' && (
        <div className="op-record-list">
          {data.offerings.map((o) => (
            <article key={o.id}>
              <span className="op-code">
                {data.sections.find((s) => s.id === o.sectionId)?.name}
              </span>
              <div>
                <h3>{data.subjects.find((s) => s.id === o.subjectId)?.name}</h3>
                <p>
                  {o.elective
                    ? 'არჩევითი · ინდივიდუალური წევრობა'
                    : 'ძირითადი · კლასის მოქმედი შემადგენლობა'}{' '}
                  · {o.startsOn} — {o.endsOn}
                </p>
              </div>
              {can && (
                <Button variant="ghost" onClick={() => setRoster(o)}>
                  შემადგენლობა <ArrowUpRight size={16} />
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {tab === 'assignments' && (
        <div className="op-record-list">
          {data.assignments.map((a) => (
            <article key={a.id}>
              <span className="op-code">
                {data.sections.find((s) => s.id === a.sectionId)?.name}
              </span>
              <div>
                <h3>{a.staffName}</h3>
                <p>
                  {a.offeringId
                    ? data.subjects.find(
                        (s) =>
                          s.id === data.offerings.find((o) => o.id === a.offeringId)?.subjectId,
                      )?.name
                    : 'დამრიგებელი'}{' '}
                  · {a.startsOn} — {a.endsOn ?? 'მოქმედი'}
                </p>
              </div>
              {writable && (!a.endsOn || a.endsOn > today()) && (
                <Button
                  variant="ghost"
                  onClick={() =>
                    setConfirm({
                      title: 'დანიშვნის დასრულება',
                      description: 'დასრულება ძალაში შევა მითითებული დღიდან. ისტორია შენარჩუნდება.',
                      command: { action: 'assignment.end', id: a.id, endsOn: today() },
                    })
                  }
                >
                  დასრულება
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
      {!year && (
        <EmptyState
          title="დაიწყეთ სასწავლო წლით"
          description="შექმენით წელი და ორი სემესტრი, შემდეგ დაამატეთ კლასები და კურსები."
        />
      )}
      {editor && (
        <AcademicEditor editor={editor} data={data} onClose={() => setEditor(null)} onSave={save} />
      )}
      {confirm && (
        <OperationDialog
          title={confirm.title}
          description={confirm.description}
          onClose={() => setConfirm(null)}
          onSave={(f) =>
            save(
              confirm.command.action === 'assignment.end'
                ? { ...confirm.command, endsOn: text(f, 'endsOn') }
                : confirm.command,
            )
          }
        >
          {confirm.command.action === 'assignment.end' ? (
            <Field label="დასრულების თარიღი (არ შედის)" name="endsOn" type="date" value={today()} />
          ) : (
            <p>{year?.name}</p>
          )}
        </OperationDialog>
      )}
      {roster && <Roster offering={roster} onClose={() => setRoster(null)} writable={!!writable} />}
    </div>
  );
}
function AcademicEditor({
  editor,
  data,
  onClose,
  onSave,
}: {
  editor: Editor;
  data: AcademicSetup;
  onClose: () => void;
  onSave: (c: AcademicCommand) => Promise<unknown>;
}) {
  const year = data.years.find((y) => y.id === data.selectedYearId)!;
  const r = 'record' in editor ? editor.record : undefined;
  const title = {
    year: 'სასწავლო წელი',
    section: 'კლასი / პარალელი',
    subject: 'საგანი',
    calendar: 'კალენდარული ჩანაწერი',
    offering: 'კურსის გახსნა',
    assignment: 'თანამშრომლის დანიშვნა',
  }[editor.kind];
  return (
    <OperationDialog
      title={title}
      description="შეამოწმეთ სახელები და მოქმედების პერიოდი. დასრულების თარიღი არ შედის პერიოდში."
      onClose={onClose}
      onSave={(f) => {
        const common = r ? { id: r.id, version: r.version } : {};
        const interval = { startsOn: text(f, 'startsOn'), endsOn: text(f, 'endsOn') };
        if (editor.kind === 'year')
          return onSave({
            action: 'year.save',
            ...common,
            name: text(f, 'name'),
            ...interval,
            semesters: [1, 2].map((i) => ({
              name: `${i === 1 ? 'I' : 'II'} სემესტრი`,
              startsOn: text(f, `term${i}Start`),
              endsOn: text(f, `term${i}End`),
            })),
          });
        if (editor.kind === 'section')
          return onSave({
            action: 'section.save',
            ...common,
            yearId: year.id,
            name: text(f, 'name'),
            gradeLevel: Number(text(f, 'gradeLevel')),
          });
        if (editor.kind === 'subject')
          return onSave({
            action: 'subject.save',
            ...common,
            name: text(f, 'name'),
            code: text(f, 'code'),
            archived: text(f, 'archived') === 'true',
          });
        if (editor.kind === 'calendar')
          return onSave({
            action: 'calendar.save',
            ...common,
            yearId: year.id,
            title: text(f, 'title'),
            kind: text(f, 'kind') as 'holiday',
            ...interval,
            gradeFrom: Number(text(f, 'gradeFrom')),
            gradeTo: Number(text(f, 'gradeTo')),
          });
        if (editor.kind === 'offering')
          return onSave({
            action: 'offering.create',
            sectionId: text(f, 'sectionId'),
            subjectId: text(f, 'subjectId'),
            elective: text(f, 'elective') === 'true',
            ...interval,
          });
        const offeringId = text(f, 'offeringId') || null;
        return onSave({
          action: 'assignment.create',
          staffPersonId: text(f, 'staffPersonId'),
          sectionId: offeringId
            ? data.offerings.find((o) => o.id === offeringId)!.sectionId
            : text(f, 'sectionId'),
          offeringId,
          ...interval,
        });
      }}
    >
      {editor.kind === 'year' && (
        <>
          <Field label="წლის დასახელება" name="name" value={editor.record?.name} />
          <Field label="დასაწყისი" name="startsOn" type="date" value={editor.record?.startsOn} />
          <Field
            label="დასრულების საზღვარი"
            name="endsOn"
            type="date"
            value={editor.record?.endsOn}
          />
          {[1, 2].map((i) => (
            <fieldset key={i}>
              <legend>{i === 1 ? 'I' : 'II'} სემესტრი</legend>
              <Field
                label={`${i} სემესტრის დასაწყისი`}
                name={`term${i}Start`}
                type="date"
                value={editor.record ? data.semesters[i - 1]?.startsOn : undefined}
              />
              <Field
                label={`${i} სემესტრის დასრულების საზღვარი`}
                name={`term${i}End`}
                type="date"
                value={editor.record ? data.semesters[i - 1]?.endsOn : undefined}
              />
            </fieldset>
          ))}
        </>
      )}
      {editor.kind === 'section' && (
        <>
          <Field label="პარალელის დასახელება" name="name" value={editor.record?.name} />
          <Field label="კლასის საფეხური" name="gradeLevel" value={editor.record?.gradeLevel ?? 7}>
            {Array.from({ length: 12 }, (_, i) => (
              <option key={i} value={i + 1}>
                {i + 1} კლასი
              </option>
            ))}
          </Field>
        </>
      )}
      {editor.kind === 'subject' && (
        <>
          <Field label="საგნის დასახელება" name="name" value={editor.record?.name} />
          <Field label="საგნის კოდი" name="code" value={editor.record?.code} />
          <Field label="სტატუსი" name="archived" value={String(editor.record?.archived ?? false)}>
            <option value="false">აქტიური</option>
            <option value="true">არქივში</option>
          </Field>
        </>
      )}
      {editor.kind === 'calendar' && (
        <>
          <Field label="სათაური" name="title" value={editor.record?.title} />
          <Field label="ჩანაწერის ტიპი" name="kind" value={editor.record?.kind ?? 'holiday'}>
            {Object.entries(kindLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </Field>
          <Field
            label="პირველი კლასი"
            name="gradeFrom"
            type="number"
            value={editor.record?.gradeFrom ?? 1}
          />
          <Field
            label="ბოლო კლასი"
            name="gradeTo"
            type="number"
            value={editor.record?.gradeTo ?? 12}
          />
        </>
      )}
      {(editor.kind === 'offering' || editor.kind === 'assignment') && (
        <Field label="კლასი" name="sectionId">
          {data.sections.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Field>
      )}
      {editor.kind === 'offering' && (
        <>
          <Field label="საგანი" name="subjectId">
            {data.subjects
              .filter((s) => !s.archived)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </Field>
          <Field label="შემადგენლობის წესი" name="elective" value="false">
            <option value="false">ძირითადი — კლასის ჩარიცხვებიდან</option>
            <option value="true">არჩევითი — ინდივიდუალური წევრობა</option>
          </Field>
        </>
      )}
      {editor.kind === 'assignment' && (
        <>
          <PersonPicker kind="staff" name="staffPersonId" label="მასწავლებლის მოძებნა" />
          <Field label="პასუხისმგებლობა" name="offeringId" required={false}>
            <option value="">დამრიგებელი — არჩეული კლასი</option>
            {data.offerings.map((o) => (
              <option key={o.id} value={o.id}>
                {data.sections.find((s) => s.id === o.sectionId)?.name} ·{' '}
                {data.subjects.find((s) => s.id === o.subjectId)?.name}
              </option>
            ))}
          </Field>
        </>
      )}
      {['calendar', 'offering', 'assignment'].includes(editor.kind) && (
        <>
          <Field
            label="დასაწყისი"
            name="startsOn"
            type="date"
            value={
              editor.kind === 'calendar' ? (editor.record?.startsOn ?? today()) : year.startsOn
            }
          />
          <Field
            label="დასრულების საზღვარი"
            name="endsOn"
            type="date"
            value={editor.kind === 'calendar' ? editor.record?.endsOn : year.endsOn}
          />
        </>
      )}
    </OperationDialog>
  );
}
function Roster({
  offering,
  onClose,
  writable,
}: {
  offering: OfferingRecord;
  onClose: () => void;
  writable: boolean;
}) {
  const [on, setOn] = useState(today()),
    [offset, setOffset] = useState(0),
    [adding, setAdding] = useState(false),
    [ending, setEnding] = useState<string | null>(null);
  const result = useQuery({
    queryKey: ['roster', offering.id, on, offset],
    queryFn: () =>
      api<RosterPage>(`/api/academics/offerings/${offering.id}/roster?on=${on}&offset=${offset}`),
    enabled: !!on,
  });
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title="კურსის შემადგენლობა"
      description="სია გამოითვლება არჩეული თარიღის ჩარიცხვით და არჩევითი კურსის წევრობით."
      className="op-dialog"
    >
      <label className="op-field">
        <span>მოქმედი თარიღი</span>
        <DateInput
          type="date"
          value={on}
          onChange={(e) => {
            setOn(e.target.value);
            setOffset(0);
          }}
        />
      </label>
      {result.isPending ? (
        <Skeleton />
      ) : result.isError ? (
        <ErrorState onRetry={() => void result.refetch()} />
      ) : (
        <>
          <div className="op-record-list">
            {result.data.items.map((p) => (
              <article key={p.id}>
                <div>
                  <h3>{p.name}</h3>
                  <p>
                    {p.number} · {p.startsOn} — {p.endsOn ?? 'მოქმედი'}
                  </p>
                </div>
                {writable && p.membershipId && (
                  <Button variant="ghost" onClick={() => setEnding(p.membershipId)}>
                    წევრობის დასრულება
                  </Button>
                )}
              </article>
            ))}
          </div>
          {!result.data.items.length && (
            <p className="op-hint">ამ თარიღისთვის კურსის სია ცარიელია.</p>
          )}
          <div className="op-actions">
            <Button disabled={!offset} onClick={() => setOffset(offset - 25)}>
              წინა
            </Button>
            <span>{result.data.total} ჩანაწერი</span>
            <Button
              disabled={offset + 25 >= result.data.total}
              onClick={() => setOffset(offset + 25)}
            >
              შემდეგი
            </Button>
          </div>
        </>
      )}
      {offering.elective && writable && (
        <Button onClick={() => setAdding(true)}>მოსწავლის დამატება</Button>
      )}
      {adding && (
        <OperationDialog
          title="არჩევით კურსზე ჩარიცხვა"
          description="მოსწავლეს შესაბამის კლასში მოქმედი ჩარიცხვა უნდა ჰქონდეს."
          onClose={() => setAdding(false)}
          onSave={(f) =>
            mutate('/api/academics/actions', {
              action: 'membership.create',
              offeringId: offering.id,
              studentId: text(f, 'studentId'),
              startsOn: text(f, 'startsOn'),
              endsOn: text(f, 'endsOn'),
            })
          }
        >
          <PersonPicker kind="student" name="studentId" label="მოსწავლის მოძებნა" />
          <Field label="წევრობის დასაწყისი" name="startsOn" type="date" value={on} />
          <Field label="დასრულების საზღვარი" name="endsOn" type="date" value={offering.endsOn} />
        </OperationDialog>
      )}
      {ending && (
        <OperationDialog
          title="წევრობის დასრულება"
          description="არჩეული დღიდან მოსწავლე კურსის მოქმედ სიაში აღარ გამოჩნდება. ისტორია შენარჩუნდება."
          onClose={() => setEnding(null)}
          onSave={(f) =>
            mutate('/api/academics/actions', {
              action: 'membership.end',
              id: ending,
              endsOn: text(f, 'endsOn'),
            })
          }
        >
          <Field label="დასრულების საზღვარი" name="endsOn" type="date" value={today()} />
        </OperationDialog>
      )}
    </Modal>
  );
}
