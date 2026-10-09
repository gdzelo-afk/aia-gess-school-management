import { useSearchQuery } from '../lib/use-search-query';
import { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { type Viewer, type Role, roleLabels } from '../../shared/contracts';
import type { AccountRow, AccountCommand } from '../../shared/stage1a';
import { api } from '../lib/api';
import { Button, Modal, Badge, EmptyState, ErrorState, Skeleton } from '../components/ui';
import { Field, PersonPicker, OperationDialog, mutate, text } from '../components/Operations';
export function Accounts() {
  const { viewer } = useOutletContext<{ viewer: Viewer }>();
  const allowed = viewer.capabilities.includes('access:manage'),
    rolesAllowed = viewer.capabilities.includes('access:roles');
  const [q, setQ] = useState(''),
    [offset, setOffset] = useState(0),
    [invite, setInvite] = useState(false),
    [roles, setRoles] = useState<AccountRow | null>(null),
    [command, setCommand] = useState<AccountCommand | null>(null),
    [link, setLink] = useState('');
  const search = useSearchQuery(q);
  const result = useQuery<{ items: AccountRow[]; total: number; localDelivery: boolean }>({
    queryKey: ['accounts', search, offset, viewer.id],
    placeholderData: (previous, previousQuery) =>
      previousQuery?.queryKey[3] === viewer.id ? previous : undefined,
    queryFn: ({ signal }) =>
      api<{ items: AccountRow[]; total: number; localDelivery: boolean }>(
        `/api/accounts?q=${encodeURIComponent(search)}&offset=${offset}`,
        { signal },
      ),
    enabled: allowed && q === search,
  });
  const refreshing = q !== search || result.isPlaceholderData;
  const save = async (c: AccountCommand) => {
    const r = await mutate('/api/accounts/actions', c);
    if (r.activationUrl) setLink(r.activationUrl);
  };
  if (!allowed)
    return (
      <EmptyState
        denied
        title="წვდომა შეზღუდულია"
        description="ანგარიშების მართვა უფლებამოსილ ადმინისტრატორს შეუძლია."
      />
    );
  return (
    <div className="op-workspace">
      <header className="page-intro">
        <div>
          <div className="page-kicker">მართვა · წვდომა</div>
          <h1>ანგარიშები</h1>
          <p>მოწვევა, წინასწარ განსაზღვრული როლები და ანგარიშის სასიცოცხლო ციკლი.</p>
        </div>
        {rolesAllowed && <Button onClick={() => setInvite(true)}>მოწვევის შექმნა</Button>}
      </header>
      <p className="op-hint">
        {result.data?.localDelivery
          ? 'ლოკალური დემო მიწოდება: შეიქმნება ერთჯერადი ბმული. ელფოსტა არ იგზავნება.'
          : 'ელფოსტის მიწოდება არ არის გამართული. მოწვევა დროებით მიუწვდომელია.'}
      </p>
      <input
        className="op-search"
        aria-label="ანგარიშის ძიება"
        placeholder="ელფოსტით ძიება…"
        value={q}
        maxLength={100}
        onChange={(e) => {
          setQ(e.target.value);
          setOffset(0);
        }}
      />
      {result.isPending ? (
        <Skeleton />
      ) : result.isError ? (
        <ErrorState onRetry={() => void result.refetch()} />
      ) : (
        <>
          <div
            className="op-record-list ux-refresh-region"
            aria-busy={refreshing}
            inert={refreshing}
          >
            {result.data.items.map((a) => (
              <article key={a.id}>
                <div className="op-person-identity">
                  <h3>{a.name}</h3>
                  <p>{a.email}</p>
                  <p>{a.roles.map((r) => roleLabels[r]).join(' · ')}</p>
                </div>
                <Badge>{a.pending ? 'მოწვეული' : a.disabled ? 'გამორთული' : 'აქტიური'}</Badge>
                <div className="op-actions">
                  {rolesAllowed && (
                    <Button variant="ghost" onClick={() => setRoles(a)}>
                      როლები
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    onClick={() => setCommand({ action: 'reinvite', userId: a.id })}
                  >
                    {a.disabled ? 'ხელახალი მოწვევა' : 'აღდგენა'}
                  </Button>
                  {!a.disabled && (
                    <Button
                      variant="ghost"
                      onClick={() => setCommand({ action: 'disable', userId: a.id })}
                    >
                      გამორთვა
                    </Button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <div className="pagination">
            <span role="status">{refreshing ? 'ახლდება…' : `${result.data.total} ანგარიში`}</span>
            <div>
              <Button disabled={!offset || refreshing} onClick={() => setOffset(offset - 25)}>
                წინა
              </Button>
              <Button
                disabled={refreshing || offset + 25 >= result.data.total}
                onClick={() => setOffset(offset + 25)}
              >
                შემდეგი
              </Button>
            </div>
          </div>
        </>
      )}
      {(invite || roles) && (
        <OperationDialog
          title={invite ? 'ანგარიშის მოწვევა' : 'როლების შეცვლა'}
          description="როლები განსაზღვრავს მოქმედების უფლებებს. ბმულის მიმღები როლებს თვითონ ვერ ირჩევს."
          onClose={() => {
            setInvite(false);
            setRoles(null);
          }}
          onSave={(f) =>
            save(
              invite
                ? {
                    action: 'invite',
                    personId: text(f, 'personId'),
                    email: text(f, 'email'),
                    roles: f.getAll('roles') as Role[],
                  }
                : { action: 'roles', userId: roles!.id, roles: f.getAll('roles') as Role[] },
            )
          }
        >
          {invite && (
            <>
              <PersonPicker kind="person" />
              <Field label="ანგარიშის ელფოსტა" name="email" type="email" />
            </>
          )}
          <fieldset className="op-roles">
            <legend>როლები</legend>
            {Object.entries(roleLabels)
              .filter(
                ([r]) =>
                  viewer.roles.includes('super_admin') ||
                  !['super_admin', 'director', 'founders_office', 'it_admin'].includes(r),
              )
              .map(([r, l]) => (
                <label key={r}>
                  <input
                    type="checkbox"
                    name="roles"
                    value={r}
                    defaultChecked={roles?.roles.includes(r as Role)}
                  />
                  {l}
                </label>
              ))}
          </fieldset>
        </OperationDialog>
      )}
      {command && (
        <OperationDialog
          title={command.action === 'disable' ? 'ანგარიშის გამორთვა' : 'ახალი ბმულის შექმნა'}
          description="მიმდინარე სესიები გაუქმდება. პიროვნება და სასწავლო ისტორია შენარჩუნდება. ძველი მოწვევის ბმული აღარ იმუშავებს."
          onClose={() => setCommand(null)}
          onSave={() => save(command)}
        >
          <p>
            {
              result.data?.items.find((a) => a.id === ('userId' in command ? command.userId : ''))
                ?.email
            }
          </p>
        </OperationDialog>
      )}
      <Modal
        open={!!link}
        onOpenChange={(v) => {
          if (!v) setLink('');
        }}
        title="ლოკალური მოწვევა მზად არის"
        description="ელფოსტა არ გაგზავნილა. ბმული გამოჩნდება მხოლოდ ამჯერად; გააზიარეთ მხოლოდ განკუთვნილ მიმღებთან."
        className="op-dialog"
      >
        <a className="op-token-link" href={link}>
          {link}
        </a>
        <p className="op-hint">მოწვევა მოქმედებს 48 საათი; აღდგენის ბმული — 1 საათი.</p>
      </Modal>
    </div>
  );
}
