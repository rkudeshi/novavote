/* ------------------------------------------------------------------
   One jurisdiction, every election it has data for: /fairfax-county

   The election pages answer "what happened in this cycle?". This one
   answers "how does this cycle compare with the last ones?" — the same
   question the cumulative curves are built for, which is why they lead
   the page.

   Comparison here is *within one place*, so counts are legitimate: a
   county against its own past is a fair fight in ballots. The
   cross-jurisdiction rule — always percentages — applies on the election
   pages, where the rows are places of wildly different size.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { fmt, fullDate, pct } from '../lib/format.js';
import { cumulativeByMethod, methodTotals, summary } from '../lib/derive.js';
import { cyclePath, electionKind, electionPath } from '../lib/slugs.js';
import TrendLines from '../components/charts/TrendLines.jsx';
import DotPlot from '../components/charts/DotPlot.jsx';

/* What the curve counts. In person and by mail are the two the VPAP-style
   pair of charts asks for; the combined series is the same chart applied
   to the whole early vote. */
const MEASURES = [
  { key: 'inPerson', label: 'Early in person', noun: 'in-person ballots' },
  { key: 'vbm', label: 'Vote by mail', noun: 'mail ballots' },
  { key: 'early', label: 'All early ballots', noun: 'early ballots' },
];

/* What the curve is measured in. `mix` is the composition view — this
   method's share of every early ballot banked *so far*, which is why it
   is meaningless for the combined series and hidden there rather than
   drawn as a flat 100%. */
const UNITS = [
  { key: 'count', label: 'Ballots' },
  { key: 'mix', label: 'Share of early vote' },
  { key: 'electorate', label: 'Share of electorate' },
];

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve'];
const monthYear = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

const count = (n) => {
  const w = WORDS[n] || String(n);
  return w[0].toUpperCase() + w.slice(1);
};

export default function Jurisdiction({ jur }) {
  const cycles = jur.cycles;             // newest first
  const [measure, setMeasure] = useState('inPerson');
  const [unit, setUnit] = useState('count');

  const m = MEASURES.find((o) => o.key === measure);
  const units = UNITS.filter((u) => !(u.key === 'mix' && measure === 'early'));
  const activeUnit = units.find((u) => u.key === unit) ? unit : 'count';

  const emphasis = useMemo(() => emphasisOf(cycles), [cycles]);

  const series = useMemo(
    () => buildSeries(cycles, measure, activeUnit, emphasis),
    [cycles, measure, activeUnit, emphasis],
  );

  const latest = cycles[0];
  const prior = cycles.find((d) => emphasis[d.id] === 'secondary');
  const span = cycles.map((d) => d.electionDate.slice(0, 4)).sort();

  return (
    <>
      <section className="section el-head">
        <div className="wrap">
          <Link to="/elections" className="back">← All elections</Link>
          <div className="eyebrow" style={{ marginTop: 16 }}>
            {jur.type === 'city' ? 'Independent city' : 'County'} · Northern Virginia
          </div>
          <h1 className="h1" style={{ marginTop: 8 }}>{jur.name}</h1>
          {/* Not "6 November elections …" — that opens on a date the
              sentence does not mean. The count spelled out keeps the
              month where it belongs. */}
          <p className="lede" style={{ marginTop: 16 }}>
            {cycles.length === 1
              ? `The November ${span[0]} general election, day by day.`
              : `${count(cycles.length)} general elections, November ${span[0]} to
                 November ${span[span.length - 1]}, day by day.`}{' '}
            Every cycle is aligned to its own Election Day, so the years read
            against each other.
          </p>
        </div>
      </section>

      <Headline latest={latest} prior={prior} />

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">How the vote banked, year by year</h2>
            </div>
            <div className="seg" role="tablist" aria-label="Measure">
              {MEASURES.map((o) => (
                <button
                  key={o.key}
                  role="tab"
                  aria-selected={measure === o.key}
                  className={measure === o.key ? 'is-on' : ''}
                  onClick={() => setMeasure(o.key)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>
          <div className="seg seg-scope" role="tablist" aria-label="Units">
            {units.map((u) => (
              <button
                key={u.key}
                role="tab"
                aria-selected={activeUnit === u.key}
                className={activeUnit === u.key ? 'is-on' : ''}
                onClick={() => setUnit(u.key)}
              >
                {u.label}
              </button>
            ))}
          </div>
          <p className="note" style={{ marginBottom: 22 }}>
            {blurbFor(m, activeUnit)} Each point is the running total with that
            many days left before Election Day.
            {prior && ` ${latest.electionDate.slice(0, 4)} and `}
            {prior && `${prior.electionDate.slice(0, 4)} are drawn in colour: `}
            {prior && `both are ${electionKind(latest.electionDate).label.toLowerCase()} elections, so they are the pair that compares directly.`}
          </p>
          <div className="card chart-card">
            <TrendLines
              key={`${measure}-${activeUnit}`}
              series={series}
              unit={activeUnit === 'count' ? 'count' : 'pct'}
              height={420}
              yLabel={`Cumulative ${m.noun}`}
            />
          </div>
          {activeUnit === 'electorate' && series.length < cycles.length && (
            <p className="note" style={{ marginTop: 14 }}>
              {series.length} of {cycles.length} shown — the rest have no
              registered-voter count recorded.
            </p>
          )}
        </div>
      </section>

      <TurnoutByYear cycles={cycles} />
      <CycleTable cycles={cycles} />
    </>
  );
}

/* ------------------------------------------------------------------
   Which two cycles are drawn in colour.

   The newest cycle, and the newest cycle of the same *kind* — Virginia
   runs a four-year rotation, so a governor's year belongs beside the
   previous governor's year and not beside a presidential one. Drawing
   2025 against 2024 as if they were peers is the single most misleading
   thing a multi-year turnout chart can do; a presidential cycle roughly
   doubles the early vote here.
------------------------------------------------------------------ */
function emphasisOf(cycles) {
  const out = {};
  if (!cycles.length) return out;
  const latest = cycles[0];
  out[latest.id] = 'primary';
  const kind = electionKind(latest.electionDate).key;
  const peer = cycles
    .slice(1)
    .find((d) => electionKind(d.electionDate).key === kind);
  if (peer) out[peer.id] = 'secondary';
  cycles.forEach((d) => { out[d.id] ||= 'muted'; });
  return out;
}

function buildSeries(cycles, measure, unit, emphasis) {
  return cycles
    .filter((ds) => unit !== 'electorate' || ds.registeredVoters)
    .map((ds) => {
      const rows = cumulativeByMethod(ds)
        .filter((r) => r.daysOut >= 0)
        .map((r) => ({
          date: r.date,
          daysOut: r.daysOut,
          value:
            unit === 'count'
              ? r[measure]
              : unit === 'electorate'
                ? (r[measure] / ds.registeredVoters) * 100
                : r.early
                  ? (r[measure] / r.early) * 100
                  : null,
        }))
        /* The composition view has no answer before the first ballot is
           recorded — 0/0 is not 0%. Those days are dropped rather than
           drawn on the floor. */
        .filter((r) => r.value != null);
      return {
        id: ds.id,
        label: ds.electionDate.slice(0, 4),
        kindLabel: electionKind(ds.electionDate).label,
        emphasis: emphasis[ds.id] || 'muted',
        partial: ds.coverage?.complete === false,
        rows,
      };
    })
    /* Oldest first, so the shape list assigns marker shapes in a stable
       order as new cycles land rather than reshuffling every year. */
    .reverse();
}

function blurbFor(m, unit) {
  if (unit === 'count') return `Cumulative ${m.noun}.`;
  if (unit === 'electorate') {
    return `Cumulative ${m.noun} as a percentage of registered voters.`;
  }
  return `${m.label} as a share of every early ballot banked so far.`;
}

/**
 * The two facts a reader wants before any chart: how big the latest
 * cycle was, and whether that is up or down on the comparable one.
 *
 * The change is stated against the *comparable* election, named, rather
 * than against whatever happened to come before — "down 46% on 2024" is
 * technically true of every odd year and tells the reader nothing.
 */
function Headline({ latest, prior }) {
  const s = summary(latest);
  const t = methodTotals(latest);
  const p = prior ? methodTotals(prior) : null;
  const change = p && p.early ? ((t.early - p.early) / p.early) * 100 : null;

  return (
    <section className="section" style={{ paddingTop: 0 }}>
      <div className="wrap">
        <div className="keys">
          <Key
            v={fmt(t.early)}
            k="Early ballots"
            s={`${latest.electionDate.slice(0, 4)} general · ${s.votingDays} voting days`}
          />
          <Key
            v={pct((t.inPerson / t.early) * 100)}
            k="Cast in person"
            s={`the rest by mail`}
          />
          {latest.registeredVoters && (
            <Key
              v={pct((t.early / latest.registeredVoters) * 100)}
              k="Voted early"
              s={`of ${fmt(latest.registeredVoters)} registered voters`}
            />
          )}
          {change != null && (
            <Key
              v={`${change >= 0 ? '+' : '−'}${pct(Math.abs(change))}`}
              k={`Against ${prior.electionDate.slice(0, 4)}`}
              s={`early ballots, versus the last ${electionKind(latest.electionDate).label.toLowerCase()} election`}
            />
          )}
          {s.closing7 != null && (
            <Key
              v={pct(s.closing7)}
              k="Cast in the final week"
              s="of the early vote"
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

/**
 * Early ballots against the electorate, one row per election.
 *
 * Percentages rather than counts even though this is one place: the
 * electorate itself grows, and a raw-ballot row would mix "more voters
 * turned out" with "there are more voters". Cycles with no registration
 * count sit out rather than plotting at zero.
 */
function TurnoutByYear({ cycles }) {
  const rows = cycles
    .filter((ds) => ds.registeredVoters)
    .map((ds) => {
      const t = methodTotals(ds);
      const reg = ds.registeredVoters;
      return {
        key: ds.id,
        label: ds.electionDate.slice(0, 4),
        sub: electionKind(ds.electionDate).label,
        dots: [
          { key: 'inPerson', label: 'Early in person', value: (t.inPerson / reg) * 100 },
          { key: 'vbm', label: 'Vote by mail', value: (t.vbm / reg) * 100 },
          { key: 'early', label: 'All early ballots', value: (t.early / reg) * 100 },
        ],
      };
    });

  if (rows.length < 2) return null;

  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 8 }}>Early voting against the electorate</h2>
        <p className="note" style={{ marginBottom: 22 }}>
          Early ballots as a percentage of registered voters, by election. Not
          turnout — Election Day itself is not in these figures — but it is the
          measure that survives an electorate growing from one cycle to the next.
        </p>
        <div className="card">
          <DotPlot
            rows={rows}
            labelW={110}
            series={[
              { key: 'inPerson', label: 'Early in person', color: 'var(--s1)' },
              { key: 'vbm', label: 'Vote by mail', color: 'var(--s2)' },
              { key: 'early', label: 'All early ballots', color: 'var(--ink)' },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

function CycleTable({ cycles }) {
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 22 }}>Every recorded election</h2>
        <div className="el-list">
          {cycles.map((ds) => {
            const t = methodTotals(ds);
            const s = summary(ds);
            return (
              <Link key={ds.id} to={cyclePath(ds)} className="card el-row">
                <span className="el-year" style={{ color: ds.color }}>
                  {ds.electionDate.slice(0, 4)}
                </span>
                <span className="el-main">
                  <strong>{electionKind(ds.electionDate).label}</strong>
                  <span className="el-sub">
                    {ds.electionName} · {fullDate(ds.electionDate)}
                  </span>
                </span>
                <span className="el-stat">
                  <b>{fmt(t.early)}</b>
                  <span>early ballots</span>
                </span>
                <span className="el-stat">
                  <b>{pct((t.inPerson / t.early) * 100)}</b>
                  <span>in person</span>
                </span>
                <span className="el-stat">
                  <b>{s.closing7 == null ? '—' : pct(s.closing7)}</b>
                  <span>final week</span>
                </span>
                <span className="el-go">→</span>
              </Link>
            );
          })}
        </div>
        {/* Sideways out of this jurisdiction: the same election in every
            other place that recorded it. */}
        <p className="note" style={{ margin: '26px 0 12px' }}>
          Compare this jurisdiction against the rest of Northern Virginia:
        </p>
        <div className="jur-index">
          {cycles.map((ds) => (
            <Link key={ds.id} to={electionPath(ds.electionDate)} className="chip">
              {monthYear(ds.electionDate)}<em>all jurisdictions</em>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
