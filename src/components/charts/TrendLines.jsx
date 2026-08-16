/* ------------------------------------------------------------------
   Cumulative curves, one per election, indexed to days before Election
   Day.

   Where SurgeChart draws the *daily* rhythm, this draws the bank: how
   many ballots were in hand with n days to go. That is the shape worth
   comparing across years, because it answers "are we ahead of last
   time?" at every point in the cycle rather than only at the end.

   **Telling six lines apart is the whole design problem.** Six curves of
   the same family in six shades of one ramp is a chart nobody can read.
   Three things separate them here, and they are deliberately redundant
   so none has to carry it alone:

     1. Two lines are in colour and the rest are grey. The two are the
        newest cycle and the newest *comparable* one — a governor's year
        against the last governor's year, not against a presidential
        year. Everything else is context, drawn as context.
     2. Every line ends in its own marker shape, and the legend shows
        the same shape. Shape survives greyscale, printing, and every
        form of colour vision deficiency.
     3. Every line carries its year as a direct label at its end point,
        pushed apart where two curves finish close together.

   2 and 3 hold up to six series. Past that — nine jurisdictions in one
   election — there are more curves than distinct shapes and the end
   labels stack into a column, so only the emphasised pair is named and
   the caller supplies a control for changing which pair that is.

   The emphasis is passed in rather than decided here: which cycle is
   "comparable" is a fact about the election calendar, and it lives in
   lib/slugs.js with the rest of that knowledge.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { fmt, longDate, pct } from '../../lib/format.js';
import { useInView, useProgress, useWidth } from '../../lib/motion.js';
import { linear, niceMax, partial, smoothPath } from './svg.js';

const PAD = { top: 26, right: 78, bottom: 38, left: 62 };

/* Emphasis is a rank, not a colour name: the page decides which cycle is
   current and which is its comparable predecessor, and this maps that
   ranking onto weight and hue. Grey here is a real colour choice — it
   holds 4.6:1 against the chart surface, so a context line is quiet but
   never unreadable. */
const RANK = {
  primary: { color: 'var(--s1)', width: 2.8, opacity: 1 },
  secondary: { color: 'var(--s2)', width: 2.4, opacity: 1 },
  muted: { color: '#9AA2B1', width: 1.4, opacity: 0.95 },
};

/* Marker shapes, walked in order. Six is the most cycles any
   jurisdiction here has; a seventh would wrap, which is why the legend
   pairs shape with a written label rather than relying on shape alone. */
const SHAPES = ['circle', 'square', 'diamond', 'triangle', 'plus', 'cross'];

function Marker({ shape, x, y, r, fill, stroke = 'var(--surface)', width = 2 }) {
  const common = { fill, stroke, strokeWidth: width };
  if (shape === 'square') {
    return <rect x={x - r} y={y - r} width={r * 2} height={r * 2} rx="1" {...common} />;
  }
  if (shape === 'diamond') {
    return (
      <path d={`M${x},${y - r * 1.25} L${x + r * 1.25},${y} L${x},${y + r * 1.25} L${x - r * 1.25},${y} Z`} {...common} />
    );
  }
  if (shape === 'triangle') {
    return (
      <path d={`M${x},${y - r * 1.3} L${x + r * 1.2},${y + r} L${x - r * 1.2},${y + r} Z`} {...common} />
    );
  }
  if (shape === 'plus') {
    const a = r * 0.45;
    return (
      <path
        d={`M${x - a},${y - r} H${x + a} V${y - a} H${x + r} V${y + a} H${x + a} V${y + r} H${x - a} V${y + a} H${x - r} V${y - a} H${x - a} Z`}
        {...common}
      />
    );
  }
  if (shape === 'cross') {
    const a = r * 0.42;
    const b = r * 0.72;
    const pts = [
      [0, -a], [b - a, -b], [b, -b + a], [a, 0], [b, b - a], [b - a, b], [0, a],
      [-b + a, b], [-b, b - a], [-a, 0], [-b, -b + a], [-b + a, -b],
    ];
    return (
      <path d={`M${pts.map(([dx, dy]) => `${x + dx},${y + dy}`).join(' L')} Z`} {...common} />
    );
  }
  return <circle cx={x} cy={y} r={r} {...common} />;
}

/**
 * @param series  [{ id, label, emphasis, rows: [{daysOut, value, date, raw}] }]
 * @param unit    'count' | 'pct' — how the y axis and readout are printed
 */
export default function TrendLines({
  series,
  height = 400,
  unit = 'count',
  yLabel,
  xLabel = 'Days before Election Day',
}) {
  const [inViewRef, inView] = useInView({ threshold: 0.15 });
  const [boxRef, measured] = useWidth();
  const p = useProgress(inView, 1500);
  const [hover, setHover] = useState(null);
  const w = measured || 900;

  /* ----------------------------------------------------------------
     Which curves get their own shape and their own end label.

     All of them, when the labels are years and there are six or fewer —
     that is the per-jurisdiction case and it reads perfectly. But nine
     places all finish inside the same narrow band, so nine names stack
     into an unreadable column, the long ones ("Prince William") run off
     the edge, and there are more series than distinct shapes, which
     would put two grey curves under the same marker. Past six series
     only the emphasised curves are given a shape and a label; the rest
     are context, and the way to identify one is to make it the focus.
  ---------------------------------------------------------------- */
  const labelAll = series.filter((s) => s.rows.length).length <= SHAPES.length;

  const shaped = useMemo(
    () =>
      series.map((s, i) => {
        const rank = s.emphasis || 'muted';
        return {
          ...s,
          named: labelAll || rank !== 'muted',
          shape: labelAll
            ? SHAPES[i % SHAPES.length]
            : rank === 'secondary' ? 'diamond' : 'circle',
          ...RANK[rank],
        };
      }),
    [series, labelAll],
  );

  const drawn = shaped.filter((s) => s.rows.length);
  const labelled = (s) => s.named;
  const maxOut = Math.max(...drawn.flatMap((s) => s.rows.map((r) => r.daysOut)), 1);
  const rawMax = Math.max(...drawn.flatMap((s) => s.rows.map((r) => r.value)), 0);
  /* Percentages cap at 100 whatever the data does; a composition chart
     whose axis stops at 80% invites the reader to measure against the
     wrong whole. Counts get a rounded-up nice maximum. */
  const maxVal = unit === 'pct' ? Math.min(100, niceMax(rawMax)) : niceMax(rawMax || 1);

  /* The gutter is sized from the longest label actually drawn rather
     than fixed, so a long name is not clipped and a chart of bare years
     does not pay for one. Plex Mono at 11.5px advances ~6.9px. */
  const gutter = Math.max(
    40,
    ...drawn.filter(labelled).map((s) => s.label.length * 6.9 + 22),
  );
  const pad = { ...PAD, right: Math.min(gutter, Math.max(40, w * 0.28)) };

  const innerW = Math.max(200, w - pad.left - pad.right);
  const innerH = height - pad.top - pad.bottom;
  const x = linear(maxOut, 0, pad.left, pad.left + innerW);
  const y = linear(0, maxVal, pad.top + innerH, pad.top);

  const ends = drawn.map((s) => {
    const last = s.rows[s.rows.length - 1];
    return { x: x(last.daysOut), y: y(last.value), row: last };
  });

  /* End labels sit at each curve's last point and collide when two
     cycles finish level. Same two-pass sweep the surge chart uses: push
     down through the stack, then back up off the floor. */
  const labelYs = (() => {
    const GAP = 13;
    const top = pad.top + 6;
    const bottom = pad.top + innerH;
    const want = ends
      .map((e, i) => ({ i, y: e.y }))
      .filter((o) => labelled(drawn[o.i]));
    want.sort((a, b) => a.y - b.y);
    for (let k = 1; k < want.length; k++) {
      if (want[k].y - want[k - 1].y < GAP) want[k].y = want[k - 1].y + GAP;
    }
    if (want.length && want[want.length - 1].y > bottom) {
      want[want.length - 1].y = bottom;
      for (let k = want.length - 2; k >= 0; k--) {
        if (want[k + 1].y - want[k].y < GAP) want[k].y = want[k + 1].y - GAP;
      }
    }
    const out = [];
    want.forEach((o) => { out[o.i] = Math.max(top, o.y); });
    return out;
  })();

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => maxVal * f);
  const dayTicks = [maxOut, 35, 28, 21, 14, 7, 0]
    .filter((d, i, a) => d <= maxOut && d >= 0 && a.indexOf(d) === i);

  const axisText = (v) =>
    unit === 'pct' ? `${Math.round(v)}%` : abbreviate(v);

  const readOut = (v) => (unit === 'pct' ? pct(v) : fmt(Math.round(v)));

  return (
    <figure className="trend" style={{ margin: 0 }} ref={boxRef}>
      <div
        ref={inViewRef}
        onMouseLeave={() => setHover(null)}
      >
        <svg
          viewBox={`0 0 ${w} ${height}`}
          width="100%"
          height={height}
          role="img"
          aria-label={`${yLabel || 'Cumulative ballots'} by days before Election Day: ${drawn
            .map((s) => s.label)
            .join(', ')}`}
        >
          {ticks.map((t, i) => (
            <g key={i}>
              <line
                x1={pad.left}
                x2={pad.left + innerW}
                y1={y(t)}
                y2={y(t)}
                stroke="var(--line)"
              />
              <text
                x={pad.left - 10}
                y={y(t) + 4}
                textAnchor="end"
                fontSize="10.5"
                fontFamily="var(--font-mono)"
                fill="var(--muted)"
              >
                {axisText(t)}
              </text>
            </g>
          ))}

          {/* Election Day — the wall every curve runs into. */}
          <line
            x1={x(0)}
            x2={x(0)}
            y1={pad.top - 6}
            y2={pad.top + innerH}
            stroke="var(--brand)"
            strokeWidth="1.5"
            strokeDasharray="3 3"
            opacity="0.8"
          />

          {/* Grey context lines first, so the two emphasised curves sit
              on top of them wherever they cross. */}
          {[...drawn.keys()]
            .sort((a, b) => order(drawn[a]) - order(drawn[b]))
            .map((si) => {
              const s = drawn[si];
              const pts = s.rows.map((r) => [x(r.daysOut), y(r.value)]);
              const shown = partial(pts, p);
              if (shown.length < 2) return null;
              const end = ends[si];
              return (
                <g key={s.id}>
                  <path
                    d={smoothPath(shown)}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDasharray={s.partial ? '5 4' : undefined}
                    opacity={s.opacity}
                  />
                  {p >= 1 && (
                    <>
                      <Marker
                        shape={s.shape}
                        x={end.x}
                        y={end.y}
                        r={s.emphasis === 'muted' ? 3.6 : 5}
                        fill={s.color}
                      />
                      {labelled(s) && (
                        <text
                          x={end.x + 9}
                          y={labelYs[si] + 4}
                          fontSize="11.5"
                          fontWeight={s.emphasis === 'muted' ? 500 : 700}
                          fontFamily="var(--font-mono)"
                          fill={s.color}
                          stroke="var(--surface)"
                          strokeWidth="3"
                          paintOrder="stroke"
                          strokeLinejoin="round"
                        >
                          {s.label}
                        </text>
                      )}
                    </>
                  )}
                </g>
              );
            })}

          {dayTicks.map((d) => (
            <text
              key={d}
              x={x(d)}
              y={height - 14}
              textAnchor="middle"
              fontSize="10.5"
              fontFamily="var(--font-mono)"
              fill="var(--muted)"
            >
              {d === 0 ? 'E-Day' : d}
            </text>
          ))}
          <text
            x={pad.left + innerW / 2}
            y={height - 1}
            textAnchor="middle"
            fontSize="10"
            fontFamily="var(--font-body)"
            letterSpacing="0.08em"
            fill="var(--muted)"
          >
            {xLabel.toUpperCase()}
          </text>

          {/* One invisible band per day, for the crosshair. */}
          {p >= 1 &&
            Array.from({ length: maxOut + 1 }, (_, i) => maxOut - i).map((d) => {
              const bw = innerW / (maxOut + 1);
              return (
                <rect
                  key={d}
                  x={x(d) - bw / 2}
                  y={pad.top}
                  width={bw}
                  height={innerH}
                  fill="transparent"
                  onMouseEnter={() =>
                    setHover({
                      daysOut: d,
                      points: drawn
                        .map((s) => ({ s, r: at(s.rows, d) }))
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
                y1={pad.top}
                y2={pad.top + innerH}
                stroke="var(--ink)"
                strokeOpacity=".25"
              />
              {hover.points.map(({ s, r }) => (
                <Marker
                  key={s.id}
                  shape={s.shape}
                  x={x(hover.daysOut)}
                  y={y(r.value)}
                  r={4.5}
                  fill={s.color}
                />
              ))}
            </g>
          )}
        </svg>
      </div>

      {/* The legend names only what the chart can actually distinguish.
          With more curves than shapes, the grey ones share a marker, so
          listing them here would promise an identification the chart
          cannot deliver — they are summarised as a count instead. */}
      <div className="trend-legend">
        {shaped.filter((s) => s.named).map((s) => (
          <span key={s.id} className="trend-key is-on">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <Marker shape={s.shape} x={7} y={7} r={4.5} fill={s.color} width={0} />
            </svg>
            {s.label}
            {s.kindLabel && <em>{s.kindLabel}</em>}
          </span>
        ))}
        {!labelAll && (
          <span className="trend-key">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <line x1="1" y1="7" x2="13" y2="7" stroke={RANK.muted.color} strokeWidth="1.6" />
            </svg>
            {drawn.filter((s) => !s.named).length} more
          </span>
        )}
      </div>

      <figcaption className="surge-read" role="status">
        {hover && hover.points.length ? (
          <>
            <strong>
              {hover.daysOut === 0 ? 'Election Day' : `${hover.daysOut} days out`}
            </strong>
            {hover.points.map(({ s, r }) => (
              <span key={s.id} className="surge-read-item">
                <i style={{ background: s.color }} />
                {s.label} · {longDate(r.date)} · <b>{readOut(r.value)}</b>
              </span>
            ))}
          </>
        ) : (
          <span className="surge-idle">
            Hover to read any point. Every cycle is aligned to its own Election
            Day, so the curves compare directly.
          </span>
        )}
      </figcaption>
    </figure>
  );
}

/* Draw order: context underneath, comparable above it, current on top. */
const order = (s) =>
  ({ muted: 0, secondary: 1, primary: 2 }[s.emphasis || 'muted']);

/** The row at a given days-out, or the nearest earlier one. */
function at(rows, d) {
  let best = null;
  for (const r of rows) {
    if (r.daysOut === d) return r;
    if (r.daysOut > d && (!best || r.daysOut < best.daysOut)) best = r;
  }
  /* A cumulative series holds its value across a day it has no row for,
     so the nearest *earlier* day is the right answer — not a gap. */
  return best;
}

/** 240,000 -> "240k". Axis ticks only; every readout prints in full. */
function abbreviate(v) {
  if (v >= 1000000) return `${(v / 1000000).toFixed(v % 1000000 ? 1 : 0)}M`;
  if (v >= 1000) return `${Math.round(v / 1000)}k`;
  return fmt(Math.round(v));
}
