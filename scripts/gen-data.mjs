#!/usr/bin/env node
// Generates src/data/generated/*.js from the validated CSVs in data/.
// Runs automatically before `npm run dev` / `npm run build` (see package.json
// "predev"/"prebuild"). Do not hand-edit the generated output — edit the
// CSVs (or scripts/build_csvs.py, which produces them) instead.
//
// This is a JS port of scripts/gen_data.py, kept in sync with it so the
// frontend build doesn't require Python. If you change one, change both.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'generated');

function readCsv(name) {
  const text = readFileSync(path.join(DATA_DIR, name), 'utf8').replace(/\r\n/g, '\n').trim();
  const [headerLine, ...lines] = text.split('\n');
  const header = headerLine.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    const row = {};
    header.forEach((h, i) => { row[h] = cells[i]; });
    return row;
  });
}

function num(v) {
  return v === '' || v === undefined || v === null ? null : Number(v);
}

const early = readCsv('early_in_person_by_site.csv');
const mail = readCsv('returned_by_mail.csv');
const drop = readCsv('returned_by_dropbox.csv');
const mailed = readCsv('mailed_absentee_ballots.csv');

const SITE_KEYS = Object.keys(early[0]).filter((k) => k !== 'date' && k !== 'total');

const SITE_LABELS = {
  government_center: 'Government Center',
  mt_vernon: 'Mt. Vernon',
  north_county: 'North County',
  burke: 'Burke',
  centreville: 'Centreville',
  franconia: 'Franconia',
  great_falls: 'Great Falls',
  herndon_fortnightly: 'Herndon Fortnightly',
  jim_scott: 'Jim Scott',
  lorton: 'Lorton',
  mason: 'Mason',
  mclean: 'McLean',
  sully: 'Sully',
  thomas_jefferson: 'Thomas Jefferson',
  tysons_pimmit: 'Tysons-Pimmit',
  west_springfield: 'West Springfield',
};

// Approximate coordinates for the Fairfax County early voting sites
// (community centers / govt buildings). Rounded; for map plotting these
// should be replaced with authoritative geocodes.
const SITE_COORDS = {
  government_center: [38.8554, -77.3607],
  mt_vernon: [38.7293, -77.1043],
  north_county: [38.9526, -77.3494],
  burke: [38.7934, -77.2717],
  centreville: [38.8401, -77.4386],
  franconia: [38.7712, -77.1524],
  great_falls: [39.0018, -77.2872],
  herndon_fortnightly: [38.9696, -77.3861],
  jim_scott: [38.8676, -77.2280],
  lorton: [38.7009, -77.2278],
  mason: [38.8462, -77.1520],
  mclean: [38.9343, -77.1775],
  sully: [38.8879, -77.4344],
  thomas_jefferson: [38.8462, -77.1861],
  tysons_pimmit: [38.9021, -77.1936],
  west_springfield: [38.7743, -77.2158],
};

const mailByDate = Object.fromEntries(mail.map((r) => [r.date, r]));
const dropByDate = Object.fromEntries(drop.map((r) => [r.date, r]));
const mailedByDate = Object.fromEntries(mailed.map((r) => [r.date, r]));
const earlyByDate = Object.fromEntries(early.map((r) => [r.date, r]));

const allDates = [...new Set([
  ...Object.keys(mailByDate), ...Object.keys(dropByDate),
  ...Object.keys(mailedByDate), ...early.map((r) => r.date),
])].sort();

const days = allDates.map((d) => {
  const e = earlyByDate[d];
  const m = mailByDate[d];
  const dr = dropByDate[d];
  const ml = mailedByDate[d];
  const sites = {};
  if (e) {
    for (const k of SITE_KEYS) {
      const v = num(e[k]);
      if (v !== null) sites[k] = v;
    }
  }
  return {
    date: d,
    inPerson: e ? num(e.total) : null,
    sites,
    returnedMail: m ? num(m.total_returned) : null,
    returnedDropbox: dr ? num(dr.total_returned_dropbox) : null,
    ballotsMailed: ml ? num(ml.total_mailed) : null,
  };
});

const siteTotals = {};
for (const k of SITE_KEYS) {
  siteTotals[k] = early.reduce((sum, r) => sum + (num(r[k]) || 0), 0);
}

const firstOpen = {};
for (const k of SITE_KEYS) {
  const row = early.find((r) => num(r[k]) !== null);
  if (row) firstOpen[k] = row.date;
}

const sitesMeta = SITE_KEYS.map((k) => ({
  key: k,
  label: SITE_LABELS[k],
  total: siteTotals[k],
  opened: firstOpen[k],
  lat: SITE_COORDS[k][0],
  lon: SITE_COORDS[k][1],
}));

const FAIRFAX_2025 = {
  id: 'fairfax-2025-general',
  locality: 'Fairfax County',
  localityType: 'county',
  electionName: 'General & Special Elections',
  electionDate: '2025-11-04',
  reportDate: '2025-11-07',
  status: 'Final (county-labeled unofficial)',
  registeredVoters: 809786,
  totalBallotsCast: 201588,
  turnoutPct: 24.89,
  totals: {
    ballotsMailed: 87547,
    returnedMail: 51413,
    returnedDropbox: 12954,
    inPerson: 137221,
    abApplicantsVotedInPerson: 1654,
  },
  sourceUrl: 'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf',
  sites: sitesMeta,
  days,
};

// Sanity checks — mirror the assertions in scripts/build_csvs.py so a bad
// regeneration fails the build loudly instead of shipping silently wrong data.
const checks = [
  ['ballotsMailed', mailed.reduce((s, r) => s + (num(r.total_mailed) || 0), 0)],
  ['returnedMail', mail.reduce((s, r) => s + (num(r.total_returned) || 0), 0)],
  ['returnedDropbox', drop.reduce((s, r) => s + (num(r.total_returned_dropbox) || 0), 0)],
  ['inPerson', early.reduce((s, r) => s + (num(r.total) || 0), 0)],
];
for (const [key, sum] of checks) {
  if (sum !== FAIRFAX_2025.totals[key]) {
    throw new Error(`gen-data: ${key} CSV sum ${sum} != published total ${FAIRFAX_2025.totals[key]}`);
  }
}

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  path.join(OUT_DIR, 'fairfax-2025.js'),
  `// AUTO-GENERATED by scripts/gen-data.mjs from data/*.csv. Do not hand-edit.\n` +
  `export const FAIRFAX_2025 = ${JSON.stringify(FAIRFAX_2025, null, 2)};\n`,
);
writeFileSync(
  path.join(OUT_DIR, 'index.js'),
  `// AUTO-GENERATED by scripts/gen-data.mjs. Do not hand-edit.\n` +
  `export { FAIRFAX_2025 } from './fairfax-2025.js';\n` +
  `import { FAIRFAX_2025 } from './fairfax-2025.js';\n\n` +
  `// One dataset object per locality-election. To add a jurisdiction, append\n` +
  `// here — no UI changes needed elsewhere.\n` +
  `export const DATASETS = [FAIRFAX_2025];\n`,
);

console.log(`gen-data: wrote ${sitesMeta.length} sites, ${days.length} days -> src/data/generated/`);
