import { useEffect, useRef, type ReactNode } from 'react';
import { X, Check, ArrowRight, Search, CornerDownLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Person } from './data';
export function Mark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="dl-mark">
      <img src="/logo.png" alt="აია-ჯესსი" />
      {!compact && (
        <span>
          AIA-GESS<small>სასკოლო სივრცე</small>
        </span>
      )}
    </span>
  );
}
export function Avatar({ person, large = false }: { person: Person; large?: boolean }) {
  return (
    <span className={`dl-avatar ${large ? 'large' : ''}`} aria-hidden="true">
      {person.initials}
    </span>
  );
}
export function Status({ review = false }: { review?: boolean }) {
  return (
    <span className={`dl-status ${review ? 'review' : ''}`}>
      <i />
      {review ? 'გადასამოწმებელი' : 'აქტიური'}
    </span>
  );
}
export function Modal({
  title,
  description,
  close,
  children,
  className = '',
}: {
  title: string;
  description?: string;
  close: () => void;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current!;
    d.showModal();
    d.querySelector<HTMLElement>('[data-autofocus]')?.focus();
    return () => d.close();
  }, []);
  return (
    <dialog
      ref={ref}
      className={`dl-dialog ${className}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          const r = e.currentTarget.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            close();
        }
      }}
    >
      <header className="dl-dialog-head">
        <div>
          <h2>{title}</h2>
          {description && <p>{description}</p>}
        </div>
        <button className="dl-icon" aria-label="დახურვა" onClick={close}>
          <X size={19} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
export function Empty({ reset }: { reset: () => void }) {
  return (
    <div className="dl-state">
      <Search size={30} />
      <h3>ჩანაწერი ვერ მოიძებნა</h3>
      <p>სცადეთ სხვა სახელი ან შეცვალეთ ფილტრი.</p>
      <button className="dl-button" onClick={reset}>
        ფილტრების გასუფთავება <ArrowRight size={15} />
      </button>
    </div>
  );
}
export function Toast({ message }: { message: string }) {
  return (
    <div className="dl-toast" role="status">
      <span>
        <Check size={17} />
      </span>
      {message}
    </div>
  );
}
export function Kbd({ children }: { children: ReactNode }) {
  return <kbd>{children}</kbd>;
}
export function LabLinks() {
  return (
    <div className="dl-lab-links">
      <Link to="/design-lab">
        სამი მიმართულება <ArrowRight size={14} />
      </Link>
      <Link to="/design-lab/type">შრიფტების კვლევა</Link>
    </div>
  );
}
export function EnterHint() {
  return (
    <span className="dl-enter">
      <CornerDownLeft size={14} /> გახსნა
    </span>
  );
}
