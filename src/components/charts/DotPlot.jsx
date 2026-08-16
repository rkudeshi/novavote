/* ------------------------------------------------------------------
   A row per election (or per jurisdiction), a dot per measure, on one
   shared percentage axis.

   This is the chart for "how does 2025 compare with 2021 and 2023?" when
   the answer is a single number per year rather than a curve. Bars would
   work too, but three bars per row is nine bars for three years and the
   eye ends up comparing bar lengths inside a row rather than positions
   down a column. Dots on a common axis make the column the comparison,
   which is the one that matters — and the connector between the outer
   dots gives each row a length without pretending the gap starts at zero.

   The axis is always a percentage. Rows here are places or years of very
   different sizes, and a raw-count axis would make every row a statement
   about population.
------------------------------------------------------------------ */
import { useState } from 'react';
import { pct } from '../../lib/format.js';
import { useInView, useWidth } from '../../lib/motion.js';
import { linear, niceMax } from './svg.js';

const PAD = { top: 10, right: 44, bottom: 30, left: 0 };
const ROW = 46;

/**
 * @param rows    [{ key, label, sub, dots: [{key, label, value}] }]
 * @param series  [{ key, label, color }] — the dot legend, in order
 * @param labelW  px reserved for row labels
 */
export default function DotPlot({ rows, series, labelW = 130, max: capMax }) {
  const [boxRef, measured] = useWidth();
  const [inViewRef, inView] = useInView({ threshold: 0.1 });
  const [hover, setHover] = useState(null);
  const w = measured || 800;

  const height = PAD.top + rows.length * ROW + PAD.bottom;
  const left = PAD.left + labelW;
  const innerW = Math.max(140, w - left - PAD.right);
  const values = rows.flatMap((r) => r.dots.map((d) => d.value)).filter((v) => v != null);
  const max = capMax || Math.min(100, niceMax(Math.max(...values, 1)));
  const x = linear(0, max, left, left + innerW);
  const colorOf = (key) => series.find((s) => s.key === key)?.color || 'var(--muted)';

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => max * f);

  return (
    <figure className="dotplot" style={{ margin: 0 }} ref={boxRef}>
      <div ref={inViewRef}>
        <svg viewBox={`0 0 ${w} ${height}`} width="100%" height={height} role="img"
             aria-label={`${series.map((s) => s.label).join(' and ')} by ${rows.map((r) => r.label).join(', ')}`}>
          {ticks.map((t, i) => (
            <g key={i}>
              <line x1={x(t)} x2={x(t)} y1={PAD.top} y2={PAD.top + rows.length * ROW}
                    stroke="var(--line)" />
              <text x={x(t)} y={height - 12} textAnchor="middle" fontSize="10.5"
                    fontFamily="var(--font-mono)" fill="var(--muted)">
                {pct(t, 0)}
              </text>
            </g>
          ))}

          {rows.map((row, ri) => {
            const cy = PAD.top + ri * ROW + ROW / 2;
            const vals = row.dots.map((d) => d.value).filter((v) => v != null);
            const lo = Math.min(...vals);
            const hi = Math.max(...vals);
            return (
              <g key={row.key} onMouseEnter={() => setHover(row.key)}
                 onMouseLeave={() => setHover(null)}>
                <rect x="0" y={PAD.top + ri * ROW} width={w} height={ROW}
                      fill={hover === row.key ? 'rgba(19,26,43,0.035)' : 'transparent'} />
                <text x="0" y={row.sub ? cy - 6 : cy + 1} fontSize="13" fontWeight="600"
                      fontFamily="var(--font-body)" fill="var(--ink)"
                      dominantBaseline="middle">
                  {row.label}
                </text>
                {row.sub && (
                  <text x="0" y={cy + 10} fontSize="10.5" fontFamily="var(--font-body)"
                        fill="var(--muted)" dominantBaseline="middle">
                    {row.sub}
                  </text>
                )}
                {vals.length > 1 && (
                  <line x1={x(lo)} x2={inView ? x(hi) : x(lo)} y1={cy} y2={cy}
                        stroke="var(--line-strong)" strokeWidth="2.5" strokeLinecap="round"
                        style={{ transition: 'x2 .7s cubic-bezier(.2,.7,.3,1)' }} />
                )}
                {row.dots.map((d) => d.value == null ? null : (
                  <g key={d.key}>
                    <circle cx={inView ? x(d.value) : x(0)} cy={cy} r="6.5"
                            fill={colorOf(d.key)} stroke="var(--surface)" strokeWidth="2"
                            style={{ transition: 'cx .7s cubic-bezier(.2,.7,.3,1)' }}>
                      <title>{`${row.label} — ${d.label}: ${pct(d.value)}`}</title>
                    </circle>
                  </g>
                ))}
                {/* The value that leads the row, printed. A dot plot read
                    off an axis alone loses the figure the reader came
                    for; the rest are available on hover. */}
                {vals.length > 0 && (
                  <text x={x(hi) + 12} y={cy + 1} fontSize="11.5"
                        fontFamily="var(--font-mono)" fill="var(--ink-2)"
                        dominantBaseline="middle">
                    {pct(hi)}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="trend-legend">
        {series.map((s) => (
          <span key={s.key} className="trend-key is-on">
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill={s.color} />
            </svg>
            {s.label}
          </span>
        ))}
      </div>
    </figure>
  );
}
