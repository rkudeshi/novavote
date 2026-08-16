import { useMemo, useState } from 'react';
import { DATASETS } from '../data/generated/index.js';
import { JURISDICTIONS, NOV2025 } from '../data/jurisdictions.js';
import { Link } from '../lib/router.jsx';
import { fmt, longDate, parseDate, pct, shortDate } from '../lib/format.js';
import { byRecency, methodTotals, summary } from '../lib/derive.js';
import { cyclePath, electionPath, jurisdictionPath } from '../lib/slugs.js';
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
  const scopes = useMemo(() => buildScopes(all), [all]);
  const [scope, setScope] = useState(scopes[0].key);
  const [view, setView] = useState(scopes[0].metric);

  const chosen = scopes.find((sc) => sc.key === scope) || scopes[0];
  const comparable = useMemo(
    () =>
      view === 'electorateShare'
        ? chosen.datasets.filter((d) => d.registeredVoters)
        : chosen.datasets,
    [chosen, view],
  );

  return (
    <>
      <Hero />
      <KeyNumbers />
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
          {scopes.length > 1 && (
            <div className="seg seg-scope" role="tablist" aria-label="Comparison scope">
              {scopes.map((sc) => (
                <button
                  key={sc.key}
                  role="tab"
                  aria-selected={scope === sc.key}
                  className={scope === sc.key ? 'is-on' : ''}
                  onClick={() => { setScope(sc.key); setView(sc.metric); }}
                >
                  {sc.label}
                </button>
              ))}
            </div>
          )}
          <p className="note" style={{ marginBottom: 22 }}>
            {BLURB[view]} {chosen.blurb}
          </p>

          <div className="card chart-card">
            <SurgeChart
              key={`${scope}-${view}`}
              datasets={comparable}
              metric={view}
              height={400}
            />
          </div>

          {view === 'electorateShare' && comparable.length < chosen.datasets.length && (
            <p className="note" style={{ marginTop: 14 }}>
              {comparable.length} of {chosen.datasets.length} shown — the rest have
              no registered-voter count recorded.
            </p>
          )}
        </div>
      </section>

      <CycleGrid datasets={all} />
    </>
  );
}

/* ------------------------------------------------------------------
   The two comparisons the data supports, derived rather than listed.

   One jurisdiction with many cycles asks "how does this year compare
   with the last five?"; many jurisdictions in one cycle ask "who voted
   early, and how?". They are different questions and putting all
   fourteen curves on one chart answers neither, so the chart carries a
   scope switch instead of a single merged set.

   Within a single election the year on each label is noise, so those
   series are relabelled to the bare place name.
------------------------------------------------------------------ */
function buildScopes(all) {
  const out = [];

  const perLocality = {};
  all.forEach((d) => { (perLocality[d.locality] ||= []).push(d); });
  const deepest = Object.values(perLocality)
    .sort((a, b) => b.length - a.length)[0];

  const latest = all.reduce(
    (a, d) => (d.electionDate > a ? d.electionDate : a), all[0].electionDate);
  const places = all.filter((d) => d.electionDate === latest);

  if (places.length > 1) {
    out.push({
      key: 'places',
      label: `${places.length} jurisdictions`,
      /* Nine places in one election share the same arc almost exactly,
         so a daily-share chart of them is nine copies of one curve.
         Cumulative share is where they actually differ — who banks the
         vote early and who leaves it to the last week. */
      metric: 'cumulativeShare',
      groupLabel: `${new Date(`${latest}T00:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}, across Northern Virginia`,
      blurb: 'Each jurisdiction is plotted against its own Election Day.',
      datasets: places.map((d) => ({ ...d, shortLabel: d.shortName })),
    });
  }
  if (deepest.length > 1) {
    const span = deepest.map((d) => d.electionDate.slice(0, 4)).sort();
    out.push({
      key: 'years',
      label: `${deepest[0].shortName} by year`,
      metric: 'share',
      groupLabel: `${deepest[0].locality}, ${span[0]}\u2013${span[span.length - 1]}`,
      blurb: 'Every cycle is plotted by days before its own Election Day, so different years line up.',
      datasets: deepest,
    });
  }
  return out.length
    ? out
    : [{ key: 'all', label: 'All', metric: 'share', blurb: '', datasets: all }];
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
        <h1 className="h1 hero-h1">
          <span className="hero-num rise" style={{ animationDelay: '.12s' }}>
            {fmt(Math.round(n))}
          </span>
          <br />
          {/* Word-by-word reveal. The number lands first and the sentence
              assembles under it, so the eye reads the figure before the
              clause that qualifies it. */}
          <Words text="early ballots" start={0.34} />
          <br />
          <Words
            text={only ? `in ${only.name}.` : `across ${reporting} jurisdictions.`}
            start={0.52}
          />
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

/**
 * Word-by-word reveal for the hero headline.
 *
 * Split on spaces and animate each word in turn, so the number lands
 * first and the sentence assembles under it. Non-breaking spaces keep
 * the inline-block words from collapsing their gaps.
 */
function Words({ text, start = 0 }) {
  const words = text.split(' ');
  return words.map((word, i) => (
    <span
      key={`${word}-${i}`}
      className="hero-word"
      style={{ animationDelay: `${start + i * 0.09}s` }}
    >
      {word}
      {i < words.length - 1 ? '\u00a0' : ''}
    </span>
  ));
}

/**
 * Key numbers across everything currently reporting.
 *
 * These are the facts that need no chart. Each one states the scope it
 * covers rather than implying the region: not every jurisdiction records
 * a registration count or a ballots-issued count, and a figure averaged
 * over one place must not be labelled as if it came from nine.
 */
function KeyNumbers() {
  const rows = JURISDICTIONS.filter((j) => j.total != null);
  if (!rows.length) return null;

  const { turnout, turnoutVoters, turnoutCovers, reporting, inPersonShare } = NOV2025;
  const peak = rows.reduce((a, j) => (!a || j.peak.share > a.peak.share ? j : a), null);
  const closing = rows.filter((j) => j.closing7 != null);
  const mail = rows.filter((j) => j.mailReturn != null);

  const avg = (list, key) => list.reduce((s, j) => s + j[key], 0) / list.length;
  /* Where the in-person habit is strongest and weakest. Both ends come
     from the same measure, so the pair is a range rather than two
     unrelated facts — and it is one of the few things every jurisdiction
     here can be compared on. */
  const ipShares = rows.map((j) => (j.inPerson / j.total) * 100).sort((a, b) => a - b);
  const low = rows.find((j) => (j.inPerson / j.total) * 100 === ipShares[0]);
  const high = rows.find(
    (j) => (j.inPerson / j.total) * 100 === ipShares[ipShares.length - 1]);

  /* "1 of 9 jurisdictions" is the whole point of the qualifier — drop it
     once every reporting jurisdiction is in the figure. */
  const scope = (n) => (n === reporting ? '' : ` \u00b7 ${n} of ${reporting} jurisdictions`);

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="keys">
          {turnout != null && (
            <Key
              v={pct(turnout)}
              k="Voted early"
              s={`of ${fmt(turnoutVoters)} registered voters${scope(turnoutCovers)}`}
            />
          )}
          {inPersonShare != null && (
            <Key
              v={pct(inPersonShare)}
              k="Cast in person"
              s={`of ${fmt(NOV2025.totals.early)} early ballots`}
            />
          )}
          {closing.length > 0 && (
            <Key
              v={pct(avg(closing, 'closing7'))}
              k="Cast in the final week"
              s={`of the early vote${scope(closing.length)}`}
            />
          )}
          {peak && (
            /* A share, not a count: the biggest single day in raw ballots
               is Fairfax's every time and says only that Fairfax is
               large. The share of a jurisdiction's own cycle that landed
               on one day is a fact about how concentrated its vote was. */
            <Key
              v={pct(peak.peak.share)}
              k="Most concentrated day"
              s={`of ${peak.name}\u2019s early vote, ${longDate(peak.peak.date)}`}
            />
          )}
          {ipShares.length > 1 && (
            <Key
              v={`${pct(ipShares[0], 0)}\u2013${pct(ipShares[ipShares.length - 1], 0)}`}
              k="In-person share, low to high"
              s={`${low.name} to ${high.name}`}
            />
          )}
          {mail.length > 0 && (
            <Key
              v={pct(avg(mail, 'mailReturn'))}
              k="Mail ballots returned"
              s={`of those issued${scope(mail.length)}`}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function Key({ v, k, s }) {
  return (
    <div className="key">
      <div className="key-v">{v}</div>
      <div className="key-k">{k}</div>
      <div className="key-s">{s}</div>
    </div>
  );
}

/* ------------------------------------------------------------------
   Jurisdiction comparison — the lead of the page.

   **The bar is a percentage, not a volume.** Fairfax casts more early
   ballots than the other eight put together, so a bar scaled to raw
   totals is a chart of how big Fairfax is — every other jurisdiction
   collapses to a stub and nothing about how they voted is legible. The
   full width is that jurisdiction's own early vote, split by how it was
   cast, so every row is drawn to the same 100% and the rows can actually
   be read against each other. The count stays, as a figure beside the
   bar rather than as the thing being encoded.
------------------------------------------------------------------ */
function Jurisdictions() {
  const [ref, inView] = useInView({ threshold: 0.1 });
  const rows = JURISDICTIONS.filter((j) => j.total != null);
  const pending = JURISDICTIONS.filter((j) => j.total == null);
  const latest = byRecency(DATASETS)[0]?.electionDate;

  return (
    <section className="section" ref={ref}>
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 8 }}>
          Early voting by jurisdiction
        </h2>
        <p className="note" style={{ marginBottom: 20 }}>
          November 2025 general election. Each bar is that jurisdiction&rsquo;s
          own early vote, split by how it was cast, so jurisdictions of very
          different sizes compare directly. The last column is early ballots as
          a share of registered voters, shown where a registration count is
          recorded.
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
                      width: inView ? '100%' : '0%',
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
                  <span className="jur-split">
                    <i className="jur-dot" /> {pct(ipShare)} in person
                    <i className="jur-dot is-vbm" /> {pct(100 - ipShare)} by mail
                  </span>
                  <b className="jur-count">{fmt(j.total)} ballots</b>
                </div>
                <div className="jur-turnout">
                  {j.turnout == null ? (
                    <span className="muted">&mdash;</span>
                  ) : (
                    <>
                      <b>{pct(j.turnout)}</b>
                      <span>of {fmt(j.registered)} voters</span>
                    </>
                  )}
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

        {/* Two ways out of this table: sideways to the rest of this
            election, or down into one jurisdiction's whole history. */}
        <div className="jur-index" style={{ marginTop: 24 }}>
          {latest && (
            <Link to={electionPath(latest)} className="chip is-on">
              Every jurisdiction, side by side →
            </Link>
          )}
          {rows.map((j) => (
            <Link key={j.key} to={j.home} className="chip">
              {j.name}<em>over time</em>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

/**
 * Every dataset, grouped by the election it belongs to.
 *
 * Grouping followed the chart's two scopes when there were fourteen
 * cards. With thirty it has to be the election: a reader looking for
 * "Loudoun 2023" is looking under 2023, not under a comparison mode.
 */
function CycleGrid({ datasets }) {
  const groups = [];
  for (const ds of datasets) {
    const key = ds.electionDate;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: electionLabel(ds), items: [] }));
    g.items.push(ds);
  }
  // Largest first inside each election, which is the order the
  // jurisdiction comparison above uses.
  groups.forEach((g) => g.items.sort((a, b) => bigger(b) - bigger(a)));

  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 22 }}>
          Elections with daily data
        </h2>
        {groups.map((g, gi) => (
          <div key={g.key} style={{ marginTop: gi ? 40 : 0 }}>
            <h3 className="grid-group">
              <Link to={electionPath(g.key)}>
                {g.label} · {g.items.length}{' '}
                {g.items.length === 1 ? 'jurisdiction' : 'jurisdictions'} →
              </Link>
            </h3>
            <div className="cycle-grid">
              {g.items.map((ds, i) => (
                <CycleCard key={ds.id} ds={ds} delay={i * 50} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

const bigger = (ds) => methodTotals(ds).early;

const electionLabel = (ds) =>
  parseDate(ds.electionDate).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

function CycleCard({ ds, delay }) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const s = summary(ds);
  const m = methodTotals(ds);
  return (
    <Link
      to={cyclePath(ds)}
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
          <dd>{pct((m.inPerson / m.early) * 100)}</dd>
        </div>
        <div>
          <dt>{!s.complete ? 'Through' : ds.detail.sites ? 'Sites' : 'Busiest day'}</dt>
          <dd>
            {!s.complete
              ? shortDate(ds.coverage.dataThrough)
              : ds.detail.sites
                ? ds.sites.length
                : fmt(s.peak.value)}
          </dd>
        </div>
      </dl>
      <span className="cycle-go">Explore →</span>
    </Link>
  );
}
