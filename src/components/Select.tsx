import {
  Children,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type SelectHTMLAttributes,
  type ChangeEvent,
  type KeyboardEvent,
} from 'react';
import * as Popover from '@radix-ui/react-popover';
import { Check, ChevronDown, Search } from 'lucide-react';

type Option = { value: string; label: string; disabled: boolean };
function text(node: ReactNode): string {
  return Children.toArray(node)
    .map((n) => (isValidElement<{ children?: ReactNode }>(n) ? text(n.props.children) : String(n)))
    .join('');
}
function optionsOf(children: ReactNode): Option[] {
  return Children.toArray(children).flatMap((node) => {
    if (
      !isValidElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>(node)
    )
      return [];
    if (node.type === 'option')
      return [
        {
          value: String(node.props.value ?? text(node.props.children)),
          label: text(node.props.children),
          disabled: !!node.props.disabled,
        },
      ];
    return optionsOf(node.props.children);
  });
}
/** Product listbox; the native form control retains validation, reset and FormData semantics. */
export function Select({
  children,
  value,
  defaultValue,
  onChange,
  className = '',
  searchable,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { searchable?: boolean }) {
  const options = optionsOf(children),
    id = useId();
  const [local, setLocal] = useState(String(defaultValue ?? options[0]?.value ?? ''));
  const requested = String(value ?? local);
  const selected = options.find((o) => o.value === requested) ?? options.find((o) => !o.disabled);
  const current = selected?.value ?? requested;
  const [open, setOpen] = useState(false),
    [search, setSearch] = useState(''),
    [active, setActive] = useState(''),
    [label, setLabel] = useState(''),
    [invalid, setInvalid] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null),
    control = useRef<HTMLSelectElement>(null),
    list = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null),
    typeahead = useRef({ text: '', time: 0 });
  const firstValue = options[0]?.value;
  useEffect(() => {
    const form = control.current?.form;
    const reset = () => {
      if (value === undefined) setLocal(String(defaultValue ?? firstValue ?? ''));
      setInvalid(false);
      setOpen(false);
    };
    form?.addEventListener('reset', reset);
    return () => form?.removeEventListener('reset', reset);
  }, [value, defaultValue, firstValue]);
  const hasSearch = searchable ?? options.length > 7;
  const filtered = options.filter(
    (o) => !search || o.label.toLocaleLowerCase('ka').includes(search.toLocaleLowerCase('ka')),
  );
  const enabled = filtered.filter((o) => !o.disabled);
  function change(next: string) {
    const el = control.current!;
    // A real change event keeps existing controlled scope guards and form handlers authoritative.
    Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')!.set!.call(el, next);
    el.dispatchEvent(new Event('change', { bubbles: true }));
    setOpen(false);
  }
  function highlight(next: string) {
    setActive(next);
    requestAnimationFrame(() =>
      document
        .getElementById(`${id}-${options.findIndex((o) => o.value === next)}`)
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
  function keys(e: KeyboardEvent) {
    const index = enabled.findIndex((o) => o.value === active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      highlight(
        enabled[Math.max(0, Math.min(enabled.length - 1, index + (e.key === 'ArrowDown' ? 1 : -1)))]
          ?.value ?? '',
      );
    } else if (e.key === 'Home' && e.target === list.current) {
      e.preventDefault();
      highlight(enabled[0]?.value ?? '');
    } else if (e.key === 'End' && e.target === list.current) {
      e.preventDefault();
      highlight(enabled.at(-1)?.value ?? '');
    } else if (e.key === 'Enter' || (e.key === ' ' && e.target === list.current)) {
      e.preventDefault();
      if (enabled.some((o) => o.value === active)) change(active);
    } else if (!hasSearch && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      const now = Date.now();
      typeahead.current = {
        text: (now - typeahead.current.time < 600 ? typeahead.current.text : '') + e.key,
        time: now,
      };
      const match = enabled.find((o) =>
        o.label.toLocaleLowerCase('ka').startsWith(typeahead.current.text.toLocaleLowerCase('ka')),
      );
      if (match) highlight(match.value);
    }
  }
  return (
    <span className={`ux-select ${className}`}>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (next) {
            setSearch('');
            setActive(selected?.value ?? enabled[0]?.value ?? '');
            setLabel(
              props['aria-label'] ??
                trigger.current?.labels?.[0]?.querySelector('span')?.textContent ??
                trigger.current?.labels?.[0]?.textContent
                  ?.replace(selected?.label ?? '', '')
                  .trim() ??
                'არჩევა',
            );
          }
        }}
      >
        <Popover.Trigger asChild>
          <button
            ref={trigger}
            type="button"
            id={props.id}
            name={undefined}
            value={current}
            className="ux-select-trigger"
            role="combobox"
            aria-haspopup="listbox"
            aria-controls={`${id}-list`}
            aria-expanded={open}
            aria-label={props['aria-label']}
            aria-labelledby={props['aria-labelledby']}
            aria-describedby={
              [props['aria-describedby'], invalid ? `${id}-error` : null]
                .filter(Boolean)
                .join(' ') || undefined
            }
            aria-invalid={invalid || props['aria-invalid']}
            aria-required={props.required}
            disabled={props.disabled}
            onKeyDown={(e) => {
              if (['ArrowDown', 'ArrowUp'].includes(e.key)) {
                e.preventDefault();
                e.currentTarget.click();
              }
            }}
          >
            <span>{selected?.label || 'აირჩიეთ…'}</span>
            <ChevronDown size={15} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="product-theme ux-popover ux-select-menu"
            sideOffset={5}
            collisionPadding={12}
            align="start"
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              (hasSearch ? input.current : list.current)?.focus();
            }}
            onKeyDown={keys}
          >
            {hasSearch && (
              <div className="ux-select-search">
                <Search size={15} aria-hidden="true" />
                <input
                  ref={input}
                  aria-label={`${label} — ძიება`}
                  placeholder="მოძებნეთ…"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setActive(
                      options.find(
                        (o) =>
                          !o.disabled &&
                          o.label
                            .toLocaleLowerCase('ka')
                            .includes(e.target.value.toLocaleLowerCase('ka')),
                      )?.value ?? '',
                    );
                  }}
                  aria-controls={`${id}-list`}
                  aria-activedescendant={
                    active ? `${id}-${options.findIndex((o) => o.value === active)}` : undefined
                  }
                />
              </div>
            )}
            <div
              ref={list}
              id={`${id}-list`}
              role="listbox"
              aria-label={label}
              tabIndex={hasSearch ? -1 : 0}
              aria-activedescendant={`${id}-${options.findIndex((o) => o.value === active)}`}
              className="ux-options"
            >
              {filtered.map((o) => (
                <div
                  key={o.value}
                  id={`${id}-${options.findIndex((v) => v.value === o.value)}`}
                  role="option"
                  aria-selected={o.value === current}
                  aria-disabled={o.disabled || undefined}
                  data-value={o.value}
                  data-active={o.value === active || undefined}
                  className="ux-option"
                  onMouseMove={() => !o.disabled && setActive(o.value)}
                  onClick={() => !o.disabled && change(o.value)}
                >
                  <span>{o.label}</span>
                  {o.value === current && <Check size={15} aria-hidden="true" />}
                </div>
              ))}
              {!filtered.length && (
                <p className="ux-option-empty" role="status">
                  შედეგი ვერ მოიძებნა.
                </p>
              )}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      {invalid && (
        <span className="sr-only" id={`${id}-error`} role="alert">
          აირჩიეთ მნიშვნელობა.
        </span>
      )}
      <select
        hidden
        {...props}
        id={undefined}
        aria-label={undefined}
        aria-labelledby={undefined}
        aria-hidden="true"
        tabIndex={-1}
        className="ux-select-native"
        ref={control}
        value={current}
        onInvalid={(e) => {
          e.preventDefault();
          trigger.current?.focus();
          setInvalid(true);
        }}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => {
          setLocal(e.target.value);
          setInvalid(false);
          onChange?.(e);
        }}
      >
        {children}
      </select>
    </span>
  );
}
