/* ------------------------------------------------------------------
   A ~60-line path router.

   Real paths (not hashes) because the version archive is meant to be
   linkable as /versions/v1. GitHub Pages has no rewrite rules, so the
   build copies index.html to 404.html — Pages serves that for any deep
   path, the app boots, and this router reads location.pathname. See
   vite.config.js.
------------------------------------------------------------------ */
import {
  createContext, forwardRef, useCallback, useContext, useEffect, useState,
} from 'react';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const RouterContext = createContext({ path: '/', navigate: () => {} });

/** Strip the deploy base (/novavote) so routes are written base-agnostic. */
function currentPath() {
  const p = window.location.pathname;
  const stripped = BASE && p.startsWith(BASE) ? p.slice(BASE.length) : p;
  return stripped.replace(/\/+$/, '') || '/';
}

export function RouterProvider({ children }) {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onPop = () => setPath(currentPath());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  /* `replace` is for redirects — the legacy /e/<id> addresses resolve to
     a canonical path, and pushing that would leave the old URL in the
     history so Back bounces straight off the redirect again. */
  const navigate = useCallback((to, { replace = false } = {}) => {
    if (to === currentPath()) return;
    const url = `${BASE}${to === '/' ? '/' : to}`;
    if (replace) window.history.replaceState({}, '', url);
    else window.history.pushState({}, '', url);
    setPath(to);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);

  return (
    <RouterContext.Provider value={{ path, navigate }}>{children}</RouterContext.Provider>
  );
}

export const useRouter = () => useContext(RouterContext);

/** Anchor that keeps real href semantics (open-in-new-tab still works). */
export const Link = forwardRef(function Link({ to, children, ...rest }, ref) {
  const { navigate } = useRouter();
  const onClick = (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    e.preventDefault();
    navigate(to);
  };
  return (
    <a ref={ref} href={`${BASE}${to}`} onClick={onClick} {...rest}>
      {children}
    </a>
  );
});
