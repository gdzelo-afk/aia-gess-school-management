import { useLayoutEffect, useRef } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
/** New workspaces start at their header. Query-only changes keep the user's working position. */
export function useRouteScroll() {
  const { pathname } = useLocation();
  const navigation = useNavigationType();
  const previous = useRef(pathname);
  useLayoutEffect(() => {
    if (previous.current !== pathname) {
      document.getElementById('main')?.focus({ preventScroll: true });
      if (navigation !== 'POP') window.scrollTo({ top: 0, behavior: 'instant' });
    }
    previous.current = pathname;
  }, [pathname, navigation]);
}
