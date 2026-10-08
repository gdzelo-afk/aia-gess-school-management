import {
  createContext,
  useContext,
  useState,
  useRef,
  useEffect,
  type ReactNode,
  type ButtonHTMLAttributes,
} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Check, Inbox, AlertCircle, LockKeyhole } from 'lucide-react';
import { initials } from '../lib/format';
export function Button({
  variant = 'secondary',
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  return <button className={`button button-${variant} ${className}`} {...props} />;
}
export function IconButton({
  label,
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button className="icon-button" aria-label={label} title={label} {...props}>
      {children}
    </button>
  );
}
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: 'neutral' | 'success' | 'warning';
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
export function Avatar({ name, color = 0 }: { name: string; color?: number }) {
  return (
    <span className={`avatar avatar-${color % 4}`} aria-hidden="true">
      {initials(name)}
    </span>
  );
}
export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`card ${className}`}>{children}</section>;
}
export function SectionHeading({
  title,
  children,
  kicker,
}: {
  title: string;
  children?: ReactNode;
  kicker?: string;
}) {
  return (
    <div className="section-heading">
      <div>
        {kicker && <span className="eyebrow">{kicker}</span>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  className = '',
  themeClass = 'product-theme',
  onCloseAutoFocus,
}: {
  open: boolean;
  onOpenChange: (value: boolean) => void;
  title: string;
  description: string;
  children: ReactNode;
  className?: string;
  themeClass?: string;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const opener = useRef<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className={`dialog-overlay ${themeClass}`} />
        <Dialog.Content
          className={`dialog-content ${themeClass} ${className}`}
          onOpenAutoFocus={() => {
            opener.current =
              document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }}
          onCloseAutoFocus={(event) => {
            onCloseAutoFocus?.(event);
            if (
              !event.defaultPrevented &&
              opener.current?.isConnected &&
              !opener.current.closest('[inert], [hidden]') &&
              !opener.current.matches(':disabled') &&
              opener.current.getClientRects().length
            ) {
              event.preventDefault();
              opener.current.focus({ preventScroll: true });
            }
          }}
        >
          <Dialog.Title className="dialog-title">{title}</Dialog.Title>
          <Dialog.Description className="dialog-description">{description}</Dialog.Description>
          <Dialog.Close asChild>
            <IconButton label="დახურვა" className="dialog-close">
              <X size={18} />
            </IconButton>
          </Dialog.Close>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function EmptyState({
  title = 'ჯერ არაფერია',
  description = 'ახალი ჩანაწერები აქ გამოჩნდება.',
  action,
  denied = false,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  denied?: boolean;
}) {
  const Icon = denied ? LockKeyhole : Inbox;
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={26} />
      </span>
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <AlertCircle size={24} />
      <h2>მონაცემები ვერ ჩაიტვირთა</h2>
      <p>შეამოწმეთ კავშირი და სცადეთ ხელახლა.</p>
      <Button onClick={onRetry}>ხელახლა ცდა</Button>
    </div>
  );
}
export function Skeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="skeleton-group" role="status" aria-label="იტვირთება">
      <span className="sr-only">იტვირთება…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="skeleton" />
      ))}
    </div>
  );
}
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return (
    <ToastContext.Provider
      value={(text) => {
        setMessage(text);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => setMessage(''), 5000);
      }}
    >
      {children}
      <div aria-live="polite" className="toast-region product-theme">
        {message && (
          <div className="toast">
            <Check size={18} />
            <span>{message}</span>
            <IconButton label="შეტყობინების დახურვა" onClick={() => setMessage('')}>
              <X size={15} />
            </IconButton>
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
export const useToast = () => useContext(ToastContext);
