import { queryClient } from '../../lib/api';
import { useState, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Modal, IconButton, Button } from '../ui';
const subscribe = (fn: () => void) => {
  const q = matchMedia('(max-width: 1100px)');
  q.addEventListener('change', fn);
  return () => q.removeEventListener('change', fn);
};
export function Panel({
  title,
  description,
  children,
  onOpenChange,
  className = '',
}: {
  title: string;
  description: string;
  children: ReactNode;
  onOpenChange: (open: boolean) => void;
  open?: boolean;
  className?: string;
}) {
  const narrow = useSyncExternalStore(
      subscribe,
      () => matchMedia('(max-width: 1100px)').matches,
      () => false,
    ),
    ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (narrow) return;
    const prior = document.activeElement as HTMLElement | null;
    ref.current?.focus({ preventScroll: true });
    return () => {
      if (prior?.isConnected) prior.focus({ preventScroll: true });
    };
  }, [narrow]);
  if (narrow)
    return (
      <Modal
        open
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        className={`tt-panel-mobile ${className}`}
      >
        {children}
      </Modal>
    );
  return (
    <aside
      className={`tt-inspector ${className}`}
      tabIndex={-1}
      ref={ref}
      aria-label={title}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onOpenChange(false);
        }
      }}
    >
      <header>
        <div>
          <span className="product-eyebrow">კონტექსტი</span>
          <h2>{title}</h2>
        </div>
        <IconButton label="დახურვა" onClick={() => onOpenChange(false)}>
          <X size={18} />
        </IconButton>
      </header>
      <p className="tt-inspector-intro">{description}</p>
      <div className="tt-inspector-body">{children}</div>
    </aside>
  );
}

export function ReviewPanel({
  title,
  description,
  children,
  onSave,
  onClose,
}: {
  title: string;
  description: string;
  children: ReactNode;
  onSave: (data: FormData) => Promise<unknown>;
  onClose: () => void;
}) {
  const [review, setReview] = useState<FormData | null>(null),
    [labels, setLabels] = useState<{ label: string; value: string }[]>([]),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  return (
    <Panel title={title} description={description} onOpenChange={() => !busy && onClose()}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!review) {
            const form = e.currentTarget;
            setLabels(
              Array.from(
                form.querySelectorAll<HTMLInputElement | HTMLSelectElement>('input,select'),
              )
                .filter(
                  (el) =>
                    el.value &&
                    (!(el instanceof HTMLInputElement) || el.type !== 'checkbox' || el.checked),
                )
                .map((el) => ({
                  label:
                    el.labels?.[0]?.querySelector('span')?.textContent ??
                    el.labels?.[0]?.textContent ??
                    '',
                  value:
                    el instanceof HTMLSelectElement
                      ? (el.selectedOptions[0]?.textContent ?? '')
                      : el.type === 'checkbox'
                        ? 'არჩეულია'
                        : el.value,
                })),
            );
            setReview(new FormData(form));
            return;
          }
          setBusy(true);
          setError('');
          try {
            await onSave(review);
            onClose();
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <div hidden={!!review}>{children}</div>
        {review && (
          <div className="tt-edit-review">
            <h3>შენახვამდე შეამოწმეთ</h3>
            <dl className="tt-lesson-facts">
              {labels.map((r, i) => (
                <div key={i}>
                  <dt>{r.label}</dt>
                  <dd>{r.value}</dd>
                </div>
              ))}
            </dl>
            <Button type="button" disabled={busy} onClick={() => setReview(null)}>
              რედაქტირებაზე დაბრუნება
            </Button>
          </div>
        )}
        {error && (
          <div role="alert" className="field-error">
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
          </div>
        )}
        <footer className="op-form-actions">
          <Button type="button" disabled={busy} onClick={onClose}>
            გაუქმება
          </Button>
          <Button variant="primary" disabled={busy}>
            {busy ? 'ინახება…' : review ? 'დადასტურება და შენახვა' : 'გადახედვა'}
          </Button>
        </footer>
      </form>
    </Panel>
  );
}
