import React, { useState, useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LineChart, Line
} from 'recharts';
import { DATASETS } from './data/generated/index.js';

/* ------------------------------------------------------------------
   DATA LAYER
   DATASETS is generated at build time (see scripts/gen-data.mjs) from
   the validated CSVs in /data. Every figure reconciles against the
   locality's published grand totals.

   To add a locality: append a dataset object with the same shape to
   DATASETS (in scripts/gen-data.mjs). Nothing else in the UI needs to
   change.
------------------------------------------------------------------ */
const PLANNED = [
  { locality: 'Loudoun County', note: 'County publishes daily AB report' },
  { locality: 'Prince William County', note: 'County publishes daily AB report' },
  { locality: 'Arlington County', note: 'County publishes daily AB report' },
  { locality: 'City of Alexandria', note: 'City publishes daily AB report' },
  { locality: 'Richmond City', note: 'Needs source survey' },
  { locality: 'Virginia Beach', note: 'Needs source survey' },
];

/* ---------------------------- palette ---------------------------- */
const RAMP = ['#1A2436', '#22485E', '#2A7E92', '#43B4A4', '#8FD98A', '#F0C05A'];

function rampColor(t) {
  if (t <= 0) return RAMP[0];
  const x = Math.min(1, Math.max(0, t));
  const i = Math.min(RAMP.length - 2, Math.floor(x * (RAMP.length - 1)));
  const f = x * (RAMP.length - 1) - i;
  const a = hexToRgb(RAMP[i]), b = hexToRgb(RAMP[i + 1]);
  return `rgb(${Math.round(a[0] + (b[0] - a[0]) * f)},${Math.round(a[1] + (b[1] - a[1]) * f)},${Math.round(a[2] + (b[2] - a[2]) * f)})`;
}
function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
}

/* ---------------------------- helpers ---------------------------- */
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}
function shortDate(s) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function longDate(s) {
  const d = parseDate(s);
  return `${DOW[d.getDay()]} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}

/* ================================================================= */
export default function App() {
  const [datasetId] = useState(DATASETS[0].id);
  const ds = DATASETS.find((d) => d.id === datasetId);

  return (
    <div className="nv-root">
      <style>{CSS}</style>
      <Header ds={ds} />
      <main className="nv-main">
        <BallotGrid ds={ds} />
        <StatStrip ds={ds} />
        <DailyVolume ds={ds} />
        <SiteRanking ds={ds} />
        <DataTable ds={ds} />
        <Roadmap ds={ds} />
      </main>
      <Footer ds={ds} />
    </div>
  );
}

/* ---------------------------- header ---------------------------- */
function Header({ ds }) {
  return (
    <header className="nv-header">
      <div className="nv-header-in">
        <div className="nv-brand">
          <span className="nv-mark" aria-hidden="true">
            <span className="nv-oval nv-oval-filled" />
            <span className="nv-oval" />
          </span>
          <span className="nv-wordmark">NovaVote</span>
        </div>
        <div className="nv-header-meta">
          <span className="nv-chip nv-chip-live">{ds.locality}</span>
          <span className="nv-chip">{ds.electionName}</span>
          <span className="nv-chip">{parseDate(ds.electionDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </div>
      </div>
    </header>
  );
}

/* --------------------- signature: ballot grid -------------------- */
function BallotGrid({ ds }) {
  const [hover, setHover] = useState(null);
  const openDays = ds.days.filter((d) => d.inPerson != null && d.inPerson > 0);
  const max = Math.max(...openDays.flatMap((d) => Object.values(d.sites)));
  const sortedSites = [...ds.sites].sort((a, b) => b.total - a.total);
  const expansionDate = '2025-10-23';

  return (
    <section className="nv-section nv-hero">
      <div className="nv-eyebrow">In-person early voting · ballots cast per site per day</div>
      <h1 className="nv-h1">
        Fairfax opened <em>three</em> early voting sites in September.<br />
        On October 23 it opened <em>thirteen</em> more.
      </h1>
      <p className="nv-lede">
        Each oval is one site on one day, inked by how many ballots it took. The wall down the
        middle is the moment the satellite sites came online — and the county's early vote nearly
        quadrupled overnight.
      </p>

      <div className="nv-gridwrap">
        <div className="nv-grid-scroll">
          <div className="nv-grid" style={{ gridTemplateColumns: `var(--lblw) repeat(${openDays.length}, minmax(var(--cellw), 1fr))` }}>
            <div className="nv-grid-corner" />
            {openDays.map((d, i) => {
              const show = i % 3 === 0 || d.date === expansionDate;
              return (
                <div key={`h${d.date}`} className={`nv-colhead ${d.date === expansionDate ? 'nv-colhead-mark' : ''}`}>
                  <span>{show ? shortDate(d.date) : ''}</span>
                </div>
              );
            })}
            {sortedSites.map((s) => (
              <React.Fragment key={s.key}>
                <div className="nv-rowhead" title={s.label}>
                  <span className="nv-rowhead-name">{s.label}</span>
                  <span className="nv-rowhead-num">{fmt(s.total)}</span>
                </div>
                {openDays.map((d) => {
                  const v = d.sites[s.key];
                  const closed = v == null;
                  const t = closed ? 0 : v / max;
                  const on = hover && hover.site === s.key && hover.date === d.date;
                  return (
                    <div
                      key={s.key + d.date}
                      className={`nv-cell ${closed ? 'nv-cell-closed' : ''} ${on ? 'nv-cell-on' : ''} ${d.date === expansionDate ? 'nv-cell-mark' : ''}`}
                      onMouseEnter={() => setHover({ site: s.key, label: s.label, date: d.date, v, closed })}
                      onMouseLeave={() => setHover(null)}
                      tabIndex={0}
                      onFocus={() => setHover({ site: s.key, label: s.label, date: d.date, v, closed })}
                      onBlur={() => setHover(null)}
                      aria-label={`${s.label}, ${longDate(d.date)}: ${closed ? 'not open' : v + ' ballots'}`}
                    >
                      <span className="nv-ink" style={closed ? undefined : { background: rampColor(t) }} />
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>

        <div className="nv-readout" role="status">
          {hover ? (
            <>
              <span className="nv-readout-site">{hover.label}</span>
              <span className="nv-readout-date">{longDate(hover.date)}</span>
              <span className="nv-readout-val">
                {hover.closed ? <em>not yet open</em> : <><strong>{fmt(hover.v)}</strong> ballots</>}
              </span>
            </>
          ) : (
            <span className="nv-readout-idle">Tap or hover any oval for the count</span>
          )}
        </div>
      </div>

      <div className="nv-legend">
        <span className="nv-legend-lbl">Fewer</span>
        <span className="nv-legend-ramp" />
        <span className="nv-legend-lbl">More ({fmt(max)})</span>
        <span className="nv-legend-sep" />
        <span className="nv-legend-closed"><span className="nv-ink" /> Site not yet open</span>
      </div>
    </section>
  );
}

/* ---------------------------- stats ----------------------------- */
function StatStrip({ ds }) {
  const t = ds.totals;
  const stats = [
    { k: 'Ballots cast, all methods', v: fmt(ds.totalBallotsCast), s: `${ds.turnoutPct}% of ${fmt(ds.registeredVoters)} registered` },
    { k: 'Early in person', v: fmt(t.inPerson), s: `${Math.round((t.inPerson / ds.totalBallotsCast) * 100)}% of ballots cast` },
    { k: 'Returned by mail', v: fmt(t.returnedMail), s: `of ${fmt(t.ballotsMailed)} mailed out` },
    { k: 'Returned by drop box', v: fmt(t.returnedDropbox), s: `${Math.round((t.returnedDropbox / (t.returnedMail + t.returnedDropbox)) * 100)}% of returned absentee` },
  ];
  return (
    <section className="nv-section">
      <div className="nv-stats">
        {stats.map((s) => (
          <div className="nv-stat" key={s.k}>
            <div className="nv-stat-k">{s.k}</div>
            <div className="nv-stat-v">{s.v}</div>
            <div className="nv-stat-s">{s.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ------------------------- daily volume ------------------------- */
const METHODS = [
  { key: 'inPerson', label: 'Early in person', color: '#43B4A4' },
  { key: 'returnedMail', label: 'Returned by mail', color: '#F0C05A' },
  { key: 'returnedDropbox', label: 'Returned by drop box', color: '#7E6BD8' },
];

function DailyVolume({ ds }) {
  const [mode, setMode] = useState('daily');
  const [active, setActive] = useState(METHODS.map((m) => m.key));

  const data = useMemo(() => {
    const run = { inPerson: 0, returnedMail: 0, returnedDropbox: 0 };
    return ds.days.map((d) => {
      const row = { date: d.date, label: shortDate(d.date) };
      METHODS.forEach((m) => {
        const v = d[m.key] || 0;
        run[m.key] += v;
        row[m.key] = mode === 'daily' ? v : run[m.key];
      });
      return row;
    });
  }, [ds, mode]);

  const toggle = (k) =>
    setActive((a) => (a.includes(k) ? (a.length > 1 ? a.filter((x) => x !== k) : a) : [...a, k]));

  return (
    <section className="nv-section">
      <div className="nv-sec-head">
        <h2 className="nv-h2">Ballots by day</h2>
        <div className="nv-controls">
          <div className="nv-seg">
            <button className={mode === 'daily' ? 'on' : ''} onClick={() => setMode('daily')}>Daily</button>
            <button className={mode === 'cume' ? 'on' : ''} onClick={() => setMode('cume')}>Cumulative</button>
          </div>
        </div>
      </div>

      <div className="nv-methodtoggle">
        {METHODS.map((m) => (
          <button
            key={m.key}
            className={`nv-mt ${active.includes(m.key) ? 'on' : ''}`}
            onClick={() => toggle(m.key)}
            aria-pressed={active.includes(m.key)}
          >
            <span className="nv-mt-dot" style={{ background: m.color }} />
            {m.label}
          </button>
        ))}
      </div>

      <div className="nv-chart">
        <ResponsiveContainer width="100%" height={320}>
          {mode === 'daily' ? (
            <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#232F4A" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#7E90B4', fontSize: 10 }} interval={3} tickLine={false} axisLine={{ stroke: '#232F4A' }} />
              <YAxis tick={{ fill: '#7E90B4', fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              {METHODS.filter((m) => active.includes(m.key)).map((m) => (
                <Bar key={m.key} dataKey={m.key} stackId="a" fill={m.color} name={m.label} />
              ))}
            </BarChart>
          ) : (
            <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 4 }}>
              <CartesianGrid stroke="#232F4A" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: '#7E90B4', fontSize: 10 }} interval={3} tickLine={false} axisLine={{ stroke: '#232F4A' }} />
              <YAxis tick={{ fill: '#7E90B4', fontSize: 10 }} tickLine={false} axisLine={false} width={52} />
              <Tooltip content={<ChartTip />} />
              {METHODS.filter((m) => active.includes(m.key)).map((m) => (
                <Line key={m.key} type="monotone" dataKey={m.key} stroke={m.color} strokeWidth={2} dot={false} name={m.label} />
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
    </section>
  );
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  const total = payload.reduce((s, p) => s + (p.value || 0), 0);
  return (
    <div className="nv-tip">
      <div className="nv-tip-h">{label}</div>
      {payload.map((p) => (
        <div className="nv-tip-r" key={p.dataKey}>
          <span className="nv-tip-dot" style={{ background: p.color }} />
          <span className="nv-tip-n">{p.name}</span>
          <span className="nv-tip-v">{fmt(p.value)}</span>
        </div>
      ))}
      {payload.length > 1 && (
        <div className="nv-tip-r nv-tip-total">
          <span className="nv-tip-n">Total</span>
          <span className="nv-tip-v">{fmt(total)}</span>
        </div>
      )}
    </div>
  );
}

/* ------------------------- site ranking ------------------------- */
function SiteRanking({ ds }) {
  const [sort, setSort] = useState('total');
  const sites = useMemo(() => {
    const arr = [...ds.sites];
    if (sort === 'total') arr.sort((a, b) => b.total - a.total);
    if (sort === 'name') arr.sort((a, b) => a.label.localeCompare(b.label));
    if (sort === 'peak') arr.sort((a, b) => peakOf(ds, b.key).v - peakOf(ds, a.key).v);
    return arr;
  }, [ds, sort]);
  const max = Math.max(...ds.sites.map((s) => s.total));

  return (
    <section className="nv-section">
      <div className="nv-sec-head">
        <h2 className="nv-h2">Where people voted</h2>
        <div className="nv-seg">
          <button className={sort === 'total' ? 'on' : ''} onClick={() => setSort('total')}>Total</button>
          <button className={sort === 'peak' ? 'on' : ''} onClick={() => setSort('peak')}>Busiest day</button>
          <button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>A–Z</button>
        </div>
      </div>
      <div className="nv-bars">
        {sites.map((s) => {
          const pk = peakOf(ds, s.key);
          const early = s.opened === ds.days.find((d) => d.inPerson)?.date;
          return (
            <div className="nv-bar" key={s.key}>
              <div className="nv-bar-lbl">
                {s.label}
                {early && <span className="nv-tag">open from day one</span>}
              </div>
              <div className="nv-bar-track">
                <div className="nv-bar-fill" style={{ width: `${(s.total / max) * 100}%` }} />
              </div>
              <div className="nv-bar-val">{fmt(s.total)}</div>
              <div className="nv-bar-sub">peak {fmt(pk.v)} on {shortDate(pk.date)}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
function peakOf(ds, key) {
  let best = { v: 0, date: ds.days[0].date };
  ds.days.forEach((d) => {
    const v = d.sites[key];
    if (v != null && v > best.v) best = { v, date: d.date };
  });
  return best;
}

/* --------------------------- data table -------------------------- */
function DataTable({ ds }) {
  const [sortKey, setSortKey] = useState('date');
  const [dir, setDir] = useState('asc');
  const cols = [
    { k: 'date', l: 'Date', fmtv: (r) => longDate(r.date) },
    { k: 'inPerson', l: 'Early in person' },
    { k: 'returnedMail', l: 'Returned by mail' },
    { k: 'returnedDropbox', l: 'Drop box' },
    { k: 'ballotsMailed', l: 'Ballots mailed out' },
  ];
  const rows = useMemo(() => {
    const a = [...ds.days];
    a.sort((x, y) => {
      const vx = x[sortKey], vy = y[sortKey];
      if (sortKey === 'date') return dir === 'asc' ? x.date.localeCompare(y.date) : y.date.localeCompare(x.date);
      const nx = vx == null ? -1 : vx, ny = vy == null ? -1 : vy;
      return dir === 'asc' ? nx - ny : ny - nx;
    });
    return a;
  }, [ds, sortKey, dir]);

  const click = (k) => {
    if (k === sortKey) setDir(dir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setDir(k === 'date' ? 'asc' : 'desc'); }
  };

  const download = () => {
    const head = ['date', 'early_in_person', 'returned_by_mail', 'returned_by_dropbox', 'ballots_mailed',
      ...ds.sites.map((s) => s.key)];
    const lines = [head.join(',')];
    ds.days.forEach((d) => {
      lines.push([d.date, d.inPerson ?? '', d.returnedMail ?? '', d.returnedDropbox ?? '', d.ballotsMailed ?? '',
        ...ds.sites.map((s) => d.sites[s.key] ?? '')].join(','));
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${ds.id}.csv`;
    a.click();
  };

  return (
    <section className="nv-section">
      <div className="nv-sec-head">
        <h2 className="nv-h2">Every day, every number</h2>
        <button className="nv-dl" onClick={download}>Download CSV</button>
      </div>
      <div className="nv-tablewrap">
        <table className="nv-table">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.k} onClick={() => click(c.k)} className={sortKey === c.k ? 'on' : ''}
                    aria-sort={sortKey === c.k ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  {c.l}<span className="nv-caret">{sortKey === c.k ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date}>
                {cols.map((c) => (
                  <td key={c.k} className={c.k === 'date' ? 'nv-td-date' : 'nv-td-num'}>
                    {c.fmtv ? c.fmtv(r) : fmt(r[c.k])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* --------------------------- roadmap ----------------------------- */
function Roadmap({ ds }) {
  return (
    <section className="nv-section">
      <h2 className="nv-h2">What plugs in next</h2>
      <p className="nv-note">
        The data layer takes one object per locality-election. Adding a jurisdiction means adding a
        dataset — no UI changes.
      </p>
      <div className="nv-plan">
        <div className="nv-plan-col">
          <div className="nv-plan-h">Loaded</div>
          <div className="nv-plan-item on">
            <span className="nv-oval nv-oval-filled" />
            <div>
              <strong>{ds.locality}</strong>
              <span>Nov 2025 general · 16 sites · 50 days</span>
            </div>
          </div>
        </div>
        <div className="nv-plan-col">
          <div className="nv-plan-h">Queued</div>
          {PLANNED.map((p) => (
            <div className="nv-plan-item" key={p.locality}>
              <span className="nv-oval" />
              <div><strong>{p.locality}</strong><span>{p.note}</span></div>
            </div>
          ))}
        </div>
        <div className="nv-plan-col">
          <div className="nv-plan-h">Deeper cuts</div>
          <div className="nv-plan-item"><span className="nv-oval" /><div><strong>2020–2024 back-catalog</strong><span>Every cycle since no-excuse early voting began</span></div></div>
          <div className="nv-plan-item"><span className="nv-oval" /><div><strong>Precinct-level detail</strong><span>From ELECT's Daily Absentee List, not third-party republishers</span></div></div>
          <div className="nv-plan-item"><span className="nv-oval" /><div><strong>Site map</strong><span>Coordinates are stubbed in the dataset already</span></div></div>
        </div>
      </div>
    </section>
  );
}

/* ---------------------------- footer ----------------------------- */
function Footer({ ds }) {
  return (
    <footer className="nv-footer">
      <div className="nv-footer-in">
        <div>
          <div className="nv-foot-h">Source</div>
          <p>
            Fairfax County Office of Elections, Absentee &amp; Early Voting Daily Report, marked
            final {parseDate(ds.reportDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
            The county labels this report unofficial; it is not certified results.
          </p>
        </div>
        <div>
          <div className="nv-foot-h">Reconciliation</div>
          <p>
            Every daily series and all 16 site columns sum exactly to the county's published grand
            totals. One sub-count (undeliverable mail ballots on 14 dates) could not be verified
            from the PDF's text layer and is flagged in the CSV.
          </p>
        </div>
        <div>
          <div className="nv-foot-h">Not shown here</div>
          <p>
            Party registration, results, or any partisan split. This is administrative turnout data:
            when and where ballots were cast, nothing about who they were cast for.
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ============================== CSS ============================== */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;700&family=IBM+Plex+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

.nv-root {
  --ink:#0B111E; --panel:#131B2C; --panel2:#182136; --line:#232F4A;
  --muted:#7E90B4; --paper:#E6ECF8; --amber:#F0C05A; --teal:#43B4A4;
  --cellw:22px; --lblw:186px;
  background:var(--ink); color:var(--paper);
  font-family:'IBM Plex Sans',system-ui,sans-serif;
  min-height:100%; width:100%;
  -webkit-font-smoothing:antialiased;
}
.nv-root *,.nv-root *::before,.nv-root *::after{box-sizing:border-box;}
.nv-root h1,.nv-root h2,.nv-root p{margin:0;}
.nv-root button{font-family:inherit;cursor:pointer;}

/* header */
.nv-header{border-bottom:1px solid var(--line);background:rgba(11,17,30,.9);backdrop-filter:blur(8px);position:sticky;top:0;z-index:20;}
.nv-header-in{max-width:1240px;margin:0 auto;padding:14px 24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;}
.nv-brand{display:flex;align-items:center;gap:10px;}
.nv-mark{display:flex;gap:3px;align-items:center;}
.nv-oval{width:9px;height:14px;border-radius:9px;border:1.5px solid var(--muted);display:inline-block;flex:none;}
.nv-oval-filled{background:var(--amber);border-color:var(--amber);}
.nv-wordmark{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:19px;letter-spacing:-.02em;}
.nv-header-meta{display:flex;gap:6px;flex-wrap:wrap;}
.nv-chip{font-family:'IBM Plex Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--muted);border:1px solid var(--line);border-radius:100px;padding:4px 10px;}
.nv-chip-live{color:var(--ink);background:var(--amber);border-color:var(--amber);font-weight:600;}

/* layout */
.nv-main{max-width:1240px;margin:0 auto;padding:0 24px;}
.nv-section{padding:56px 0;border-bottom:1px solid var(--line);}
.nv-hero{padding-top:44px;}
.nv-sec-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-bottom:20px;flex-wrap:wrap;}
.nv-eyebrow{font-family:'IBM Plex Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--teal);margin-bottom:16px;}
.nv-h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(26px,4vw,46px);line-height:1.1;letter-spacing:-.025em;max-width:24ch;}
.nv-h1 em{font-style:normal;color:var(--amber);}
.nv-h2{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:clamp(19px,2.4vw,26px);letter-spacing:-.02em;}
.nv-lede{margin-top:16px;max-width:62ch;color:#B6C3DC;font-size:15.5px;line-height:1.6;}
.nv-note{color:var(--muted);font-size:14px;line-height:1.6;max-width:66ch;margin-top:8px;}

/* ballot grid */
.nv-gridwrap{margin-top:32px;border:1px solid var(--line);border-radius:10px;background:var(--panel);overflow:hidden;}
.nv-grid-scroll{overflow-x:auto;padding:14px 14px 6px;}
.nv-grid{display:grid;gap:0;min-width:max-content;width:100%;}
.nv-grid-corner{position:sticky;left:0;background:var(--panel);z-index:3;}
.nv-colhead{font-family:'IBM Plex Mono',monospace;font-size:8.5px;color:var(--muted);text-align:center;
  padding-bottom:8px;white-space:nowrap;letter-spacing:-.02em;}
.nv-colhead-mark{color:var(--amber);font-weight:600;}
.nv-rowhead{position:sticky;left:0;background:var(--panel);z-index:2;display:flex;align-items:center;
  justify-content:space-between;gap:8px;padding-right:12px;height:24px;font-size:11.5px;white-space:nowrap;
  border-right:1px solid var(--line);}
.nv-rowhead-name{overflow:hidden;text-overflow:ellipsis;}
.nv-rowhead-num{font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);flex:none;}
.nv-cell{height:24px;display:flex;align-items:center;justify-content:center;outline:none;}
.nv-cell .nv-ink{width:11px;height:17px;border-radius:11px;background:var(--panel2);
  transition:transform .12s ease,box-shadow .12s ease;}
.nv-cell-closed .nv-ink{background:transparent;border:1px dashed #2B3652;}
.nv-cell-mark{box-shadow:inset 1px 0 0 rgba(240,192,90,.5);}
.nv-cell:hover .nv-ink,.nv-cell-on .nv-ink,.nv-cell:focus-visible .nv-ink{transform:scale(1.35);box-shadow:0 0 0 2px var(--paper);}
.nv-readout{border-top:1px solid var(--line);background:var(--panel2);padding:10px 16px;display:flex;
  align-items:center;gap:14px;font-size:13px;min-height:42px;flex-wrap:wrap;}
.nv-readout-site{font-weight:600;}
.nv-readout-date{color:var(--muted);font-family:'IBM Plex Mono',monospace;font-size:11.5px;}
.nv-readout-val{margin-left:auto;font-family:'IBM Plex Mono',monospace;color:var(--amber);}
.nv-readout-val em{color:var(--muted);font-style:normal;}
.nv-readout-idle{color:var(--muted);font-size:12.5px;}
.nv-legend{display:flex;align-items:center;gap:10px;margin-top:14px;flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace;font-size:10.5px;color:var(--muted);}
.nv-legend-ramp{width:120px;height:9px;border-radius:9px;
  background:linear-gradient(90deg,#1A2436,#22485E,#2A7E92,#43B4A4,#8FD98A,#F0C05A);}
.nv-legend-sep{width:1px;height:14px;background:var(--line);}
.nv-legend-closed{display:flex;align-items:center;gap:6px;}
.nv-legend-closed .nv-ink{width:9px;height:14px;border-radius:9px;border:1px dashed #2B3652;display:inline-block;}

/* stats */
.nv-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:1px;background:var(--line);
  border:1px solid var(--line);border-radius:10px;overflow:hidden;}
.nv-stat{background:var(--panel);padding:22px 20px;}
.nv-stat-k{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted);}
.nv-stat-v{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:31px;letter-spacing:-.03em;margin:8px 0 4px;}
.nv-stat-s{font-size:12.5px;color:var(--muted);}

/* controls */
.nv-seg{display:inline-flex;border:1px solid var(--line);border-radius:8px;overflow:hidden;}
.nv-seg button{background:transparent;border:0;color:var(--muted);padding:7px 14px;font-size:12.5px;}
.nv-seg button:hover{color:var(--paper);}
.nv-seg button.on{background:var(--panel2);color:var(--paper);font-weight:600;}
.nv-methodtoggle{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;}
.nv-mt{display:flex;align-items:center;gap:7px;background:transparent;border:1px solid var(--line);
  border-radius:100px;padding:6px 13px;color:var(--muted);font-size:12.5px;}
.nv-mt.on{color:var(--paper);border-color:#33436B;background:var(--panel);}
.nv-mt-dot{width:8px;height:8px;border-radius:8px;opacity:.35;}
.nv-mt.on .nv-mt-dot{opacity:1;}

/* chart */
.nv-chart{border:1px solid var(--line);border-radius:10px;background:var(--panel);padding:16px 12px 8px;}
.nv-tip{background:#0B111E;border:1px solid var(--line);border-radius:8px;padding:10px 12px;font-size:12px;min-width:180px;}
.nv-tip-h{font-family:'IBM Plex Mono',monospace;color:var(--muted);font-size:11px;margin-bottom:7px;}
.nv-tip-r{display:flex;align-items:center;gap:8px;padding:2px 0;}
.nv-tip-dot{width:8px;height:8px;border-radius:8px;flex:none;}
.nv-tip-n{color:#B6C3DC;}
.nv-tip-v{margin-left:auto;font-family:'IBM Plex Mono',monospace;font-weight:600;}
.nv-tip-total{border-top:1px solid var(--line);margin-top:6px;padding-top:6px;}

/* bars */
.nv-bars{display:flex;flex-direction:column;gap:2px;}
.nv-bar{display:grid;grid-template-columns:var(--lblw) 1fr 76px;grid-template-areas:'l t v' '. s s';
  align-items:center;gap:4px 14px;padding:9px 0;border-bottom:1px solid rgba(35,47,74,.5);}
.nv-bar-lbl{grid-area:l;font-size:13px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
.nv-tag{font-family:'IBM Plex Mono',monospace;font-size:8.5px;letter-spacing:.06em;text-transform:uppercase;
  color:var(--teal);border:1px solid rgba(67,180,164,.35);border-radius:100px;padding:2px 6px;}
.nv-bar-track{grid-area:t;height:10px;background:var(--panel2);border-radius:10px;overflow:hidden;}
.nv-bar-fill{height:100%;border-radius:10px;background:linear-gradient(90deg,#2A7E92,#43B4A4 60%,#8FD98A);}
.nv-bar-val{grid-area:v;text-align:right;font-family:'IBM Plex Mono',monospace;font-size:13px;font-weight:600;}
.nv-bar-sub{grid-area:s;font-family:'IBM Plex Mono',monospace;font-size:10px;color:var(--muted);}

/* table */
.nv-dl{background:transparent;border:1px solid var(--line);color:var(--paper);border-radius:8px;
  padding:8px 15px;font-size:12.5px;}
.nv-dl:hover{border-color:var(--amber);color:var(--amber);}
.nv-tablewrap{border:1px solid var(--line);border-radius:10px;overflow:auto;max-height:460px;background:var(--panel);}
.nv-table{width:100%;border-collapse:collapse;font-size:13px;}
.nv-table th{position:sticky;top:0;background:var(--panel2);text-align:right;padding:11px 16px;
  font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--muted);cursor:pointer;white-space:nowrap;border-bottom:1px solid var(--line);user-select:none;}
.nv-table th:first-child{text-align:left;}
.nv-table th:hover{color:var(--paper);}
.nv-table th.on{color:var(--amber);}
.nv-caret{margin-left:6px;opacity:.6;font-size:9px;}
.nv-table td{padding:9px 16px;border-bottom:1px solid rgba(35,47,74,.45);}
.nv-table tbody tr:hover{background:rgba(255,255,255,.025);}
.nv-td-date{white-space:nowrap;}
.nv-td-num{text-align:right;font-family:'IBM Plex Mono',monospace;}

/* roadmap */
.nv-plan{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:24px;margin-top:26px;}
.nv-plan-h{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--muted);padding-bottom:10px;border-bottom:1px solid var(--line);margin-bottom:14px;}
.nv-plan-item{display:flex;gap:11px;align-items:flex-start;padding:9px 0;}
.nv-plan-item div{display:flex;flex-direction:column;gap:2px;}
.nv-plan-item strong{font-size:13.5px;font-weight:600;color:#94A6C6;}
.nv-plan-item.on strong{color:var(--paper);}
.nv-plan-item span:last-child{font-size:11.5px;color:var(--muted);line-height:1.45;}
.nv-plan-item .nv-oval{margin-top:2px;}

/* footer */
.nv-footer{border-top:1px solid var(--line);background:var(--panel);margin-top:0;}
.nv-footer-in{max-width:1240px;margin:0 auto;padding:36px 24px 48px;display:grid;
  grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:28px;}
.nv-foot-h{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.12em;text-transform:uppercase;
  color:var(--teal);margin-bottom:9px;}
.nv-footer p{font-size:12.5px;color:var(--muted);line-height:1.6;}

/* a11y + responsive */
.nv-root :focus-visible{outline:2px solid var(--amber);outline-offset:2px;border-radius:3px;}
@media (max-width:720px){
  .nv-root{--lblw:120px;--cellw:19px;}
  .nv-section{padding:40px 0;}
  .nv-main{padding:0 16px;}
  .nv-header-in{padding:12px 16px;}
  .nv-bar{grid-template-columns:1fr 64px;grid-template-areas:'l v' 't t' 's s';}
  .nv-stat-v{font-size:26px;}
}
@media (prefers-reduced-motion:reduce){
  .nv-root *{transition:none!important;animation:none!important;}
}
`;
