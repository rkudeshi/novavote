/* ------------------------------------------------------------------
   Headline figures for a cycle.

   Layout: large stat boxes carry the counts and their shares, then
   proportional bars underneath show how each total divides. Every label
   sits inside the segment it describes, or directly beneath a segment
   too narrow to hold text — there is no separate legend to look up.

   Vote by mail is one group with two subgroups (returned by mail,
   returned by drop box), which is how the whole site treats it. The
   grouping is structural: a voter chooses vote-by-mail, and the drop box
   versus the postal service is a delivery detail within that choice.
------------------------------------------------------------------ */
import { fmt, pct } from '../../lib/format.js';
import { isComplete, methodTotals } from '../../lib/derive.js';

const NEUTRAL = 'var(--line-strong)';
/* Below this width a segment cannot hold its own text, so the label is
   rendered under the bar, anchored to the segment's centre. */
const INSIDE_MIN = 12;
/* A subgroup narrower than this can hold a number but not a name; the
   name is carried by the caption row under the bar instead. */
const SUB_NAME_MIN = 30;

function Stat({ label, value, sub, accent }) {
  return (
    <div className="rs-stat">
      {accent && <span className="rs-stat-rule" style={{ background: accent }} />}
      <div className="rs-stat-k">{label}</div>
      <div className="rs-stat-v">{fmt(value)}</div>
      {sub && <div className="rs-stat-s">{sub}</div>}
    </div>
  );
}

/**
 * A proportional bar. `parts` may each carry `sub` — a nested breakdown
 * rendered as a second tier spanning only that part's width, which is how
 * vote-by-mail shows its two delivery routes without becoming a peer of
 * in-person voting.
 */
function Bar({ title, total, totalLabel, parts, note }) {
  const outside = [];
  let acc = 0;

  return (
    <div className="rs-flow">
      <div className="rs-flow-head">
        <h3 className="rs-flow-title">{title}</h3>
        <div className="rs-flow-total">
          <b>{fmt(total)}</b> {totalLabel}
        </div>
      </div>

      <div
        className="rs-bar"
        role="img"
        aria-label={parts
          .map((p) => `${p.label}: ${fmt(p.value)}, ${pct((p.value / total) * 100, 1)}`)
          .join('; ')}
      >
        {parts.map((p) => {
          const share = (p.value / total) * 100;
          const mid = acc + share / 2;
          acc += share;
          if (share < INSIDE_MIN) outside.push({ ...p, share, mid });
          return (
            <div
              key={p.key}
              className="rs-seg"
              style={{ width: `${share}%`, background: p.color }}
              title={`${p.label}: ${fmt(p.value)} (${pct(share, 1)})`}
            >
              {share >= INSIDE_MIN && (
                <span className={`rs-seg-in ${p.dark ? 'on-dark' : ''}`}>
                  <b>{p.label}</b>
                  <i>{fmt(p.value)} · {pct(share, 1)}</i>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* Slivers cannot hold their own text. Their labels wrap in a row
          directly under the bar rather than being pinned to the segment
          centre, which collided as soon as two slivers sat side by side. */}
      {outside.length > 0 && (
        <div className="rs-out">
          {outside.map((p) => (
            <span key={p.key} className="rs-out-lbl">
              <span className="rs-out-dot" style={{ background: p.color }} />
              {p.label} · {fmt(p.value)} · {pct(p.share, 1)}
            </span>
          ))}
        </div>
      )}

      {/* Second tier: a subgroup breakdown spanning only its parent. */}
      {parts.some((p) => p.sub) && (
        <div className="rs-subbar">
          {parts.map((p) => {
            const share = (p.value / total) * 100;
            if (!p.sub) return <div key={p.key} style={{ width: `${share}%` }} />;
            return (
              <div key={p.key} className="rs-subwrap" style={{ width: `${share}%` }}>
                {p.sub.map((s) => {
                  const w = (s.value / p.value) * 100;
                  return (
                    <div
                      key={s.key}
                      className="rs-subseg"
                      style={{ width: `${w}%`, background: s.color }}
                      title={`${s.label}: ${fmt(s.value)}`}
                    >
                      <span className={`rs-subseg-in ${s.dark ? 'on-dark' : ''}`}>
                        {w >= SUB_NAME_MIN ? `${s.label} · ${fmt(s.value)}` : fmt(s.value)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {note && <p className="rs-flow-note">{note}</p>}
    </div>
  );
}

export default function ReportSummary({ ds }) {
  const t = ds.totals;
  const m = methodTotals(ds);
  const reg = ds.registeredVoters || null;
  const abIn = t.abInPerson || 0;
  const complete = isComplete(ds);

  /* Ballots issued that never came back. Guarded at zero: on a snapshot
     the mailed and returned series can stop on different dates. */
  const unreturned = Math.max(0, t.ballotsMailed - m.vbm - abIn);

  return (
    <div className="rs">
      <div className="rs-stats">
        <Stat
          label="Early ballots cast"
          value={m.early}
          sub={reg ? `${pct((m.early / reg) * 100, 2)} of registered voters` : 'all methods'}
          accent="var(--ink)"
          wide
        />
        <Stat
          label="Early in person"
          value={m.inPerson}
          sub={`${pct((m.inPerson / m.early) * 100, 1)} of early ballots`}
          accent="var(--s1)"
        />
        <Stat
          label="Vote by mail"
          value={m.vbm}
          sub={`${pct((m.vbm / m.early) * 100, 1)} of early ballots`}
          accent="var(--s2)"
        />
        <Stat
          label="Ballots issued by mail"
          value={t.ballotsMailed}
          sub={reg ? `${pct((t.ballotsMailed / reg) * 100, 1)} of registered voters` : null}
          accent={NEUTRAL}
        />
      </div>

      {reg && (
        <Bar
          title="Share of the electorate voting early"
          total={reg}
          totalLabel="registered voters"
          parts={[
            { key: 'early', label: 'Voted early', value: m.early, color: 'var(--s1)', dark: true },
            { key: 'not', label: 'Did not vote early', value: reg - m.early, color: NEUTRAL },
          ]}
          note="Election Day ballots are not counted here, so this is not total turnout."
        />
      )}

      <Bar
        title="How the early vote was cast"
        total={m.early}
        totalLabel="early ballots"
        parts={[
          {
            key: 'ip', label: 'Early in person', value: m.inPerson,
            color: 'var(--s1)', dark: true,
          },
          {
            key: 'vbm', label: 'Vote by mail', value: m.vbm,
            color: 'var(--s2)', dark: true,
            sub: [
              { key: 'mail', label: 'By mail', value: t.returnedMail, color: 'var(--s2)', dark: true },
              { key: 'box', label: 'Drop box', value: t.returnedDropbox, color: 'var(--s3)' },
            ],
          },
        ]}
      />

      <Bar
        title="What became of the ballots issued by mail"
        total={t.ballotsMailed}
        totalLabel="ballots issued"
        parts={[
          { key: 'mail', label: 'Returned by mail', value: t.returnedMail, color: 'var(--s2)', dark: true },
          { key: 'box', label: 'Returned by drop box', value: t.returnedDropbox, color: 'var(--s3)' },
          { key: 'ip', label: 'Voted in person instead', value: abIn, color: 'var(--seq-250)' },
          {
            key: 'none',
            label: complete ? 'Never returned' : 'Not returned yet',
            value: unreturned,
            color: NEUTRAL,
          },
        ]}
        note={complete
          ? `${fmt(unreturned)} ballots were issued and never came back${
              t.undeliverable != null ? `, of which ${fmt(t.undeliverable)} were undeliverable` : ''
            }.`
          : 'Coverage stops before Election Day, so most mail ballots were still outstanding.'}
      />
    </div>
  );
}
