/* ------------------------------------------------------------------
   The Surge — the site's signature visualization.

   It replaces v1's site x day oval grid. That grid failed for a
   structural reason: early voting follows the same arc everywhere, so
   every row was a copy of the county curve and the heatmap encoded the
   calendar rather than anything about the sites.

   This chart leans into the arc instead of hiding it. The x-axis is
   *days until Election Day*, not calendar date, which is what makes
   cycles and jurisdictions directly comparable — a Tuesday in 2023 and
   a Tuesday in 2025 aren't the same moment, but "14 days out" is.
------------------------------------------------------------------ */
import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt, longDate, pct } from '../../lib/format.js';
import { timeline } from '../../lib/derive.js';
import { useInView, useProgress } from '../../lib/motion.js';
import { linear, niceMax, partial, smoothPath } from './svg.js';

const PAD = { top: 28, right: 18, bottom: 34, left: 52 };

export default function SurgeChart({
  datasets,
  height = 380,
  metric = 'share',
  showAxis = true,
}) {
  const [ref, inView] = useInView({ threshold: 0.2 });
  const p = useProgress(inView, 1900);
  const [hover, setHover] = useState(null);
  const [w, setW] = useState(900);
  const boxRef = useRef(null);

  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const measure = () => setW(el.clientWidth || 900);
    measure();
    if (!('ResizeObserver' in window)) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const series = useMemo(
    () =>
      datasets.map((ds) => ({
        id: ds.id,
        label: ds.shortLabel || ds.locality,
        year: ds.electionDate.slice(0, 4),
        color: ds.color,
        // A snapshot that stops mid-cycle is drawn dashed and labelled, so
        // its truncated curve is never mistaken for a completed one.
        partial: ds.coverage?.complete === false,
        rows: timeline(ds).filter((r) => r.daysOut >= 0),
      })),
    [datasets],
  );

  const maxOut = Math.max(...series.flatMap((s) => s.rows.map((r) => r.daysOut)), 1);
  const maxVal = niceMax(
    Math.max(...series.flatMap((s) => s.rows.map((r) => r[metric])), 0.001),
  );

  const innerW = Math.max(220, w - PAD.left - PAD.right);
  const innerH = height - PAD.top - PAD.bottom;
  // Election Day sits at the right edge, so days-out runs high -> low.
  const x = linear(maxOut, 0, PAD.left, PAD.left + innerW);
  const y = linear(0, maxVal, PAD.top + innerH, PAD.top);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);
  const dayTicks = [maxOut, 28, 21, 14, 7, 3, 0].filter((d, i, a) => d <= maxOut && a.indexOf(d) === i);

  return (
    <figure
      ref={(node) => {
        ref.current = node;
        boxRef.current = node;
      }}
      className="surge"
      style={{ margin: 0 }}
    >
      <svg
        viewBox={`0 0 ${w} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`Early ballots by days until Election Day, ${series
          .map((s) => s.label)
          .join(', ')}`}
        onMouseLeave={() => setHover(null)}
      >
        <defs>
          {series.map((s) => (
            <linearGradient key={s.id} id={`fill-${s.id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.30" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0.02" />
            </linearGradient>
          ))}
        </defs>

        {showAxis &&
          ticks.map((t, i) => (
            <g key={i} style={{ opacity: p > 0.05 ? 1 : 0, transition: 'opacity .5s' }}>
              <line
                x1={PAD.left}
                x2={PAD.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--line)"
                strokeWidth="1"
              />
              <text
                x={PAD.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
                fill="var(--muted)"
              >
                {metric === 'share' ? `${t.toFixed(t < 1 ? 1 : 0)}%` : fmt(Math.round(t))}
              </text>
            </g>
          ))}

        {/* Election Day marker — the wall every curve runs into. */}
        <line
          x1={x(0)}
          x2={x(0)}
          y1={PAD.top - 8}
          y2={PAD.top + innerH}
          stroke="var(--brand)"
          strokeWidth="1.5"
          strokeDasharray="3 3"
          style={{ opacity: p > 0.9 ? 0.9 : 0, transition: 'opacity .6s' }}
        />
        <text
          x={x(0)}
          y={PAD.top - 13}
          textAnchor="end"
          fontSize="10"
          fontFamily="var(--font-mono)"
          fill="var(--brand)"
          letterSpacing="0.08em"
          style={{ opacity: p > 0.9 ? 1 : 0, transition: 'opacity .6s' }}
        >
          ELECTION DAY
        </text>

        {series.map((s, si) => {
          const pts = s.rows.map((r) => [x(r.daysOut), y(r[metric])]);
          const shown = partial(pts, p);
          if (!shown.length) return null;
          const line = smoothPath(shown);
          const last = shown[shown.length - 1];
          const area = `${line} L${last[0]},${PAD.top + innerH} L${shown[0][0]},${
            PAD.top + innerH
          } Z`;
          return (
            <g key={s.id}>
              <path
                d={area}
                fill={`url(#fill-${s.id})`}
                opacity={s.partial ? 0.45 : 1}
              />
              <path
                d={line}
                fill="none"
                stroke={s.color}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.partial ? '5 4' : undefined}
              />
              {/* Leading edge: a bright dot riding the draw. */}
              {p < 1 && (
                <circle r="4.5" cx={last[0]} cy={last[1]} fill={s.color}>
                  <animate
                    attributeName="opacity"
                    values="1;.35;1"
                    dur="1.1s"
                    repeatCount="indefinite"
                  />
                </circle>
              )}
              {/* Direct label — required relief for the aqua series, which
                  sits under 3:1 contrast on this surface. */}
              {p >= 1 && (
                <text
                  x={Math.max(PAD.left + 4, last[0] - 6)}
                  y={Math.max(PAD.top + 12, last[1] - 10 - si * 14)}
                  textAnchor="end"
                  fontSize="11.5"
                  fontWeight="600"
                  fontFamily="var(--font-mono)"
                  fill={s.color}
                >
                  {s.label}{s.partial ? ' (partial)' : ''}
                </text>
              )}
            </g>
          );
        })}

        {showAxis &&
          dayTicks.map((d) => (
            <text
              key={d}
              x={x(d)}
              y={height - 12}
              textAnchor="middle"
              fontSize="10.5"
              fontFamily="var(--font-mono)"
              fill="var(--muted)"
              style={{ opacity: p > 0.4 ? 1 : 0, transition: 'opacity .5s' }}
            >
              {d === 0 ? 'E-Day' : `${d}d`}
            </text>
          ))}

        {/* Hover crosshair: one invisible band per day-out position. */}
        {p >= 1 &&
          Array.from({ length: maxOut + 1 }, (_, i) => maxOut - i).map((d) => {
            const bw = innerW / (maxOut + 1);
            return (
              <rect
                key={d}
                x={x(d) - bw / 2}
                y={PAD.top}
                width={bw}
                height={innerH}
                fill="transparent"
                onMouseEnter={() =>
                  setHover({
                    daysOut: d,
                    points: series
                      .map((s) => ({ s, r: s.rows.find((r) => r.daysOut === d) }))
                      .filter((o) => o.r),
                  })
                }
              />
            );
          })}

        {hover && hover.points.length > 0 && (
          <g pointerEvents="none">
            <line
              x1={x(hover.daysOut)}
              x2={x(hover.daysOut)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              stroke="var(--ink)"
              strokeOpacity=".25"
              strokeWidth="1"
            />
            {hover.points.map(({ s, r }) => (
              <circle
                key={s.id}
                cx={x(r.daysOut)}
                cy={y(r[metric])}
                r="5"
                fill={s.color}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ))}
          </g>
        )}
      </svg>

      {showAxis && (
      <figcaption className="surge-read" role="status">
        {hover && hover.points.length ? (
          <>
            <strong>
              {hover.daysOut === 0 ? 'Election Day' : `${hover.daysOut} days out`}
            </strong>
            {hover.points.map(({ s, r }) => (
              <span key={s.id} className="surge-read-item">
                <i style={{ background: s.color }} />
                {s.label} · {longDate(r.date)} · <b>{fmt(r.value)}</b> ballots (
                {pct(r.share, 1)} of cycle)
              </span>
            ))}
          </>
        ) : (
          <span className="surge-idle">
            Hover the chart to read any day. Every cycle is aligned to its own
            Election Day, so the curves compare directly.
          </span>
        )}
      </figcaption>
      )}
    </figure>
  );
}
