import { useEffect, useMemo } from 'react';
import './styles/global.css';
import './styles/components.css';

import { DATASETS } from './data/generated/index.js';
import { RouterProvider, Link, useRouter } from './lib/router.jsx';
import { byRecency, methodTotals, summary } from './lib/derive.js';
import {
  cyclePath, electionPath, electionsOf, jurisdictionPath, jurisdictionsOf,
  matchPath,
} from './lib/slugs.js';
import { fmt, fullDate, pct } from './lib/format.js';
import { Header, Footer } from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Election from './pages/Election.jsx';
import Jurisdiction from './pages/Jurisdiction.jsx';
import ElectionCycle from './pages/ElectionCycle.jsx';
import Versions from './pages/Versions.jsx';

export default function App() {
  return (
    <RouterProvider>
      <Routes />
    </RouterProvider>
  );
}

function Routes() {
  const { path, navigate } = useRouter();
  const all = useMemo(() => byRecency(DATASETS), []);
  const jurisdictions = useMemo(() => jurisdictionsOf(all), [all]);
  const elections = useMemo(() => electionsOf(all), [all]);

  /* /e/<dataset-id> is the address this site shipped with. It still
     resolves, but as a redirect to the canonical path rather than as a
     second page rendering the same thing — two live URLs for one cycle
     is how a site ends up with half its internal links pointing at the
     old one. replace(), so Back doesn't bounce off the redirect. */
  const legacy = path.startsWith('/e/')
    ? all.find((d) => d.id === path.slice(3))
    : null;
  useEffect(() => {
    if (legacy) navigate(cyclePath(legacy), { replace: true });
  }, [legacy, navigate]);

  let page;
  if (path === '/') page = <Home />;
  else if (path === '/versions') page = <Versions />;
  else if (path === '/elections') page = <ElectionIndex all={all} />;
  else if (legacy) page = null;                        // redirecting
  else {
    const hit = matchPath(path);
    const jur = hit && jurisdictions.find((j) => j.slug === hit.slug);
    if (hit?.kind === 'jurisdiction' && jur) {
      page = <Jurisdiction jur={jur} all={all} />;
    } else if (hit?.kind === 'election') {
      const el = elections.find((e) => e.slug === hit.slug);
      page = el ? <ElectionCycle election={el} /> : <NotFound />;
    } else if (hit?.kind === 'cycle' && jur) {
      const ds = jur.cycles.find((d) => d.electionDate.startsWith(hit.month));
      page = ds ? <Election ds={ds} all={all} /> : <NotFound />;
    } else page = <NotFound />;
  }

  return <Shell>{page}</Shell>;
}

function Shell({ children }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}

/**
 * The archive, grouped by election.
 *
 * Thirty rows in one flat list is a list nobody scans. Grouping by
 * election matches how the addresses are shaped — /2025-november holds
 * these rows — and gives each group a heading that is itself a link to
 * the cross-jurisdiction page for that election.
 */
function ElectionIndex({ all }) {
  const elections = electionsOf(all);
  const jurisdictions = jurisdictionsOf(all);

  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">Archive</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Elections</h1>
        <p className="lede" style={{ marginBottom: 30 }}>
          Every locality-election NovaVote holds daily data for. Each one
          reconciles against its own published totals.
        </p>

        <div className="jur-index">
          {jurisdictions.map((j) => (
            <Link key={j.slug} to={jurisdictionPath(j.name)} className="chip">
              {j.name}
              <em>{j.cycles.length}</em>
            </Link>
          ))}
        </div>

        {elections.map((el, ei) => (
          <div key={el.slug} style={{ marginTop: ei ? 42 : 34 }}>
            <h2 className="grid-group">
              <Link to={electionPath(el.date)}>
                {fullDate(el.date)} · {el.cycles.length}{' '}
                {el.cycles.length === 1 ? 'jurisdiction' : 'jurisdictions'} →
              </Link>
            </h2>
            <div className="el-list">
              {[...el.cycles]
                .sort((a, b) => methodTotals(b).early - methodTotals(a).early)
                .map((ds) => {
                  const s = summary(ds);
                  const t = methodTotals(ds);
                  return (
                    <Link key={ds.id} to={cyclePath(ds)} className="card el-row">
                      <span className="el-year" style={{ color: ds.color }}>
                        {ds.electionDate.slice(0, 4)}
                      </span>
                      <span className="el-main">
                        <strong>{ds.locality}</strong>
                        <span className="el-sub">
                          {ds.electionName} · {fullDate(ds.electionDate)}
                        </span>
                      </span>
                      <span className="el-stat">
                        <b>{fmt(t.early)}</b>
                        <span>early ballots</span>
                      </span>
                      <span className="el-stat">
                        <b>{s.closing7 == null ? '—' : pct(s.closing7)}</b>
                        <span>final week</span>
                      </span>
                      {/* A dataset with no site breakdown says so with a dash
                          rather than "0 sites", which would be a claim. */}
                      <span className="el-stat">
                        <b>{ds.detail.sites ? ds.sites.length : '—'}</b>
                        <span>sites</span>
                      </span>
                      <span className="el-go">→</span>
                    </Link>
                  );
                })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function NotFound() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">404</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>No page here</h1>
        <p className="lede" style={{ marginBottom: 24 }}>
          That address doesn't match a jurisdiction, an election, or anything
          else on the site.
        </p>
        <Link to="/" className="btn">Back to the overview →</Link>
      </div>
    </section>
  );
}
