import { useState, useEffect, useCallback } from 'react';
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useNavigate,
  useParams,
  useLocation,
} from 'react-router-dom';
import {
  ArrowUpRight,
  ArrowRight,
  Command,
  LayoutDashboard,
  Users,
  Table2,
  LogIn,
  Sun,
  Moon,
  PanelLeft,
  Bell,
  ChevronDown,
  Search,
  Check,
  SlidersHorizontal,
  CircleHelp,
} from 'lucide-react';
import { agenda, directions, people, type Direction } from './data';
import { Mark, Modal, Kbd, Toast, Avatar, EnterHint, LabLinks } from './primitives';
import { Login, Dashboard } from './overview';
import { Students, Gradebook } from './workspaces';
import { Typography } from './typography';
export type LabActions = {
  direction: Direction;
  notify: (message: string) => void;
  openModal: (kind: 'meeting' | 'notice' | 'publish' | 'invite', event?: number) => void;
};
export function DesignLab() {
  return (
    <Routes>
      <Route path="/design-lab" element={<Hub />} />
      <Route path="/design-lab/type" element={<Typography />} />
      <Route path="/design-lab/:direction/:screen?" element={<DirectionRoute />} />
      <Route path="*" element={<Navigate to="/design-lab" replace />} />
    </Routes>
  );
}
function DirectionRoute() {
  const { direction = 'a' } = useParams();
  return direction in directions ? (
    <Experience key={direction} direction={direction as Direction} />
  ) : (
    <Navigate to="/design-lab" replace />
  );
}
function Hub() {
  return (
    <div className="dl-hub">
      <header>
        <Mark />
        <span>კვლევის არქივი / 2026</span>
        <a href="/">
          მთავარი სივრცე <ArrowUpRight size={16} />
        </a>
      </header>
      <main>
        <div className="dl-hub-intro">
          <p>სამი ხედვა. ერთი სკოლა.</p>
          <h1>
            შემდეგი სასკოლო
            <br />
            გამოცდილება.
          </h1>
          <div>
            სამი მიმართულება — კვლევის არქივი.
            <br />
            არჩეული A-ს განვითარებული სისტემა უკვე მთავარ სივრცეშია.
          </div>
        </div>
        <div className="dl-directions">
          {(Object.keys(directions) as Direction[]).map((d, i) => (
            <Link
              key={d}
              to={`/design-lab/${d}/login`}
              className={`dl-direction-preview preview-${d}`}
            >
              <div className="dl-preview-art" aria-hidden="true">
                {d === 'a' ? (
                  <>
                    <i />
                    <i />
                    <i />
                  </>
                ) : d === 'b' ? (
                  <>
                    <span>
                      28<span>/09</span>
                    </span>
                    <i />
                    <i />
                  </>
                ) : (
                  <>
                    <span>ა</span>
                    <span>ა</span>
                    <span>ა</span>
                  </>
                )}
              </div>
              <div className="dl-preview-copy">
                <span>
                  0{i + 1} / {d.toUpperCase()}
                </span>
                <h2>{directions[d].name}</h2>
                <p>{directions[d].description}</p>
                <span className="dl-preview-link">
                  მიმართულების გახსნა <ArrowUpRight size={20} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        <footer>
          <Link to="/design-lab/type">
            12 შრიფტი. რეალური ინტერფეისის ნიმუშები. <ArrowRight size={18} />
          </Link>
          <span>გამოგონილი მონაცემები · მთავარი აპლიკაცია უცვლელია</span>
        </footer>
      </main>
    </div>
  );
}
function Experience({ direction }: { direction: Direction }) {
  const [theme, setTheme] = useState(
    () => localStorage.getItem(`aia-lab-${direction}-theme`) || 'light',
  );
  const [expanded, setExpanded] = useState(true);
  const [mobile, setMobile] = useState(false);
  const [command, setCommand] = useState(false);
  const [modal, setModal] = useState<'meeting' | 'notice' | 'publish' | 'invite' | null>(null);
  const [eventIndex, setEventIndex] = useState(1);
  const event = agenda[eventIndex]!;
  const [toast, setToast] = useState('');
  const { screen = 'login' } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const notify = useCallback((m: string) => setToast(m), []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(''), 3500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommand((c) => !c);
      }
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);
  function toggleTheme() {
    const t = theme === 'light' ? 'dark' : 'light';
    setTheme(t);
    localStorage.setItem(`aia-lab-${direction}-theme`, t);
  }
  const openModal: LabActions['openModal'] = (kind, index = 1) => {
    setEventIndex(index);
    setModal(kind);
  };
  const actions = { direction, notify, openModal };
  const items = [
    { screen: 'dashboard', label: 'მიმოხილვა', icon: LayoutDashboard },
    { screen: 'students', label: 'მოსწავლეები', icon: Users },
    { screen: 'gradebook', label: 'ჟურნალი', icon: Table2 },
    { screen: 'login', label: 'შესვლა', icon: LogIn },
  ];
  const nav = (
    <>
      <div className="dl-rail-brand">
        <Mark compact={!expanded} />
      </div>
      <div className="dl-workspace-label">
        <span>სკოლის სამუშაო სივრცე</span>
        <ChevronDown size={13} />
      </div>
      <nav aria-label="მთავარი ნავიგაცია">
        {items.map((item, i) => (
          <NavLink
            key={item.screen}
            to={`/design-lab/${direction}/${item.screen}`}
            onClick={() => setMobile(false)}
            title={item.label}
          >
            <item.icon size={19} />
            <span>{item.label}</span>
            <small>0{i + 1}</small>
          </NavLink>
        ))}
      </nav>
      <div className="dl-rail-context">
        <span>I სემესტრი</span>
        <strong>2026 — 2027</strong>
        <div className="dl-rail-progress">
          <i />
        </div>
        <small>სექტემბერი · სასწავლო წლის დასაწყისი</small>
      </div>
      <div className="dl-rail-bottom">
        <button onClick={() => setCommand(true)}>
          <Command size={18} />
          <span>ბრძანებები</span>
          <Kbd>⌘ K</Kbd>
        </button>
        <button onClick={() => setModal('notice')}>
          <CircleHelp size={18} />
          <span>კვლევის შესახებ</span>
        </button>
        <LabLinks />
        <div className="dl-profile">
          <span>თჯ</span>
          <div>
            თამარ ჯაფარიძე<small>დირექტორი · ნიმუში</small>
          </div>
        </div>
      </div>
    </>
  );
  return (
    <div
      className={`dl-root dl-${direction} ${expanded ? '' : 'dl-collapsed'}`}
      data-lab-theme={theme}
    >
      {screen === 'login' ? (
        <>
          <div className="dl-login-utilities">
            <Link to="/design-lab">← მიმართულებები</Link>
            <button
              className="dl-icon"
              onClick={toggleTheme}
              aria-label={theme === 'light' ? 'მუქი რეჟიმი' : 'ღია რეჟიმი'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>
          <Login {...actions} />
        </>
      ) : (
        <div className="dl-shell">
          <aside className="dl-rail">{nav}</aside>
          <div className="dl-work">
            <header className="dl-topbar">
              <button
                className="dl-icon dl-desktop-toggle"
                aria-label="ნავიგაციის შეკეცვა"
                onClick={() => setExpanded(!expanded)}
              >
                <PanelLeft size={18} />
              </button>
              <button
                className="dl-icon dl-mobile-toggle"
                aria-label="მენიუს გახსნა"
                onClick={() => setMobile(true)}
              >
                <PanelLeft size={20} />
              </button>
              <div className="dl-breadcrumb">
                აია-ჯესსი <span>/</span>{' '}
                <strong>{items.find((i) => i.screen === screen)?.label}</strong>
              </div>
              <button className="dl-search-trigger" onClick={() => setCommand(true)}>
                <Search size={16} />
                <span>ძიება ან ბრძანება</span>
                <Kbd>⌘ K</Kbd>
              </button>
              <button
                className="dl-icon"
                onClick={toggleTheme}
                aria-label={theme === 'light' ? 'მუქი რეჟიმი' : 'ღია რეჟიმი'}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button
                className="dl-icon dl-notice-button"
                aria-label="შეტყობინებები"
                onClick={() => setModal('notice')}
              >
                <Bell size={18} />
                <i />
              </button>
            </header>
            <div className="dl-experiment">
              <span>
                <i />
                {direction.toUpperCase()} — {directions[direction].name}
              </span>
              <span>დიზაინის პროტოტიპი · გამოგონილი მონაცემები</span>
              <Link to="/design-lab">
                შედარება <ArrowUpRight size={12} />
              </Link>
            </div>
            <main key={location.pathname} className="dl-content">
              {screen === 'dashboard' ? (
                <Dashboard {...actions} />
              ) : screen === 'students' ? (
                <Students {...actions} />
              ) : screen === 'gradebook' ? (
                <Gradebook {...actions} />
              ) : (
                <Navigate to={`/design-lab/${direction}/dashboard`} replace />
              )}
            </main>
            <footer className="dl-footer">
              <span>
                AIA-GESS <i /> 2026—2027
              </span>
              <span>ცვლილებები მხოლოდ ამ დემონსტრაციაშია</span>
              <span>თბილისი · UTC+4</span>
            </footer>
          </div>
        </div>
      )}
      {mobile && (
        <Modal title="ნავიგაცია" close={() => setMobile(false)} className="dl-mobile-nav">
          {nav}
        </Modal>
      )}
      {command && (
        <CommandPalette
          direction={direction}
          close={() => setCommand(false)}
          toggleTheme={toggleTheme}
          onMeeting={() => openModal('meeting')}
        />
      )}
      {modal && (
        <Modal
          title={
            modal === 'meeting'
              ? event.title
              : modal === 'publish'
                ? 'შეფასებების მიმოხილვა'
                : modal === 'invite'
                  ? 'ახალი მოსწავლის ნიმუში'
                  : 'კვლევის სივრცე'
          }
          description="გამოგონილი სცენარი · სერვერზე არაფერი იგზავნება"
          close={() => setModal(null)}
        >
          {modal === 'meeting' ? (
            <div className="dl-modal-body">
              <span className="dl-eyebrow">
                28 სექტემბერი / {event.time}–{event.end}
              </span>
              <h3>{event.detail}</h3>
              <p>
                {eventIndex === 1
                  ? 'განვიხილოთ სასწავლო გეგმა, ორი პროფილის გადამოწმება და აკადემიური გუნდის შემდეგი ნაბიჯები.'
                  : 'განრიგის საილუსტრაციო მოვლენა. მონაწილეები და დასწრება ამ ნიმუშში არ აღირიცხება.'}
              </p>
              {eventIndex === 1 && (
                <div className="dl-attendees">
                  <span>თჯ</span>
                  <span>მკ</span>
                  <span>იმ</span>
                  <small>3 მონაწილე · შეხვედრების ოთახი</small>
                </div>
              )}
              <button
                className="dl-primary"
                onClick={() => {
                  notify('მოვლენა მონიშნულია მხოლოდ ამ ნიმუშში');
                  setModal(null);
                }}
              >
                მონიშვნა <Check size={16} />
              </button>
            </div>
          ) : modal === 'notice' ? (
            <div className="dl-modal-body">
              <h3>კვლევის არქივი — არჩეულია A</h3>
              <p>
                ეს არის ვიზუალური კვლევა. მოსწავლეები გამოგონილია. ჟურნალი და ფორმები მხოლოდ
                ბრაუზერში მუშაობს. მთავარი სისტემის მონაცემები არ იცვლება.
              </p>
              <ul>
                <li>ორი პროფილი ელოდება გადამოწმებას.</li>
                <li>გუნდის შეხვედრა დაგეგმილია 11:30-ზე.</li>
                <li>ჟურნალის ნიმუში მზადაა გამოსაცდელად.</li>
              </ul>
              <button
                className="dl-primary"
                onClick={() => {
                  setModal(null);
                  navigate(`/design-lab/${direction}/gradebook`);
                }}
              >
                ჟურნალის გახსნა <ArrowRight size={16} />
              </button>
            </div>
          ) : modal === 'publish' ? (
            <div className="dl-modal-body">
              <p>
                შეფასებები მხოლოდ ვიზუალური ნიმუშია. ოფიციალური შედეგები არ ქვეყნდება და მონაცემთა
                ბაზა არ იცვლება.
              </p>
              <button
                className="dl-primary"
                onClick={() => {
                  setModal(null);
                  notify('ნიმუში დადასტურებულია — ოფიციალური გამოქვეყნების გარეშე');
                }}
              >
                ნიმუშის დადასტურება <Check size={16} />
              </button>
            </div>
          ) : (
            <form
              className="dl-modal-body"
              onSubmit={(e) => {
                e.preventDefault();
                setModal(null);
                notify('ფორმა შემოწმებულია — მოსწავლე არ დამატებულა');
              }}
            >
              <label>
                სახელი და გვარი
                <input required placeholder="გამოგონილი სახელი" />
              </label>
              <label>
                კლასი
                <select>
                  <option>VII ა</option>
                  <option>VII ბ</option>
                  <option>VIII ა</option>
                  <option>IX ა</option>
                </select>
              </label>
              <button className="dl-primary">
                ფორმის გამოცდა <ArrowRight size={16} />
              </button>
            </form>
          )}
        </Modal>
      )}
      {toast && <Toast message={toast} />}
    </div>
  );
}
function CommandPalette({
  direction,
  close,
  toggleTheme,
  onMeeting,
}: {
  direction: Direction;
  close: () => void;
  toggleTheme: () => void;
  onMeeting: () => void;
}) {
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const navigate = useNavigate();
  const choices = [
    {
      title: 'მიმოხილვის გახსნა',
      group: 'ნავიგაცია',
      action: () => navigate(`/design-lab/${direction}/dashboard`),
    },
    {
      title: 'მოსწავლეების გახსნა',
      group: 'ნავიგაცია',
      action: () => navigate(`/design-lab/${direction}/students`),
    },
    {
      title: 'ჟურნალის გახსნა',
      group: 'ნავიგაცია',
      action: () => navigate(`/design-lab/${direction}/gradebook`),
    },
    { title: 'თემის შეცვლა', group: 'მოქმედება', action: toggleTheme },
    { title: 'გუნდის შეხვედრა', group: 'დღის კონტექსტი', action: onMeeting },
    ...people.map((p) => ({
      title: p.name,
      group: `მოსწავლე · ${p.section}`,
      person: p,
      action: () => navigate(`/design-lab/${direction}/students?person=${p.id}`),
    })),
  ].filter((c) => (c.title + ' ' + c.group).toLowerCase().includes(query.toLowerCase()));
  function choose(i: number) {
    const c = choices[i];
    if (c) {
      close();
      c.action();
    }
  }
  useEffect(() => {
    document.getElementById(`dl-result-${active}`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <Modal title="სწრაფი ძიება" close={close} className="dl-command">
      <div className="dl-command-input">
        <Search size={22} />
        <input
          data-autofocus
          role="combobox"
          aria-label="ძიება ან ბრძანება"
          aria-controls="dl-results"
          aria-expanded="true"
          aria-autocomplete="list"
          aria-activedescendant={choices.length ? `dl-result-${active}` : undefined}
          value={query}
          placeholder="მოსწავლე, გვერდი ან მოქმედება…"
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((i) => Math.min(i + 1, choices.length - 1));
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            }
            if (e.key === 'Enter') {
              e.preventDefault();
              choose(active);
            }
          }}
        />
        <Kbd>esc</Kbd>
      </div>
      <div className="dl-command-layout">
        <div id="dl-results" role="listbox" aria-label="შედეგები">
          {choices.map((c, i) => (
            <div
              key={c.title}
              id={`dl-result-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
            >
              <button tabIndex={-1} onClick={() => choose(i)}>
                {'person' in c ? <Avatar person={c.person} /> : <Command size={19} />}
                <span>
                  {c.title}
                  <small>{c.group}</small>
                </span>
                {i === active && <EnterHint />}
              </button>
            </div>
          ))}
          {!choices.length && <div className="dl-state">შედეგი ვერ მოიძებნა</div>}
        </div>
        <aside className="dl-command-preview">
          <SlidersHorizontal size={28} />
          <small>კონტექსტური მოქმედება</small>
          <h3>{choices[active]?.title || 'ძიება'}</h3>
          <p>გახსენით საჭირო სივრცე კლავიატურიდან.</p>
          <Kbd>↵</Kbd>
        </aside>
      </div>
      <footer>
        <span>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> გადაადგილება
        </span>
        <span>
          <Kbd>↵</Kbd> გახსნა
        </span>
        <small>{choices.length} შედეგი · ნიმუში</small>
      </footer>
    </Modal>
  );
}
