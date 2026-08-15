/* ------------------------------------------------------------------
   Early voting sites on the county map.

   Circles are sized by *area*, not radius — a site with twice the traffic
   gets twice the ink, which is the only encoding people read correctly.

   Two views:
   - Whole cycle: one circle per site. The per-day/total toggle matters
     because sites opened on different dates, so a raw total largely
     measures how long a site was open rather than how busy it was.
   - Day by day: scrub or play through the cycle. This is where a map
     earns its place over a table — the Oct 23 expansion, thirteen sites
     switching on at once, is something you watch happen. The day's
     county-wide weather rides along, since a washout is one of the few
     external explanations for a soft day.
------------------------------------------------------------------ */
import { useEffect, useMemo, useRef, useState } from 'react';
import boundary from '../../data/fairfax-boundary.json';
import { fmt, longDate, pct } from '../../lib/format.js';
import { siteStats } from '../../lib/derive.js';
import { useInView, prefersReducedMotion } from '../../lib/motion.js';
import WeatherIcon from '../WeatherIcon.jsx';

const METRICS = [
  { key: 'perDay', label: 'Ballots per day open', unit: 'per day' },
  { key: 'total', label: 'Total ballots', unit: 'total' },
];

const PAD = 16;
const MAX_H = 620;  // the county is tall; fit to height, not just width
const MAX_R = 26;   // radius of the busiest site
const MIN_R = 5;

export default function SiteMap({ ds }) {
  const [ref, inView] = useInView({ threshold: 0.15 });
  const [mode, setMode] = useState('cycle');      // 'cycle' | 'day'
  const [metric, setMetric] = useState('perDay');
  const [dayIdx, setDayIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
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

  /* Only days when someone actually voted in person — weekends and
     holidays would otherwise stall the animation on empty frames. */
  const votingDays = useMemo(
    () => ds.days.filter((d) => d.inPerson > 0 && Object.keys(d.sites).length),
    [ds],
  );

  useEffect(() => {
    setDayIdx(Math.max(0, votingDays.length - 1));
  }, [votingDays.length]);

  useEffect(() => {
    if (!playing) return;
    if (prefersReducedMotion()) { setPlaying(false); return; }
    const t = setInterval(() => {
      setDayIdx((i) => {
        if (i >= votingDays.length - 1) { setPlaying(false); return i; }
        return i + 1;
      });
    }, 320);
    return () => clearInterval(t);
  }, [playing, votingDays.length]);

  const day = votingDays[Math.min(dayIdx, votingDays.length - 1)] || null;
  const byDay = mode === 'day' && !!day;

  const [minLon, minLat, maxLon, maxLat] = boundary.bbox;
  const kx = Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180));
  const spanX = (maxLon - minLon) * kx;
  const spanY = maxLat - minLat;
  const scale = Math.min((w - PAD * 2) / spanX, (MAX_H - PAD * 2) / spanY);
  const h = spanY * scale + PAD * 2;
  const offsetX = (w - spanX * scale) / 2;

  const px = (lon) => offsetX + (lon - minLon) * kx * scale;
  const py = (lat) => PAD + (maxLat - lat) * scale;
  const toPath = (rings) =>
    rings.map((r) =>
      r.map(([lon, lat], i) =>
        `${i ? 'L' : 'M'}${px(lon).toFixed(1)},${py(lat).toFixed(1)}`).join('') + 'Z',
    ).join(' ');

  const county = boundary.features.find((f) => f.role === 'county');
  const enclaves = boundary.features.filter((f) => f.role === 'enclave');

  const valueOf = (s) => (byDay ? (day.sites[s.key] ?? null) : s[metric]);

  /* In day mode the scale is fixed across the whole cycle rather than
     per frame — rescaling each day would make every day look equally
     busy and the surge would disappear entirely. */
  const maxVal = useMemo(() => {
    if (byDay) return Math.max(...votingDays.flatMap((d) => Object.values(d.sites)), 1);
    return Math.max(...sites.map((s) => s[metric]), 1);
  }, [byDay, sites, metric, votingDays]);

  const radiusFor = (v) =>
    v == null ? 0 : MIN_R + (MAX_R - MIN_R) * Math.sqrt(Math.max(0, v) / maxVal);

  const active = METRICS.find((m) => m.key === metric);
  const ordered = [...sites].sort((a, b) => (valueOf(b) ?? -1) - (valueOf(a) ?? -1));
  const wx = day?.weather;

  return (
    <div className="map" ref={ref}>
      <div className="map-head">
        <div className="seg" role="tablist" aria-label="Map view">
          <button role="tab" aria-selected={mode === 'cycle'}
                  className={mode === 'cycle' ? 'is-on' : ''}
                  onClick={() => { setMode('cycle'); setPlaying(false); }}>
            Whole cycle
          </button>
          <button role="tab" aria-selected={mode === 'day'}
                  className={mode === 'day' ? 'is-on' : ''}
                  onClick={() => setMode('day')}>
            Day by day
          </button>
        </div>

        {mode === 'cycle' && (
          <div className="seg" role="tablist" aria-label="Map metric">
            {METRICS.map((m) => (
              <button key={m.key} role="tab" aria-selected={metric === m.key}
                      className={metric === m.key ? 'is-on' : ''}
                      onClick={() => setMetric(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
        )}

        <ScaleLegend
          maxVal={maxVal}
          radiusFor={radiusFor}
          unit={byDay ? 'that day' : active.unit}
        />
      </div>

      {byDay && (
        <div className="map-scrub">
          <button
            className="map-play"
            onClick={() => {
              if (!playing && dayIdx >= votingDays.length - 1) setDayIdx(0);
              setPlaying((p) => !p);
            }}
            aria-label={playing ? 'Pause' : 'Play through the cycle'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            className="map-range"
            type="range"
            min="0"
            max={Math.max(0, votingDays.length - 1)}
            value={Math.min(dayIdx, votingDays.length - 1)}
            onChange={(e) => { setPlaying(false); setDayIdx(Number(e.target.value)); }}
            aria-label="Day of the early voting period"
          />
          <div className="map-scrub-read">
            <strong>{longDate(day.date)}</strong>
            <span>{fmt(day.inPerson)} in person</span>
            <span className="map-scrub-open">
              {Object.keys(day.sites).length}/{sites.length} sites open
            </span>
            {wx && (
              <span className={`wx ${wx.wet ? 'is-wet' : ''} ${wx.snowy ? 'is-snowy' : ''}`}>
                <WeatherIcon wet={wx.wet} snowy={wx.snowy} /> {wx.label},{' '}
                {Math.round(wx.tempMax)}°/{Math.round(wx.tempMin)}°F
                {wx.precip >= 0.01 ? ` · ${wx.precip.toFixed(2)}″` : ''}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="map-body" ref={boxRef}>
        <svg
          viewBox={`0 0 ${w} ${h}`} width="100%" height={h} role="img"
          aria-label={byDay
            ? `Map of ${ds.locality} early voting sites on ${longDate(day.date)}`
            : `Map of ${ds.locality} early voting sites, sized by ${active.label.toLowerCase()}`}
          onMouseLeave={() => setHover(null)}
        >
          <path d={toPath(county.rings)} className="map-county" />
          {enclaves.map((e) => (
            <path key={e.geoid} d={toPath(e.rings)} className="map-enclave" />
          ))}

          {ordered.map((s, i) => {
            const v = valueOf(s);
            const closed = v == null;
            const on = hover?.key === s.key;
            return (
              <g
                key={s.key}
                className={`map-site ${on ? 'is-on' : ''}`}
                style={{
                  opacity: inView ? 1 : 0,
                  transitionDelay: byDay ? '0ms' : `${i * 45}ms`,
                }}
                tabIndex={0}
                onMouseEnter={() => setHover(s)}
                onFocus={() => setHover(s)}
                onBlur={() => setHover(null)}
                aria-label={closed
                  ? `${s.label}: not open`
                  : `${s.label}: ${fmt(Math.round(v))} ballots`}
              >
                {closed ? (
                  /* Not-yet-open is a hollow marker, never a zero-radius
                     circle: "not open" and "nobody came" are different
                     facts and must not look the same. */
                  <circle cx={px(s.lon)} cy={py(s.lat)} r={MIN_R}
                          className="map-closed-ring" />
                ) : (
                  <circle cx={px(s.lon)} cy={py(s.lat)} r={radiusFor(v)}
                          className="map-oval" />
                )}
                <circle cx={px(s.lon)} cy={py(s.lat)} r="1.6" className="map-pin" />
              </g>
            );
          })}

          {!byDay && ordered.slice(0, 4).map((s) => (
            <text key={`l-${s.key}`} x={px(s.lon)}
                  y={py(s.lat) - radiusFor(valueOf(s)) - 7}
                  textAnchor="middle" className="map-label"
                  style={{ opacity: inView ? 1 : 0 }}>
              {s.label}
            </text>
          ))}
        </svg>
      </div>

      <div className="map-read" role="status">
        {hover ? (
          <>
            <strong>{hover.venue || hover.label}</strong>
            {hover.formerly && (
              <span className="map-formerly">formerly {hover.formerly}</span>
            )}
            {hover.address && <span className="map-address">{hover.address}</span>}
            <span className="map-read-stats">
              {byDay ? (
                day.sites[hover.key] != null
                  ? <><b>{fmt(day.sites[hover.key])}</b> ballots on {longDate(day.date)}</>
                  : <>not open on {longDate(day.date)}</>
              ) : (
                <>
                  <b>{fmt(Math.round(hover.perDay))}</b> ballots/day ·{' '}
                  <b>{fmt(hover.total)}</b> total · {hover.openDays} day
                  {hover.openDays === 1 ? '' : 's'} open ·{' '}
                  {pct(hover.shareOfInPerson)} of the county's in-person vote
                </>
              )}
            </span>
          </>
        ) : (
          <span className="muted">
            {byDay
              ? 'Drag the slider or press play. Circles use one fixed scale across every day, so the surge you see is real and not rescaled per frame.'
              : `Hover or tab to any site. Circle area is proportional to ${active.label.toLowerCase()}. Locations are geocoded from the county's published site addresses.`}
          </span>
        )}
      </div>
    </div>
  );
}

/** Nested reference circles — the honest way to label an area encoding. */
function ScaleLegend({ maxVal, radiusFor, unit }) {
  const steps = [maxVal, maxVal / 4].map((v) => ({ v, r: radiusFor(v) }));
  const wide = steps[0].r * 2 + 8;
  const tall = steps[0].r * 2 + 20;
  return (
    <svg width={wide + 74} height={tall} className="map-legend" aria-hidden="true">
      {steps.map((s, i) => (
        <g key={i}>
          <circle cx={wide / 2} cy={tall - 14 - s.r} r={s.r} className="map-legend-oval" />
          <text x={wide + 6} y={tall - 14 - s.r * 2 + 7} className="map-legend-text">
            {fmt(Math.round(s.v))}
          </text>
        </g>
      ))}
      <text x={wide / 2} y={tall - 4} textAnchor="middle" className="map-legend-text">
        {unit}
      </text>
    </svg>
  );
}
