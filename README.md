# NovaVote

Tracking early voting turnout across Virginia — in person, by mail, and by
drop box — day by day, for Fairfax County and (as data lands) its
neighbours. Turnout only: when and where ballots were cast, never who they
were cast for.

Live at **https://raviudeshi.com/novavote/**

## Stack

Vite + React + recharts, with hand-rolled SVG for the custom charts.
Data lives as CSVs under `data/` and is compiled into a JS module at build
time — nothing is hand-inlined into the frontend.

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production build to dist/
npm run preview   # serve the production build
npm run gen-data  # just regenerate src/data/generated/ from the CSVs
```

## Pages

| Route | What it is |
|---|---|
| `/` | Cross-cycle overview: comparison indexed to days-until-Election-Day |
| `/elections` | Every locality-election held |
| `/e/<cycle-id>` | One election: charts, site map, full data table |
| `/versions` | Version archive |
| `/versions/v1` | v1 preserved and still running |

## Layout

```
data/
  *.csv                 Fairfax 2025 (hand-validated)
  parsed/*.csv          machine-parsed cycles, written by CI
  sources.json          sources for the automated daily pull
scripts/
  build_csvs.py         regenerates the 2025 CSVs, asserting every total
  parse_report.py       parses any AB Daily Report PDF; self-checking
  extract_pdf.py        downloads reports and dumps their text layer
  find_reports.py       crawls the county site for published reports
  fetch_boundary.py     county boundary from Census cartographic files
  daily_pull.py         fetch + parse every active source
  gen-data.mjs          CSVs -> src/data/generated/ (runs pre-dev/build)
src/
  pages/                Home, Election, Versions
  components/charts/    SurgeChart, SiteRhythm, SiteMap
  lib/                  router, derived metrics, formatting, motion
  versions/v1/          v1, preserved as a live component
```

## Adding a locality or cycle

1. Get its daily report into CSVs under `data/parsed/` (usually by adding
   it to `scripts/extract_pdf.py` and letting CI parse it).
2. Add an entry to `CYCLES` in `scripts/gen-data.mjs`.

That's it. Every comparison is normalised by days-until-Election-Day and
by electorate size, so charts pick up a new dataset without changes.

## Data integrity

Every number on the site is asserted against a published total before it
can ship:

- `build_csvs.py` and `gen-data.mjs` check the 2025 grand totals, and each
  of the 16 site columns individually.
- `parse_report.py` checks every parsed column against the grand-total row
  the report prints itself; a misparse fails the job.
- `gen-data.mjs` also asserts every site coordinate falls inside the county
  boundary.

Cycles whose source report stops before Election Day are flagged
`coverage.complete: false` and shown as partial — dashed curves, a
warning banner, and no final-week statistics. See `CLAUDE.md` for the
known data problems, which include the 2023 and 2024 reports being
mid-cycle snapshots.

## Automation

- `daily-pull.yml` — pulls, parses and commits every active source in
  `data/sources.json` daily. Idle until a source is switched on; this is
  the mechanism for tracking a live cycle such as Nov 2026.
- `extract-report.yml` — fetches and parses the historical reports.
- `deploy.yml` — builds and publishes to GitHub Pages on push to `main`.
