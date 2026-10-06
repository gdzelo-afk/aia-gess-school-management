import { useId, useState, useRef, useEffect, useLayoutEffect } from 'react';
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
  const tooltip = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ top: 8, left: 72 });
  useLayoutEffect(() => {
    if (top === null || !collapsed || !tooltip.current) return;
    const place = () => {
      const box = tooltip.current!.getBoundingClientRect();
      setPosition({
        top: Math.max(8, Math.min(top, window.innerHeight - box.height - 8)),
        left: Math.max(8, Math.min(72, window.innerWidth - box.width - 8)),
      });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(tooltip.current);
    return () => observer.disconnect();
  }, [top, collapsed, item.label]);
  useLayoutEffect(() => {
    setTop(null);
  }, [collapsed]);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => {
    const dismiss = (event?: Event) => {
      if (event?.target instanceof Node && tooltip.current?.contains(event.target)) return;
      clearTimeout(timer.current);
      setTop(null);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', escape);
    window.addEventListener('scroll', dismiss, true);
    window.addEventListener('resize', dismiss);
    return () => {
      clearTimeout(timer.current);
      window.removeEventListener('scroll', dismiss, true);
      window.removeEventListener('resize', dismiss);
      window.removeEventListener('keydown', escape);
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
            ref={tooltip}
            style={position}
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
