import { Link, useRouter } from '../lib/router.jsx';

export function Header() {
  const { path } = useRouter();
  const nav = [
    { to: '/', label: 'Overview' },
    { to: '/elections', label: 'Elections' },
    { to: '/versions', label: 'Versions' },
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

export function Footer({ sources = [] }) {
  return (
    <footer className="ftr">
      <div className="wrap ftr-in">
        <div>
          <div className="ftr-h">Source</div>
          <p>
            Fairfax County Office of Elections, Absentee &amp; Early Voting Daily
            Reports. The county labels these reports unofficial; they are not
            certified results.
          </p>
          {sources.map((s) => (
            <p key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="ftr-link">
                {s.label} ↗
              </a>
            </p>
          ))}
        </div>
        <div>
          <div className="ftr-h">Reconciliation</div>
          <p>
            Every daily series and every early-voting site column is summed and
            checked against the totals the county publishes in the same report.
            A figure that doesn't reconcile fails the build rather than shipping.
          </p>
        </div>
        <div>
          <div className="ftr-h">Not shown here</div>
          <p>
            Party registration, results, or any partisan split. This is
            administrative turnout data: when and where ballots were cast,
            nothing about who they were cast for.
          </p>
        </div>
      </div>
    </footer>
  );
}
