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
import { cyclePath, jurisdictionPath } from '../lib/slugs.js';

const EMPTY = {
  total: null, inPerson: null, vbm: null, href: null, home: null,
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
    href: cyclePath(ds),
    /* The jurisdiction's own page, which spans every cycle it has —
       distinct from the link above, which is this one election. */
    home: jurisdictionPath(ds.locality),
    registered: reg,
    /* Early ballots over registration. Not turnout — Election Day is not
       in these files — but it is the one measure that compares a county
       of 810,000 with a city of 10,000 on equal footing. */
    turnout: reg ? (m.early / reg) * 100 : null,
    sites: ds.detail.sites ? ds.sites.length : null,
    peak: peakDay(ds),
    closing7: closingShare(ds, 7),
    mailReturn: ds.totals.ballotsMailed
      ? (m.vbm / ds.totals.ballotsMailed) * 100
      : null,
  };
}

/* Fairfax points at its own daily report; every other jurisdiction
   points at the locality baseline built from the statewide daily file.
   Both are reconciled datasets — see the locality-cycle notes in
   scripts/gen-data.mjs — so both belong here. */
const SCOPE = [
  { key: 'fairfax_county', name: 'Fairfax County', datasetId: 'fairfax-2025-general' },
  { key: 'loudoun', name: 'Loudoun County', datasetId: 'loudoun-2025-general' },
  { key: 'prince_william', name: 'Prince William County', datasetId: 'prince-william-2025-general' },
  { key: 'arlington', name: 'Arlington County', datasetId: 'arlington-2025-general' },
  { key: 'alexandria', name: 'Alexandria City', datasetId: 'alexandria-2025-general' },
  { key: 'fairfax_city', name: 'Fairfax City', datasetId: 'fairfax-city-2025-general' },
  { key: 'falls_church', name: 'Falls Church City', datasetId: 'falls-church-2025-general' },
  { key: 'manassas', name: 'Manassas City', datasetId: 'manassas-2025-general' },
  { key: 'manassas_park', name: 'Manassas Park City', datasetId: 'manassas-park-2025-general' },
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
  /* Computed over the jurisdictions that have a registration count and
     no others — nine jurisdictions' ballots over one jurisdiction's
     electorate is not a turnout figure. `turnoutCovers` says how many
     went into it so the page can name its own scope instead of implying
     the region. */
  ...(() => {
    const known = withData.filter((j) => j.registered);
    const ballots = known.reduce((s, j) => s + j.total, 0);
    const voters = known.reduce((s, j) => s + j.registered, 0);
    return {
      turnout: voters ? (ballots / voters) * 100 : null,
      turnoutVoters: voters || null,
      turnoutCovers: known.length,
    };
  })(),
  /* How the region as a whole split between the two ways of voting —
     available for every jurisdiction, unlike the turnout figure. */
  inPersonShare: withData.length
    ? (withData.reduce((s, j) => s + j.inPerson, 0)
       / withData.reduce((s, j) => s + j.total, 0)) * 100
    : null,
};
