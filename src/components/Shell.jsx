import { Link, useRouter } from '../lib/router.jsx';
import { VERSION } from '../version.js';

export function Header() {
  const { path } = useRouter();
  // Versions is reachable from the footer only — it's provenance, not a
  // destination someone comes to the site for.
  const nav = [
    { to: '/', label: 'Overview' },
    { to: '/elections', label: 'Elections' },
  ];
  return (
    <header className="hdr">
      <div className="wrap hdr-in">
        <Link to="/" className="brand" aria-label="NovaVote home">
          <Mark />
          <span className="brand-word">NovaVote</span>
        </Link>
        <nav className="nav">
          {nav.map((n) => {
            const active = n.to === '/' ? path === '/' : path.startsWith(n.to);
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`nav-link ${active ? 'is-active' : ''}`}
                aria-current={active ? 'page' : undefined}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

/* Brand mark: a rising bar cluster — the shape the data actually makes,
   replacing v1's ballot-punch ovals. */
function Mark() {
  return (
    <span className="mark" aria-hidden="true">
      <svg viewBox="0 0 22 18" width="22" height="18">
        <rect x="0" y="12" width="4" height="6" rx="1.4" fill="var(--seq-250)" />
        <rect x="6" y="8" width="4" height="10" rx="1.4" fill="var(--seq-350)" />
        <rect x="12" y="4" width="4" height="14" rx="1.4" fill="var(--seq-450)" />
        <rect x="18" y="0" width="4" height="18" rx="1.4" fill="var(--brand)" />
      </svg>
    </span>
  );
}

export function Footer() {
  return (
    <footer className="ftr">
      <div className="wrap ftr-in">
        <p className="ftr-by">
          This site is made by{' '}
          <a href="https://raviudeshi.com" className="ftr-link">Ravi Udeshi</a>.
        </p>
        <Link to="/versions" className="ftr-link ftr-ver">Version {VERSION}</Link>
      </div>
    </footer>
  );
}
