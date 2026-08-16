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
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2025',
    localityType: 'county',
    electionName: 'General & Special Elections',
    electionDate: '2025-11-04',
    reportDate: '2025-11-07',
    status: 'Final (county-labeled unofficial)',
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
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2024',
    localityType: 'county',
    electionName: 'General Election (presidential)',
    electionDate: '2024-11-05',
    reportDate: '2024-11-07',
    status: 'Final (county-labeled unofficial)',
    coverage: {
      complete: true,
      /* Shown on the page. The per-site split is withheld rather than
         published unverified: one page of this report's text layer is
         scrambled and seven site columns come up short of their own
         printed totals. Every county-level column reconciles exactly,
         which is why the cycle ships at all. */
      note:
        'Turnout by individual voting site is not available for this election; the countywide daily figures are.',
    },
    sourceUrl:
      'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB%20Daily%20Report%20-%20NOV%202024%20-%2011.07.pdf',
    expect: {
      inPerson: 239326, returnedMail: 69977, returnedDropbox: 23678,
      ballotsMailed: 114183, abInPerson: 5127,
    },
  },
  {
    id: 'fairfax-2023-general',
    dir: 'data/parsed',
    prefix: 'fairfax-2023-general_',
    locality: 'Fairfax County',
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2023',
    localityType: 'county',
    electionName: 'General & Special Elections',
    electionDate: '2023-11-07',
    reportDate: '2023-11-04',
    status: 'Final (county-labeled unofficial)',
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
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2022',
    localityType: 'county',
    electionName: 'General Election',
    electionDate: '2022-11-08',
    reportDate: '2022-11-08',
    status: 'Final (county-labeled unofficial)',
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
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2021',
    localityType: 'county',
    electionName: 'General Election (governor)',
    electionDate: '2021-11-02',
    reportDate: '2021-11-05',
    status: 'Final (county-labeled unofficial)',
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
    shortName: 'Fairfax',
    shortLabel: 'Fairfax 2020',
    localityType: 'county',
    electionName: 'General Election (presidential)',
    electionDate: '2020-11-03',
    reportDate: '2020-11-03',
    status: 'Final (county-labeled unofficial)',
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

/* ------------------------------------------------------------------
   Locality baseline cycles.

   Fairfax publishes a daily operational report; no other Northern
   Virginia locality does. What every locality has is the state's daily
   absentee file, which carries two cumulative counts — early ballots
   cast in person, and mail ballots returned — and nothing else.
   scripts/parse_dal.py differences those daily snapshots into a per-day
   series; this builds the same dataset shape from it.

   This is the template every non-Fairfax jurisdiction uses, and the
   floor Fairfax sits above rather than a different kind of thing. The
   fields that genuinely do not exist here are carried as **null, never
   zero**: there is no site breakdown, no mail-versus-drop-box split, no
   daily ballots-issued count, and no surrendered-ballot count. `detail`
   is what the UI reads — a section that needs one of those checks the
   flag rather than inferring absence from a zero, which would otherwise
   render as "0 ballots returned by drop box".

   Two things about this series differ from a county report and both are
   real, not artefacts:

     * In-person moves on the day a ballot is cast, so that curve is
       activity. Mail moves when a ballot is *processed*, which mostly
       happens after Election Day — so mail keeps climbing for a week
       past the election. Those days are kept (a mail ballot returned
       before Election Day is an early ballot whenever it gets scanned)
       and the report cycles already do the same thing.
     * A daily figure can be negative where a record's status was
       corrected. Those are preserved rather than clamped, because
       zeroing them would silently inflate the running total.

   Fairfax appears in the same file, which is what makes this method
   checkable rather than merely plausible — see checkLocalityMethod().
------------------------------------------------------------------ */
const LOCALITY_ELECTIONS = [
  {
    year: 2025,
    electionDate: '2025-11-04',
    electionName: 'General Election',
  },
  {
    year: 2024,
    electionDate: '2024-11-05',
    electionName: 'General Election (presidential)',
  },
  {
    year: 2023,
    electionDate: '2023-11-07',
    electionName: 'General Election',
  },
];

/* Fairfax is deliberately absent: it publishes its own daily report, and
   that report is the authority for Fairfax. The same daily file still
   carries Fairfax, and it is used — as the check that keeps the other
   eight honest (checkLocalityMethod) rather than as a second, competing
   Fairfax dataset. */
const LOCALITIES = [
  { slug: 'loudoun', locality: 'Loudoun County', shortName: 'Loudoun', localityType: 'county' },
  { slug: 'prince-william', locality: 'Prince William County', shortName: 'Prince William', localityType: 'county' },
  { slug: 'arlington', locality: 'Arlington County', shortName: 'Arlington', localityType: 'county' },
  { slug: 'alexandria', locality: 'Alexandria City', shortName: 'Alexandria', localityType: 'city' },
  { slug: 'fairfax-city', locality: 'Fairfax City', shortName: 'Fairfax City', localityType: 'city' },
  { slug: 'falls-church', locality: 'Falls Church City', shortName: 'Falls Church', localityType: 'city' },
  { slug: 'manassas', locality: 'Manassas City', shortName: 'Manassas', localityType: 'city' },
  { slug: 'manassas-park', locality: 'Manassas Park City', shortName: 'Manassas Park', localityType: 'city' },
];

const LOCALITY_CYCLES = LOCALITY_ELECTIONS.flatMap((e) =>
  LOCALITIES.map((j) => ({
    ...j,
    electionDate: e.electionDate,
    electionName: e.electionName,
    // Not the locality's own report. Every other cycle's status names what
    // kind of document it came from; this names what kind of figure it is.
    status: 'Unofficial daily totals',
    coverage: { complete: true },
    /* Registration counts are filled from data/registration.json where
       that file has them; a cycle with none drops out of
       share-of-electorate views rather than borrowing a figure. */
    registeredVoters: null,
    id: `${j.slug}-${e.year}-general`,
    shortLabel: `${j.shortName} ${e.year}`,
    file: `data/parsed/${j.slug}-${e.year}-general_dal_daily.csv`,
  })),
);

/* What a dataset actually contains. Every consumer that needs more than
   two daily counts asks here first. Report cycles fill these in from the
   columns their CSVs really have, so a cycle whose report omits a
   section (2023 has no undeliverable column) still describes itself
   correctly. */
const FULL_DETAIL = {
  sites: true, returnRoute: true, ballotsIssued: true, surrendered: true,
};

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

/* ------------------------------------------------------------------
   Source tables.

   The report is a stack of separate tables — ballots issued, returned by
   mail, returned by drop box, mail requesters who voted in person
   instead, and turnout by site — each with its own sub-columns. The rest
   of the site works with the totals; this carries each table through
   whole so the reader can see the same breakdowns.

   The first column of each spec is the table's total and is always
   shown. Everything after it is a sub-column, hidden until asked for:
   the UOCAVA and domestic splits are a small fraction of every table and
   showing them by default triples the width for a reader who wanted the
   total.

   Column sets differ by cycle and are emitted from what each CSV
   actually has — the 2020–2023 workbooks carry totals only, and 2024
   splits its returns differently from 2025.
------------------------------------------------------------------ */
const TABLE_SPECS = [
  {
    key: 'issued',
    label: 'Issued by mail',
    file: 'mailed_absentee_ballots',
    hue: [124, 135, 155],
    cols: [
      ['total_mailed', 'Total issued'],
      ['domestic', 'Domestic'],
      ['uocava_mail', 'UOCAVA by mail'],
      ['uocava_email', 'UOCAVA by email'],
    ],
  },
  {
    key: 'mail',
    label: 'Returned by mail',
    file: 'returned_by_mail',
    hue: [235, 104, 52],
    cols: [
      ['total_returned', 'Total returned'],
      ['returned_by_mail', 'By mail'],
      ['returned_by_email', 'By email'],
      ['returned_uocava', 'UOCAVA'],
      ['undeliverable_subset_of_mail', 'Undeliverable'],
      ['undeliverable', 'Undeliverable'],
    ],
    /* Not a column. On 14 of 2025's dates the undeliverable sub-count is
       best-effort (see data/README.md), and the row says so rather than
       the figure being dropped or silently presented as verified. */
    estimatedFlag: 'undeliverable_is_estimated',
  },
  {
    key: 'dropbox',
    label: 'Returned by drop box',
    file: 'returned_by_dropbox',
    hue: [27, 175, 122],
    cols: [
      ['total_returned_dropbox', 'Total returned'],
      ['dropbox_mail_ballot', 'Mail ballot'],
      ['dropbox_email_ballot', 'Email ballot'],
      ['dropbox_domestic', 'Domestic'],
      ['dropbox_uocava', 'UOCAVA'],
      ['dropbox_email_uocava', 'UOCAVA by email'],
      ['returned_unused', 'Returned unused'],
    ],
  },
  {
    key: 'instead',
    label: 'Voted in person instead',
    file: 'ab_applicants_voted_early_in_person',
    hue: [154, 122, 196],
    cols: [
      ['total', 'Total'],
      ['ballot_not_surrendered', 'Ballot not surrendered'],
      ['ballot_surrendered', 'Ballot surrendered'],
    ],
  },
];

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

/* Boolean columns arrive spelled by whichever script wrote them —
   build_csvs.py emits Python's "True", parse_dal.py emits "true". */
const isTrue = (v) => String(v).toLowerCase() === 'true';

/** First column present out of `names`. */
const pick = (row, names) => {
  for (const n of names) if (row && row[n] !== undefined) return n;
  return null;
};

const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

/**
 * Registered voters per locality per election.
 *
 * `data/registration.json`, supplied directly and the sole source for
 * this figure — no cycle carries its own any more. One consistent series
 * across every locality and year is the whole point of a column whose
 * job is to compare a county of 800,000 with a city of 12,000; a
 * per-cycle figure from a different publisher would make the column
 * compare definitions instead of places.
 *
 * The figure used is the **total** — active plus inactive. An inactive
 * registrant is still a registered voter who can turn up and vote, so
 * they belong in the denominator.
 *
 * That choice also resolves what looked like a bad Fairfax figure. The
 * county's own report prints 809,786 for 2025, which is 7% above the
 * supplied *active* count of 754,532 but within 0.14% of the supplied
 * *total* of 808,667 — the county's line is a total. It is not a total
 * in every year: for 2021, 2022 and 2023 the same line matches the
 * active count instead. That inconsistency across the county's own years
 * is the reason nothing here reads it.
 */
const REGISTRATION = (() => {
  const file = path.join(ROOT, 'data', 'registration.json');
  if (!existsSync(file)) return {};
  return JSON.parse(readFileSync(file, 'utf8')).elections || {};
})();

const registrationFor = (cycle) =>
  REGISTRATION[cycle.electionDate]?.[cycle.locality] || null;

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

  /** One source table, or null if this cycle's CSV isn't there. */
  const sourceTable = (spec) => {
    const rows = readCsv(f(spec.file));
    if (!rows?.length) return null;
    const present = spec.cols.filter(([k]) => rows[0][k] !== undefined);
    if (!present.length) return null;
    const flag = spec.estimatedFlag && rows[0][spec.estimatedFlag] !== undefined
      ? spec.estimatedFlag
      : null;
    return {
      key: spec.key,
      label: spec.label,
      hue: spec.hue,
      columns: present.map(([k, label], i) => ({ key: k, label, detail: i > 0 })),
      rows: rows.map((r) => ({
        date: r.date,
        values: Object.fromEntries(present.map(([k]) => [k, num(r[k])])),
        ...(flag && isTrue(r[flag]) ? { estimated: true } : {}),
      })),
      totals: Object.fromEntries(
        present.map(([k]) => [k, rows.reduce((s, r) => s + (num(r[k]) || 0), 0)]),
      ),
      /* The report's own caveat, carried with the table it applies to
         rather than as a footnote the reader has to connect back. */
      note: flag && rows.some((r) => isTrue(r[flag]))
        ? 'Marked undeliverable figures are best-effort and not independently verified.'
        : null,
    };
  };

  const tables = TABLE_SPECS.map(sourceTable).filter(Boolean);

  // Turnout by site is the one table whose columns are the cycle's own
  // site roster rather than a fixed list.
  if (sites.length) {
    tables.push({
      key: 'sites',
      label: 'In person by site',
      hue: [42, 120, 214],
      columns: [
        { key: 'total', label: 'Total', detail: false },
        ...sites.map((s) => ({ key: s.key, label: s.label, detail: false })),
      ],
      rows: early.map((r) => ({
        date: r.date,
        values: {
          total: num(r.total),
          ...Object.fromEntries(sites.map((s) => [s.key, siteValue(r, s.key)])),
        },
      })),
      totals: {
        total: totals.inPerson,
        ...Object.fromEntries(sites.map((s) => [s.key, s.total])),
      },
      note: null,
    });
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
  const reg = registrationFor(cycle);
  return {
    ...meta,
    registeredVoters: reg?.registered ?? null,
    /* Derived from the columns this cycle's report actually has, not
       assumed. A report cycle normally fills all four, but 2022's has no
       surrendered-ballot section and there is no reason for the page to
       print a zero for it. */
    detail: {
      ...FULL_DETAIL,
      sites: sites.length > 0,
      ballotsIssued: totals.ballotsMailed > 0,
      surrendered: abTotalCol != null,
    },
    coverage: { ...cycle.coverage, dataThrough, daysBeforeElection },
    totals,
    sites,
    days,
    tables,
    hours,
    schedule,
  };
}

/**
 * Build a locality baseline cycle from a differenced daily-absentee file.
 *
 * Same dataset shape as a report cycle, with the four things this source
 * cannot know carried as null. See the LOCALITY_CYCLES comment above.
 */
function buildLocalityCycle(cycle) {
  const rows = readCsv(path.join(ROOT, cycle.file));
  if (!rows) {
    throw new Error(
      `gen-data: no daily file for ${cycle.id} (${cycle.file}). ` +
        `Run scripts/parse_dal.py to regenerate it.`,
    );
  }

  /* Trim the flat tail. The source keeps emitting snapshots for days
     after the last ballot moves; carrying them would put a week of empty
     rows on the end of every table. Everything up to and including the
     last day something happened is kept, zero-days in the middle
     included — a quiet Sunday is a fact about the cycle. */
  const active = rows.map((r, i) => [i, Number(r.combined_daily) || 0]);
  let lastActive = -1;
  for (const [i, v] of active) if (v !== 0) lastActive = i;
  if (lastActive < 0) throw new Error(`gen-data: ${cycle.id} has no activity in its daily file`);
  const kept = rows.slice(0, lastActive + 1);

  const days = kept.map((r) => ({
    date: r.date,
    weather: null,
    inPerson: num(r.early_in_person_daily),
    sites: {},
    returnedMail: num(r.mail_returned_daily),
    // Null, not zero: the return route is unknown here, and a zero would
    // render as "nobody used a drop box".
    returnedDropbox: null,
    ballotsMailed: null,
    abInPerson: null,
    /* A negative day is a status correction upstream, not a day ballots
       were withdrawn. Flagged so a reader can see one happened. */
    correction: r.is_correction === 'true',
    phase: r.phase,
  }));

  const last = kept[kept.length - 1];
  const totals = {
    // Cumulative from the source rather than a sum of the deltas: the two
    // agree, and taking the published cumulative means a dropped snapshot
    // can never quietly shrink the total.
    inPerson: num(last.early_in_person_cumulative),
    returnedMail: num(last.mail_returned_cumulative),
    returnedDropbox: null,
    ballotsMailed: null,
    abInPerson: null,
    undeliverable: null,
  };

  const sumOf = (col) => kept.reduce((s, r) => s + (num(r[col]) || 0), 0);
  for (const [total, col] of [
    [totals.inPerson, 'early_in_person_daily'],
    [totals.returnedMail, 'mail_returned_daily'],
  ]) {
    if (total !== sumOf(col)) {
      throw new Error(
        `gen-data: ${cycle.id} ${col} sums to ${sumOf(col)} but the file's ` +
          `running total ends at ${total}`,
      );
    }
  }

  const dataThrough = days[days.length - 1].date;
  const MS = 86400000;

  const { file, slug, ...meta } = cycle;
  const reg = registrationFor(cycle);
  return {
    ...meta,
    reportDate: dataThrough,
    registeredVoters: reg?.registered ?? null,
    detail: { sites: false, returnRoute: false, ballotsIssued: false, surrendered: false },
    coverage: {
      ...cycle.coverage,
      dataThrough,
      daysBeforeElection: Math.round(
        (new Date(cycle.electionDate) - new Date(dataThrough)) / MS,
      ),
      /* Shown on the page. It explains a shape the reader can see —
         mail still arriving after Election Day — rather than commenting
         on it. */
      note: 'Mail ballots are counted as they are processed, which continues for several days after Election Day.',
    },
    totals,
    sites: [],
    days,
    /* The same shape as a report cycle's, with the one table this source
       supports. The tabbed view then needs no special case — it renders
       whatever tables a dataset has. */
    tables: [{
      key: 'daily',
      label: 'Daily totals',
      hue: [42, 120, 214],
      columns: [
        { key: 'inPerson', label: 'Early in person', detail: false },
        { key: 'returnedMail', label: 'Vote by mail returned', detail: false },
        { key: 'inPersonCumulative', label: 'In person, running total', detail: true },
        { key: 'mailCumulative', label: 'By mail, running total', detail: true },
      ],
      rows: kept.map((r) => ({
        date: r.date,
        values: {
          inPerson: num(r.early_in_person_daily),
          returnedMail: num(r.mail_returned_daily),
          inPersonCumulative: num(r.early_in_person_cumulative),
          mailCumulative: num(r.mail_returned_cumulative),
        },
        ...(isTrue(r.is_correction) ? { corrected: true } : {}),
        ...(Number(r.span_days) > 1 ? { span: Number(r.span_days) } : {}),
      })),
      totals: {
        inPerson: totals.inPerson,
        returnedMail: totals.returnedMail,
        inPersonCumulative: null,
        mailCumulative: null,
      },
      note: kept.some((r) => Number(r.span_days) > 1)
        ? 'Marked days are covered by a single combined figure, shown on the first day of the span.'
        : null,
    }],
    hours: null,
    schedule: null,
  };
}

/**
 * Check the locality method against the one place the answer is known.
 *
 * Fairfax is in the same daily file as everyone else *and* publishes its
 * own report, so the two can be compared directly. That comparison is
 * the entire warrant for showing eight other localities built the same
 * way, and it has to keep holding — if a future import drifts, this is
 * what catches it before the figures ship.
 *
 * **In person is asserted.** It is the strong signal: the daily file
 * moves a ballot on the day it is cast, and it lands on the county's own
 * published figure to within six ballots in 2025 and exactly in 2023.
 *
 * **Mail is reported, not asserted.** The two are not measuring the same
 * moment — the county counts a ballot when it is returned, the daily
 * file when it is processed — and 2023 diverges far too widely to
 * bracket: 47,771 against the county's 36,773. That gap is not obviously
 * the daily file's fault. A 36,773 return on 70,465 ballots issued is a
 * 52% return rate, against 73-84% in every other Fairfax cycle, and the
 * daily file's figure would put 2023 at 68% — right in line. Something
 * is short in the 2023 workbook's own mail total. Until that is run
 * down, the county's figure stands (it is the county's report, and for
 * Fairfax that is the authority) and the gap is printed on every build
 * so it cannot be forgotten.
 */
function checkLocalityMethod(reportCycles) {
  const IN_PERSON_TOLERANCE = 0.005;
  let checked = 0;

  for (const ds of reportCycles) {
    if (ds.locality !== 'Fairfax County' || ds.coverage.complete === false) continue;
    const year = ds.electionDate.slice(0, 4);
    const rows = readCsv(
      path.join(ROOT, 'data', 'parsed', `fairfax-${year}-general_dal_daily.csv`),
    );
    if (!rows?.length) continue;
    checked += 1;

    const last = rows[rows.length - 1];
    const gotInPerson = num(last.early_in_person_cumulative);
    const gotMail = num(last.mail_returned_cumulative);
    const wantInPerson = ds.totals.inPerson;
    const wantMail = ds.totals.returnedMail + ds.totals.returnedDropbox;

    const offInPerson = Math.abs(gotInPerson - wantInPerson) / wantInPerson;
    if (offInPerson > IN_PERSON_TOLERANCE) {
      throw new Error(
        `gen-data: the locality method is off by ${(offInPerson * 100).toFixed(1)}% on ` +
          `Fairfax ${year} early in person (${gotInPerson.toLocaleString()} vs the ` +
          `county's ${wantInPerson.toLocaleString()}). Every non-Fairfax jurisdiction ` +
          `is built this way, so this has to hold before any of them ship.`,
      );
    }
    const offMail = Math.abs(gotMail - wantMail) / wantMail;
    console.log(
      `  cross-check ${year}  in person ${String(gotInPerson).padStart(7)} vs ` +
        `${String(wantInPerson).padStart(7)} (${(offInPerson * 100).toFixed(2)}%)   ` +
        `by mail ${String(gotMail).padStart(7)} vs ${String(wantMail).padStart(7)} ` +
        `(${(offMail * 100).toFixed(2)}%)${offMail > 0.05 ? '  <-- unexplained' : ''}`,
    );
  }

  if (!checked) {
    console.warn('gen-data: no Fairfax daily file to check the locality method against');
  }
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

/* Step a ramp across a list, first item darkest. Proportional rather
   than one-per-stop so a longer list spreads across the whole ramp
   instead of clamping several entries onto the last colour. */
const stepRamp = (arr, ramp) =>
  arr.map((ds, i) => ({
    ...ds,
    color: ramp[
      arr.length <= 1 ? 0 : Math.round((i / (arr.length - 1)) * (ramp.length - 1))
    ],
  }));

const reports = stepRamp(
  CYCLES.map(buildCycle).sort((a, b) => b.electionDate.localeCompare(a.electionDate)),
  RECENCY_RAMP,
);

checkLocalityMethod(reports);

/* Locality cycles all share one election date, so recency says nothing
   about them. They step the same ramp by size instead — largest darkest
   — which is how the treemap and the jurisdiction bars already order a
   set of places.

   The darkest stop is held back rather than reused: Fairfax is both the
   most recent cycle and the largest jurisdiction, so it already owns
   that colour, and handing it to Prince William as well would put two
   identical lines on the one chart that shows all nine at once. */
const localityByElection = {};
for (const ds of LOCALITY_CYCLES.map(buildLocalityCycle)) {
  (localityByElection[ds.electionDate] ||= []).push(ds);
}
const localities = Object.values(localityByElection).flatMap((group) =>
  stepRamp(
    group.sort((a, b) => (b.totals.inPerson + b.totals.returnedMail)
      - (a.totals.inPerson + a.totals.returnedMail)),
    RECENCY_RAMP.slice(1),
  ),
);

const built = [...reports, ...localities];

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
  const vbm = (ds.totals.returnedMail || 0) + (ds.totals.returnedDropbox || 0);
  console.log(
    `  ${ds.id.padEnd(26)} ${String(ds.sites.length).padStart(2)} sites, ` +
      `${String(ds.days.length).padStart(2)} days, ` +
      `${ds.totals.inPerson.toLocaleString().padStart(8)} in person, ` +
      `${vbm.toLocaleString().padStart(8)} by mail, ` +
      `${ds.detail.ballotsIssued ? 'report' : 'baseline'}, ` +
      `${ds.registeredVoters ? `${ds.registeredVoters.toLocaleString()} voters` : 'NO REGISTRATION'}, ` +
      `${ds.coverage.complete ? 'complete' : `PARTIAL through ${ds.coverage.dataThrough}`}`,
  );
}
