/* ------------------------------------------------------------------
   Proportional squares.

   Side length scales with the square root of the value, so *area* is
   proportional to ballots — the encoding people read correctly. Squares
   rather than circles because they tile without gaps, which keeps
   sixteen sites of very different sizes comparable at a glance.

   Every square carries its own label and count. Small squares put that
   text beside themselves instead of inside; nothing here relies on a
   legend.
------------------------------------------------------------------ */
import { fmt, pct } from '../../lib/format.js';

const MAX = 150;   // side of the largest square, px
const MIN = 34;    // below this, text moves outside

export default function Squares({ items, total, caption }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  const sum = total ?? items.reduce((s, i) => s + i.value, 0);

  return (
    <div className="sq">
      <div className="sq-grid">
        {items.map((it) => {
          const side = Math.max(14, MAX * Math.sqrt(it.value / max));
          const share = sum ? (it.value / sum) * 100 : 0;
          const inside = side >= MIN * 2;
          return (
            <div key={it.key} className="sq-cell" style={{ width: side }}>
              <div
                className="sq-box"
                style={{ width: side, height: side, background: it.color }}
                title={`${it.label}: ${fmt(it.value)} (${pct(share, 1)})`}
              >
                {inside && (
                  <span className={`sq-in ${it.dark ? 'on-dark' : ''}`}>
                    <b>{fmt(it.value)}</b>
                    <i>{pct(share, 1)}</i>
                  </span>
                )}
              </div>
              <div className="sq-lbl">
                <span className="sq-name">{it.label}</span>
                {!inside && (
                  <span className="sq-val">{fmt(it.value)} · {pct(share, 1)}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {caption && <p className="sq-cap">{caption}</p>}
    </div>
  );
}
