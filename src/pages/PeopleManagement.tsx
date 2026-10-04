import { Select } from '../components/Select';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Search } from 'lucide-react';
import type { Viewer } from '../../shared/contracts';
import type { PeoplePage, PersonRow, PersonHistory } from '../../shared/stage1a';
import { api } from '../lib/api';
import { Button, Badge, Modal, EmptyState, ErrorState, Skeleton } from '../components/ui';
import {
  Field,
  PersonFields,
  PersonPicker,
  OperationDialog,
  mutate,
  text,
  optional,
  today,
} from '../components/Operations';
export function PeopleManagement({ staff = false }: { staff?: boolean }) {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const allowed = viewer.capabilities.includes(staff ? 'staff:manage' : 'people:manage');
  const [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [status, setStatus] = useState('active'),
    [editing, setEditing] = useState<PersonRow | 'new' | null>(null),
    [history, setHistory] = useState<PersonRow | null>(null),
    [archive, setArchive] = useState<PersonRow | null>(null);
  const result = useQuery({
    queryKey: ['people', staff, q, offset, status, viewer.id],
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[1] === staff && previousQuery?.queryKey[5] === viewer.id
        ? previous
        : undefined,
    queryFn: () =>
      api<PeoplePage>(
        `/api/people?kind=${staff ? 'staff' : 'guardian'}&q=${encodeURIComponent(q)}&offset=${offset}&status=${status}`,
      ),
    enabled: allowed,
  });
  if (!allowed)
    return (
      <EmptyState
        denied
        title="წვდომა შეზღუდულია"
        description="ამ სამუშაო სივრცისთვის შესაბამისი უფლებამოსილება გჭირდებათ."
      />
    );
  return (
    <div className="op-workspace">
      <header className="page-intro">
        <div>
          <div className="page-kicker">ადამიანები</div>
          <h1>{staff ? 'თანამშრომლები' : 'მშობლები და მეურვეები'}</h1>
          <p>
            {staff
              ? 'პროფილები, სამუშაო პერიოდები და სწავლების პასუხისმგებლობა.'
              : 'არსებული პიროვნებები და ოჯახური კავშირები. მოსწავლესთან დაკავშირება მოსწავლის პროფილიდან ხდება.'}
          </p>
        </div>
        <Button onClick={() => setEditing('new')}>
          <Plus size={16} />
          დამატება
        </Button>
      </header>
      <div className="directory-toolbar">
        <div className="input-with-icon">
          <Search size={17} />
          <input
            aria-label="პიროვნების ძიება"
            placeholder="სახელი ან ელფოსტა…"
            value={q}
            maxLength={100}
            onChange={(e) => {
              setQ(e.target.value);
              setOffset(0);
            }}
          />
        </div>
        <Select
          aria-label="სტატუსის ფილტრი"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setOffset(0);
          }}
        >
          <option value="active">{staff ? 'მოქმედი თანამშრომლები' : 'აქტიური პიროვნებები'}</option>
          {staff && <option value="departed">სამუშაო პერიოდი დასრულებულია</option>}
          <option value="archived">არქივში</option>
          <option value="all">ყველა</option>
        </Select>
      </div>
      {result.isPending ? (
        <Skeleton />
      ) : result.isError ? (
        <ErrorState onRetry={() => void result.refetch()} />
      ) : (
        <>
          <div
            className="op-record-list ux-refresh-region"
            aria-busy={result.isPlaceholderData}
            inert={result.isPlaceholderData}
          >
            {result.data.items.map((p) => (
              <article key={p.id}>
                <div className="op-person-identity">
                  <h3>{p.fullName}</h3>
                  <p>
                    {p.contactEmail ?? 'ელფოსტა არ არის მითითებული'} · {p.number ?? p.id.slice(-8)}
                  </p>
                  {staff && (
                    <p>
                      {p.title} · {p.startsOn} — {p.endsOn ?? 'მოქმედი'}
                    </p>
                  )}
                </div>
                <Badge>
                  {p.archivedAt
                    ? 'არქივში'
                    : p.endsOn && p.endsOn <= today()
                      ? 'სამუშაო პერიოდი დასრულებულია'
                      : p.userId
                        ? 'ანგარიშით'
                        : 'ანგარიშის გარეშე'}
                </Badge>
                <Button variant="ghost" onClick={() => setHistory(p)}>
                  {staff ? 'დანიშვნები' : 'კავშირები'}
                </Button>
                {(staff || (!p.staffId && !p.studentId)) && (
                  <Button variant="ghost" onClick={() => setEditing(p)}>
                    პროფილი
                  </Button>
                )}
                {!staff && !p.studentId && !p.staffId && !p.archivedAt && (
                  <Button variant="ghost" onClick={() => setArchive(p)}>
                    არქივირება
                  </Button>
                )}
              </article>
            ))}
          </div>
          {!result.data.items.length && (
            <EmptyState
              title="ჩანაწერი ვერ მოიძებნა"
              description="შეცვალეთ ფილტრი ან დაამატეთ ახალი პიროვნება."
            />
          )}
          <div className="pagination">
            <span>{result.isPlaceholderData ? 'ახლდება…' : `${result.data.total} ჩანაწერი`}</span>
            <div>
              <Button
                disabled={!offset || result.isPlaceholderData}
                onClick={() => setOffset(offset - 25)}
              >
                წინა
              </Button>
              <Button
                disabled={result.isPlaceholderData || offset + 25 >= result.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                შემდეგი
              </Button>
            </div>
          </div>
        </>
      )}
      {history && <History person={history} staff={staff} onClose={() => setHistory(null)} />}
      {editing && (
        <PersonEditor
          staff={staff}
          person={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {archive && (
        <OperationDialog
          title="პიროვნების არქივირება"
          description="ანგარიში გამოირთვება და მოქმედი წვდომა შეწყდება. ოჯახური კავშირების ისტორია შენარჩუნდება."
          onClose={() => setArchive(null)}
          onSave={() =>
            mutate('/api/people/actions', {
              action: 'person.archive',
              id: archive.id,
              version: archive.version,
            })
          }
        >
          <p>{archive.fullName}</p>
        </OperationDialog>
      )}
    </div>
  );
}
function PersonEditor({
  staff,
  person,
  onClose,
}: {
  staff: boolean;
  person?: PersonRow;
  onClose: () => void;
}) {
  const [existing, setExisting] = useState(false);
  return (
    <OperationDialog
      title={staff ? 'თანამშრომლის პროფილი' : 'პიროვნების პროფილი'}
      description={
        staff
          ? 'სამუშაოს დასრულება ხურავს მოქმედ დანიშვნებს და თიშავს ანგარიშს. ისტორიული ჩანაწერები შენარჩუნდება.'
          : 'პიროვნება შეიძლება არსებობდეს ანგარიშის გარეშე. მოსწავლესთან კავშირი ცალკე იმართება.'
      }
      onClose={onClose}
      onSave={(f) => {
        const identity = {
          fullName: text(f, 'fullName'),
          contactEmail: optional(f, 'contactEmail'),
        };
        if (staff)
          return mutate('/api/people/actions', {
            action: 'staff.save',
            ...identity,
            ...(person
              ? {
                  id: person.staffId,
                  version: person.staffVersion,
                  personId: person.id,
                  personVersion: person.version,
                }
              : existing
                ? {
                    personId: text(f, 'personId'),
                    personVersion: Number(text(f, 'personIdVersion')),
                  }
                : {}),
            title: text(f, 'title'),
            startsOn: text(f, 'startsOn'),
            endsOn: optional(f, 'endsOn'),
          });
        return mutate('/api/people/actions', {
          action: person ? 'person.edit' : 'person.create',
          ...identity,
          ...(person ? { id: person.id, version: person.version } : {}),
        });
      }}
    >
      {staff && !person && (
        <label className="op-check">
          <input
            type="checkbox"
            checked={existing}
            onChange={(e) => setExisting(e.target.checked)}
          />
          არსებული პიროვნების გამოყენება
        </label>
      )}
      {existing && <PersonPicker kind="person" />}
      <PersonFields fullName={person?.fullName} email={person?.contactEmail ?? ''} />
      {staff && (
        <>
          <Field label="თანამდებობა" name="title" value={person?.title ?? ''} />
          <Field
            label="სამუშაოს დასაწყისი"
            name="startsOn"
            type="date"
            value={person?.startsOn ?? today()}
          />
          <Field
            label="სამუშაოს დასრულება (არ შედის)"
            name="endsOn"
            type="date"
            value={person?.endsOn ?? ''}
            required={false}
          />
          <p className="op-hint">
            კურსები და დამრიგებლობა იმართება სასწავლო პროცესის „დანიშვნებში“.
          </p>
        </>
      )}
    </OperationDialog>
  );
}

function History({
  person,
  staff,
  onClose,
}: {
  person: PersonRow;
  staff: boolean;
  onClose: () => void;
}) {
  const result = useQuery({
    queryKey: ['person-history', person.id, staff],
    queryFn: () =>
      api<PersonHistory>(`/api/people/${person.id}/history?kind=${staff ? 'staff' : 'guardian'}`),
  });
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v) onClose();
      }}
      title={person.fullName}
      description={staff ? 'სწავლების პასუხისმგებლობის ისტორია' : 'ოჯახური კავშირების ისტორია'}
      className="op-dialog"
    >
      {result.isPending ? (
        <Skeleton />
      ) : result.isError ? (
        <ErrorState onRetry={() => void result.refetch()} />
      ) : (
        <div className="op-history">
          {result.data.items.map((r) => (
            <article key={r.id}>
              <div>
                <strong>{r.label}</strong>
                <p>{r.context}</p>
              </div>
              <span>
                {r.startsOn} — {r.endsOn ?? 'მოქმედი'}
              </span>
            </article>
          ))}
          {!result.data.items.length && <p>ჩანაწერები ჯერ არ არის.</p>}
        </div>
      )}
    </Modal>
  );
}
