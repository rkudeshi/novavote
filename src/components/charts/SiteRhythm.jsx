/* ------------------------------------------------------------------
   Site rhythm — what the oval grid should have been.

   v1 drew raw ballots per site per day. Because every site rises into
   Election Day, each row came out a near-copy of every other and the
   grid mostly encoded the calendar.

   This divides each site's share of a given day's countywide vote by
   its share of the whole cycle. That cancels the shared arc and leaves
   only the site-specific residual: above 1 means the site ran hotter
   than usual that day. Rows are ordered by "tilt" — late-breaking sites
   at the top, early-voting sites at the bottom — so the structure the
   heatmap was hiding becomes the thing you actually see.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { fmt, longDate, shortDate } from '../../lib/format.js';
import { siteDeviation } from '../../lib/derive.js';
import { useInView } from '../../lib/motion.js';

/* Diverging blue<->orange with a neutral midpoint, per the palette:
   two poles that read as opposite, gray at "no deviation". */
function divergingColor(ratio) {
  if (ratio == null) return 'transparent';
  const t = Math.max(-1, Math.min(1, Math.log2(ratio) / 1.2));
  const mid = [239, 237, 231];
  const pos = [42, 120, 214];   // ran late  (blue)
  const neg = [235, 104, 52];   // ran early (orange)
  const end = t >= 0 ? pos : neg;
  const k = Math.abs(t);
  const c = mid.map((m, i) => Math.round(m + (end[i] - m) * k));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

export default function SiteRhythm({ ds }) {
  const [ref, inView] = useInView({ threshold: 0.12 });
  const [hover, setHover] = useState(null);

  const sites = useMemo(
    () => siteDeviation(ds).sort((a, b) => b.tilt - a.tilt),
    [ds],
  );
  const dates = sites[0]?.cells.map((c) => c.date) || [];

  if (!dates.length) return null;

  return (
    <div className="rhythm" ref={ref}>
      <div className="rhythm-axis-note">
        Sorted by when each site's vote arrived — latest-breaking at the top.
      </div>
      <div className="rhythm-scroll">
        <div
          className="rhythm-grid"
          style={{ gridTemplateColumns: `var(--rowlbl) repeat(${dates.length}, minmax(14px, 1fr))` }}
        >
          <div className="rhythm-corner" />
          {dates.map((d, i) => (
            <div key={d} className="rhythm-colhead">
              {i % 4 === 0 ? shortDate(d) : ''}
            </div>
          ))}

          {sites.map((s, rowIdx) => (
            <Row
              key={s.key}
              site={s}
              rowIdx={rowIdx}
              inView={inView}
              onHover={setHover}
            />
          ))}
        </div>
      </div>

      <div className="rhythm-foot">
        <div className="rhythm-read" role="status">
          {hover ? (
            <>
              <strong>{hover.label}</strong>
              <span className="muted">{longDate(hover.date)}</span>
              <span>
                <b>{fmt(hover.value)}</b> ballots —{' '}
                {hover.ratio >= 1
                  ? `${((hover.ratio - 1) * 100).toFixed(0)}% busier`
                  : `${((1 - hover.ratio) * 100).toFixed(0)}% quieter`}{' '}
                than this site's normal share
              </span>
            </>
          ) : (
            <span className="muted">
              Hover any cell. Colour is the site's share of that day versus its
              share of the whole cycle — not raw volume.
            </span>
          )}
        </div>
        <div className="rhythm-legend">
          <span>Ran early</span>
          <span className="rhythm-ramp" />
          <span>Ran late</span>
        </div>
      </div>
    </div>
  );
}

function Row({ site, rowIdx, inView, onHover }) {
  return (
    <>
      <div className="rhythm-rowhead" title={site.label}>
        <span className="rhythm-name">{site.label}</span>
      </div>
      {site.cells.map((c, i) => (
        <div
          key={c.date}
          className={`rhythm-cell ${c.open ? '' : 'is-closed'}`}
          style={{
            background: c.open ? divergingColor(c.ratio) : undefined,
            opacity: inView ? 1 : 0,
            transitionDelay: `${Math.min(600, rowIdx * 22 + i * 4)}ms`,
          }}
          tabIndex={c.open ? 0 : -1}
          onMouseEnter={() =>
            c.open && onHover({ ...c, label: site.label })
          }
          onFocus={() => c.open && onHover({ ...c, label: site.label })}
          onMouseLeave={() => onHover(null)}
          onBlur={() => onHover(null)}
          aria-label={
            c.open
              ? `${site.label}, ${longDate(c.date)}: ${c.value} ballots`
              : `${site.label}, ${longDate(c.date)}: not open`
          }
        />
      ))}
    </>
  );
}
