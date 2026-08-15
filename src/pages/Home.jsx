import { useMemo, useState } from 'react';
import { DATASETS } from '../data/generated/index.js';
import { Link } from '../lib/router.jsx';
import { fmt, fullDate, longDate, pct, shortDate } from '../lib/format.js';
import { byRecency, summary } from '../lib/derive.js';
import { useCountUp, useInView } from '../lib/motion.js';
import SurgeChart from '../components/charts/SurgeChart.jsx';

const VIEWS = [
  {
    key: 'share',
    label: 'Daily share',
    blurb:
      "Each day's ballots as a share of that cycle's whole early vote. The shape is the story: a long flat plain, then a wall.",
  },
  {
    key: 'cumulativeShare',
    label: 'Banked to date',
    blurb:
      'Cumulative share of the early vote already cast. Where the curve is still low with a week to go, most of the vote is still coming.',
  },
  {
    key: 'electorateShare',
    label: 'Share of electorate',
    blurb:
      'Ballots that day as a percentage of registered voters — the measure that compares jurisdictions of different sizes on equal footing.',
  },
];

export default function Home() {
  const all = useMemo(() => byRecency(DATASETS), []);
  const latest = all[0];
  const [view, setView] = useState('share');

  const comparable = useMemo(
    () =>
      view === 'electorateShare'
        ? all.filter((d) => d.registeredVoters)
        : all,
    [all, view],
  );

  const active = VIEWS.find((v) => v.key === view);

  return (
    <>
      <Hero ds={latest} count={all.length} />

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">Every cycle, aligned to its own Election Day</div>
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
          <p className="lede" style={{ marginBottom: 24 }}>{active.blurb}</p>

          <div className="card chart-card">
            {comparable.length ? (
              <SurgeChart
                key={view}
                datasets={comparable}
                metric={view}
                height={400}
              />
            ) : (
              <p className="note" style={{ padding: 32 }}>
                No cycle in the archive has a registered-voter count attached yet,
                so this view has nothing to plot. The other two views work from
                ballot counts alone.
              </p>
            )}
          </div>

          {view === 'electorateShare' && comparable.length < all.length && (
            <p className="note" style={{ marginTop: 14 }}>
              Showing {comparable.length} of {all.length} cycles — the rest have no
              registered-voter total recorded, so a share of the electorate can't
              be computed for them.
            </p>
          )}
        </div>
      </section>

      <CycleGrid datasets={all} />
      <Roadmap />
    </>
  );
}

function Hero({ ds, count }) {
  const [ref, inView] = useInView({ threshold: 0.3 });
  const s = summary(ds);
  const n = useCountUp(s.early, inView, 1700);

  return (
    <section className="section hero" ref={ref}>
      <div className="wrap">
        <div className="eyebrow rise" style={{ animationDelay: '.05s' }}>
          {ds.locality} · {ds.electionName} · {fullDate(ds.electionDate)}
        </div>
        <h1 className="h1 rise" style={{ animationDelay: '.12s' }}>
          <span className="hero-num">{fmt(Math.round(n))}</span>
          <br />
          ballots were cast before
          <br />
          anyone showed up to vote.
        </h1>
        <p className="lede rise" style={{ animationDelay: '.2s', marginTop: 20 }}>
          NovaVote tracks Virginia early voting day by day — in person, by mail,
          and by drop box. {pct(s.closing7, 0)} of {ds.locality}'s{' '}
          {ds.electionDate.slice(0, 4)} early vote arrived in the final week
          alone, peaking at {fmt(s.peak.value)} ballots on{' '}
          {longDate(s.peak.date)}.
        </p>

        <div className="kpis rise" style={{ animationDelay: '.28s' }}>
          <Kpi
            k="Early ballots"
            v={fmt(s.early)}
            s={`across ${s.votingDays} voting days`}
          />
          <Kpi
            k="Cast in the last 7 days"
            v={pct(s.closing7, 0)}
            s="of the cycle's early vote"
          />
          <Kpi
            k="Busiest single day"
            v={fmt(s.peak.value)}
            s={longDate(s.peak.date)}
          />
          <Kpi
            k="Cycles archived"
            v={String(count)}
            s="all reconciled to source"
          />
        </div>
      </div>
    </section>
  );
}

function Kpi({ k, v, s }) {
  return (
    <div className="kpi">
      <div className="kpi-k">{k}</div>
      <div className="kpi-v">{v}</div>
      <div className="kpi-s">{s}</div>
    </div>
  );
}

function CycleGrid({ datasets }) {
  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">The archive</div>
            <h2 className="h2">Every election we hold data for</h2>
          </div>
        </div>
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
      {!s.complete && (
        <div className="badge-partial">Mid-cycle snapshot</div>
      )}
      <dl className="cycle-stats">
        <div>
          <dt>Early ballots</dt>
          <dd>{fmt(s.early)}</dd>
        </div>
        <div>
          <dt>{s.complete ? 'Final week' : 'Data through'}</dt>
          <dd>{s.complete ? pct(s.closing7, 0) : shortDate(ds.coverage.dataThrough)}</dd>
        </div>
        <div>
          <dt>Sites</dt>
          <dd>{ds.sites.length}</dd>
        </div>
      </dl>
      <span className="cycle-go">Explore this election →</span>
    </Link>
  );
}

function Roadmap() {
  const queued = [
    ['Loudoun County', 'County publishes a daily AB report'],
    ['Prince William County', 'County publishes a daily AB report'],
    ['Arlington County', 'County publishes a daily AB report'],
    ['City of Alexandria', 'City publishes a daily AB report'],
    ['Richmond City', 'Needs a source survey'],
    ['Virginia Beach', 'Needs a source survey'],
  ];
  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">What plugs in next</div>
        <h2 className="h2" style={{ marginBottom: 10 }}>
          Built to take more jurisdictions
        </h2>
        <p className="note" style={{ marginBottom: 26 }}>
          Every comparison on this page is indexed to days-until-Election-Day and
          normalised by the size of the electorate, so a new locality drops in as
          one more dataset — no chart changes. These are the ones queued up.
        </p>
        <div className="queue">
          {queued.map(([name, note]) => (
            <div key={name} className="queue-item">
              <strong>{name}</strong>
              <span>{note}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
