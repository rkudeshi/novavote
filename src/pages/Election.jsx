import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from '../lib/router.jsx';
import { fmt, fullDate, longDate, pct, shortDate } from '../lib/format.js';
import { summary, timeline } from '../lib/derive.js';
import { electionPath, jurisdictionPath } from '../lib/slugs.js';
import { useInView } from '../lib/motion.js';
import SurgeChart from '../components/charts/SurgeChart.jsx';
import SiteRhythm from '../components/charts/SiteRhythm.jsx';
import SiteMap from '../components/charts/SiteMap.jsx';
import ReportSummary from '../components/charts/ReportSummary.jsx';
import Treemap from '../components/charts/Treemap.jsx';
import Schedule from '../components/charts/Schedule.jsx';
import SourceTables from '../components/charts/SourceTables.jsx';
import WeatherIcon from '../components/WeatherIcon.jsx';

/* Sequential ramp for the site treemap — sites are ranked by size, so a
   single hue stepped light-to-dark encodes that order; a categorical
   palette would imply sixteen unrelated kinds of thing. */
const SITE_RAMP = [
  '#0d366b', '#164a8c', '#1c5cab', '#2a78d6', '#4a8ce0', '#6da8ea',
  '#8fbef1', '#b3d4f7', '#cde2fb',
];

/**
 * Sites coloured by rank, darkest = busiest.
 *
 * The ramp is walked monotonically rather than cycled: repeating it
 * would put the darkest colour back on a small site and break the
 * light-to-dark reading that makes the ramp worth having at all.
 */
function rankedSites(ds) {
  const sorted = [...ds.sites].sort((a, b) => b.total - a.total);
  const last = Math.max(1, sorted.length - 1);
  return sorted.map((site, i) => ({
    key: site.key,
    label: site.label,
    value: site.total,
    color: SITE_RAMP[Math.round((i / last) * (SITE_RAMP.length - 1))],
  }));
}

const METHODS = [
  { key: 'inPerson', label: 'Early in person', color: 'var(--s1)', hex: '#2a78d6' },
  { key: 'returnedMail', label: 'Returned by mail', color: 'var(--s2)', hex: '#eb6834' },
  { key: 'returnedDropbox', label: 'Returned by drop box', color: 'var(--s3)', hex: '#1baf7a' },
];

/* Metrics for the historical comparison. The running total leads: this
   section sits below the daily bars, which have already answered "how
   many ballots did each day take?" for this cycle. What it adds is the
   comparison, and the bank is the series that compares — it says
   whether this cycle is ahead of the last one at every point, where a
   daily figure only says whether one Tuesday beat another. */
const SURGE_METRICS = [
  {
    key: 'cumulative',
    label: 'Banked to date',
    blurb: 'Ballots recorded by the end of that day, running total.',
    counts: true,
  },
  {
    key: 'value',
    label: 'Ballots that day',
    blurb: "Ballots recorded that day, all methods.",
    counts: true,
  },
  {
    key: 'share',
    label: 'Daily share',
    blurb: "Each day's ballots as a share of that cycle's whole early vote.",
  },
  {
    key: 'electorateShare',
    label: 'Share of electorate',
    blurb: 'Ballots that day as a percentage of registered voters.',
  },
];

/**
 * What this election is worth comparing against, which depends on what
 * is being measured.
 *
 * **Counts compare a place with itself over time; shares compare places
 * with each other.** Fairfax casts more early ballots than the other
 * eight jurisdictions together, so a chart of raw counts across
 * jurisdictions is a chart of how big Fairfax is and every other curve
 * flattens against the axis. Against its own past a locality is a fair
 * comparison in ballots — 2024's presidential surge against two off
 * years is the whole point — so a count metric swaps the peer set to
 * this locality's other cycles.
 */
function peersOf(ds, all, counts) {
  const ownHistory = all.filter((d) => d.locality === ds.locality && d.id !== ds.id);
  const sameDay = all.filter((d) => d.electionDate === ds.electionDate && d.id !== ds.id);
  if (counts || !sameDay.length) return { peers: ownHistory, kind: 'years' };
  return { peers: sameDay, kind: 'places' };
}

const monthYear = (date) =>
  new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long', year: 'numeric',
  });

export default function Election({ ds, all }) {
  const s = summary(ds);
  const [surge, setSurge] = useState('cumulative');
  const metric = SURGE_METRICS.find((m) => m.key === surge) || SURGE_METRICS[0];
  const { peers, kind } = peersOf(ds, all, metric.counts);
  /* Share of the electorate needs a denominator; a cycle without one is
     dropped rather than drawn at zero. */
  const shown = [ds, ...peers]
    .filter((d) => surge !== 'electorateShare' || d.registeredVoters)
    /* Within one election the year on every label is noise; across a
       jurisdiction's own cycles it is the whole distinction. */
    .map((d) => (kind === 'places' ? { ...d, shortLabel: d.shortName } : d));

  return (
    <>
      <section className="section el-head">
        <div className="wrap">
          {/* Both axes out of a single cycle: the same place in other
              years, and the same election in other places. */}
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/elections">All elections</Link>
            <span aria-hidden="true">/</span>
            <Link to={jurisdictionPath(ds.locality)}>{ds.locality}</Link>
            <span aria-hidden="true">/</span>
            <Link to={electionPath(ds.electionDate)}>{monthYear(ds.electionDate)}</Link>
          </nav>
          <div className="eyebrow" style={{ marginTop: 16 }}>
            {ds.electionName} · {fullDate(ds.electionDate)} · {ds.status}
          </div>
          <h1 className="h1" style={{ marginTop: 8 }}>{ds.locality}</h1>
          <p className="lede" style={{ marginTop: 16 }}>
            {fmt(s.early)} early ballots across {s.votingDays} voting days
            {ds.detail.sites
              ? ` and ${ds.sites.length} in-person site${ds.sites.length === 1 ? '' : 's'}.`
              : '.'}
            {s.complete
              ? ` ${pct(s.closing7)} arrived in the final week.`
              : ' Coverage stops before Election Day — see the note below.'}
          </p>

          {/* Explains a shape that is visible in the data below: the mail
              line keeps rising after Election Day. */}
          {s.complete && ds.coverage.note && (
            <p className="note" style={{ marginTop: 14 }}>{ds.coverage.note}</p>
          )}

          {!s.complete && (
            <div className="notice" style={{ marginTop: 22 }}>
              <span aria-hidden="true">⚠</span>
              <span>
                <strong>Partial cycle — not a final report.</strong>
                {ds.coverage.note} Data here runs through{' '}
                {fullDate(ds.coverage.dataThrough)}, {ds.coverage.daysBeforeElection}{' '}
                days before Election Day, so totals and the shape of the curve
                are both incomplete.
              </span>
            </div>
          )}

        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <h2 className="h2" style={{ marginBottom: 22 }}>Overview</h2>
          <div className="card">
            <ReportSummary ds={ds} />
          </div>
        </div>
      </section>

      {ds.sites.length > 1 && (
        <section className="section">
          <div className="wrap">
            <h2 className="h2" style={{ marginBottom: 8 }}>Early in-person votes</h2>
            <p className="note" style={{ marginBottom: 22 }}>
              Tile area is proportional to ballots cast at that site.
            </p>
            <div className="card">
              <Treemap
                items={rankedSites(ds)}
                total={ds.totals.inPerson}
                height={420}
              />
            </div>
          </div>
        </section>
      )}

      {ds.detail.returnRoute && (
      <section className="section">
        <div className="wrap">
          <h2 className="h2" style={{ marginBottom: 8 }}>Vote by mail</h2>
          <p className="note" style={{ marginBottom: 22 }}>
            Tile area is proportional to ballots returned by that route.
          </p>
          <div className="card">
            <Treemap
              items={[
                {
                  key: 'mail', label: 'Returned by mail', value: ds.totals.returnedMail,
                  color: 'var(--s2)', dark: true,
                },
                {
                  key: 'box', label: 'Returned by drop box', value: ds.totals.returnedDropbox,
                  color: 'var(--s3)', dark: true,
                },
              ]}
              height={200}
            />
          </div>
        </div>
      </section>
      )}

      <DailyVolume ds={ds} />

      {/* Below the daily bars on purpose. Those describe this cycle;
          this puts it beside the others, which is a question the reader
          only has once they know the shape of the cycle in front of
          them. */}
      <section className="section">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <div className="eyebrow">
                {kind === 'years' ? 'Against past cycles' : 'Across jurisdictions'}
              </div>
              <h2 className="h2">Historical comparison</h2>
            </div>
            <div className="seg" role="tablist" aria-label="Measure">
              {SURGE_METRICS.map((m) => (
                <button
                  key={m.key}
                  role="tab"
                  aria-selected={surge === m.key}
                  className={surge === m.key ? 'is-on' : ''}
                  onClick={() => setSurge(m.key)}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
          <p className="note" style={{ marginBottom: 22 }}>
            {metric.blurb} Each day is plotted by how many days it fell before
            Election Day, so
            {kind === 'years'
              ? ' cycles line up against each other.'
              : ' jurisdictions line up against each other.'}
            {metric.counts && kind === 'years' && peers.length > 0
              && ' Counts are compared against this jurisdiction\u2019s own other'
                 + ' cycles; jurisdictions of different sizes are compared as shares.'}
          </p>
          <div className="card chart-card">
            <SurgeChart
              key={surge}
              datasets={shown}
              metric={surge}
              height={360}
            />
          </div>
          {surge === 'electorateShare' && shown.length < peers.length + 1 && (
            <p className="note" style={{ marginTop: 14 }}>
              {shown.length} of {peers.length + 1} shown — the rest have no
              registered-voter count recorded.
            </p>
          )}
        </div>
      </section>

      {ds.sites.length > 1 && (
        <>
          <section className="section">
            <div className="wrap">
              <h2 className="h2" style={{ marginBottom: 8 }}>
                {ds.sites.length} early voting sites
              </h2>
              <p className="note" style={{ marginBottom: 22 }}>
                Circle area is proportional to the selected measure. Sites
                opened on different dates, so a total partly reflects how long
                a site was open.
              </p>
              <div className="card">
                <SiteMap ds={ds} />
              </div>
            </div>
          </section>

          {ds.schedule && (
            <section className="section">
              <div className="wrap">
                <h2 className="h2" style={{ marginBottom: 8 }}>Voting hours</h2>
                <p className="note" style={{ marginBottom: 22 }}>
                  Scheduled opening hours. Whether a site was open on a given
                  date comes from the ballot record, not from this schedule.
                </p>
                <div className="card">
                  <Schedule ds={ds} />
                </div>
              </div>
            </section>
          )}

          <section className="section">
            <div className="wrap">
              <h2 className="h2" style={{ marginBottom: 8 }}>
                Every site, every day
              </h2>
              <p className="note" style={{ marginBottom: 22 }}>
                Each cell is one site on one day. Use the selector to change
                what the cell measures. Hover for that day's weather.
              </p>
              <div className="card">
                <SiteRhythm ds={ds} />
              </div>
            </div>
          </section>
          <SiteRanking ds={ds} />
        </>
      )}

      <SourceTables ds={ds} />
    </>
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

function DailyVolume({ ds }) {
  const [mode, setMode] = useState('daily');

  /* Only the methods this dataset actually separates. Without the route
     split, "returned by mail" is the whole vote-by-mail group, so it is
     relabelled rather than shown beside an empty drop-box series. */
  const methods = useMemo(() => {
    if (ds.detail.returnRoute) return METHODS;
    return METHODS.filter((m) => m.key !== 'returnedDropbox').map((m) =>
      m.key === 'returnedMail' ? { ...m, label: 'Vote by mail' } : m);
  }, [ds]);

  const [active, setActive] = useState(methods.map((m) => m.key));

  const data = useMemo(() => {
    const run = { inPerson: 0, returnedMail: 0, returnedDropbox: 0 };
    return ds.days.map((d) => {
      /* The day of week and the weather ride along on the row so the
         tooltip can name them. A Saturday and a washout are the two
         things that most often explain a bar's height, and reading them
         off the axis label alone is impossible. */
      const row = {
        date: d.date,
        label: shortDate(d.date),
        weekday: longDate(d.date),
        weather: d.weather,
      };
      methods.forEach((m) => {
        const v = d[m.key] || 0;
        run[m.key] += v;
        row[m.key] = mode === 'daily' ? v : run[m.key];
      });
      return row;
    });
  }, [ds, methods, mode]);

  const toggle = (k) =>
    setActive((a) =>
      a.includes(k) ? (a.length > 1 ? a.filter((x) => x !== k) : a) : [...a, k]);

  const shown = methods.filter((m) => active.includes(m.key));

  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">By method</div>
            <h2 className="h2">Ballots by day</h2>
          </div>
          <div className="seg">
            <button className={mode === 'daily' ? 'is-on' : ''} onClick={() => setMode('daily')}>Daily</button>
            <button className={mode === 'cume' ? 'is-on' : ''} onClick={() => setMode('cume')}>Cumulative</button>
          </div>
        </div>

        <div className="legend">
          {methods.map((m) => (
            <button
              key={m.key}
              className={`legend-item ${active.includes(m.key) ? 'is-on' : ''}`}
              onClick={() => toggle(m.key)}
              aria-pressed={active.includes(m.key)}
            >
              <i style={{ background: m.hex }} />
              {m.label}
            </button>
          ))}
        </div>

        <div className="card chart-card">
          <ResponsiveContainer width="100%" height={330}>
            {mode === 'daily' ? (
              <BarChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#E4E1D8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#7C879B', fontSize: 10 }} interval={3}
                       tickLine={false} axisLine={{ stroke: '#CFCBBE' }} />
                <YAxis tick={{ fill: '#7C879B', fontSize: 10 }} tickLine={false}
                       axisLine={false} width={54} tickFormatter={fmt} />
                <Tooltip content={<Tip />} cursor={{ fill: 'rgba(19,26,43,0.04)' }} />
                {shown.map((m) => (
                  <Bar key={m.key} dataKey={m.key} stackId="a" fill={m.hex}
                       name={m.label} radius={[2, 2, 0, 0]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 4 }}>
                <CartesianGrid stroke="#E4E1D8" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: '#7C879B', fontSize: 10 }} interval={3}
                       tickLine={false} axisLine={{ stroke: '#CFCBBE' }} />
                <YAxis tick={{ fill: '#7C879B', fontSize: 10 }} tickLine={false}
                       axisLine={false} width={54} tickFormatter={fmt} />
                <Tooltip content={<Tip />} />
                {shown.map((m) => (
                  <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.hex}
                        strokeWidth={2} dot={false} name={m.label} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

function Tip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  const row = payload[0]?.payload;
  const wx = row?.weather;
  return (
    <div className="tip">
      <div className="tip-h">{row?.weekday || label}</div>
      {wx && (
        <div className="tip-wx">
          <WeatherIcon wet={wx.wet} snowy={wx.snowy} /> {wx.label},{' '}
          {Math.round(wx.tempMax)}°/{Math.round(wx.tempMin)}°
          {wx.precip >= 0.01 ? ` · ${wx.precip.toFixed(2)}″` : ''}
        </div>
      )}
      {payload.map((p) => (
        <div className="tip-row" key={p.dataKey}>
          <i style={{ background: p.color }} />
          <span>{p.name}</span>
          <b>{fmt(p.value)}</b>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="tip-row tip-total">
          <span>Total</span>
          <b>{fmt(total)}</b>
        </div>
      )}
    </div>
  );
}

function SiteRanking({ ds }) {
  const [sort, setSort] = useState('total');
  const [ref, inView] = useInView({ threshold: 0.1 });

  const sites = useMemo(() => {
    const arr = [...ds.sites];
    if (sort === 'total') arr.sort((a, b) => b.total - a.total);
    if (sort === 'name') arr.sort((a, b) => a.label.localeCompare(b.label));
    if (sort === 'peak') arr.sort((a, b) => peakOf(ds, b.key).v - peakOf(ds, a.key).v);
    return arr;
  }, [ds, sort]);

  const max = Math.max(...ds.sites.map((s) => s.total), 1);

  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">In-person sites</div>
            <h2 className="h2">Where people voted</h2>
          </div>
          <div className="seg">
            <button className={sort === 'total' ? 'is-on' : ''} onClick={() => setSort('total')}>Total</button>
            <button className={sort === 'peak' ? 'is-on' : ''} onClick={() => setSort('peak')}>Busiest day</button>
            <button className={sort === 'name' ? 'is-on' : ''} onClick={() => setSort('name')}>A–Z</button>
          </div>
        </div>
        <div className="bars" ref={ref}>
          {sites.map((s, i) => {
            const pk = peakOf(ds, s.key);
            return (
              <div className="bar" key={s.key}>
                <div className="bar-lbl">{s.label}</div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{
                      width: inView ? `${(s.total / max) * 100}%` : 0,
                      transitionDelay: `${i * 40}ms`,
                    }}
                  />
                </div>
                <div className="bar-val">{fmt(s.total)}</div>
                <div className="bar-sub">
                  {pk.v ? `peak ${fmt(pk.v)} on ${shortDate(pk.date)}` : 'no ballots recorded'}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function peakOf(ds, key) {
  let best = { v: 0, date: ds.days[0]?.date };
  ds.days.forEach((d) => {
    const v = d.sites[key];
    if (v != null && v > best.v) best = { v, date: d.date };
  });
  return best;
}
