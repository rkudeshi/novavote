/* ------------------------------------------------------------------
   Derived metrics.

   Everything here is computed from the generated datasets at render
   time rather than baked into the data files, so adding a locality or a
   cycle needs no changes here — the same functions describe it.

   Key idea for cross-election / cross-jurisdiction comparison: index
   every series to *days until Election Day* rather than calendar date.
   A Nov 2023 Tuesday and a Nov 2025 Tuesday aren't comparable by date,
   but "14 days out" is the same moment in both cycles.
------------------------------------------------------------------ */
import { daysUntil, isWeekend } from './format.js';

/** Total early ballots (all methods) recorded on a given day. */
export function dayTotal(d) {
  return (d.inPerson || 0) + (d.returnedMail || 0) + (d.returnedDropbox || 0);
}

/** Sum of every early ballot in a dataset, all methods. */
export function earlyTotal(ds) {
  const t = ds.totals;
  return t.inPerson + t.returnedMail + t.returnedDropbox;
}

/**
 * Per-day series indexed to days-until-election, with running totals and
 * each day's share of the cycle's early vote. Days with no activity at
 * all are dropped so weekends/holidays don't flatten the curve.
 */
export function timeline(ds) {
  const total = earlyTotal(ds);
  let run = 0;
  return ds.days
    .map((d) => {
      const v = dayTotal(d);
      run += v;
      return {
        date: d.date,
        daysOut: daysUntil(d.date, ds.electionDate),
        weekend: isWeekend(d.date),
        value: v,
        inPerson: d.inPerson || 0,
        returnedMail: d.returnedMail || 0,
        returnedDropbox: d.returnedDropbox || 0,
        cumulative: run,
        share: total ? (v / total) * 100 : 0,
        cumulativeShare: total ? (run / total) * 100 : 0,
        /* Share of the whole registered electorate voting that day —
           the cross-jurisdiction apples-to-apples measure, since it
           divides out how big the locality is. */
        electorateShare: ds.registeredVoters ? (v / ds.registeredVoters) * 100 : 0,
      };
    })
    .filter((r) => r.value > 0);
}

/** The single busiest early-voting day of a cycle. */
export function peakDay(ds) {
  return timeline(ds).reduce((a, b) => (b.value > a.value ? b : a));
}

export const isComplete = (ds) => ds.coverage?.complete !== false;

/**
 * Share of the cycle's early vote cast in the final `n` days.
 *
 * Null for a cycle whose data stops before that window: a snapshot that
 * ends five days into early voting has no final week, and reporting 0%
 * would read as "nobody voted late" rather than "we don't know".
 */
export function closingShare(ds, n = 7) {
  if (!isComplete(ds)) return null;
  const rows = timeline(ds);
  const total = rows.reduce((s, r) => s + r.value, 0);
  const late = rows.filter((r) => r.daysOut <= n).reduce((s, r) => s + r.value, 0);
  return total ? (late / total) * 100 : 0;
}

/** Headline numbers for a dataset, shared by the home cards and detail page. */
export function summary(ds) {
  const early = earlyTotal(ds);
  const peak = peakDay(ds);
  return {
    early,
    peak,
    complete: isComplete(ds),
    closing7: closingShare(ds, 7),
    earlyShareOfBallots: ds.totalBallotsCast ? (early / ds.totalBallotsCast) * 100 : null,
    earlyTurnoutOfRegistered: ds.registeredVoters ? (early / ds.registeredVoters) * 100 : null,
    votingDays: timeline(ds).length,
  };
}

/**
 * Per-site daily *deviation* from the countywide pattern.
 *
 * A raw site x day heatmap is nearly featureless: every site rises into
 * Election Day, so each row is a copy of the county curve. Dividing each
 * site's daily share by its overall share removes that shared trend and
 * leaves only the site-specific signal — who runs early, who runs late,
 * who owns the weekends. Values are ratios: 1 = exactly on pattern.
 */
export function siteDeviation(ds) {
  const days = ds.days.filter((d) => d.inPerson > 0 && Object.keys(d.sites).length);
  const countyTotal = days.reduce((s, d) => s + d.inPerson, 0);

  return ds.sites.map((site) => {
    const siteTotal = site.total;
    const expectedShare = countyTotal ? siteTotal / countyTotal : 0;
    const cells = days.map((d) => {
      const v = d.sites[site.key];
      if (v == null) return { date: d.date, open: false, ratio: null, value: null };
      const actual = d.inPerson ? v / d.inPerson : 0;
      return {
        date: d.date,
        daysOut: daysUntil(d.date, ds.electionDate),
        open: true,
        value: v,
        ratio: expectedShare ? actual / expectedShare : null,
      };
    });
    const openCells = cells.filter((c) => c.open && c.ratio != null);
    /* Positive tilt = this site's vote came in later than the county's. */
    const half = Math.floor(openCells.length / 2);
    const firstHalf = openCells.slice(0, half);
    const lastHalf = openCells.slice(half);
    const avg = (xs) => (xs.length ? xs.reduce((s, c) => s + c.ratio, 0) / xs.length : 1);
    return {
      ...site,
      cells,
      tilt: avg(lastHalf) - avg(firstHalf),
    };
  });
}

/**
 * Per-site totals plus a rate.
 *
 * Sites open on different dates — in 2025 three ran for 46 days and
 * thirteen for ten — so a raw total mostly measures how long a site was
 * open. Ballots per day open is the like-for-like measure; the map
 * offers both because the gap between them is itself informative.
 */
export function siteStats(ds) {
  return ds.sites.map((site) => {
    const openDays = ds.days.filter((d) => d.sites[site.key] != null).length;
    const values = ds.days
      .map((d) => d.sites[site.key])
      .filter((v) => v != null);
    const busiest = values.length ? Math.max(...values) : 0;
    return {
      ...site,
      openDays,
      perDay: openDays ? site.total / openDays : 0,
      busiest,
      shareOfInPerson: ds.totals.inPerson
        ? (site.total / ds.totals.inPerson) * 100
        : 0,
    };
  });
}

/** Datasets newest-first, which is the order every listing uses. */
export function byRecency(datasets) {
  return [...datasets].sort((a, b) => b.electionDate.localeCompare(a.electionDate));
}
