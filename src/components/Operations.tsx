import { useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, queryClient } from '../lib/api';
import { Button, Modal, ErrorState } from './ui';
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
        <select aria-label={label} name={name} defaultValue={value ?? ''} required={required}>
          {children}
        </select>
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
                        ? (control.labels?.[0]?.querySelector('span')?.textContent ?? '')
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
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
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
    [selected, setSelected] = useState<{ id: string; name: string; version?: number } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setSearch(q), 180);
    return () => clearTimeout(t);
  }, [q]);
  const result = useQuery({
    queryKey: ['person-options', kind, search],
    queryFn: () =>
      api<{ items: { id: string; name: string; context: string; version: number }[] }>(
        `/api/people/options?kind=${kind}&q=${encodeURIComponent(search)}`,
      ),
    enabled: search.trim().length >= 2 && !selected,
  });
  return (
    <div className="op-person-picker">
      <label className="op-field">
        <span>{label}</span>
        <input
          aria-label={label}
          placeholder="სახელი ან ელფოსტა…"
          value={selected?.name ?? q}
          ref={(input) => {
            input?.setCustomValidity(
              required && !selected ? 'აირჩიეთ პიროვნება ძიების შედეგებიდან.' : '',
            );
          }}
          onChange={(e) => {
            setSelected(null);
            setQ(e.target.value);
          }}
          required={required}
        />
      </label>
      <input type="hidden" name={name} value={selected?.id ?? ''} />
      {selected && (
        <>
          <input type="hidden" name={`${name}Label`} value={selected.name} />
          <input type="hidden" name={`${name}Version`} value={selected.version ?? 1} />
        </>
      )}
      {!selected && result.isFetching && <p className="op-hint">იძებნება…</p>}
      {!selected && result.isError && <ErrorState onRetry={() => void result.refetch()} />}
      {!selected && result.data && (
        <div className="op-picker-results">
          {result.data.items.map((p) => (
            <button type="button" key={p.id} onClick={() => setSelected(p)}>
              <strong>{p.name}</strong>
              <small>{p.context}</small>
            </button>
          ))}
          {!result.data.items.length && <p>ჩანაწერი ვერ მოიძებნა.</p>}
        </div>
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
