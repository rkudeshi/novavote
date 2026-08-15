# NovaVote

A site tracking early voting (in-person, mail, drop box) across Virginia
counties, starting with Fairfax County's Nov 2025 General & Special
Election. Turnout data only — no results, no partisan splits.

## Stack

Vite + React + [recharts](https://recharts.org/). Data lives in `data/*.csv`
and is compiled into a JS module at build time (`scripts/gen-data.mjs`) —
nothing is hand-inlined into the frontend.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173, regenerates data on start
npm run build      # production build to dist/
npm run preview    # serve the production build locally
```

`npm run gen-data` regenerates `src/data/generated/` from the CSVs on its
own if you just want to check the data pipeline. That output directory is
gitignored — it's build output, not source.

## Project layout

```
data/           validated source CSVs, one row per date (see data/README.md)
scripts/
  build_csvs.py   regenerates the CSVs from hand-transcribed source data,
                  asserting every total against the county's published figures
  gen-data.mjs    compiles data/*.csv -> src/data/generated/*.js at build time
  gen_data.py     original Python port of the same step (kept for reference;
                  the Node script is what the npm build actually runs)
src/
  App.jsx         the whole UI: ballot grid, stat strip, charts, site
                  ranking, data table, roadmap
  data/generated/ build output, gitignored
```

## Adding a locality

The data layer is one object per locality-election, all with the same
shape. To add a jurisdiction: get its daily report into CSVs under `data/`
(following the pattern in `data/README.md`), extend `scripts/gen-data.mjs`
to emit a dataset object for it, and append that dataset to `DATASETS`.
No UI changes needed — `App.jsx` already renders whatever's in the array
(today it just always shows `DATASETS[0]`; a locality picker is on the
roadmap once there's more than one).

## Status

This is a fresh build-out of a Claude.ai-artifact prototype into a real
Vite project — see `CLAUDE.md` for the fuller history and what's queued
next (more localities, historical cycles, precinct-level data, a site
map).
