import './styles/global.css';
import './styles/components.css';

import { DATASETS } from './data/generated/index.js';
import { RouterProvider, Link, useRouter } from './lib/router.jsx';
import { byRecency, summary } from './lib/derive.js';
import { fmt, fullDate, pct } from './lib/format.js';
import { Header, Footer } from './components/Shell.jsx';
import Home from './pages/Home.jsx';
import Election from './pages/Election.jsx';
import Versions from './pages/Versions.jsx';

export default function App() {
  return (
    <RouterProvider>
      <Routes />
    </RouterProvider>
  );
}

function Routes() {
  const { path } = useRouter();
  const all = byRecency(DATASETS);

  let page;
  if (path === '/') page = <Home />;
  else if (path === '/versions') page = <Versions />;
  else if (path === '/elections') page = <ElectionIndex all={all} />;
  else if (path.startsWith('/e/')) {
    const ds = all.find((d) => d.id === path.slice(3));
    page = ds ? <Election ds={ds} all={all} /> : <NotFound />;
  } else page = <NotFound />;

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

function ElectionIndex({ all }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">Archive</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Elections</h1>
        <p className="lede" style={{ marginBottom: 34 }}>
          Every locality-election NovaVote holds daily data for. Each one
          reconciles against its own published totals.
        </p>
        <div className="el-list">
          {all.map((ds) => {
            const s = summary(ds);
            return (
              <Link key={ds.id} to={`/e/${ds.id}`} className="card el-row">
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
                  <b>{fmt(s.early)}</b>
                  <span>early ballots</span>
                </span>
                <span className="el-stat">
                  <b>{pct(s.closing7)}</b>
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
          That address doesn't match an election, a version, or anything else
          on the site.
        </p>
        <Link to="/" className="btn">Back to the overview →</Link>
      </div>
    </section>
  );
}
