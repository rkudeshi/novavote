/* ------------------------------------------------------------------
   The county report's front page, rebuilt.

   Fairfax's AB Daily Report opens with a small table and then eleven
   loose percentages stacked under it. Every one of those figures is
   derived from six counts, and the percentages are quotients over three
   different denominators — registered voters, ballots issued, ballots
   returned — with nothing on the page saying which is which. So the
   reader is handed "74%", "80%", "32%" and "68%" with no way to tell
   that they are answers to four different questions.

   This rebuilds it as three proportional bars, one per question the
   page is actually asking:

     1. How much of the electorate voted early at all?
     2. Of those early ballots, how were they cast?
     3. Of the mail ballots issued, what became of them?

   Bar 3 is the one the PDF cannot draw, because the county never prints
   the residual: 87,547 issued minus 51,413 returned by mail minus
   12,954 by drop box minus 1,654 whose requester voted in person leaves
   21,526 ballots that simply never came back. That is a quarter of every
   ballot mailed, and it is the most interesting number on the page.

   Two of the county's own labels are wrong in a way worth flagging
   rather than propagating — see LABEL NOTES at the bottom of the file.
------------------------------------------------------------------ */
import { useState } from 'react';
import { fmt, pct } from '../../lib/format.js';
import { isComplete } from '../../lib/derive.js';

const NEUTRAL = 'var(--line-strong)';

/** A stacked proportional bar plus a keyed read-out of its parts. */
function FlowBar({ title, question, total, totalLabel, parts, note }) {
  const [hover, setHover] = useState(null);
  const sum = parts.reduce((s, p) => s + p.value, 0);
  const denom = total ?? sum;

  return (
    <div className="rs-flow">
      <div className="rs-flow-head">
        <h3 className="rs-flow-title">{title}</h3>
        <div className="rs-flow-total">
          <b>{fmt(denom)}</b> {totalLabel}
        </div>
      </div>
      <p className="rs-flow-q">{question}</p>

      <div
        className="rs-bar"
        role="img"
        aria-label={parts
          .map((p) => `${p.label}: ${fmt(p.value)}, ${pct((p.value / denom) * 100, 1)}`)
          .join('; ')}
        onMouseLeave={() => setHover(null)}
      >
        {parts.map((p) => {
          const share = (p.value / denom) * 100;
          return (
            <div
              key={p.key}
              className={`rs-seg ${hover && hover !== p.key ? 'is-dim' : ''}`}
              style={{ width: `${share}%`, background: p.color }}
              onMouseEnter={() => setHover(p.key)}
              title={`${p.label}: ${fmt(p.value)} (${pct(share, 1)})`}
            >
              {/* Only label inside the bar when the segment can actually
                  hold the text; everything is in the list below anyway. */}
              {share >= 12 && (
                <span className={`rs-seg-in ${p.dark ? 'on-dark' : ''}`}>
                  {pct(share, 1)}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <ul className="rs-keys">
        {parts.map((p) => {
          const share = (p.value / denom) * 100;
          return (
            <li
              key={p.key}
              className={`rs-key ${hover && hover !== p.key ? 'is-dim' : ''}`}
              onMouseEnter={() => setHover(p.key)}
              onMouseLeave={() => setHover(null)}
            >
              <span className="rs-swatch" style={{ background: p.color }} />
              <span className="rs-key-label">{p.label}</span>
              <span className="rs-key-val">{fmt(p.value)}</span>
              <span className="rs-key-pct">{pct(share, 1)}</span>
              {p.of && <span className="rs-key-of">{p.of}</span>}
            </li>
          );
        })}
      </ul>

      {note && <p className="rs-flow-note">{note}</p>}
    </div>
  );
}

export default function ReportSummary({ ds }) {
  const t = ds.totals;
  const early = t.inPerson + t.returnedMail + t.returnedDropbox;
  const returnedAbsentee = t.returnedMail + t.returnedDropbox;
  const reg = ds.registeredVoters || null;
  const abIn = t.abInPerson || 0;
  /* A mid-cycle snapshot has not had time for mail ballots to come back,
     so its residual is "not returned *yet*", not "abandoned" — and any
     ratio over its tiny returned-absentee count is noise. Both are
     suppressed rather than shown with a caveat nobody reads. */
  const complete = isComplete(ds);

  /* The residual the report never prints. Guarded at zero: a partial
     cycle can report more issued-then-returned than a snapshot's own
     mailed count if the two series stop on different dates. */
  const unreturned = Math.max(0, t.ballotsMailed - returnedAbsentee - abIn);

  return (
    <div className="rs">
      {reg && (
        <FlowBar
          title="Who voted early"
          question="How much of the electorate cast a ballot before Election Day?"
          total={reg}
          totalLabel="registered voters"
          parts={[
            {
              key: 'early', label: 'Voted early, any method', value: early,
              color: 'var(--s1)', dark: true,
            },
            {
              key: 'not', label: 'Did not vote early', value: reg - early,
              color: NEUTRAL,
              of: 'includes Election Day voters and non-voters alike',
            },
          ]}
          note={`The county's front page calls the ${pct((early / reg) * 100, 2)} figure
                 "% Voted (Turnout)". It is early-vote share of registered voters —
                 Election Day ballots are not in this report at all, so real turnout
                 is higher by an amount these files cannot tell you.`}
        />
      )}

      <FlowBar
        title="How the early vote was cast"
        question="Of the ballots cast before Election Day, which route did they take?"
        total={early}
        totalLabel="early ballots"
        parts={[
          {
            key: 'ip', label: 'Early in person', value: t.inPerson,
            color: 'var(--s1)', dark: true, of: 'at a county voting site',
          },
          {
            key: 'mail', label: 'Returned by mail or email', value: t.returnedMail,
            color: 'var(--s2)', dark: true,
            of: complete
              ? `${pct((t.returnedMail / returnedAbsentee) * 100, 0)} of the ${fmt(returnedAbsentee)} absentee ballots returned`
              : null,
          },
          {
            key: 'box', label: 'Returned by drop box', value: t.returnedDropbox,
            color: 'var(--s3)',
            of: complete
              ? `${pct((t.returnedDropbox / returnedAbsentee) * 100, 0)} of the same ${fmt(returnedAbsentee)}`
              : null,
          },
        ]}
        note={complete
          ? `The two absentee routes together are ${fmt(returnedAbsentee)} ballots,
             ${pct((returnedAbsentee / early) * 100, 1)} of the early vote — the report's
             "% Voting Absentee by Mail 32%". It prints that beside
             "% Returned by Drop Box 20%", which is a share of absentee ballots
             returned, not of the early vote. Two denominators, one line apart,
             neither of them stated.`
          : `This is a mid-cycle snapshot, so the mix is not the cycle's final one —
             mail ballots return late, and most of this report's had not come back yet.`}
      />

      <FlowBar
        title="What became of the mail ballots"
        question="Every ballot the county mailed or emailed out, and where it ended up."
        total={t.ballotsMailed}
        totalLabel="ballots issued"
        parts={[
          {
            key: 'mail', label: 'Came back by mail or email', value: t.returnedMail,
            color: 'var(--s2)', dark: true,
          },
          {
            key: 'box', label: 'Came back via drop box', value: t.returnedDropbox,
            color: 'var(--s3)',
          },
          {
            key: 'ip', label: 'Requester voted in person instead', value: abIn,
            color: 'var(--seq-250)',
            of: `${pct((abIn / t.inPerson) * 100, 1)} of everyone who voted in person`,
          },
          {
            key: 'none',
            label: complete ? 'Never returned' : 'Not returned as of this report',
            value: unreturned,
            color: NEUTRAL,
            of: t.undeliverable != null
              ? `${fmt(t.undeliverable)} of these came back undeliverable`
              : null,
          },
        ]}
        note={complete
          ? `This bar is the one the county's page does not draw. It prints
             "% Total Returned 74%" — ${fmt(returnedAbsentee)} ÷ ${fmt(t.ballotsMailed)} —
             which counts a requester who gave up on the mail and voted in person
             as a ballot that never came back. Counting them,
             ${pct(((returnedAbsentee + abIn) / t.ballotsMailed) * 100, 1)} of issued
             ballots were accounted for.`
          : `The report stops well before Election Day, so the grey block is mail
             ballots still outstanding on the day it was published, not ballots
             that were abandoned. Only a final report can tell those apart.`}
      />
    </div>
  );
}

/* ------------------------------------------------------------------
   LABEL NOTES — why this component restates two of the county's own
   figures rather than reprinting them.

   "Total Ballots Cast 201,588" is exactly 137,221 + 51,413 + 12,954,
   i.e. early ballots only. In a report published three days after
   Election Day, a reader takes "total ballots cast" to include Election
   Day. It does not. v1 of this site carried the number under that name
   and every derived stat came out as "100% of ballots were early".

   "% Voted (Turnout) 24.89%" is 201,588 / 809,786 — early-vote share of
   registration, not turnout. Same trap.

   Both are surfaced here with their arithmetic shown, under names that
   say what they count. Do not reintroduce the county's labels.
------------------------------------------------------------------ */
