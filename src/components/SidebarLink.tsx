import { useId, useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import type { navigation } from './navigation';

/** Portal keeps keyboard/hover labels clear of the scrollable icon rail. */
export function SidebarLink({
  item,
  collapsed,
  onNavigate,
}: {
  item: ReturnType<typeof navigation>[number];
  collapsed: boolean;
  onNavigate: () => void;
}) {
  const id = useId();
  const [top, setTop] = useState<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const dismiss = () => setTop(null);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
    };
  }, []);
  function close() {
    clearTimeout(timer.current);
    setTop(null);
  }
  function leave() {
    timer.current = setTimeout(close, 120);
  }
  return (
    <>
      <NavLink
        to={item.path}
        end={item.path === '/'}
        aria-label={item.label}
        aria-describedby={collapsed && top !== null ? id : undefined}
        onMouseEnter={(e) => {
          clearTimeout(timer.current);
          setTop(
            Math.max(
              8,
              Math.min(e.currentTarget.getBoundingClientRect().top, window.innerHeight - 60),
            ),
          );
        }}
        onMouseLeave={leave}
        onFocus={(e) =>
          setTop(
            Math.max(
              8,
              Math.min(e.currentTarget.getBoundingClientRect().top, window.innerHeight - 60),
            ),
          )
        }
        onBlur={close}
        onKeyDown={(e) => {
          if (e.key === 'Escape') close();
        }}
        onClick={() => {
          close();
          onNavigate();
        }}
        className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
      >
        <item.icon size={18} aria-hidden="true" />
        <span className="nav-label">{item.label}</span>
        {item.path === '/' && <span className="nav-current" />}
      </NavLink>
      {collapsed &&
        top !== null &&
        createPortal(
          <span
            id={id}
            role="tooltip"
            className="product-theme sidebar-tooltip"
            style={{ top }}
            onMouseEnter={() => clearTimeout(timer.current)}
            onMouseLeave={close}
          >
            {item.label}
          </span>,
          document.body,
        )}
    </>
  );
}
