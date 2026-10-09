import * as Popover from '@radix-ui/react-popover';
import { DateInput } from './DateInput';
import { Select } from './Select';
import { useState, useEffect, useId, useRef, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../lib/api';
import { Button, Modal } from './ui';
export const today = () =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Tbilisi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
export async function mutate(path: string, body: unknown) {
  const result = await api<{ id: string; activationUrl?: string }>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  await queryClient.invalidateQueries({
    predicate: (query) => !['me', 'config'].includes(String(query.queryKey[0])),
  });
  return result;
}
export function Field({
  label,
  name,
  type = 'text',
  value,
  required = true,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  value?: string | number;
  required?: boolean;
  children?: ReactNode;
}) {
  return (
    <label className="op-field">
      <span>{label}</span>
      {children ? (
        <Select aria-label={label} name={name} defaultValue={value ?? ''} required={required}>
          {children}
        </Select>
      ) : type === 'date' ? (
        <DateInput name={name} defaultValue={value ?? ''} required={required} />
      ) : (
        <input
          name={name}
          type={type}
          defaultValue={value ?? ''}
          required={required}
          maxLength={type === 'email' ? 200 : 120}
        />
      )}
    </label>
  );
}
export function OperationDialog({
  title,
  description,
  children,
  onClose,
  onSave,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onClose: () => void;
  onSave: (data: FormData) => Promise<unknown>;
}) {
  const [summary, setSummary] = useState<{ label: string; value: string }[]>([]);
  const [review, setReview] = useState<FormData | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onOpenChange={(v) => {
        if (!v && !busy) onClose();
      }}
      title={title}
      description={description}
      className="op-dialog"
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError('');
          if (!review) {
            setSummary(
              Array.from(
                e.currentTarget.querySelectorAll<HTMLInputElement | HTMLSelectElement>(
                  'input, select',
                ),
              ).flatMap((control) => {
                if (
                  control.type === 'hidden' ||
                  !control.value ||
                  (control instanceof HTMLInputElement &&
                    control.type === 'checkbox' &&
                    !control.checked)
                )
                  return [];
                const label = control.labels?.[0]?.textContent?.trim() ?? '';
                const value =
                  control instanceof HTMLSelectElement
                    ? (control.selectedOptions[0]?.textContent?.trim() ?? '')
                    : control.type === 'checkbox'
                      ? 'არჩეულია'
                      : control.value;
                return [
                  {
                    label:
                      control instanceof HTMLSelectElement
                        ? (control.closest('label')?.querySelector('span')?.textContent ?? '')
                        : label,
                    value,
                  },
                ];
              }),
            );
            setReview(new FormData(e.currentTarget));
            return;
          }
          setBusy(true);
          try {
            await onSave(review);
            onClose();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'შენახვა ვერ შესრულდა.');
          } finally {
            setBusy(false);
          }
        }}
      >
        <div hidden={!!review} className="op-form-grid">
          {children}
        </div>
        {review && (
          <div className="op-review">
            <h3>შენახვამდე შეამოწმეთ</h3>
            <p>{description}</p>
            <dl>
              {summary.map(({ label, value }, index) => (
                <div key={index}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <p>ცვლილება შეინახება სასკოლო ჩანაწერებში და აუდიტის ისტორიაში.</p>
          </div>
        )}
        <div className="ux-feedback-slot">
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="op-form-actions">
          <Button
            type="button"
            disabled={busy}
            onClick={() => (review ? setReview(null) : onClose())}
          >
            {review ? 'რედაქტირება' : 'გაუქმება'}
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? 'ინახება…' : review ? 'დადასტურება და შენახვა' : 'გადახედვა'}
          </Button>
        </footer>
      </form>
    </Modal>
  );
}
export function PersonPicker({
  kind = 'guardian',
  name = 'personId',
  label = 'არსებული პიროვნების მოძებნა',
  required = true,
}: {
  kind?: 'guardian' | 'staff' | 'person' | 'student';
  name?: string;
  label?: string;
  required?: boolean;
}) {
  const [q, setQ] = useState(''),
    [search, setSearch] = useState(''),
    [selected, setSelected] = useState<{ id: string; name: string; version?: number } | null>(null),
    [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const id = useId(),
    input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    const timer = setTimeout(() => setSearch(q), 180);
    return () => clearTimeout(timer);
  }, [q]);
  const result = useQuery({
    queryKey: ['person-options', kind, search],
    queryFn: () =>
      api<{ items: { id: string; name: string; context: string; version: number }[] }>(
        `/api/people/options?kind=${kind}&q=${encodeURIComponent(search)}`,
      ),
    enabled: search.trim().length >= 2 && !selected,
  });
  const items = search === q && !result.isFetching ? (result.data?.items ?? []) : [];
  function choose(person: (typeof items)[number]) {
    setSelected(person);
    setOpen(false);
    input.current?.setCustomValidity('');
    input.current?.focus();
  }
  return (
    <div className="op-person-picker">
      <Popover.Root open={open && !selected} onOpenChange={setOpen}>
        <Popover.Anchor asChild>
          <label className="op-field">
            <span>{label}</span>
            <input
              aria-label={label}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={open && !selected}
              aria-controls={`${id}-list`}
              aria-activedescendant={items[active] ? `${id}-${items[active]!.id}` : undefined}
              placeholder="სახელი ან ელფოსტა…"
              value={selected?.name ?? q}
              ref={(el) => {
                input.current = el;
                el?.setCustomValidity(
                  required && !selected ? 'აირჩიეთ პიროვნება ძიების შედეგებიდან.' : '',
                );
              }}
              onFocus={() => !selected && setOpen(true)}
              onChange={(e) => {
                setSelected(null);
                setQ(e.target.value);
                setActive(0);
                setOpen(true);
              }}
              required={required}
              onKeyDown={(e) => {
                if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
                  e.preventDefault();
                  setOpen(true);
                  const next = Math.max(
                    0,
                    Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)),
                  );
                  setActive(next);
                  document
                    .getElementById(`${id}-${items[next]?.id}`)
                    ?.scrollIntoView({ block: 'nearest' });
                } else if (e.key === 'Enter' && open && items[active]) {
                  e.preventDefault();
                  choose(items[active]!);
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setOpen(false);
                }
              }}
            />
          </label>
        </Popover.Anchor>
        <Popover.Portal>
          <Popover.Content
            className="product-theme ux-popover ux-select-menu"
            align="start"
            sideOffset={5}
            collisionPadding={12}
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
            onInteractOutside={(e) => {
              if (e.target === input.current) e.preventDefault();
            }}
          >
            <div id={`${id}-list`} role="listbox" aria-label={label} className="ux-options">
              {q.trim().length < 2 ? (
                <p className="ux-option-empty">შეიყვანეთ მინიმუმ ორი სიმბოლო.</p>
              ) : result.isFetching || search !== q ? (
                <p className="ux-option-empty" role="status">
                  იძებნება…
                </p>
              ) : result.isError ? (
                <Button type="button" onClick={() => void result.refetch()}>
                  ძიების ხელახლა ცდა
                </Button>
              ) : items.length ? (
                items.map((person, index) => (
                  <div
                    key={person.id}
                    id={`${id}-${person.id}`}
                    role="option"
                    aria-selected={active === index}
                    data-active={active === index || undefined}
                    className="ux-option ux-person-option"
                    onMouseDown={(e) => e.preventDefault()}
                    onMouseMove={() => setActive(index)}
                    onClick={() => choose(person)}
                  >
                    <strong>{person.name}</strong>
                    <small>{person.context}</small>
                  </div>
                ))
              ) : (
                <p className="ux-option-empty" role="status">
                  ჩანაწერი ვერ მოიძებნა.
                </p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      {selected && (
        <>
          <input type="hidden" name={`${name}Label`} value={selected.name} />
          <input type="hidden" name={`${name}Version`} value={selected.version ?? 1} />
        </>
      )}
      <small className="op-hint">
        მინიმუმ ორი სიმბოლო. ერთნაირი სახელები ავტომატურად არ ერთიანდება.
      </small>
    </div>
  );
}
export function DuplicateHint({ name }: { name: string }) {
  const result = useQuery({
    queryKey: ['duplicates', name],
    queryFn: () =>
      api<{ items: { id: string; name: string; context: string; version: number }[] }>(
        `/api/people/options?kind=person&q=${encodeURIComponent(name)}`,
      ),
    enabled: name.trim().length >= 3,
  });
  return result.data?.items.length ? (
    <p className="op-hint" role="status">
      მსგავსი ჩანაწერი არსებობს:{' '}
      {result.data.items
        .slice(0, 3)
        .map((p) => `${p.name} (${p.context})`)
        .join('; ')}
      . ახალი პიროვნება მხოლოდ იდენტობის შემოწმების შემდეგ დაამატეთ.
    </p>
  ) : null;
}
export function PersonFields({ fullName = '', email = '' }: { fullName?: string; email?: string }) {
  const [name, setName] = useState(fullName);
  return (
    <>
      <label className="op-field">
        <span>სახელი და გვარი</span>
        <input
          name="fullName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
        />
      </label>
      <Field
        label="საკონტაქტო ელფოსტა"
        name="contactEmail"
        type="email"
        value={email}
        required={false}
      />
      <DuplicateHint name={name} />
    </>
  );
}
export const text = (f: FormData, key: string) => String(f.get(key) ?? '');
export const optional = (f: FormData, key: string) => text(f, key) || null;
