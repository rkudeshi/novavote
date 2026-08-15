import { useMemo, useState } from 'react';
import { DATASETS } from '../data/generated/index.js';
import { JURISDICTIONS, NOV2025 } from '../data/jurisdictions.js';
import { Link } from '../lib/router.jsx';
import { fmt, pct, shortDate } from '../lib/format.js';
import { byRecency, methodTotals, summary } from '../lib/derive.js';
import { useCountUp, useInView } from '../lib/motion.js';
import SurgeChart from '../components/charts/SurgeChart.jsx';

const VIEWS = [
  { key: 'share', label: 'Daily share' },
  { key: 'cumulativeShare', label: 'Banked to date' },
  { key: 'electorateShare', label: 'Share of electorate' },
];

const BLURB = {
  share: "Each day's ballots as a share of that cycle's whole early vote.",
  cumulativeShare: 'Share of the early vote already cast by that day.',
  electorateShare: 'Ballots that day as a percentage of registered voters.',
};

export default function Home() {
  const all = useMemo(() => byRecency(DATASETS), []);
  const [view, setView] = useState('share');

  const comparable = useMemo(
    () => (view === 'electorateShare' ? all.filter((d) => d.registeredVoters) : all),
    [all, view],
  );

  return (
    <>
      <Hero />
      <Jurisdictions />

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">The shape of an early vote</h2>
            </div>
            <div className="seg" role="tablist" aria-label="Comparison metric">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  role="tab"
                  aria-selected={view === v.key}
                  className={view === v.key ? 'is-on' : ''}
                  onClick={() => setView(v.key)}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
          <p className="note" style={{ marginBottom: 22 }}>
            {BLURB[view]} Every cycle is plotted by days before its own Election
            Day, so different years line up.
          </p>

          <div className="card chart-card">
            <SurgeChart key={view} datasets={comparable} metric={view} height={400} />
          </div>

          {view === 'electorateShare' && comparable.length < all.length && (
            <p className="note" style={{ marginTop: 14 }}>
              {comparable.length} of {all.length} cycles shown — the rest have no
              registered-voter count recorded.
            </p>
          )}
        </div>
      </section>

      <CycleGrid datasets={all} />
    </>
  );
}

function Hero() {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const { reporting, inScope, totals } = NOV2025;
  const n = useCountUp(totals.early, inView, 1700);
  const only = reporting === 1 ? JURISDICTIONS.find((j) => j.total != null) : null;

  return (
    <section className="section hero" ref={ref}>
      <div className="wrap">
        <div className="eyebrow rise" style={{ animationDelay: '.05s' }}>
          Northern Virginia · November 2025 general election
        </div>
        <h1 className="h1 rise" style={{ animationDelay: '.12s' }}>
          <span className="hero-num">{fmt(Math.round(n))}</span>
          <br />
          early ballots
          <br />
          {only ? `in ${only.name}.` : `across ${reporting} jurisdictions.`}
        </h1>
        <p className="lede rise" style={{ animationDelay: '.2s', marginTop: 20 }}>
          NovaVote tracks early voting across Northern Virginia — in person and
          by mail — day by day.{' '}
          {reporting < inScope && (
            <>
              {reporting} of {inScope} jurisdictions{' '}
              {reporting === 1 ? 'has' : 'have'} daily data so far.
            </>
          )}
        </p>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------
   Jurisdiction comparison — the lead of the page.

   Two encodings, because the two questions are different: the bar is
   raw volume (Fairfax dwarfs Falls Church), the share split is the mix
   (a small city can lean far harder on mail than a big county). Every
   jurisdiction carries both, so neither reading is privileged.
------------------------------------------------------------------ */
function Jurisdictions() {
  const [ref, inView] = useInView({ threshold: 0.1 });
  const rows = JURISDICTIONS.filter((j) => j.total != null);
  const pending = JURISDICTIONS.filter((j) => j.total == null);
  const max = Math.max(...rows.map((j) => j.total), 1);

  return (
    <section className="section" ref={ref}>
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 8 }}>
          Early voting by jurisdiction
        </h2>
        <p className="note" style={{ marginBottom: 26 }}>
          November 2025 general election. Bar length is total early ballots;
          the split shows how they were cast.
        </p>

        <div className="jur">
          {rows.map((j, i) => {
            const ipShare = (j.inPerson / j.total) * 100;
            return (
              <div className="jur-row" key={j.key}>
                <div className="jur-name">
                  {j.href ? <Link to={j.href}>{j.name}</Link> : j.name}
                </div>
                <div className="jur-barwrap">
                  <div
                    className="jur-bar"
                    style={{
                      width: inView ? `${(j.total / max) * 100}%` : '0%',
                      transitionDelay: `${i * 60}ms`,
                    }}
                  >
                    <span className="jur-seg" style={{ width: `${ipShare}%` }} />
                    <span
                      className="jur-seg is-vbm"
                      style={{ width: `${100 - ipShare}%` }}
                    />
                  </div>
                </div>
                <div className="jur-figs">
                  <b>{fmt(j.total)}</b>
                  <span className="jur-split">
                    <i className="jur-dot" /> {pct(ipShare, 0)} in person
                    <i className="jur-dot is-vbm" /> {pct(100 - ipShare, 0)} by mail
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {pending.length > 0 && (
          <p className="note" style={{ marginTop: 22 }}>
            {pending.map((j) => j.name).join(', ')}{' '}
            {pending.length === 1 ? 'is' : 'are'} in scope, with no figures
            recorded yet.
          </p>
        )}
      </div>
    </section>
  );
}

function CycleGrid({ datasets }) {
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 22 }}>
          Elections with daily data
        </h2>
        <div className="cycle-grid">
          {datasets.map((ds, i) => (
            <CycleCard key={ds.id} ds={ds} delay={i * 70} />
          ))}
        </div>
      </div>
    </section>
  );
}

function CycleCard({ ds, delay }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const s = summary(ds);
  const m = methodTotals(ds);
  return (
    <Link
      to={`/e/${ds.id}`}
      className={`card cycle ${inView ? 'is-in' : ''}`}
      ref={ref}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="cycle-top">
        <span className="cycle-year" style={{ color: ds.color }}>
          {ds.electionDate.slice(0, 4)}
        </span>
        <span className="cycle-spark">
          <SurgeChart datasets={[ds]} height={64} metric="share" showAxis={false} />
        </span>
      </div>
      <h3 className="h3">{ds.locality}</h3>
      <div className="cycle-sub">{ds.electionName}</div>
      {!s.complete && <div className="badge-partial">Partial data</div>}
      <dl className="cycle-stats">
        <div>
          <dt>Early ballots</dt>
          <dd>{fmt(m.early)}</dd>
        </div>
        <div>
          <dt>In person</dt>
          <dd>{pct((m.inPerson / m.early) * 100, 0)}</dd>
        </div>
        <div>
          <dt>{s.complete ? 'Sites' : 'Through'}</dt>
          <dd>{s.complete ? ds.sites.length : shortDate(ds.coverage.dataThrough)}</dd>
        </div>
      </dl>
      <span className="cycle-go">Explore →</span>
    </Link>
  );
}
