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
import { methodTotals } from '../lib/derive.js';

/** Pull reconciled totals out of a generated dataset, if we have it. */
function fromDataset(id) {
  const ds = DATASETS.find((d) => d.id === id);
  if (!ds) return { total: null, inPerson: null, vbm: null, href: null };
  const m = methodTotals(ds);
  return { total: m.early, inPerson: m.inPerson, vbm: m.vbm, href: `/e/${ds.id}` };
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
  ...(j.datasetId
    ? fromDataset(j.datasetId)
    : { total: null, inPerson: null, vbm: null, href: null }),
})).sort((a, b) => (b.total ?? -1) - (a.total ?? -1));

const withData = JURISDICTIONS.filter((j) => j.total != null);

export const NOV2025 = {
  reporting: withData.length,
  inScope: SCOPE.length,
  totals: {
    early: withData.reduce((s, j) => s + j.total, 0),
    inPerson: withData.reduce((s, j) => s + j.inPerson, 0),
    vbm: withData.reduce((s, j) => s + j.vbm, 0),
  },
};
