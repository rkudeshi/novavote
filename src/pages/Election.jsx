import { useMemo, useState } from 'react';
import {
  Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts';
import { Link } from '../lib/router.jsx';
import { fmt, fullDate, longDate, pct, shortDate } from '../lib/format.js';
import { summary, timeline } from '../lib/derive.js';
import { useInView } from '../lib/motion.js';
import SurgeChart from '../components/charts/SurgeChart.jsx';
import SiteRhythm from '../components/charts/SiteRhythm.jsx';
import SiteMap from '../components/charts/SiteMap.jsx';
import ReportSummary from '../components/charts/ReportSummary.jsx';
import Treemap from '../components/charts/Treemap.jsx';
import Schedule from '../components/charts/Schedule.jsx';
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

/**
 * What this election is worth comparing against.
 *
 * A jurisdiction with several cycles compares against its own past —
 * that is the question its page is asking. One with a single cycle
 * compares against the other jurisdictions that voted the same day.
 * Passing every dataset to both would put fourteen curves on one chart
 * and answer neither.
 */
function peersOf(ds, all) {
  const ownHistory = all.filter((d) => d.locality === ds.locality && d.id !== ds.id);
  if (ownHistory.length) return { peers: ownHistory, kind: 'years' };
  return {
    peers: all.filter((d) => d.electionDate === ds.electionDate && d.id !== ds.id),
    kind: 'places',
  };
}

export default function Election({ ds, all }) {
  const s = summary(ds);
  const { peers, kind } = peersOf(ds, all);

  return (
    <>
      <section className="section el-head">
        <div className="wrap">
          <Link to="/elections" className="back">← All elections</Link>
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

      <section className="section">
        <div className="wrap">
          <h2 className="h2" style={{ marginBottom: 8 }}>How the vote came in</h2>
          <p className="note" style={{ marginBottom: 22 }}>
            Each day is plotted by how many days it fell before Election Day, so
            {kind === 'years'
              ? ' cycles line up against each other.'
              : ' jurisdictions line up against each other.'}
          </p>
          <div className="card chart-card">
            <SurgeChart datasets={[ds, ...peers]} metric="share" height={360} />
          </div>
        </div>
      </section>

      <DailyVolume ds={ds} />

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

      <DataTable ds={ds} />
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
      const row = { date: d.date, label: shortDate(d.date) };
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
                       axisLine={false} width={54} />
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
                       axisLine={false} width={54} />
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
  return (
    <div className="tip">
      <div className="tip-h">{label}</div>
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

/* Column tints. Each numeric column is scaled against its own maximum and
   tinted with its method's hue, so a column of small numbers still shows
   its own shape instead of being flattened by a larger column. Alpha tops
   out well below full so the figure stays legible in ink. */
const COL_RGB = {
  inPerson: [42, 120, 214],
  returnedMail: [235, 104, 52],
  returnedDropbox: [27, 175, 122],
  ballotsMailed: [124, 135, 155],
};
const MAX_ALPHA = 0.5;

function DataTable({ ds }) {
  const [sortKey, setSortKey] = useState('date');
  const [dir, setDir] = useState('asc');
  const [shade, setShade] = useState(true);

  const cols = [
    { k: 'date', l: 'Date', render: (r) => longDate(r.date) },
    /* Two-line headers: the group on top, the specific measure beneath.
       Splitting the label is what lets the column be as narrow as its
       numbers rather than as wide as its name — which is most of what was
       pushing this table off the side of a phone. */
    { k: 'inPerson', l: 'In person', l2: 'ballots' },
    /* A column the dataset does not record is left out entirely rather
       than filled with dashes: an empty column is still column width,
       and on a phone that is the scarce thing. */
    { k: 'returnedMail', l: 'Vote by mail', l2: ds.detail.returnRoute ? 'by mail' : 'returned' },
    ds.detail.returnRoute && { k: 'returnedDropbox', l: 'Vote by mail', l2: 'drop box' },
    ds.detail.ballotsIssued && { k: 'ballotsMailed', l: 'Issued', l2: 'by mail' },
    ds.days.some((d) => d.weather) && {
      k: 'weather',
      l: 'Weather',
      l2: '',
      sortable: false,
      render: (r) =>
        r.weather ? (
          <span className={`wx ${r.weather.wet ? 'is-wet' : ''} ${r.weather.snowy ? 'is-snowy' : ''}`}>
            <WeatherIcon wet={r.weather.wet} snowy={r.weather.snowy} /> {r.weather.label},{' '}
            {Math.round(r.weather.tempMax)}°/{Math.round(r.weather.tempMin)}°
            {r.weather.precip >= 0.01 ? ` · ${r.weather.precip.toFixed(2)}″` : ''}
          </span>
        ) : '—',
    },
  ].filter(Boolean);

  const colMax = useMemo(() => {
    const m = {};
    for (const c of cols) {
      if (c.k === 'date' || c.k === 'weather') continue;
      m[c.k] = Math.max(...ds.days.map((d) => d[c.k] ?? 0), 1);
    }
    return m;
  }, [ds]);

  const tint = (key, v) => {
    if (!shade || v == null || !COL_RGB[key]) return undefined;
    const [r, g, b] = COL_RGB[key];
    // sqrt so the long tail of small days stays visible rather than
    // collapsing to white against a few very large ones.
    const a = Math.sqrt(Math.max(0, v) / colMax[key]) * MAX_ALPHA;
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };

  const rows = useMemo(() => {
    const a = [...ds.days];
    a.sort((x, y) => {
      if (sortKey === 'date') {
        return dir === 'asc'
          ? x.date.localeCompare(y.date)
          : y.date.localeCompare(x.date);
      }
      const nx = x[sortKey] ?? -1;
      const ny = y[sortKey] ?? -1;
      return dir === 'asc' ? nx - ny : ny - nx;
    });
    return a;
  }, [ds, sortKey, dir]);

  const click = (k) => {
    if (k === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc');
    else {
      setSortKey(k);
      setDir(k === 'date' ? 'asc' : 'desc');
    }
  };

  const download = () => {
    const fields = [
      ['early_in_person', (d) => d.inPerson],
      [ds.detail.returnRoute ? 'returned_by_mail' : 'vote_by_mail_returned',
        (d) => d.returnedMail],
      ...(ds.detail.returnRoute
        ? [['returned_by_dropbox', (d) => d.returnedDropbox]] : []),
      ...(ds.detail.ballotsIssued
        ? [['ballots_mailed', (d) => d.ballotsMailed]] : []),
      ...ds.sites.map((s) => [s.key, (d) => d.sites[s.key]]),
    ];
    const lines = [['date', ...fields.map(([n]) => n)].join(',')];
    ds.days.forEach((d) => {
      lines.push([d.date, ...fields.map(([, get]) => get(d) ?? '')].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ds.id}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  return (
    <section className="section">
      <div className="wrap">
        <div className="sec-head">
          <div>
            <div className="eyebrow">Full detail</div>
            <h2 className="h2">Every day, every number</h2>
          </div>
          <div className="table-tools">
            <label className="rhythm-check">
              <input
                type="checkbox"
                checked={shade}
                onChange={(e) => setShade(e.target.checked)}
              />
              Shade by value
            </label>
            <button className="btn" onClick={download}>Download CSV</button>
          </div>
        </div>
        <div className="card tablewrap">
          <table className="table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.k}
                    onClick={() => c.sortable !== false && click(c.k)}
                    className={`${sortKey === c.k ? 'is-on' : ''} ${c.sortable === false ? 'is-static' : ''}`}
                    aria-sort={
                      sortKey === c.k
                        ? dir === 'asc' ? 'ascending' : 'descending'
                        : 'none'
                    }
                  >
                    <span className="th-l1">
                      {c.l}
                      {c.sortable !== false && (
                        <span className="caret">
                          {sortKey === c.k ? (dir === 'asc' ? '▲' : '▼') : '↕'}
                        </span>
                      )}
                    </span>
                    <span className="th-l2">{c.l2 || ' '}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  {cols.map((c) => (
                    <td
                      key={c.k}
                      className={c.k === 'date' ? 'td-date' : c.k === 'weather' ? 'td-wx' : 'td-num'}
                      style={{ background: tint(c.k, r[c.k]) }}
                    >
                      {c.render ? c.render(r) : fmt(r[c.k])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
