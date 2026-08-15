/* ------------------------------------------------------------------
   Site x day grid.

   v1 drew raw ballots per site per day and nothing else, which made every
   row a near-copy of the county curve — the grid mostly encoded the
   calendar. The fix isn't to drop the grid, it's to let you change what
   the cell means: a magnitude view answers "how many", the normalised
   views answer "how much of what", and the deviation view cancels the
   shared arc entirely so only site-specific behaviour is left.

   Cells carry their value as text as well as colour. That costs cell
   width and forces horizontal scrolling on a 44-day cycle, but being
   able to read an exact number without hovering is worth more than
   fitting the whole grid on screen.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { dayOfWeek, fmt, isWeekend, longDate, shortDate } from '../../lib/format.js';
import { earlyTotal, siteDeviation } from '../../lib/derive.js';
import { useInView } from '../../lib/motion.js';

/* Compact formatters — cells are ~40px wide, so "12,112" has to become
   "12.1k" rather than overflow or get clipped. */
const compact = (n) => {
  if (n == null) return '';
  const a = Math.abs(n);
  if (a >= 10000) return `${(n / 1000).toFixed(a >= 100000 ? 0 : 1)}k`;
  return fmt(Math.round(n));
};
const pctCell = (n) =>
  n == null ? '' : n >= 10 ? `${n.toFixed(0)}%` : n >= 1 ? `${n.toFixed(1)}%` : `${n.toFixed(2)}%`;

export const METRICS = [
  {
    key: 'perDay',
    label: 'Ballots that day',
    scale: 'sequential',
    format: compact,
    describe: (c) => `${fmt(c.value)} ballots`,
    blurb: 'Raw ballots cast at that site on that day.',
  },
  {
    key: 'cumulative',
    label: 'Cumulative ballots',
    scale: 'sequential',
    format: compact,
    describe: (c) => `${fmt(c.cumulative)} cumulative`,
    blurb: "Running total at that site, so each row builds to the site's final count.",
  },
  {
    key: 'shareOfSite',
    label: '% of this site',
    scale: 'sequential',
    format: pctCell,
    describe: (c) => `${pctCell(c.shareOfSite)} of this site's cycle`,
    blurb:
      "Each day as a share of that site's own total. Rows are directly comparable — a busy site and a quiet one both sum to 100%.",
  },
  {
    key: 'shareOfAllEarly',
    label: '% of all early ballots',
    scale: 'sequential',
    format: pctCell,
    describe: (c) => `${pctCell(c.shareOfAllEarly)} of the county's early vote`,
    blurb:
      "Each cell as a share of the whole cycle's early vote across every method — in person, mail and drop box. Shows which site-days actually moved the county's numbers.",
  },
  {
    key: 'perHour',
    label: 'Ballots per hour',
    scale: 'sequential',
    format: (n) => (n == null ? '' : n >= 100 ? n.toFixed(0) : n.toFixed(1)),
    describe: (c) => (c.perHour == null ? 'no hours recorded' : `${c.perHour.toFixed(1)}/hour`),
    needsSchedule: true,
    blurb:
      'Ballots divided by hours open, which separates a genuinely busy site from one that simply opened for longer.',
  },
  {
    key: 'vsAverage',
    label: 'vs this site’s daily average',
    scale: 'diverging',
    format: (n) => (n == null ? '' : `${n >= 1 ? '+' : '−'}${Math.round(Math.abs(n - 1) * 100)}%`),
    describe: (c) =>
      c.vsAverage == null
        ? ''
        : c.vsAverage >= 1
          ? `${((c.vsAverage - 1) * 100).toFixed(0)}% above this site's daily average`
          : `${((1 - c.vsAverage) * 100).toFixed(0)}% below this site's daily average`,
    blurb:
      "That day's ballots against this site's own average across the days it was open. Straightforward to read, but note every site is above average near Election Day — the run-up is in here too.",
  },
  {
    key: 'vsCountyPace',
    label: 'vs the county’s pace that day',
    scale: 'diverging',
    format: (n) => (n == null ? '' : `${n >= 1 ? '+' : '−'}${Math.round(Math.abs(n - 1) * 100)}%`),
    describe: (c) =>
      c.vsCountyPace >= 1
        ? `${((c.vsCountyPace - 1) * 100).toFixed(0)}% busier than the county moved that day`
        : `${((1 - c.vsCountyPace) * 100).toFixed(0)}% quieter than the county moved that day`,
    blurb:
      "This site's share of the day's countywide vote, against its share of the whole cycle. Because it divides by what the county did, the shared run-up to Election Day cancels out — what's left is purely which sites ran early and which ran late.",
  },
];

/* Sequential = one hue light->dark (magnitude). Diverging = two hues with
   a neutral midpoint (polarity). Never a rainbow for either. */
const SEQ = [
  [205, 226, 251], [134, 182, 239], [85, 152, 231],
  [42, 120, 214], [28, 92, 171], [13, 54, 107],
];
const DIV_MID = [239, 237, 231];
const DIV_POS = [42, 120, 214];
const DIV_NEG = [235, 104, 52];

function rgb(c) { return `rgb(${c[0]},${c[1]},${c[2]})`; }

function sequential(t) {
  const x = Math.max(0, Math.min(1, t));
  const i = Math.min(SEQ.length - 2, Math.floor(x * (SEQ.length - 1)));
  const f = x * (SEQ.length - 1) - i;
  return SEQ[i].map((a, k) => Math.round(a + (SEQ[i + 1][k] - a) * f));
}

function diverging(ratio) {
  const t = Math.max(-1, Math.min(1, Math.log2(ratio) / 1.2));
  const end = t >= 0 ? DIV_POS : DIV_NEG;
  const k = Math.abs(t);
  return DIV_MID.map((m, i) => Math.round(m + (end[i] - m) * k));
}

/* Relative luminance, so the value text flips to white on dark cells
   instead of disappearing. */
function readableOn([r, g, b]) {
  const lin = (v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? 'var(--ink)' : '#fff';
}

export default function SiteRhythm({ ds }) {
  const [ref, inView] = useInView({ threshold: 0.08 });
  const [metricKey, setMetricKey] = useState('perDay');
  const [hover, setHover] = useState(null);
  const [showValues, setShowValues] = useState(true);

  const hasSchedule = Boolean(ds.hours && Object.keys(ds.hours).length);
  const metric = METRICS.find((m) => m.key === metricKey) || METRICS[0];
  const unavailable = metric.needsSchedule && !hasSchedule;

  /* Build every metric per cell once. The grid is at most ~16x50, so
     computing all of them up front is cheaper than re-deriving on each
     toggle and keeps the switch instant. */
  const weatherByDate = useMemo(
    () => Object.fromEntries(ds.days.map((d) => [d.date, d.weather])),
    [ds],
  );

  const sites = useMemo(() => {
    const allEarly = earlyTotal(ds);
    return siteDeviation(ds).map((site) => {
      const openDays = site.cells.filter((c) => c.open).length;
      const dailyAverage = openDays ? site.total / openDays : 0;
      let run = 0;
      const cells = site.cells.map((c) => {
        if (!c.open) return { ...c, cumulative: null };
        run += c.value;
        const h = ds.hours?.[site.key]?.[c.date];
        return {
          ...c,
          perDay: c.value,
          cumulative: run,
          shareOfSite: site.total ? (c.value / site.total) * 100 : 0,
          shareOfAllEarly: allEarly ? (c.value / allEarly) * 100 : 0,
          perHour: h ? c.value / h : null,
          hoursOpen: h ?? null,
          // `ratio` from siteDeviation() is the share-of-share; name it for
          // what it measures rather than the vague "normal".
          vsCountyPace: c.ratio,
          vsAverage: dailyAverage ? c.value / dailyAverage : null,
          weather: weatherByDate[c.date] ?? null,
        };
      });
      return { ...site, cells };
    });
  }, [ds, weatherByDate]);

  const ordered = useMemo(() => {
    const arr = [...sites];
    // The deviation view is about ordering by behaviour; every other view
    // is about magnitude, where biggest-first is the useful order.
    if (metricKey === 'vsCountyPace') arr.sort((a, b) => b.tilt - a.tilt);
    else arr.sort((a, b) => b.total - a.total);
    return arr;
  }, [sites, metricKey]);

  const dates = ordered[0]?.cells.map((c) => c.date) || [];

  const maxVal = useMemo(() => {
    if (metric.scale !== 'sequential') return 1;
    let m = 0;
    for (const s of ordered) {
      for (const c of s.cells) {
        const v = c[metricKey];
        if (v != null && v > m) m = v;
      }
    }
    return m || 1;
  }, [ordered, metricKey, metric.scale]);

  if (!dates.length) return null;

  const colorFor = (c) => {
    if (!c.open) return null;
    const v = c[metricKey];
    if (v == null) return null;
    return metric.scale === 'diverging' ? diverging(v) : sequential(v / maxVal);
  };

  return (
    <div className="rhythm" ref={ref}>
      <div className="rhythm-controls">
        <label className="rhythm-select">
          <span>Show</span>
          <select value={metricKey} onChange={(e) => setMetricKey(e.target.value)}>
            {METRICS.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
                {m.needsSchedule && !hasSchedule ? ' (needs hours data)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="rhythm-check">
          <input
            type="checkbox"
            checked={showValues}
            onChange={(e) => setShowValues(e.target.checked)}
          />
          Show numbers
        </label>
      </div>

      <p className="rhythm-blurb">{metric.blurb}</p>

      {unavailable ? (
        <div className="rhythm-empty">
          <strong>No opening-hours data yet.</strong> Ballots per hour needs
          how long each site was open each day. Add it to{' '}
          <code>data/site_schedules.json</code> and this view fills in — the
          rest of the grid works without it.
        </div>
      ) : (
        <>
          <div className="rhythm-scroll">
            <div
              className={`rhythm-grid ${showValues ? 'has-values' : ''}`}
              style={{
                gridTemplateColumns: `var(--rowlbl) repeat(${dates.length}, minmax(var(--cellw), 1fr))`,
              }}
            >
              <div className="rhythm-corner" />
              {dates.map((d, i) => {
                const show = showValues || i % 4 === 0;
                return (
                  <div
                    key={d}
                    className={`rhythm-colhead ${isWeekend(d) ? 'is-weekend' : ''}`}
                  >
                    {/* Two lines: weekday above the date. Turnout has a
                        strong weekly rhythm, so the day of week is as much
                        context as the date itself. */}
                    <span className="rhythm-dow">{show ? dayOfWeek(d) : ''}</span>
                    <span className="rhythm-date">{show ? shortDate(d) : ''}</span>
                  </div>
                );
              })}

              {ordered.map((s, rowIdx) => (
                <Row
                  key={s.key}
                  site={s}
                  rowIdx={rowIdx}
                  inView={inView}
                  metric={metric}
                  metricKey={metricKey}
                  colorFor={colorFor}
                  showValues={showValues}
                  onHover={setHover}
                />
              ))}
            </div>
          </div>

          <div className="rhythm-foot">
            <div className="rhythm-read" role="status">
              {hover ? (
                <>
                  <strong>{hover.site}</strong>
                  <span className="muted">{longDate(hover.cell.date)}</span>
                  <span>
                    <b>{fmt(hover.cell.value)}</b> ballots
                    {hover.cell.hoursOpen ? ` over ${hover.cell.hoursOpen}h` : ''}
                    {/* The raw count is already printed above, so only add
                        the metric's phrasing when it says something else. */}
                    {metricKey !== 'perDay' && <> · {metric.describe(hover.cell)}</>}
                  </span>
                  {hover.cell.weather && (
                    <span className={`wx ${hover.cell.weather.wet ? 'is-wet' : ''} ${hover.cell.weather.snowy ? 'is-snowy' : ''}`}>
                      {hover.cell.weather.snowy ? '❄' : hover.cell.weather.wet ? '☔' : '○'}{' '}
                      {hover.cell.weather.label},{' '}
                      {Math.round(hover.cell.weather.tempMax)}°/
                      {Math.round(hover.cell.weather.tempMin)}°F
                      {hover.cell.weather.precip >= 0.01
                        ? ` · ${hover.cell.weather.precip.toFixed(2)}″`
                        : ''}
                    </span>
                  )}
                </>
              ) : (
                <span className="muted">
                  Hover or tab any cell for the full read-out.
                </span>
              )}
            </div>
            <Legend metric={metric} maxVal={maxVal} />
          </div>
        </>
      )}
    </div>
  );
}

function Row({ site, rowIdx, inView, metric, metricKey, colorFor, showValues, onHover }) {
  return (
    <>
      <div className="rhythm-rowhead" title={site.formerly ? `${site.label} (formerly ${site.formerly})` : site.label}>
        <span className="rhythm-name">{site.label}</span>
        <span className="rhythm-rowtotal">{compact(site.total)}</span>
      </div>
      {site.cells.map((c, i) => {
        const col = colorFor(c);
        const v = c[metricKey];
        return (
          <div
            key={c.date}
            className={`rhythm-cell ${c.open ? '' : 'is-closed'}`}
            style={{
              background: col ? rgb(col) : undefined,
              color: col ? readableOn(col) : undefined,
              opacity: inView ? 1 : 0,
              transitionDelay: `${Math.min(500, rowIdx * 18 + i * 3)}ms`,
            }}
            tabIndex={c.open ? 0 : -1}
            onMouseEnter={() => c.open && onHover({ site: site.label, cell: c })}
            onFocus={() => c.open && onHover({ site: site.label, cell: c })}
            onMouseLeave={() => onHover(null)}
            onBlur={() => onHover(null)}
            aria-label={
              c.open
                ? `${site.label}, ${longDate(c.date)}: ${metric.describe(c)}`
                : `${site.label}, ${longDate(c.date)}: not open`
            }
          >
            {showValues && c.open && v != null && (
              <span className="rhythm-val">{metric.format(v)}</span>
            )}
          </div>
        );
      })}
    </>
  );
}

function Legend({ metric, maxVal }) {
  if (metric.scale === 'diverging') {
    return (
      <div className="rhythm-legend">
        <span>Quieter</span>
        <span
          className="rhythm-ramp"
          style={{ background: `linear-gradient(90deg, ${rgb(DIV_NEG)}, ${rgb(DIV_MID)} 50%, ${rgb(DIV_POS)})` }}
        />
        <span>Busier</span>
      </div>
    );
  }
  return (
    <div className="rhythm-legend">
      <span>0</span>
      <span
        className="rhythm-ramp"
        style={{ background: `linear-gradient(90deg, ${SEQ.map(rgb).join(',')})` }}
      />
      <span>{metric.format(maxVal)}</span>
    </div>
  );
}
