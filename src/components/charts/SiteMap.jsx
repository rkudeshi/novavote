/* ------------------------------------------------------------------
   Early voting sites on the county map.

   Ovals are sized by *area*, not radius — a site with twice the traffic
   gets twice the ink, which is the only encoding people read correctly.
   The oval shape is a deliberate callback to the ballot-punch motif the
   grid used to carry.

   The metric toggle matters more than it looks: sites open on different
   dates, so raw totals largely measure how long a site was open. Per-day
   is the like-for-like number, and flipping between the two shows which
   sites were genuinely busy versus merely early.
------------------------------------------------------------------ */
import { useEffect, useMemo, useRef, useState } from 'react';
import boundary from '../../data/fairfax-boundary.json';
import { fmt, longDate, pct, shortDate } from '../../lib/format.js';
import { siteStats } from '../../lib/derive.js';
import { useInView } from '../../lib/motion.js';

const METRICS = [
  { key: 'perDay', label: 'Ballots per day open', unit: 'per day' },
  { key: 'total', label: 'Total ballots', unit: 'total' },
];

const PAD = 16;
const MAX_H = 620;  // the county is tall; fit to height, not just width
const MAX_A = 26;   // semi-axis of the busiest site
const MIN_A = 5;
const ASPECT = 1.28; // ovals, not circles — the ballot-punch nod

export default function SiteMap({ ds }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  const [metric, setMetric] = useState('perDay');
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(760);
  const boxRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setW(Math.max(320, el.clientWidth || 760));
    measure();
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const sites = useMemo(
    () => siteStats(ds).filter((s) => s.lat != null && s.lon != null),
    [ds],
  );

  const [minLon, minLat, maxLon, maxLat] = boundary.bbox;
  /* Equirectangular with a cos(lat) correction — at this latitude a
     degree of longitude is ~0.78 of a degree of latitude, and without
     the correction the county comes out visibly stretched. */
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const innerW = w - PAD * 2;
  /* Fit to whichever axis binds. Scaling on width alone makes the map
     taller than the viewport, since the county is much deeper than it
     is wide at this latitude. */
  const scale = Math.min(innerW / spanX, (MAX_H - PAD * 2) / spanY);
  const drawW = spanX * scale;
  const drawH = spanY * scale;
  const h = drawH + PAD * 2;
  const offsetX = (w - drawW) / 2;   // centre the county in the card

  const px = (lon) => offsetX + (lon - minLon) * kx * scale;
  const py = (lat) => PAD + (maxLat - lat) * scale;
  const toPath = (rings) =>
    rings
      .map((r) => r.map(([lon, lat], i) => `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join('') + 'Z')
      .join(' ');

  const county = boundary.features.find((f) => f.role === 'county');
  const enclaves = boundary.features.filter((f) => f.role === 'enclave');

  const maxVal = Math.max(...sites.map((s) => s[metric]), 1);
  // Area-proportional: semi-axis scales with the square root.
  const axisFor = (v) => MIN_A + (MAX_A - MIN_A) * Math.sqrt(Math.max(0, v) / maxVal);

  const active = METRICS.find((m) => m.key === metric);
  const ordered = [...sites].sort((a, b) => b[metric] - a[metric]);

  return (
    <div className="map" ref={ref}>
      <div className="map-head">
        <div className="seg" role="tablist" aria-label="Map metric">
          {METRICS.map((m) => (
            <button
              key={m.key}
              role="tab"
              aria-selected={metric === m.key}
              className={metric === m.key ? 'is-on' : ''}
              onClick={() => setMetric(m.key)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ScaleLegend maxVal={maxVal} axisFor={axisFor} unit={active.unit} />
      </div>

      <div className="map-body" ref={boxRef}>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height={h}
          role="img"
          aria-label={`Map of ${ds.locality} early voting sites, sized by ${active.label.toLowerCase()}`}
          onMouseLeave={() => setHover(null)}
        >
          <path d={toPath(county.rings)} className="map-county" />
          {enclaves.map((e) => (
            <g key={e.geoid}>
              <path d={toPath(e.rings)} className="map-enclave" />
            </g>
          ))}

          {/* Largest first so small ovals stay clickable on top. */}
          {ordered.map((s, i) => {
            const a = axisFor(s[metric]);
            const on = hover?.key === s.key;
            return (
              <g
                key={s.key}
                className={`map-site ${on ? 'is-on' : ''}`}
                style={{
                  opacity: inView ? 1 : 0,
                  transform: inView ? 'none' : 'scale(.5)',
                  transformOrigin: `${px(s.lon)}px ${py(s.lat)}px`,
                  transitionDelay: `${i * 45}ms`,
                }}
                tabIndex={0}
                onMouseEnter={() => setHover(s)}
                onFocus={() => setHover(s)}
                onBlur={() => setHover(null)}
                aria-label={`${s.label}: ${fmt(Math.round(s[metric]))} ballots ${active.unit}`}
              >
                <ellipse
                  cx={px(s.lon)}
                  cy={py(s.lat)}
                  rx={a}
                  ry={a * ASPECT}
                  className="map-oval"
                />
                <circle cx={px(s.lon)} cy={py(s.lat)} r="1.6" className="map-pin" />
              </g>
            );
          })}

          {/* Label only the top few, so the map doesn't turn into a word cloud. */}
          {ordered.slice(0, 4).map((s) => (
            <text
              key={`l-${s.key}`}
              x={px(s.lon)}
              y={py(s.lat) - axisFor(s[metric]) * ASPECT - 7}
              textAnchor="middle"
              className="map-label"
              style={{ opacity: inView ? 1 : 0 }}
            >
              {s.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="map-read" role="status">
        {hover ? (
          <>
            <strong>{hover.label}</strong>
            {hover.formerly && (
              <span className="map-formerly">formerly {hover.formerly}</span>
            )}
            <span className="map-read-stats">
              <b>{fmt(Math.round(hover.perDay))}</b> ballots/day ·{' '}
              <b>{fmt(hover.total)}</b> total ·{' '}
              {hover.openDays} day{hover.openDays === 1 ? '' : 's'} open ·{' '}
              {pct(hover.shareOfInPerson, 1)} of the county's in-person vote
              {hover.opened ? ` · opened ${shortDate(hover.opened)}` : ''}
            </span>
          </>
        ) : (
          <span className="muted">
            Hover or tab to any site. Oval area is proportional to{' '}
            {active.label.toLowerCase()}. Site coordinates are approximate,
            pending real geocoding.
          </span>
        )}
      </div>
    </div>
  );
}

/** Nested reference ovals — the honest way to label an area encoding. */
function ScaleLegend({ maxVal, axisFor, unit }) {
  const steps = [maxVal, maxVal / 4].map((v) => ({ v, a: axisFor(v) }));
  const wide = steps[0].a * 2 + 8;
  const tall = steps[0].a * ASPECT * 2 + 20;
  return (
    <svg width={wide + 74} height={tall} className="map-legend" aria-hidden="true">
      {steps.map((s, i) => (
        <g key={i}>
          <ellipse
            cx={wide / 2}
            cy={tall - 14 - s.a * ASPECT}
            rx={s.a}
            ry={s.a * ASPECT}
            className="map-legend-oval"
          />
          <text
            x={wide + 6}
            y={tall - 14 - s.a * ASPECT * 2 + 7}
            className="map-legend-text"
          >
            {fmt(Math.round(s.v))}
          </text>
        </g>
      ))}
      <text x={wide / 2} y={tall - 4} textAnchor="middle" className="map-legend-text">{unit}</text>
    </svg>
  );
}
