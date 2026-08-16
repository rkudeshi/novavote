/* ------------------------------------------------------------------
   Readable addresses for jurisdictions, elections, and the intersection
   of the two.

     /fairfax-county            everything Fairfax County has ever recorded
     /2025-november             one election, every jurisdiction in it
     /fairfax-county/2025-11    one jurisdiction in one election

   The dataset id (`fairfax-2025-general`) stays the internal key — it is
   what the generated files are named and what gen-data.mjs asserts
   against — but it is not what a URL should say. These slugs are derived
   from the dataset, never stored, so a new locality or cycle addresses
   itself with no table to update.

   `/e/<id>` still resolves; it is redirected to the canonical path
   rather than removed, because those addresses are in the wild.
------------------------------------------------------------------ */
import { parseDate } from './format.js';

const MONTHS = [
  'january', 'february', 'march', 'april', 'may', 'june',
  'july', 'august', 'september', 'october', 'november', 'december',
];

/** Lowercase, hyphenated, punctuation dropped. "Manassas Park City" -> manassas-park-city */
export const slugify = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** A jurisdiction's own page: /fairfax-county */
export const jurisdictionSlug = (locality) => slugify(locality);
export const jurisdictionPath = (locality) => `/${jurisdictionSlug(locality)}`;

/** An election across every jurisdiction: /2025-november */
export function electionSlug(electionDate) {
  const d = parseDate(electionDate);
  return `${d.getFullYear()}-${MONTHS[d.getMonth()]}`;
}
export const electionPath = (electionDate) => `/${electionSlug(electionDate)}`;

/** One jurisdiction in one election: /fairfax-county/2025-11 */
export const cyclePath = (ds) =>
  `${jurisdictionPath(ds.locality)}/${ds.electionDate.slice(0, 7)}`;

/**
 * Which of a URL's shapes this path is, if any.
 *
 * Two single-segment shapes share the same slot — an election slug and a
 * jurisdiction slug — so they are told apart by pattern rather than by
 * lookup order: a year-and-month is an election, anything else is a
 * place. That keeps a future jurisdiction whose name happens to start
 * with digits from silently shadowing an election.
 */
export function matchPath(path) {
  const parts = path.replace(/^\/+|\/+$/g, '').split('/').filter(Boolean);
  if (parts.length === 1) {
    return /^\d{4}-[a-z]+$/.test(parts[0])
      ? { kind: 'election', slug: parts[0] }
      : { kind: 'jurisdiction', slug: parts[0] };
  }
  if (parts.length === 2 && /^\d{4}-\d{2}$/.test(parts[1])) {
    return { kind: 'cycle', slug: parts[0], month: parts[1] };
  }
  return null;
}

/** Every jurisdiction that has at least one dataset, newest cycle first. */
export function jurisdictionsOf(datasets) {
  const by = new Map();
  for (const ds of datasets) {
    const slug = jurisdictionSlug(ds.locality);
    if (!by.has(slug)) {
      by.set(slug, {
        slug,
        name: ds.locality,
        shortName: ds.shortName,
        type: ds.localityType,
        cycles: [],
      });
    }
    by.get(slug).cycles.push(ds);
  }
  for (const j of by.values()) {
    j.cycles.sort((a, b) => b.electionDate.localeCompare(a.electionDate));
  }
  return [...by.values()];
}

/** Every election that has at least one dataset, newest first. */
export function electionsOf(datasets) {
  const by = new Map();
  for (const ds of datasets) {
    const slug = electionSlug(ds.electionDate);
    if (!by.has(slug)) {
      by.set(slug, {
        slug,
        date: ds.electionDate,
        name: ds.electionName,
        cycles: [],
      });
    }
    by.get(slug).cycles.push(ds);
  }
  return [...by.values()].sort((a, b) => b.date.localeCompare(a.date));
}

/**
 * What kind of November election a year holds, in Virginia's four-year
 * cycle: presidential, midterm, statewide (governor), legislative.
 *
 * This is what makes "the comparable prior election" a fact rather than
 * a guess. 2025 belongs beside 2021, not beside 2024 — a governor's race
 * and a presidential race are not the same event, and drawing them as
 * peers is most of why a multi-year turnout chart misleads. Year modulo
 * four separates them exactly.
 */
const KINDS = {
  0: { key: 'presidential', label: 'Presidential' },
  2: { key: 'midterm', label: 'Congressional midterm' },
  1: { key: 'statewide', label: 'Statewide' },
  3: { key: 'legislative', label: 'General Assembly' },
};

export const electionKind = (electionDate) =>
  KINDS[Number(electionDate.slice(0, 4)) % 4];
