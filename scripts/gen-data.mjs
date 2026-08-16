#!/usr/bin/env node
// Compiles the per-cycle CSVs into src/data/generated/*.js.
// Runs automatically before `npm run dev` / `npm run build`.
// Do not hand-edit the output — edit the CSVs (or the scripts that
// produce them: build_csvs.py for 2025, parse_report.py for the rest).

import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'src', 'data', 'generated');

/* ------------------------------------------------------------------
   Cycle registry.

   `coverage` is load-bearing, not documentation. The 2023 and 2024 PDFs
   the project started from are mid-cycle snapshots — the 2024 one stops
   five days into early voting — so their curves must never be presented
   as a full cycle's shape. The same flag is what an in-progress 2026
   cycle will carry while daily pulls are still running.
------------------------------------------------------------------ */
const CYCLES = [
  {
    id: 'fairfax-2025-general',
    dir: 'data',                         // hand-validated, flat layout
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2025',
    localityType: 'county',
    electionName: 'General & Special Elections',
    electionDate: '2025-11-04',
    reportDate: '2025-11-07',
    status: 'Final (county-labeled unofficial)',
    registeredVoters: 809786,
    // NOTE: v1 carried `totalBallotsCast: 201588` and `turnoutPct: 24.89`.
    // Both were mislabelled — 201,588 is exactly the early-vote sum
    // (137,221 + 51,413 + 12,954) and 24.89% is that over registered
    // voters, not turnout including Election Day. Anything derived from
    // them read as "100% of ballots were early", so they are gone;
    // early-vote share of the electorate is computed from the CSVs.
    coverage: { complete: true },
    sourceUrl:
      'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf',
    // Published grand totals, asserted below.
    expect: {
      inPerson: 137221, returnedMail: 51413, returnedDropbox: 12954,
      ballotsMailed: 87547, abInPerson: 1654,
    },
  },
  {
    id: 'fairfax-2024-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2024-general_',
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2024',
    localityType: 'county',
    electionName: 'General Election (presidential)',
    electionDate: '2024-11-05',
    reportDate: '2024-09-24',
    status: 'Mid-cycle snapshot — not a final report',
    coverage: {
      complete: false,
      note:
        'This report is a snapshot taken 24 September 2024, five days into early voting. It is not the end-of-cycle report, so totals here are a small fraction of the eventual 2024 turnout.',
    },
    sourceUrl:
      'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB%20Daily%20Report%20-%20NOV%202024%20-%209.24.pdf',
  },
  {
    id: 'fairfax-2023-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2023-general_',
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2023',
    localityType: 'county',
    electionName: 'General & Special Elections',
    electionDate: '2023-11-07',
    reportDate: '2023-11-04',
    status: 'Final (county-labeled unofficial)',
    registeredVoters: 717440,
    coverage: { complete: true },
    sourceFile: 'data/sources/fairfax-2023-11-final-ab-daily-report.xlsx',
    expect: {
      inPerson: 64382, returnedMail: 30240, returnedDropbox: 6533,
      ballotsMailed: 70465, abInPerson: 850,
    },
  },
  {
    id: 'fairfax-2022-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2022-general_',
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2022',
    localityType: 'county',
    electionName: 'General Election',
    electionDate: '2022-11-08',
    reportDate: '2022-11-08',
    status: 'Final (county-labeled unofficial)',
    registeredVoters: 735000,
    coverage: { complete: true },
    sourceFile: 'data/sources/fairfax-2022-11-final-ab-daily-report.xlsx',
    expect: {
      inPerson: 82168, returnedMail: 45840, returnedDropbox: 12346,
      ballotsMailed: 76338,
    },
  },
  {
    id: 'fairfax-2021-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2021-general_',
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2021',
    localityType: 'county',
    electionName: 'General Election (governor)',
    electionDate: '2021-11-02',
    reportDate: '2021-11-05',
    status: 'Final (county-labeled unofficial)',
    registeredVoters: 730300,
    coverage: { complete: true },
    sourceFile: 'data/sources/fairfax-2021-11-final-ab-daily-report.xlsx',
    expect: {
      inPerson: 109764, returnedMail: 48058, returnedDropbox: 19217,
      ballotsMailed: 82239,
    },
  },
  {
    id: 'fairfax-2020-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2020-general_',
    locality: 'Fairfax County',
    shortLabel: 'Fairfax 2020',
    localityType: 'county',
    electionName: 'General Election (presidential)',
    electionDate: '2020-11-03',
    reportDate: '2020-11-03',
    status: 'Final (county-labeled unofficial)',
    // 2020's report has no Active Voters line, so this cycle carries no
    // registered-voter count and drops out of share-of-electorate views
    // rather than borrowing a neighbouring year's denominator.
    registeredVoters: null,
    coverage: { complete: true },
    sourceFile: 'data/sources/fairfax-2020-11-final-ab-daily-report.xlsx',
    // Mail and drop-box totals are the daily sheets' own; 2020's Summary
    // breaks returns down by congressional district and its columns fall
    // 42 and 125 short of them, being ballots the county never attributed
    // to a district. See scripts/parse_xlsx_report.py.
    expect: {
      inPerson: 193596, returnedMail: 141051, returnedDropbox: 85292,
      ballotsMailed: 268982,
    },
  },
];

/* Sites that changed name between cycles but are the same physical
   location. Mapping the old key onto the current one is what lets a
   site's history join up across elections instead of appearing as two
   unrelated sites that each existed for a while. */
const SITE_ALIASES = {
  providence: { canonical: 'jim_scott', formerly: 'Providence Community Center' },
};

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
  laurel_hill: 'Laurel Hill',
  gerry_hyland: 'Gerry Hyland',
  mason: 'Mason',
  mclean: 'McLean',
  providence: 'Providence',
  sully: 'Sully',
  thomas_jefferson: 'Thomas Jefferson',
  tysons_pimmit: 'Tysons-Pimmit',
  west_springfield: 'West Springfield',
};

/* Site locations come from data/site_locations.json: real addresses
   supplied by the county, geocoded by scripts/geocode_sites.py against the
   Census geocoder — the same reference the boundary geometry comes from,
   so address and outline agree. A site with no coordinate fails the build
   rather than being dropped silently from the map. */
const LOCATIONS = (() => {
  const file = path.join(ROOT, 'data', 'site_locations.json');
  if (!existsSync(file)) return {};
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  return Object.fromEntries(doc.sites.map((s) => [s.key, s]));
})();

/* Elections are ordered by recency, not categorical, so they take steps
   of one sequential ramp — newest darkest. The ramp stops short of very
   pale blue: the oldest cycle still has to be a visible line on a white
   chart, and #cde2fb was not. Cycles index into it proportionally rather
   than one-per-stop, so a sixth and seventh cycle spread across the ramp
   instead of clamping onto the last colour, which is how 2020 and 2021
   ended up identical. */
const RECENCY_RAMP = [
  '#0d366b', '#12457f', '#1c5cab', '#2a78d6',
  '#4a8ce0', '#6da8ea', '#8fbef1', '#a9cef5',
];

function readCsv(file) {
  if (!existsSync(file)) return null;
  const text = readFileSync(file, 'utf8').replace(/\r\n/g, '\n').trim();
  if (!text) return null;
  const [headerLine, ...lines] = text.split('\n');
  const header = headerLine.split(',');
  return lines.map((line) => {
    const cells = line.split(',');
    return Object.fromEntries(header.map((h, i) => [h, cells[i]]));
  });
}

const num = (v) => (v === '' || v === undefined || v === null ? null : Number(v));

/** First column present out of `names`. */
const pick = (row, names) => {
  for (const n of names) if (row && row[n] !== undefined) return n;
  return null;
};

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/* County-level daily weather, one observation per day at the county
   centroid (see scripts/fetch_weather.py). Attached per day so the UI can
   put it beside a turnout figure without a second lookup. */
const WEATHER = (() => {
  const file = path.join(ROOT, 'data', 'weather.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')).cycles || {};
})();

/**
 * Resolve opening hours per (site, date) from data/site_schedules.json.
 *
 * Ordered groups, last match wins: a group applies when its `sites` list
 * contains the site (or is "*") and the date falls in from..to. That
 * ordering is what expresses "everyone does X, except the Government
 * Center" without repeating fifteen site keys, and what lets 2020's
 * mid-cycle extensions override the base schedule for two days.
 *
 * Returns hours: null when a cycle has no schedule at all, which the UI
 * reads as "the per-hour view isn't available" — deliberately distinct
 * from "open zero hours".
 */
const HHMM = (t) => {
  const [h, m] = String(t).split(':').map(Number);
  return h + (m || 0) / 60;
};

function matchGroup(groups, key, date, dow) {
  let found = null;
  for (const g of groups) {
    const forSite = g.sites === '*' || (g.sites || []).includes(key);
    if (!forSite) continue;
    if (g.from && date < g.from) continue;
    if (g.to && date > g.to) continue;
    const block = g[dow === 'sat' ? 'sat' : dow === 'sun' ? 'sun' : 'weekday'];
    if (!block) continue;
    found = { group: g, block };
  }
  return found;
}

function buildSchedule(cycleId, days, siteKeys) {
  const file = path.join(ROOT, 'data', 'site_schedules.json');
  if (!existsSync(file)) return { hours: null, gaps: [], schedule: null };
  const conf = JSON.parse(readFileSync(file, 'utf8')).cycles?.[cycleId];
  if (!conf?.groups?.length) return { hours: null, gaps: [], schedule: null };

  const hours = {};
  const gaps = [];
  for (const key of siteKeys) {
    for (const d of days) {
      // Only days the site actually recorded ballots need hours; "not
      // open" is a fact the ballot data already carries.
      if (d.sites[key] == null) continue;
      const dow = DOW[new Date(`${d.date}T00:00:00`).getDay()];
      const hit = matchGroup(conf.groups, key, d.date, dow);
      if (!hit) {
        gaps.push(`${key} ${d.date}`);
        continue;
      }
      const [open, close] = hit.block;
      (hours[key] ||= {})[d.date] = Math.round((HHMM(close) - HHMM(open)) * 100) / 100;
    }
  }

  /* The schedule is published on the page as well as divided by, so the
     groups travel with the dataset rather than staying a build-time
     detail. Hours are what the county scheduled; a site's actual open
     days come from the ballot data. */
  const schedule = {
    note: conf.note || null,
    groups: conf.groups.map((g) => ({
      label: g.label,
      sites: g.sites,
      from: g.from,
      to: g.to,
      weekday: g.weekday || null,
      sat: g.sat || null,
      sun: g.sun || null,
    })),
  };
  return { hours, gaps, schedule };
}

function buildCycle(cycle) {
  const base = path.join(ROOT, cycle.dir);
  const f = (name) => path.join(base, `${cycle.prefix || ''}${name}.csv`);

  const early = readCsv(f('early_in_person_by_site'));
  const mail = readCsv(f('returned_by_mail'));
  const drop = readCsv(f('returned_by_dropbox'));
  const mailed = readCsv(f('mailed_absentee_ballots'));
  /* Mail-ballot requesters who showed up and voted in person instead.
     This is the one number that closes the ballot funnel: without it a
     mailed ballot that was never returned is indistinguishable from one
     whose requester voted another way. */
  const abApp = readCsv(f('ab_applicants_voted_early_in_person'));

  if (!early) throw new Error(`gen-data: no early-voting CSV for ${cycle.id} (${f('early_in_person_by_site')})`);

  const rawSiteKeys = Object.keys(early[0]).filter((k) => k !== 'date' && k !== 'total');
  const canon = (k) => SITE_ALIASES[k]?.canonical ?? k;
  const siteKeys = [...new Set(rawSiteKeys.map(canon))];

  const unknown = siteKeys.filter((k) => !SITE_LABELS[k]);
  if (unknown.length) throw new Error(`gen-data: ${cycle.id} has unlabelled sites: ${unknown.join(', ')}`);

  // A renamed site must never appear twice in one cycle's roster — that
  // would silently double-count it.
  for (const [raw, alias] of Object.entries(SITE_ALIASES)) {
    if (rawSiteKeys.includes(raw) && rawSiteKeys.includes(alias.canonical)) {
      throw new Error(
        `gen-data: ${cycle.id} lists both "${raw}" and "${alias.canonical}", which are aliased to the same site`,
      );
    }
  }

  /** Sum a canonical site's value on a row, following aliases. */
  const siteValue = (row, key) => {
    const sources = rawSiteKeys.filter((r) => canon(r) === key);
    let out = null;
    for (const r of sources) {
      const v = num(row[r]);
      if (v !== null) out = (out ?? 0) + v;
    }
    return out;
  };

  const mailTotalCol = mail && pick(mail[0], ['total_returned']);
  const dropTotalCol = drop && pick(drop[0], ['total_returned_dropbox']);
  const mailedTotalCol = mailed && pick(mailed[0], ['total_mailed']);
  const abTotalCol = abApp && pick(abApp[0], ['total']);
  // 2023's report has no undeliverable column at all — optional, not zero.
  const undelivCol = mail && pick(mail[0], ['undeliverable_subset_of_mail', 'undeliverable']);

  const byDate = (rows) => Object.fromEntries((rows || []).map((r) => [r.date, r]));
  const earlyBy = byDate(early);
  const mailBy = byDate(mail);
  const dropBy = byDate(drop);
  const mailedBy = byDate(mailed);
  const abBy = byDate(abApp);

  const allDates = [...new Set([
    ...Object.keys(earlyBy), ...Object.keys(mailBy),
    ...Object.keys(dropBy), ...Object.keys(mailedBy),
  ])].sort();

  const days = allDates.map((d) => {
    const e = earlyBy[d];
    const sites = {};
    if (e) {
      for (const k of siteKeys) {
        const v = siteValue(e, k);
        if (v !== null) sites[k] = v;
      }
    }
    return {
      date: d,
      weather: WEATHER[cycle.id]?.[d] ?? null,
      inPerson: e ? num(e.total) : null,
      sites,
      returnedMail: mailBy[d] && mailTotalCol ? num(mailBy[d][mailTotalCol]) : null,
      returnedDropbox: dropBy[d] && dropTotalCol ? num(dropBy[d][dropTotalCol]) : null,
      ballotsMailed: mailedBy[d] && mailedTotalCol ? num(mailedBy[d][mailedTotalCol]) : null,
      abInPerson: abBy[d] && abTotalCol ? num(abBy[d][abTotalCol]) : null,
    };
  });

  const sum = (rows, col) =>
    (rows || []).reduce((s, r) => s + (num(r[col]) || 0), 0);

  const totals = {
    inPerson: sum(early, 'total'),
    returnedMail: mailTotalCol ? sum(mail, mailTotalCol) : 0,
    returnedDropbox: dropTotalCol ? sum(drop, dropTotalCol) : 0,
    ballotsMailed: mailedTotalCol ? sum(mailed, mailedTotalCol) : 0,
    abInPerson: abTotalCol ? sum(abApp, abTotalCol) : 0,
    /* Undeliverable is best-effort on 14 of 2025's dates (see
       data/README.md) and absent entirely from 2023, so it is carried
       as null rather than 0 when the column does not exist. */
    undeliverable: undelivCol ? sum(mail, undelivCol) : null,
  };

  // Where published grand totals are known, a mismatch fails the build
  // rather than shipping silently wrong figures.
  if (cycle.expect) {
    for (const [k, want] of Object.entries(cycle.expect)) {
      if (totals[k] !== want) {
        throw new Error(`gen-data: ${cycle.id} ${k} = ${totals[k]}, expected ${want}`);
      }
    }
  }

  const sites = siteKeys.map((k) => {
    const total = early.reduce((s, r) => s + (siteValue(r, k) || 0), 0);
    const openRow = early.find((r) => siteValue(r, k) !== null);
    const renamed = Object.values(SITE_ALIASES).find(
      (a) => a.canonical === k && rawSiteKeys.includes(
        Object.keys(SITE_ALIASES).find((raw) => SITE_ALIASES[raw] === a)),
    );
    return {
      key: k,
      label: SITE_LABELS[k],
      // Under the name this cycle's report actually used, so a historic
      // page doesn't claim a name the site didn't have yet.
      ...(renamed ? { formerly: renamed.formerly } : {}),
      total,
      opened: openRow ? openRow.date : null,
      lat: LOCATIONS[k]?.lat ?? null,
      lon: LOCATIONS[k]?.lon ?? null,
      address: LOCATIONS[k]
        ? `${LOCATIONS[k].address}, ${LOCATIONS[k].city}, ${LOCATIONS[k].state} ${LOCATIONS[k].zip}`
        : null,
      venue: LOCATIONS[k]?.name ?? null,
    };
  })
    // A site the report lists but that recorded nothing in this snapshot
    // isn't a site people voted at — carrying it would invent 13 empty
    // rows in every per-site view.
    .filter((s) => s.total > 0);

  const active = days.filter(
    (d) => (d.inPerson || 0) + (d.returnedMail || 0) + (d.returnedDropbox || 0) > 0,
  );
  const dataThrough = active.length ? active[active.length - 1].date : null;
  const MS = 86400000;
  const daysBeforeElection = dataThrough
    ? Math.round((new Date(cycle.electionDate) - new Date(dataThrough)) / MS)
    : null;

  const wxDays = days.filter((d) => d.weather).length;
  if (WEATHER[cycle.id] && wxDays < days.length) {
    console.warn(
      `gen-data: ${cycle.id} has weather for ${wxDays}/${days.length} days`,
    );
  }

  const { hours, gaps, schedule } = buildSchedule(
    cycle.id, days, sites.map((s) => s.key),
  );
  if (gaps.length) {
    console.warn(
      `gen-data: ${cycle.id} has a schedule but no hours for ${gaps.length} ` +
        `site-days (e.g. ${gaps.slice(0, 3).join(', ')}) — those cells will be blank per-hour`,
    );
  }

  const { expect, dir, prefix, ...meta } = cycle;
  return {
    ...meta,
    coverage: { ...cycle.coverage, dataThrough, daysBeforeElection },
    totals,
    sites,
    days,
    hours,
    schedule,
  };
}

/* Site coordinates are hand-stubbed and still awaiting real geocoding.
   They are plotted on a real county boundary, which makes them look
   authoritative — so at minimum assert every one falls inside the
   county. A typo that lands a site in Maryland fails the build. */
function checkCoords(datasets) {
  const boundaryFile = path.join(ROOT, 'src', 'data', 'fairfax-boundary.json');
  if (!existsSync(boundaryFile)) {
    console.warn('gen-data: no boundary file yet — skipping site coordinate check');
    return;
  }
  const boundary = JSON.parse(readFileSync(boundaryFile, 'utf8'));
  const county = boundary.features.find((f) => f.role === 'county');

  const inRing = ([x, y], ring) => {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
        inside = !inside;
      }
    }
    return inside;
  };

  for (const ds of datasets) {
    for (const s of ds.sites) {
      if (s.lat == null || s.lon == null) {
        throw new Error(
          `gen-data: ${ds.id} site "${s.key}" has no coordinates. Add its address to ` +
            `data/site_locations.json and run scripts/geocode_sites.py (CI does this).`,
        );
      }
      if (!county.rings.some((r) => inRing([s.lon, s.lat], r))) {
        throw new Error(
          `gen-data: ${ds.id} site "${s.key}" at ${s.lat},${s.lon} is outside the county boundary`,
        );
      }
    }
  }
}

const built = CYCLES.map(buildCycle)
  .sort((a, b) => b.electionDate.localeCompare(a.electionDate))
  .map((ds, i, arr) => ({
    ...ds,
    color: RECENCY_RAMP[
      arr.length <= 1
        ? 0
        : Math.round((i / (arr.length - 1)) * (RECENCY_RAMP.length - 1))
    ],
  }));

checkCoords(built);

mkdirSync(OUT_DIR, { recursive: true });
for (const ds of built) {
  writeFileSync(
    path.join(OUT_DIR, `${ds.id}.js`),
    `// AUTO-GENERATED by scripts/gen-data.mjs. Do not hand-edit.\n` +
      `export default ${JSON.stringify(ds, null, 2)};\n`,
  );
}
writeFileSync(
  path.join(OUT_DIR, 'index.js'),
  `// AUTO-GENERATED by scripts/gen-data.mjs. Do not hand-edit.\n` +
    built.map((ds) => `import ${ds.id.replace(/-/g, '_')} from './${ds.id}.js';`).join('\n') +
    `\n\nexport const DATASETS = [\n` +
    built.map((ds) => `  ${ds.id.replace(/-/g, '_')},`).join('\n') +
    `\n];\n`,
);

console.log('gen-data:');
for (const ds of built) {
  console.log(
    `  ${ds.id.padEnd(24)} ${String(ds.sites.length).padStart(2)} sites, ` +
      `${String(ds.days.length).padStart(2)} days, ` +
      `${ds.totals.inPerson.toLocaleString().padStart(8)} in person, ` +
      `${ds.coverage.complete ? 'complete' : `PARTIAL through ${ds.coverage.dataThrough}`}`,
  );
}
