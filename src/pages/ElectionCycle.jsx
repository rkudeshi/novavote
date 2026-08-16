/* ------------------------------------------------------------------
   One election, every jurisdiction in it: /2025-november

   The mirror of the jurisdiction page. There the rows were years and
   counts were fair; here the rows are places, and **everything on this
   page is a percentage**. Fairfax casts more early ballots than the
   other eight jurisdictions put together, so a chart scaled to raw
   totals is a chart of how big Fairfax is and eight curves lie flat on
   the axis.

   Nine curves also cannot be told apart by colour alone, so the chart
   carries a focus: one jurisdiction in colour, the region's own
   aggregate beside it as the reference, and the rest as context. The
   focus is a control, not a claim — every jurisdiction is one click from
   being the emphasised line.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { Link } from '../lib/router.jsx';
import { fmt, fullDate, longDate, pct } from '../lib/format.js';
import { cumulativeByMethod, methodTotals, summary } from '../lib/derive.js';
import { cyclePath, electionKind, jurisdictionPath } from '../lib/slugs.js';
import { useInView } from '../lib/motion.js';
import TrendLines from '../components/charts/TrendLines.jsx';
import DotPlot from '../components/charts/DotPlot.jsx';

const MEASURES = [
  { key: 'inPerson', label: 'Early in person', noun: 'in-person ballots' },
  { key: 'vbm', label: 'Vote by mail', noun: 'mail ballots' },
  { key: 'early', label: 'All early ballots', noun: 'early ballots' },
];

const UNITS = [
  { key: 'electorate', label: 'Share of electorate' },
  { key: 'banked', label: 'Share of that cycle' },
];

const REGION = '__region';

export default function ElectionCycle({ election }) {
  /* Largest first: the same order the jurisdiction comparison uses
     everywhere else on the site. */
  const cycles = useMemo(
    () => [...election.cycles].sort((a, b) => methodTotals(b).early - methodTotals(a).early),
    [election],
  );

  const [measure, setMeasure] = useState('early');
  const [unit, setUnit] = useState('electorate');
  const [focus, setFocus] = useState(cycles[0].id);

  const m = MEASURES.find((o) => o.key === measure);
  const series = useMemo(
    () => buildSeries(cycles, measure, unit, focus),
    [cycles, measure, unit, focus],
  );

  const kind = electionKind(election.date);
  const totals = regionTotals(cycles);

  return (
    <>
      <section className="section el-head">
        <div className="wrap">
          <Link to="/elections" className="back">← All elections</Link>
          <div className="eyebrow" style={{ marginTop: 16 }}>
            {kind.label} · {fullDate(election.date)}
          </div>
          <h1 className="h1" style={{ marginTop: 8 }}>
            {monthYear(election.date)}
          </h1>
          <p className="lede" style={{ marginTop: 16 }}>
            {cycles.length} Northern Virginia{' '}
            {cycles.length === 1 ? 'jurisdiction' : 'jurisdictions'} with daily
            data for this election — {fmt(totals.early)} early ballots
            {cycles.length === 1 ? '.' : ' between them.'}
            {totals.spread && ` Every comparison here is a percentage, so an
              electorate of ${fmt(totals.spread.high)} and one of
              ${fmt(totals.spread.low)} read against each other.`}
          </p>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="keys">
            {totals.registered > 0 && (
              <Key
                v={pct((totals.earlyKnownReg / totals.registered) * 100)}
                k="Voted early"
                s={`of ${fmt(totals.registered)} registered voters${
                  totals.regCovers === cycles.length
                    ? ''
                    : ` · ${totals.regCovers} of ${cycles.length} jurisdictions`
                }`}
              />
            )}
            <Key
              v={pct((totals.inPerson / totals.early) * 100)}
              k="Cast in person"
              s={`of ${fmt(totals.early)} early ballots`}
            />
            {/* A range needs two ends. With one jurisdiction in the
                election, "46%–46%, Fairfax to Fairfax" is a spread
                dressed up out of a single figure — so the same measures
                are printed plainly instead. */}
            {cycles.length > 1 && (
              <Key
                v={`${pct(totals.ipLow.v, 0)}–${pct(totals.ipHigh.v, 0)}`}
                k="In-person share, low to high"
                s={`${totals.ipLow.name} to ${totals.ipHigh.name}`}
              />
            )}
            {totals.closing.length > 0 && (
              <Key
                v={cycles.length > 1
                  ? `${pct(totals.closeLow.v, 0)}–${pct(totals.closeHigh.v, 0)}`
                  : pct(totals.closing[0])}
                k="Cast in the final week"
                s={cycles.length > 1
                  ? `${totals.closeLow.name} to ${totals.closeHigh.name}`
                  : 'of the early vote'}
              />
            )}
          </div>
        </div>
      </section>

      <JurisdictionSplit cycles={cycles} />

      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <h2 className="h2">How the vote banked, place by place</h2>
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
            {UNITS.map((u) => (
              <button
                key={u.key}
                role="tab"
                aria-selected={unit === u.key}
                className={unit === u.key ? 'is-on' : ''}
                onClick={() => setUnit(u.key)}
              >
                {u.label}
              </button>
            ))}
          </div>
          <p className="note" style={{ marginBottom: 14 }}>
            {unit === 'electorate'
              ? `Cumulative ${m.noun} as a percentage of that jurisdiction's registered voters.`
              : `Share of each jurisdiction's own early vote already cast — ${m.noun} only.`}{' '}
            {cycles.length > 1
              && `Pick a jurisdiction to bring its line forward; the region’s
                  own total is drawn beside it as the reference.`}
          </p>
          {cycles.length > 1 && (
            <div className="chips" role="tablist" aria-label="Focus jurisdiction">
              {cycles.map((ds) => (
                <button
                  key={ds.id}
                  role="tab"
                  aria-selected={focus === ds.id}
                  className={`chip ${focus === ds.id ? 'is-on' : ''}`}
                  onClick={() => setFocus(ds.id)}
                >
                  {ds.shortName}
                </button>
              ))}
            </div>
          )}
          <div className="card chart-card">
            <TrendLines
              key={`${measure}-${unit}-${focus}`}
              series={series}
              unit="pct"
              height={430}
              yLabel={`Cumulative ${m.noun}`}
            />
          </div>
          {unit === 'electorate' && cycles.some((ds) => !ds.registeredVoters) && (
            <p className="note" style={{ marginTop: 14 }}>
              Jurisdictions with no registered-voter count recorded are not
              shown on this measure.
            </p>
          )}
        </div>
      </section>

      <TurnoutByPlace cycles={cycles} />
      <CycleList cycles={cycles} />
    </>
  );
}

const monthYear = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

function regionTotals(cycles) {
  const each = cycles.map((ds) => ({ ds, t: methodTotals(ds), s: summary(ds) }));
  const sum = (f) => each.reduce((a, o) => a + f(o), 0);
  const withReg = each.filter((o) => o.ds.registeredVoters);
  const closing = each.filter((o) => o.s.closing7 != null);

  const rank = (list, value) => {
    const sorted = [...list].sort((a, b) => value(a) - value(b));
    return {
      low: { v: value(sorted[0]), name: sorted[0].ds.shortName },
      high: {
        v: value(sorted[sorted.length - 1]),
        name: sorted[sorted.length - 1].ds.shortName,
      },
    };
  };

  const ip = rank(each, (o) => (o.t.inPerson / o.t.early) * 100);
  const cl = closing.length ? rank(closing, (o) => o.s.closing7) : null;

  return {
    early: sum((o) => o.t.early),
    inPerson: sum((o) => o.t.inPerson),
    vbm: sum((o) => o.t.vbm),
    /* Ballots and voters have to come from the same set of places: nine
       jurisdictions' ballots over eight jurisdictions' electorate is not
       a percentage of anything. */
    registered: withReg.reduce((a, o) => a + o.ds.registeredVoters, 0),
    earlyKnownReg: withReg.reduce((a, o) => a + o.t.early, 0),
    regCovers: withReg.length,
    /* The actual size gap this page has to reconcile, taken from the
       data rather than described in round numbers. */
    spread: withReg.length > 1
      ? {
        low: Math.min(...withReg.map((o) => o.ds.registeredVoters)),
        high: Math.max(...withReg.map((o) => o.ds.registeredVoters)),
      }
      : null,
    closing: closing.map((o) => o.s.closing7),
    ipLow: ip.low,
    ipHigh: ip.high,
    closeLow: cl?.low ?? { v: 0, name: '' },
    closeHigh: cl?.high ?? { v: 0, name: '' },
  };
}

/**
 * One series per jurisdiction plus the region's own aggregate.
 *
 * The aggregate is summed before it is divided, never averaged from the
 * nine percentages — a mean of shares weights Falls Church equally with
 * Fairfax and describes no real electorate.
 */
function buildSeries(cycles, measure, unit, focus) {
  const usable = cycles.filter((ds) => unit !== 'electorate' || ds.registeredVoters);

  const rowsOf = (ds) => cumulativeByMethod(ds).filter((r) => r.daysOut >= 0);
  const finalOf = (ds) => methodTotals(ds)[measure === 'early' ? 'early' : measure];

  const place = usable.map((ds) => {
    const final = finalOf(ds);
    return {
      id: ds.id,
      label: ds.shortName,
      emphasis: ds.id === focus ? 'primary' : 'muted',
      partial: ds.coverage?.complete === false,
      rows: rowsOf(ds)
        .map((r) => ({
          date: r.date,
          daysOut: r.daysOut,
          value:
            unit === 'electorate'
              ? (r[measure] / ds.registeredVoters) * 100
              : final
                ? (r[measure] / final) * 100
                : null,
        }))
        .filter((r) => r.value != null),
    };
  });

  /* The reference line, summed across exactly the jurisdictions drawn.
     With one jurisdiction it *is* that jurisdiction, so it is dropped
     rather than drawn as a second line over the top of the first. */
  if (usable.length < 2) return place;

  const byDay = new Map();
  let voters = 0;
  let final = 0;
  usable.forEach((ds) => {
    voters += ds.registeredVoters || 0;
    final += finalOf(ds);
    rowsOf(ds).forEach((r) => {
      const acc = byDay.get(r.daysOut) || { date: r.date, v: 0 };
      acc.v += r[measure];
      byDay.set(r.daysOut, acc);
    });
  });
  const region = {
    id: REGION,
    label: 'Region',
    emphasis: 'secondary',
    rows: [...byDay.entries()]
      .sort((a, b) => b[0] - a[0])
      .map(([daysOut, acc]) => ({
        date: acc.date,
        daysOut,
        value:
          unit === 'electorate'
            ? voters ? (acc.v / voters) * 100 : null
            : final ? (acc.v / final) * 100 : null,
      }))
      .filter((r) => r.value != null),
  };

  return [...place, region];
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
 * Every jurisdiction's own early vote, split by how it was cast.
 *
 * Same construction as the home page's comparison and for the same
 * reason: each bar is drawn to that jurisdiction's own 100%, and the
 * ballot count sits beside the bar rather than being the thing encoded.
 */
function JurisdictionSplit({ cycles }) {
  const [ref, inView] = useInView({ threshold: 0.1 });

  return (
    <section className="section" ref={ref}>
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 8 }}>How each jurisdiction voted</h2>
        <p className="note" style={{ marginBottom: 20 }}>
          Each bar is that jurisdiction&rsquo;s own early vote, split by how it
          was cast. The last column is early ballots as a share of registered
          voters, shown where a registration count is recorded.
        </p>
        <div className="jur">
          {cycles.map((ds, i) => {
            const t = methodTotals(ds);
            const ipShare = (t.inPerson / t.early) * 100;
            const turnout = ds.registeredVoters
              ? (t.early / ds.registeredVoters) * 100
              : null;
            return (
              <div className="jur-row" key={ds.id}>
                <div className="jur-name">
                  <Link to={cyclePath(ds)}>{ds.locality}</Link>
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
                    <span className="jur-seg is-vbm" style={{ width: `${100 - ipShare}%` }} />
                  </div>
                </div>
                <div className="jur-figs">
                  <span className="jur-split">
                    <i className="jur-dot" /> {pct(ipShare)} in person
                    <i className="jur-dot is-vbm" /> {pct(100 - ipShare)} by mail
                  </span>
                  <b className="jur-count">{fmt(t.early)} ballots</b>
                </div>
                <div className="jur-turnout">
                  {turnout == null ? (
                    <span className="muted">&mdash;</span>
                  ) : (
                    <>
                      <b>{pct(turnout)}</b>
                      <span>of {fmt(ds.registeredVoters)} voters</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function TurnoutByPlace({ cycles }) {
  const rows = cycles
    .filter((ds) => ds.registeredVoters)
    .map((ds) => {
      const t = methodTotals(ds);
      const reg = ds.registeredVoters;
      return {
        key: ds.id,
        label: ds.shortName,
        sub: `${fmt(reg)} voters`,
        dots: [
          { key: 'inPerson', label: 'Early in person', value: (t.inPerson / reg) * 100 },
          { key: 'vbm', label: 'Vote by mail', value: (t.vbm / reg) * 100 },
          { key: 'early', label: 'All early ballots', value: (t.early / reg) * 100 },
        ],
      };
    })
    .sort((a, b) => b.dots[2].value - a.dots[2].value);

  if (rows.length < 2) return null;

  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 8 }}>Early voting against the electorate</h2>
        <p className="note" style={{ marginBottom: 22 }}>
          Early ballots as a percentage of each jurisdiction&rsquo;s registered
          voters. Not turnout — Election Day itself is not in these figures —
          but it is what puts places of very different size on one axis.
        </p>
        <div className="card">
          <DotPlot
            rows={rows}
            labelW={128}
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

function CycleList({ cycles }) {
  return (
    <section className="section">
      <div className="wrap">
        <h2 className="h2" style={{ marginBottom: 22 }}>Each jurisdiction in detail</h2>
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
                  <strong>{ds.locality}</strong>
                  <span className="el-sub">
                    Busiest day {longDate(s.peak.date)} · {pct(s.peak.share)} of its
                    early vote
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
                  <b>{ds.detail.sites ? ds.sites.length : '—'}</b>
                  <span>sites</span>
                </span>
                <span className="el-go">→</span>
              </Link>
            );
          })}
        </div>
        {/* Down out of this election: one jurisdiction across every cycle
            it has recorded. */}
        <p className="note" style={{ margin: '26px 0 12px' }}>
          Follow one jurisdiction across every election it has recorded:
        </p>
        <div className="jur-index">
          {cycles.map((ds) => (
            <Link key={ds.id} to={jurisdictionPath(ds.locality)} className="chip">
              {ds.locality}<em>over time</em>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
