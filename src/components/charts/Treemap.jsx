/* ------------------------------------------------------------------
   Squarified treemap.

   Replaces the loose grid of free-standing squares. Tiles fill the
   rectangle completely, so the eye compares *adjacent* areas rather than
   estimating across whitespace — which is what makes proportional
   differences between sites legible at a glance.

   The layout is Bruls/Huizing/van Wijk squarification: lay a row along
   the shorter side, keep adding tiles while the row's worst aspect ratio
   improves, then fix the row and recurse into what's left. Tiles come out
   near-square, which is the shape people judge area most accurately in.

   Only the tile's own name and share sit inside it, and only when the
   tile can hold them. Everything else is on hover — a treemap that
   prints four numbers per tile stops being readable at a glance, which
   is the only reason to use one.
------------------------------------------------------------------ */
import { useMemo, useState } from 'react';
import { fmt, pct } from '../../lib/format.js';

/* Text colour is derived from the fill it sits on, never from the item's
   rank. An earlier pass whitened the first four tiles by index, which
   put dark text on a dark fill the moment a ramp repeated. */
function readableOn(hex) {
  const h = String(hex).replace('#', '');
  if (h.length !== 6) return false;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L < 0.45;   // true = needs light text
}

const worst = (row, len, scale) => {
  const sum = row.reduce((s, r) => s + r.value, 0) * scale;
  const max = Math.max(...row.map((r) => r.value)) * scale;
  const min = Math.min(...row.map((r) => r.value)) * scale;
  const l2 = len * len;
  const s2 = sum * sum;
  return Math.max((l2 * max) / s2, s2 / (l2 * min));
};

/** Squarified layout: returns each item with x/y/w/h in the given box. */
function squarify(items, x, y, w, h) {
  const out = [];
  let rest = [...items];
  let box = { x, y, w, h };

  while (rest.length) {
    const area = box.w * box.h;
    const total = rest.reduce((s, r) => s + r.value, 0);
    if (!total || area <= 0) break;
    const scale = area / total;
    const short = Math.min(box.w, box.h);

    // Grow the row while the worst aspect ratio keeps improving.
    let row = [rest[0]];
    let i = 1;
    while (i < rest.length) {
      const next = [...row, rest[i]];
      if (worst(next, short, scale) > worst(row, short, scale)) break;
      row = next;
      i += 1;
    }

    const rowSum = row.reduce((s, r) => s + r.value, 0) * scale;
    const thick = rowSum / short;   // depth of this row
    let along = 0;

    for (const it of row) {
      const len = (it.value * scale) / thick;
      out.push(
        box.w >= box.h
          ? { ...it, x: box.x, y: box.y + along, w: thick, h: len }
          : { ...it, x: box.x + along, y: box.y, w: len, h: thick },
      );
      along += len;
    }

    box = box.w >= box.h
      ? { x: box.x + thick, y: box.y, w: box.w - thick, h: box.h }
      : { x: box.x, y: box.y + thick, w: box.w, h: box.h - thick };
    rest = rest.slice(i);
  }
  return out;
}

export default function Treemap({ items, total, height = 380, valueLabel = 'ballots' }) {
  const [hover, setHover] = useState(null);
  const W = 1000;                     // viewBox units; scales to any width
  const H = Math.round((height / 760) * 1000);

  const sum = total ?? items.reduce((s, i) => s + i.value, 0);
  const tiles = useMemo(() => {
    const sorted = [...items].filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
    return squarify(sorted, 0, 0, W, H);
  }, [items, H]);

  const active = hover ? tiles.find((t) => t.key === hover) : null;

  return (
    <div className="tm">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={height}
        preserveAspectRatio="none"
        role="img"
        aria-label={tiles
          .map((t) => `${t.label}: ${fmt(t.value)}, ${pct((t.value / sum) * 100)}`)
          .join('; ')}
        onMouseLeave={() => setHover(null)}
      >
        {tiles.map((t) => {
          const share = (t.value / sum) * 100;
          /* preserveAspectRatio="none" stretches the viewBox, so text
             inside would stretch too. Text is drawn in a second pass
             below in screen space instead. */
          return (
            <rect
              key={t.key}
              x={t.x} y={t.y} width={t.w} height={t.h}
              fill={t.color}
              className={`tm-rect ${hover && hover !== t.key ? 'is-dim' : ''}`}
              onMouseEnter={() => setHover(t.key)}
            >
              <title>{`${t.label}: ${fmt(t.value)} (${pct(share)})`}</title>
            </rect>
          );
        })}
      </svg>

      {/* Labels in screen space, positioned as percentages of the box, so
          they stay upright and unstretched over a non-uniform viewBox. */}
      <div className="tm-labels" aria-hidden="true">
        {tiles.map((t) => {
          const share = (t.value / sum) * 100;
          const wPct = (t.w / W) * 100;
          const hPx = (t.h / H) * height;
          /* A short tile gets its name only — two lines would be clipped
             by its own bottom edge. Below 40px nothing fits, and the tile
             lives on hover instead. */
          if (wPct <= 9 || hPx <= 40) return null;
          const oneLine = hPx < 60;
          return (
            <span
              key={t.key}
              className={`tm-lbl ${readableOn(t.color) ? 'on-dark' : ''} ${hover && hover !== t.key ? 'is-dim' : ''}`}
              style={{
                left: `${(t.x / W) * 100}%`,
                top: `${(t.y / H) * 100}%`,
                width: `${wPct}%`,
                height: `${hPx}px`,
              }}
            >
              <b>{t.label}</b>
              {!oneLine && <i>{pct(share)}</i>}
            </span>
          );
        })}
      </div>

      <div className="tm-read" role="status">
        {active ? (
          <>
            <span className="tm-swatch" style={{ background: active.color }} />
            <strong>{active.label}</strong>
            <span>
              {fmt(active.value)} {valueLabel} · {pct((active.value / sum) * 100)} of{' '}
              {fmt(sum)}
            </span>
          </>
        ) : (
          <span className="muted">
            Area is proportional to {valueLabel}. Hover any tile for its figures.
          </span>
        )}
      </div>
    </div>
  );
}
