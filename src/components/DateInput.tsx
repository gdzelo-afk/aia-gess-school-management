import {
  useEffect,
  useId,
  useRef,
  useState,
  type InputHTMLAttributes,
  type KeyboardEvent,
} from 'react';
import * as Popover from '@radix-ui/react-popover';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  georgianMonths,
  georgianWeekdays,
  validDate,
  addDays,
  moveMonth,
  monthDays,
} from '../lib/calendar-control';
import { schoolTime } from '../lib/school-time';
/** Compact Georgian calendar. Native popup strings are controlled by the OS, not HTML lang. */
export function DateInput({
  value,
  defaultValue,
  onChange,
  className = '',

  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const id = useId(),
    input = useRef<HTMLInputElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [local, setLocal] = useState(String(defaultValue ?? '')),
    [open, setOpen] = useState(false),
    [month, setMonth] = useState(''),
    [focus, setFocus] = useState('');
  const current = String(value ?? local),
    today = schoolTime(new Date()).date;
  const [typed, setTyped] = useState(current),
    [previous, setPrevious] = useState(current);
  if (previous !== current) {
    setPrevious(current);
    setTyped(current);
  }
  const min = String(props.min ?? ''),
    max = String(props.max ?? '');
  const allowed = (d: string) => validDate(d) && (!min || d >= min) && (!max || d <= max);
  useEffect(() => {
    const valid =
      typed === '' || (validDate(typed) && (!min || typed >= min) && (!max || typed <= max));
    input.current?.setCustomValidity(valid ? '' : 'შეიყვანეთ მოქმედი თარიღი: წწწწ-თთ-დდ.');
  }, [typed, min, max]);
  useEffect(() => {
    const form = input.current?.form;
    const reset = () => {
      if (value === undefined) {
        const initial = String(defaultValue ?? '');
        setLocal(initial);
        setTyped(initial);
      }
      setOpen(false);
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, defaultValue]);
  function commit(next: string) {
    const el = input.current!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, next);
    el.dispatchEvent(new Event('input', { bubbles: true }));
    setOpen(false);
  }
  function focusDay(date: string) {
    setMonth(date.slice(0, 7));
    setFocus(date);
    requestAnimationFrame(() => document.getElementById(`${id}-${date}`)?.focus());
  }
  function keys(e: KeyboardEvent<HTMLButtonElement>, day: string) {
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const delta: { [key: string]: number } = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
      Home: -weekday,
      End: 6 - weekday,
    };
    if (e.key in delta) {
      e.preventDefault();
      focusDay(addDays(day, delta[e.key]!));
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault();
      focusDay(moveMonth(day, (e.key === 'PageUp' ? -1 : 1) * (e.shiftKey ? 12 : 1)));
    }
  }
  return (
    <span className={`ux-date ${className}`}>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        placeholder="წწწწ-თთ-დდ"
        ref={input}
        value={typed}
        onChange={(e) => {
          const next = e.target.value;
          const valid = next === '' || allowed(next);
          // Controlled parents may normalize a date (e.g. to Monday) or reject a scope change.
          setTyped(valid && value !== undefined ? String(value) : next);
          e.target.setCustomValidity(valid ? '' : 'შეიყვანეთ მოქმედი თარიღი: წწწწ-თთ-დდ.');
          if (valid) {
            setLocal(next);
            onChange?.(e);
          }
        }}
        onKeyDown={(e) => {
          if (e.altKey && e.key === 'ArrowDown') {
            e.preventDefault();
            trigger.current?.click();
          }
          props.onKeyDown?.(e);
        }}
      />
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            const date = validDate(current) ? current : today;
            setMonth(date.slice(0, 7));
            setFocus(date);
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            className="ux-date-trigger"
            disabled={props.disabled || props.readOnly}
            aria-label="თარიღის არჩევა"
          >
            <CalendarDays size={16} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="product-theme ux-popover ux-calendar"
            sideOffset={6}
            collisionPadding={12}
            align="end"
            aria-label="თარიღის არჩევა"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              document.getElementById(`${id}-${focus}`)?.focus();
            }}
          >
            <header>
              <button
                type="button"
                aria-label="წინა თვე"
                onClick={() => {
                  const next = moveMonth(`${month}-01`, -1);
                  setMonth(next.slice(0, 7));
                  setFocus(next);
                }}
              >
                <ChevronLeft size={16} />
              </button>
              <strong aria-live="polite">
                {georgianMonths[Number(month.slice(5)) - 1]} {month.slice(0, 4)}
              </strong>
              <button
                type="button"
                aria-label="შემდეგი თვე"
                onClick={() => {
                  const next = moveMonth(`${month}-01`, 1);
                  setMonth(next.slice(0, 7));
                  setFocus(next);
                }}
              >
                <ChevronRight size={16} />
              </button>
            </header>
            <table
              role="grid"
              aria-label={`${georgianMonths[Number(month.slice(5)) - 1]} ${month.slice(0, 4)}`}
            >
              <thead>
                <tr>
                  {georgianWeekdays.map((d) => (
                    <th key={d} scope="col">
                      {d}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {month &&
                  Array.from({ length: 6 }, (_, r) => (
                    <tr key={r}>
                      {monthDays(month)
                        .slice(r * 7, r * 7 + 7)
                        .map((d) => (
                          <td key={d} aria-selected={d === current}>
                            <button
                              type="button"
                              id={`${id}-${d}`}
                              tabIndex={d === focus ? 0 : -1}
                              aria-label={`${Number(d.slice(8))} ${georgianMonths[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`}
                              aria-current={d === today ? 'date' : undefined}
                              aria-disabled={!allowed(d) || undefined}
                              data-outside={!d.startsWith(month) || undefined}
                              onKeyDown={(e) => keys(e, d)}
                              onClick={() => allowed(d) && commit(d)}
                            >
                              {Number(d.slice(8))}
                            </button>
                          </td>
                        ))}
                    </tr>
                  ))}
              </tbody>
            </table>
            <footer>
              <button type="button" onClick={() => commit('')}>
                გასუფთავება
              </button>
              <button type="button" disabled={!allowed(today)} onClick={() => commit(today)}>
                დღეს
              </button>
            </footer>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </span>
  );
}
