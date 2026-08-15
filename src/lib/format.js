export const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-US'));

/**
 * Percentages, with precision that follows magnitude.
 *
 * At or above 10% a tenth is noise — "68.1%" and "68%" carry the same
 * meaning and the decimal only adds width. Below 10% the tenth is doing
 * real work: 6.4% and 6% are visibly different shares, and small site
 * shares would otherwise collapse into a handful of identical integers.
 *
 * Pass `digits` explicitly to override (0 forces whole numbers).
 */
export const pct = (n, digits) => {
  if (n == null || !isFinite(n)) return '—';
  const d = digits != null ? digits : Math.abs(n) >= 10 ? 0 : 1;
  return `${n.toFixed(d)}%`;
};

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse an ISO date as a *local* calendar date (no UTC shift). */
export function parseDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function shortDate(s) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export function longDate(s) {
  const d = parseDate(s);
  return `${DOW[d.getDay()]} ${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}`;
}

export function fullDate(s) {
  return parseDate(s).toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });
}

export const dayOfWeek = (s) => DOW[parseDate(s).getDay()];
export const isWeekend = (s) => [0, 6].includes(parseDate(s).getDay());

/** Whole days from `date` until `electionDate` (0 = Election Day). */
export function daysUntil(date, electionDate) {
  const MS = 86400000;
  return Math.round((parseDate(electionDate) - parseDate(date)) / MS);
}
