import { GradebookNotices } from './GradebookNotices';
import { AttendanceNotices } from './AttendanceNotices';
import { useEffect, useState, useRef } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Bell, Sun, Moon, PanelLeft, LogOut, CheckCheck } from 'lucide-react';
import type { Viewer, FoundationOverview } from '../../shared/contracts';
import { roleLabels } from '../../shared/contracts';
import { api, signOut } from '../lib/api';
import { usePreferences } from '../lib/preferences';
import { SidebarLink } from './SidebarLink';
import { SemesterContext } from './SemesterContext';
import { TbilisiClock } from './TbilisiClock';
import { navigation } from './navigation';
import { Avatar, IconButton, Modal, Button, EmptyState, Badge } from './ui';
import { CommandPalette, commandShortcut } from './CommandPalette';
export function Shell({ viewer, onLogout }: { viewer: Viewer; onLogout: () => void }) {
  const { theme, setTheme, sidebarCollapsed, setSidebarCollapsed } = usePreferences();
  const [searchOpen, setSearchOpen] = useState(false);
  const mobileTrigger = useRef<HTMLSpanElement>(null);
  const [mobile, setMobile] = useState(false);
  const [notifications, setNotifications] = useState(false);
  const [read, setRead] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutError, setLogoutError] = useState(false);
  const location = useLocation();
  const nav = navigation(viewer);
  const active = nav.find((n) => n.path === location.pathname);
  const overview = useQuery({
    queryKey: ['overview', viewer.id],
    queryFn: () => api<FoundationOverview>('/api/foundation/overview'),
  });
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (e.repeat) return;
        setSearchOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handle);
    return () => window.removeEventListener('keydown', handle);
  }, []);
  const rail = (
    <>
      <Link
        to="/"
        className="brand"
        aria-label="AIA-GESS — მიმოხილვა"
        onClick={() => setMobile(false)}
      >
        <img src="/logo.png" alt="აია-ჯესსის ემბლემა" />
        <span>
          <strong>AIA-GESS</strong>
          <small>სასკოლო სივრცე</small>
        </span>
      </Link>
      <nav aria-label="მთავარი ნავიგაცია">
        {nav.map((item, index) => (
          <div key={item.path}>
            {nav[index - 1]?.group !== item.group && <p className="nav-group">{item.group}</p>}
            <SidebarLink
              item={item}
              collapsed={sidebarCollapsed && !mobile}
              onNavigate={() => setMobile(false)}
            />
          </div>
        ))}
      </nav>
      <SemesterContext />
      <div className="rail-bottom">
        <div className="profile">
          <Avatar name={viewer.name} />
          <span>
            <strong>{viewer.name}</strong>
            <small>{roleLabels[viewer.roles[0] ?? 'student']}</small>
          </span>
          <IconButton
            label="გასვლა"
            disabled={logoutBusy}
            onClick={async () => {
              setLogoutBusy(true);
              setLogoutError(false);
              try {
                await signOut();
                onLogout();
              } catch {
                setLogoutError(true);
              } finally {
                setLogoutBusy(false);
              }
            }}
          >
            <LogOut size={16} />
          </IconButton>
        </div>
        {logoutError && (
          <p role="alert" className="field-error">
            გასვლა ვერ შესრულდა. სცადეთ ხელახლა.
          </p>
        )}
      </div>
    </>
  );
  return (
    <div
      className={`app-layout product-theme product-shell ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}
    >
      <a href="#main" className="skip-link">
        მთავარ შინაარსზე გადასვლა
      </a>
      <aside className="sidebar" id="main-sidebar">
        {rail}
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-location">
            <IconButton
              className="icon-button sidebar-toggle"
              label={sidebarCollapsed ? 'ნავიგაციის გაშლა' : 'ნავიგაციის შეკეცვა'}
              aria-expanded={!sidebarCollapsed}
              aria-controls="main-sidebar"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            >
              <PanelLeft size={19} />
            </IconButton>
            <span className="mobile-only" ref={mobileTrigger}>
              <IconButton label="მენიუს გახსნა" onClick={() => setMobile(true)}>
                <PanelLeft size={20} />
              </IconButton>
            </span>
            <span>სასკოლო სივრცე</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{active?.label ?? 'გვერდი'}</strong>
          </div>
          <div className="topbar-actions">
            <button
              className="search-trigger"
              aria-label="მოძებნეთ სივრცეში"
              onClick={() => setSearchOpen(true)}
            >
              <Search size={16} />
              <span>მოძებნეთ სივრცეში</span>
              <kbd>{commandShortcut()}</kbd>
            </button>
            <span className="topbar-divider" />
            <IconButton
              label={theme === 'light' ? 'მუქი რეჟიმი' : 'ღია რეჟიმი'}
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </IconButton>
            <button
              className="icon-button notification-button"
              aria-label="შეტყობინებების გახსნა"
              onClick={() => setNotifications(true)}
            >
              <Bell size={19} />
              {!read && Boolean(overview.data?.announcements.length) && <i />}
            </button>
          </div>
        </header>
        <main id="main" className="main-content">
          <Outlet context={{ viewer }} />
        </main>
        <footer className="app-footer">
          <TbilisiClock />
        </footer>
      </div>
      <Modal
        open={mobile}
        onOpenChange={setMobile}
        title="სასკოლო სივრცე"
        description="მთავარი ნავიგაცია"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          mobileTrigger.current?.querySelector('button')?.focus();
        }}
        className="mobile-nav-dialog product-mobile-rail"
        themeClass="product-theme"
      >
        <div className="mobile-rail">{rail}</div>
      </Modal>
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} viewer={viewer} />
      <Modal
        open={notifications}
        onOpenChange={setNotifications}
        title="შეტყობინებები"
        description="სასკოლო სიახლეები და მნიშვნელოვანი განახლებები."
        className="notification-dialog"
        themeClass="product-theme"
      >
        <AttendanceNotices viewer={viewer} open={notifications} />
        <GradebookNotices viewer={viewer} open={notifications} />
        <div className="notification-toolbar">
          <Badge>{read ? 0 : (overview.data?.announcements.length ?? 0)} წაუკითხავი</Badge>
          <Button variant="ghost" onClick={() => setRead(true)}>
            <CheckCheck size={16} />
            ყველას წაკითხვა
          </Button>
        </div>
        {overview.data?.announcements.length ? (
          overview.data.announcements.map((n) => (
            <article className={`notice-item ${read ? 'read' : ''}`} key={n.id}>
              <span className="notice-dot" />
              <div>
                <small>{n.category}</small>
                <h3>{n.title}</h3>
                <p>{n.body}</p>
              </div>
            </article>
          ))
        ) : (
          <EmptyState title="ახალი შეტყობინება არ არის" />
        )}
        <p className="fine-print">წაკითხვის მდგომარეობა მოქმედებს მხოლოდ ამ სესიაში.</p>
      </Modal>
    </div>
  );
}
