import { useEffect, useId, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  CornerDownLeft,
  Sun,
  Moon,
  X,
  LoaderCircle,
  UsersRound,
  Command,
  type LucideIcon,
} from 'lucide-react';
import type { Viewer, StudentPage, StudentRow } from '../../shared/contracts';
import { api } from '../lib/api';
import { usePreferences } from '../lib/preferences';
import { navigation } from './navigation';
import { Avatar } from './ui';

export const commandShortcut = () => (/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘ K' : 'Win K');
type Choice = {
  id: string;
  title: string;
  subtitle: string;
  group: string;
  icon: LucideIcon;
  path?: string;
  person?: StudentRow;
  action?: () => void;
  planned?: boolean;
};
export function CommandPalette({
  open,
  onOpenChange,
  viewer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  viewer: Viewer;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="product-theme command-backdrop" />
        <CommandContents viewer={viewer} close={() => onOpenChange(false)} />
      </Dialog.Portal>
    </Dialog.Root>
  );
}
function CommandContents({ viewer, close }: { viewer: Viewer; close: () => void }) {
  const input = useRef<HTMLInputElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const id = useId();
  const [q, setQ] = useState('');
  const [settled, setSettled] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const { theme, setTheme } = usePreferences();
  const canSearch = viewer.capabilities.some((c) => c.startsWith('students:'));
  const query = q.trim();
  useEffect(() => {
    const timer = setTimeout(() => setSettled(query), 120);
    return () => clearTimeout(timer);
  }, [query]);
  const people = useQuery({
    queryKey: ['command-people', viewer.id, settled],
    queryFn: ({ signal }) =>
      api<StudentPage>(`/api/foundation/students?q=${encodeURIComponent(settled)}&limit=8`, {
        signal,
      }),
    enabled: canSearch && settled.length >= 2,
    staleTime: 0,
    retry: false,
  });
  const planned = new Set(['/finance', '/reports', '/messages', '/community']);
  const lower = query.toLocaleLowerCase();
  const choices: Choice[] = [
    ...(viewer.capabilities.some((c) => c.startsWith('gradebook:'))
      ? [
          {
            id: 'gradebook-recovery',
            title: 'შემაჯამებლების აღდგენა',
            subtitle: 'აკადემიური მოთხოვნები და დამატებითი ვადები',
            group: 'ჟურნალი',
            icon: Command,
            path: '/gradebook?tab=recovery',
          },
        ]
      : []),
    ...navigation(viewer).map((n) => ({
      id: n.path,
      title: n.label,
      subtitle: planned.has(n.path)
        ? 'დაგეგმილი მოდული'
        : n.path === '/'
          ? 'თქვენი დღის ერთიანი ხედვა'
          : n.path === '/students'
            ? 'თქვენთვის ხელმისაწვდომი მოსწავლეები'
            : 'სასკოლო სამუშაო სივრცე',
      group: 'გვერდები',
      icon: n.icon,
      path: n.path,
      planned: planned.has(n.path),
    })),
    {
      id: 'theme',
      title: theme === 'light' ? 'მუქი რეჟიმი' : 'ღია რეჟიმი',
      subtitle: 'სივრცის ფერის რეჟიმის შეცვლა',
      group: 'მოქმედებები',
      icon: theme === 'light' ? Moon : Sun,
      action: () => setTheme(theme === 'light' ? 'dark' : 'light'),
    },
  ].filter((c) => (c.title + ' ' + c.subtitle).toLocaleLowerCase().includes(lower));
  const ready = canSearch && query.length >= 2 && query === settled;
  if (ready && !people.isFetching && !people.isError)
    choices.push(
      ...(people.data?.items ?? []).map((person) => ({
        id: person.id,
        title: person.name,
        subtitle: `${person.section ?? 'კლასი მითითებული არ არის'} · ${person.number}`,
        group: 'მოსწავლეები',
        icon: UsersRound,
        person,
        path: `/students?student=${encodeURIComponent(person.id)}`,
      })),
    );
  const index = Math.min(active, Math.max(0, choices.length - 1));
  const selected = choices[index];
  const searching = canSearch && query.length >= 2 && (!ready || people.isFetching);
  useEffect(() => {
    const option = list.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    option?.scrollIntoView({ block: 'nearest' });
  }, [index, query, choices.length]);
  function choose(choice: Choice | undefined) {
    if (!choice) return;
    close();
    if (choice.path) navigate(choice.path);
    else choice.action?.();
  }
  return (
    <Dialog.Content
      className="product-theme product-command"
      onOpenAutoFocus={(e) => {
        e.preventDefault();
        origin.current =
          document.activeElement instanceof HTMLElement ? document.activeElement : null;
        input.current?.focus();
      }}
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        if (origin.current?.isConnected) origin.current.focus();
        else document.querySelector<HTMLButtonElement>('.search-trigger')?.focus();
      }}
    >
      <header className="command-heading">
        <Dialog.Title>
          <Command size={15} />
          სივრცეში ძიება
        </Dialog.Title>
        <span>{commandShortcut()}</span>
        <Dialog.Close className="product-icon" aria-label="დახურვა">
          <X size={17} />
        </Dialog.Close>
      </header>
      <Dialog.Description className="sr-only">
        მოძებნეთ გვერდი ან თქვენთვის ხელმისაწვდომი მოსწავლე. შედეგებზე გადასასვლელად გამოიყენეთ
        ისრები და Enter.
      </Dialog.Description>
      <div className="command-search">
        <Search size={23} />
        <input
          ref={input}
          role="combobox"
          aria-label="საძიებო სიტყვა"
          aria-autocomplete="list"
          aria-controls={`${id}-results`}
          aria-expanded="true"
          aria-activedescendant={selected ? `${id}-option-${index}` : undefined}
          value={q}
          maxLength={100}
          autoComplete="off"
          spellCheck={false}
          placeholder="გვერდი, მოსწავლე ან მოქმედება…"
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive(
                choices.length
                  ? (index + (e.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length
                  : 0,
              );
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              choose(selected);
            }
            if (e.altKey && e.key === 'Home') {
              e.preventDefault();
              setActive(0);
            }
            if (e.altKey && e.key === 'End') {
              e.preventDefault();
              setActive(Math.max(0, choices.length - 1));
            }
          }}
        />
        {searching ? (
          <LoaderCircle size={18} className="product-spinner" />
        ) : q ? (
          <button
            className="product-icon"
            aria-label="ძიების გასუფთავება"
            onClick={() => {
              setQ('');
              setActive(0);
              input.current?.focus();
            }}
          >
            <X size={17} />
          </button>
        ) : (
          <kbd>esc</kbd>
        )}
      </div>
      <div className="command-body">
        <div className="command-list-wrap">
          <div
            ref={list}
            id={`${id}-results`}
            role="listbox"
            aria-label="ძიების შედეგები"
            className="command-list"
          >
            {choices.map((c, i) => (
              <div key={c.id} role="presentation">
                {choices[i - 1]?.group !== c.group && (
                  <div className="command-group" role="presentation">
                    {c.group}
                  </div>
                )}
                <div
                  role="option"
                  aria-selected={i === index}
                  id={`${id}-option-${i}`}
                  data-index={i}
                  onMouseMove={() => setActive(i)}
                  className="command-option"
                >
                  <button tabIndex={-1} aria-label={c.title} onClick={() => choose(c)}>
                    {c.person ? (
                      <Avatar name={c.person.name} />
                    ) : (
                      <span className="command-option-icon">
                        <c.icon size={19} />
                      </span>
                    )}
                    <span>
                      <strong>{c.title}</strong>
                      <small>{c.subtitle}</small>
                    </span>
                    {i === index ? <CornerDownLeft size={16} /> : <ArrowUpRight size={14} />}
                  </button>
                </div>
              </div>
            ))}
          </div>
          {searching && (
            <p className="command-status" role="status">
              მოსწავლეების ძიება…
            </p>
          )}
          {ready && people.isError && (
            <div className="command-status" role="alert">
              <p>ძიება ვერ შესრულდა.</p>
              <button onClick={() => void people.refetch()}>
                ხელახლა ცდა <ArrowRightIcon />
              </button>
            </div>
          )}
          {!choices.length && !searching && !(ready && people.isError) && (
            <div className="command-empty">
              <Search size={28} />
              <h3>შედეგი ვერ მოიძებნა</h3>
              <p>შეცვალეთ საძიებო სიტყვა ან მოძებნეთ სახელი.</p>
              <button
                className="product-secondary"
                onClick={() => {
                  setQ('');
                  input.current?.focus();
                }}
              >
                ძიების გასუფთავება
              </button>
            </div>
          )}
          {!query && canSearch && (
            <p className="command-search-hint">მოსწავლის მოსაძებნად შეიყვანეთ მინიმუმ 2 სიმბოლო.</p>
          )}
        </div>
        <aside className="command-preview" aria-label="არჩეული შედეგის მიმოხილვა">
          {selected ? (
            <>
              <span className="product-eyebrow">
                {selected.group === 'მოსწავლეები'
                  ? 'მოსწავლის მიმოხილვა'
                  : selected.group === 'მოქმედებები'
                    ? 'სივრცის პარამეტრი'
                    : 'სწრაფი წვდომა'}
              </span>
              <div className="command-preview-symbol">
                {selected.person ? (
                  <Avatar name={selected.person.name} />
                ) : (
                  <selected.icon size={28} />
                )}
              </div>
              <h3>{selected.title}</h3>
              <p>{selected.subtitle}</p>
              {selected.person ? (
                <dl>
                  <div>
                    <dt>კლასი</dt>
                    <dd>{selected.person.section ?? '—'}</dd>
                  </div>
                  <div>
                    <dt>ნომერი</dt>
                    <dd className="product-number">{selected.person.number}</dd>
                  </div>
                  <div>
                    <dt>სტატუსი</dt>
                    <dd>{selected.person.status === 'active' ? 'აქტიური' : 'არქივში'}</dd>
                  </div>
                </dl>
              ) : (
                <p className="command-preview-note">
                  {selected.planned
                    ? 'ამ გვერდზე მოცემულია მომავალი მოდულის აღწერა.'
                    : selected.id === 'theme'
                      ? 'ფერის რეჟიმი შეიცვლება და დამახსოვრდება ამ ბრაუზერში.'
                      : 'გახსენით საჭირო სივრცე ერთი მოქმედებით.'}
                </p>
              )}
              <span className="command-preview-enter">
                <kbd>↵</kbd> {selected.action ? 'შეცვლა' : 'გახსნა'}
              </span>
            </>
          ) : (
            <>
              <Search size={30} />
              <h3>საჭირო სივრცე, ახლოს.</h3>
              <p>გვერდები, მოსწავლეები და სწრაფი მოქმედებები.</p>
            </>
          )}
        </aside>
      </div>
      <footer className="command-footer">
        <span>
          <kbd>
            <ArrowUp size={12} />
          </kbd>
          <kbd>
            <ArrowDown size={12} />
          </kbd>{' '}
          არჩევა
        </span>
        <span>
          <kbd>↵</kbd> გახსნა
        </span>
        <span>
          <kbd>esc</kbd> დახურვა
        </span>
        <span className="command-result-count" role="status">
          {searching ? 'ძიება…' : `${choices.length} შედეგი`}
        </span>
      </footer>
    </Dialog.Content>
  );
}
function ArrowRightIcon() {
  return <ArrowUpRight size={13} />;
}
