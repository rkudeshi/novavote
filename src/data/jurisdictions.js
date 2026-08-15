/* ------------------------------------------------------------------
   Northern Virginia jurisdictions in scope.

   Figures are only ever present here when they came from a dataset this
   repo has actually reconciled. A jurisdiction with no verified numbers
   carries `total: null` and renders as "no figures recorded yet" — it is
   never filled with an estimate, a rounded press figure, or a number
   carried over from another cycle. The whole site's premise is that
   every printed figure reconciles, and a plausible-looking placeholder
   on the home page would quietly break that.

   To add one: land its daily CSVs, register the cycle in
   scripts/gen-data.mjs, then point `datasetId` at it here.
------------------------------------------------------------------ */
import { DATASETS } from './generated/index.js';
import { closingShare, methodTotals, peakDay } from '../lib/derive.js';

const EMPTY = {
  total: null, inPerson: null, vbm: null, href: null,
  registered: null, turnout: null, sites: null, peak: null,
  closing7: null, mailReturn: null,
};

/** Pull reconciled totals out of a generated dataset, if we have it. */
function fromDataset(id) {
  const ds = DATASETS.find((d) => d.id === id);
  if (!ds) return EMPTY;
  const m = methodTotals(ds);
  const reg = ds.registeredVoters || null;
  return {
    total: m.early,
    inPerson: m.inPerson,
    vbm: m.vbm,
    href: `/e/${ds.id}`,
    registered: reg,
    /* Early ballots over registration. Not turnout — Election Day is not
       in these files — but it is the one measure that compares a county
       of 810,000 with a city of 10,000 on equal footing. */
    turnout: reg ? (m.early / reg) * 100 : null,
    sites: ds.sites.length,
    peak: peakDay(ds),
    closing7: closingShare(ds, 7),
    mailReturn: ds.totals.ballotsMailed
      ? (m.vbm / ds.totals.ballotsMailed) * 100
      : null,
  };
}

const SCOPE = [
  { key: 'fairfax_county', name: 'Fairfax County', datasetId: 'fairfax-2025-general' },
  { key: 'loudoun', name: 'Loudoun County' },
  { key: 'prince_william', name: 'Prince William County' },
  { key: 'arlington', name: 'Arlington County' },
  { key: 'alexandria', name: 'Alexandria City' },
  { key: 'fairfax_city', name: 'Fairfax City' },
  { key: 'falls_church', name: 'Falls Church City' },
];

export const JURISDICTIONS = SCOPE.map((j) => ({
  ...j,
  ...(j.datasetId ? fromDataset(j.datasetId) : EMPTY),
})).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

const withData = JURISDICTIONS.filter((j) => j.total != null);

export const NOV2025 = {
  reporting: withData.length,
  inScope: SCOPE.length,
  totals: {
    early: withData.reduce((s, j) => s + j.total, 0),
    inPerson: withData.reduce((s, j) => s + j.inPerson, 0),
    vbm: withData.reduce((s, j) => s + j.vbm, 0),
    registered: withData.reduce((s, j) => s + (j.registered || 0), 0),
  },
  /* Only meaningful while every reporting jurisdiction has a registered
     count; null the moment one doesn't, rather than dividing by a
     partial denominator. */
  turnout: withData.length && withData.every((j) => j.registered)
    ? (withData.reduce((s, j) => s + j.total, 0)
       / withData.reduce((s, j) => s + j.registered, 0)) * 100
    : null,
};
