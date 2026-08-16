/* ------------------------------------------------------------------
   Scheduled voting hours.

   The hours divide into ballot counts to produce the grid's per-hour
   view, but they are a fact about how the county ran the election in
   their own right — the Government Center opening at 8am while every
   satellite opens at 1pm is most of why it takes a quarter of the
   in-person vote. So they are published, not just divided by.

   Rendered from the same `schedule.groups` the build resolves hours
   from, so the table and the arithmetic can never drift apart.
------------------------------------------------------------------ */
import { fmt, shortDate } from '../../lib/format.js';

const DAY_ROWS = [
  ['weekday', 'Mon–Fri'],
  ['sat', 'Saturday'],
  ['sun', 'Sunday'],
];

/** "13:00" -> "1:00 pm" */
function clock(t) {
  const [h, m] = String(t).split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${suffix}`;
}

const span = (block) => (block ? `${clock(block[0])} – ${clock(block[1])}` : '—');

const hoursOf = (block) => {
  if (!block) return null;
  const [a, b] = block.map((t) => {
    const [h, m] = String(t).split(':').map(Number);
    return h + (m || 0) / 60;
  });
  return Math.round((b - a) * 100) / 100;
};

export default function Schedule({ ds }) {
  const sched = ds.schedule;
  if (!sched?.groups?.length) return null;

  /* The authored label wins. "*" cannot be rendered as "All locations":
     a later group overrides it for the Government Center, so the plain
     reading would be wrong for exactly the site whose different hours
     are the most interesting thing on this table. */
  const named = (g) => {
    if (g.label) return g.label;
    if (g.sites === '*') return 'All other locations';
    return g.sites
      .map((k) => ds.sites.find((s) => s.key === k)?.label || k)
      .join(', ');
  };

  return (
    <div className="sched">
      {sched.groups.map((g, i) => (
        <div className="sched-grp" key={`${g.label}-${i}`}>
          <div className="sched-head">
            <h3 className="sched-title">{named(g)}</h3>
            <span className="sched-range">
              {g.from === g.to
                ? shortDate(g.from)
                : `${shortDate(g.from)} – ${shortDate(g.to)}`}
            </span>
          </div>
          <table className="sched-tbl">
            <tbody>
              {DAY_ROWS.map(([key, label]) => {
                const block = g[key];
                if (!block) return null;
                return (
                  <tr key={key}>
                    <th scope="row">{label}</th>
                    <td className="sched-span">{span(block)}</td>
                    <td className="sched-hrs">{hoursOf(block)} hrs</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
      {sched.note && <p className="sched-note">{sched.note}</p>}
    </div>
  );
}
