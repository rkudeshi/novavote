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

const METHODS = [
  { key: 'inPerson', label: 'Early in person', color: 'var(--s1)', hex: '#2a78d6' },
  { key: 'returnedMail', label: 'Returned by mail', color: 'var(--s2)', hex: '#eb6834' },
  { key: 'returnedDropbox', label: 'Returned by drop box', color: 'var(--s3)', hex: '#1baf7a' },
];

export default function Election({ ds, all }) {
  const s = summary(ds);
  const others = all.filter((d) => d.id !== ds.id);

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
            {fmt(s.early)} early ballots across {s.votingDays} voting days and{' '}
            {ds.sites.length} in-person site{ds.sites.length === 1 ? '' : 's'}.
            {s.complete
              ? ` ${pct(s.closing7, 0)} arrived in the final week.`
              : ' Coverage stops before Election Day — see the note below.'}
          </p>

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

          <div className="kpis" style={{ marginTop: 30 }}>
            <Kpi k="Early ballots, all methods" v={fmt(s.early)}
                 s={ds.registeredVoters
                   ? `${pct(s.earlyTurnoutOfRegistered, 1)} of registered voters`
                   : 'in-person, mail and drop box'} />
            <Kpi k="Early in person" v={fmt(ds.totals.inPerson)}
                 s={`${pct((ds.totals.inPerson / s.early) * 100, 0)} of the early vote`} />
            <Kpi k="Returned by mail" v={fmt(ds.totals.returnedMail)}
                 s={`of ${fmt(ds.totals.ballotsMailed)} mailed out`} />
            <Kpi k="Returned by drop box" v={fmt(ds.totals.returnedDropbox)}
                 s={`${pct((ds.totals.returnedDropbox / (ds.totals.returnedMail + ds.totals.returnedDropbox)) * 100, 0)} of returned absentee`} />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="eyebrow">Indexed to Election Day</div>
          <h2 className="h2" style={{ marginBottom: 8 }}>How the vote came in</h2>
          <p className="note" style={{ marginBottom: 22 }}>
            {others.length
              ? `Shown against ${others.length} other cycle${others.length === 1 ? '' : 's'} in the archive, so the shape can be compared rather than just described.`
              : 'The only cycle in the archive so far — comparisons appear here as more are added.'}
          </p>
          <div className="card chart-card">
            <SurgeChart datasets={[ds, ...others]} metric="share" height={360} />
          </div>
        </div>
      </section>

      <DailyVolume ds={ds} />

      {ds.sites.length > 1 && (
        <>
          <section className="section">
            <div className="wrap">
              <div className="eyebrow">Where the sites are</div>
              <h2 className="h2" style={{ marginBottom: 8 }}>
                {ds.sites.length} early voting sites across the county
              </h2>
              <p className="note" style={{ marginBottom: 22 }}>
                Oval area is proportional to the selected measure. Switching
                between per-day and total is the point: sites opened on
                different dates, so a total mostly measures how long a site was
                open rather than how busy it was.
              </p>
              <div className="card">
                <SiteMap ds={ds} />
              </div>
            </div>
          </section>

          <section className="section">
            <div className="wrap">
              <div className="eyebrow">Site by day</div>
              <h2 className="h2" style={{ marginBottom: 8 }}>
                Every site, every day
              </h2>
              <p className="note" style={{ marginBottom: 22 }}>
                Switch what each cell measures — raw ballots, a running total,
                a share, or how each site moved against its own norm. Raw counts
                answer "how many"; the normalised views are what let a busy site
                and a quiet one be compared on the same footing.
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
    setActive((a) =>
      a.includes(k) ? (a.length > 1 ? a.filter((x) => x !== k) : a) : [...a, k]);

  const shown = METHODS.filter((m) => active.includes(m.key));

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
          {METHODS.map((m) => (
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

function DataTable({ ds }) {
  const [sortKey, setSortKey] = useState('date');
  const [dir, setDir] = useState('asc');

  const cols = [
    { k: 'date', l: 'Date', render: (r) => longDate(r.date) },
    { k: 'inPerson', l: 'Early in person' },
    { k: 'returnedMail', l: 'Returned by mail' },
    { k: 'returnedDropbox', l: 'Drop box' },
    { k: 'ballotsMailed', l: 'Ballots mailed out' },
  ];

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
    const head = ['date', 'early_in_person', 'returned_by_mail', 'returned_by_dropbox',
      'ballots_mailed', ...ds.sites.map((s) => s.key)];
    const lines = [head.join(',')];
    ds.days.forEach((d) => {
      lines.push([
        d.date, d.inPerson ?? '', d.returnedMail ?? '', d.returnedDropbox ?? '',
        d.ballotsMailed ?? '', ...ds.sites.map((s) => d.sites[s.key] ?? ''),
      ].join(','));
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
          <button className="btn" onClick={download}>Download CSV</button>
        </div>
        <div className="card tablewrap">
          <table className="table">
            <thead>
              <tr>
                {cols.map((c) => (
                  <th
                    key={c.k}
                    onClick={() => click(c.k)}
                    className={sortKey === c.k ? 'is-on' : ''}
                    aria-sort={
                      sortKey === c.k
                        ? dir === 'asc' ? 'ascending' : 'descending'
                        : 'none'
                    }
                  >
                    {c.l}
                    <span className="caret">
                      {sortKey === c.k ? (dir === 'asc' ? '▲' : '▼') : '↕'}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.date}>
                  {cols.map((c) => (
                    <td key={c.k} className={c.k === 'date' ? 'td-date' : 'td-num'}>
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
