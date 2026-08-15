# NovaVote — project brief for Claude Code

## What this is
A site tracking early voting (in-person, mail, drop box) across Northern Virginia
counties, starting with Fairfax County's Nov 2025 General & Special Election.
Long-term: multiple counties, historical data back to 2020 (first year of
no-excuse early voting in VA), and eventually precinct-level detail.

## What's already done

**Data (in `data/`)** — extracted from Fairfax County's own PDF report:
https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf

Five CSVs, one row per date (2025-09-19 through 2025-11-01/07 depending on series):
- `mailed_absentee_ballots.csv` — ballots mailed/emailed out
- `returned_by_mail.csv` — ballots returned by mail/email (see caveat below)
- `returned_by_dropbox.csv` — ballots returned via drop box
- `early_in_person_by_site.csv` — in-person early voting, **by date AND by site** (16 sites)
- `ab_applicants_voted_early_in_person.csv` — mail-ballot requesters who voted in person instead

All five reconcile exactly against the county's published grand totals (87,547 /
51,413 / 12,954 / 137,221 / 1,654). `scripts/build_csvs.py` regenerates them from
hand-transcribed source data and asserts every total, including each of the 16
site columns individually — that per-column check is what caught a real bug
(see Known issues below), so don't remove it if the script is edited.

**Data caveats (documented in `data/README.md`, worth preserving)**:
- Only 3 of 16 early-voting sites operated before Oct 23, 2025; the rest opened
  Oct 23 through Election Day. Blank site cells before that date mean "not open,"
  not zero turnout — don't coerce them to 0 in the UI or charts.
- `returned_by_mail.csv` has an `undeliverable_is_estimated` flag column. On 14
  dates the source PDF's text layer merged digits together (e.g. "1010" instead
  of "1 0 1 0"). The `total`/`mail`/`email` split was recoverable because
  `mail + email = total` holds on every clean row and gave a unique valid split
  (verified against the grand total). The `undeliverable` sub-count has no such
  check, so those specific values are best-effort, flagged, not verified.
- One date (2025-09-25) couldn't be split at all; its total/mail/email came from
  the grand-total residual instead, and `undeliverable` is left blank.

**Known issue already fixed once, watch for regressions**: the PDF header reads
"Herndon Fortnightly" — that's **one site** (Herndon Fortnightly Library), not
two. An earlier pass split it into two site columns, which silently shifted
every site from "Jim Scott" onward by one position. Row totals still summed
correctly, which is why it wasn't caught until each site column was checked
against its own published grand total individually. There are 16 sites, not 17.

**Frontend (`src/App.jsx`)** — now a real Vite + React project (built with
`npm run dev` / `npm run build`), not a standalone artifact file. Data is no
longer hand-inlined: `scripts/gen-data.mjs` compiles `data/*.csv` into
`src/data/generated/*.js` at build time (wired via `predev`/`prebuild` npm
hooks), and `App.jsx` imports `DATASETS` from there. That generated
directory is gitignored — it's build output. `gen-data.mjs` re-asserts the
same reconciliation totals `build_csvs.py` checks, so a bad regeneration
fails the build instead of shipping silently wrong numbers.

`scripts/gen_data.py` (Python) is kept for reference — it's the original
version of the same transform — but `gen-data.mjs` (Node) is what the npm
build actually runs, so the frontend toolchain doesn't need Python. Keep
them in sync if you change the data shape.

Both `recharts` charts (`DailyVolume` bar/line toggle) have been verified
rendering correctly in a real browser (headless Chromium against `vite dev`),
along with the rest of the page — this was previously only syntax-checked,
per the prior version of this file.

Sections, top to bottom:
1. **Ballot grid (the signature element)** — a heatmap-style grid, one row per
   site, one column per day, color-coded by volume. Sites not yet open render
   as dashed outlines rather than zero. The Oct 23 expansion column is
   highlighted. This is the thing worth preserving/extending first if you
   redo the visual design — it's the most distinctive part.
2. Stat strip (turnout headline numbers)
3. Daily volume chart (stacked bar / cumulative line toggle, by method)
4. Site ranking (sortable horizontal bars)
5. Full data table (sortable, CSV download button)
6. Roadmap section (shows what's loaded vs. queued — Loudoun, Prince William,
   Arlington, Alexandria, Richmond, Virginia Beach)

Design direction: dark navy background, warm amber + teal accent, Space
Grotesk display / IBM Plex Sans body / IBM Plex Mono for data — chosen to
avoid the generic "AI-generated" defaults (cream+terracotta, black+neon,
broadsheet). Ovals in the brand mark and grid nod to a ballot-punch motif.
CSS is still a CSS-in-JS template string injected via `<style>` in
`App.jsx` (unchanged from the artifact version) — fine for now, but a
candidate to move to a real `.css` file / CSS modules if the styling grows.

The Google Fonts `@import` in that CSS needs outbound network access to
`fonts.googleapis.com`; it degrades gracefully to system fonts if blocked
(e.g. in a sandboxed dev environment), so don't treat a font-load 404 as a
bug.

**Site coordinates** — `SITE_COORDS` in `scripts/gen-data.mjs` (and the
original `scripts/gen_data.py`) has **approximate, not authoritative**
lat/lon for the 16 Fairfax sites, stubbed in for a future map view. Needs
real geocoding before it's trustworthy.

## Not done yet / where to pick up
- **Other counties**: Loudoun, Prince William, Arlington, Alexandria, Richmond,
  Virginia Beach — need to find their equivalent daily reports and confirm
  they're in a similar format before reusing `build_csvs.py`'s approach.
- **2020–2024 historical data**: same county reports, prior cycles.
- **Locality picker**: `App.jsx` currently always renders `DATASETS[0]`.
  Once a second dataset exists, add a selector in the header.
- **Precinct-level data**: the right upstream source is the Virginia Dept. of
  Elections (ELECT) — specifically the Daily Absentee List (DAL), Registered
  Voter List (RVL), and Comprehensive Absentee Application List (CAAL), which
  are purchased data files, not a public API/download as far as I could
  confirm. digitalpollwatchers.org (via EPEC) buys and republishes analysis
  of these files, but they're a downstream analyst with stated positions on
  ballot questions (they explicitly urge a "NO" vote on one in their own
  posts) — fine as a pointer to methodology, not as the primary source. Worth
  investigating VPAP.org and ELECT's own site for how to actually get DAL/RVL
  access.
- **Map view**: coordinates are stubbed, not real; site geocoding is unstarted.
- No results/partisan data anywhere in this dataset by design — it's turnout
  only (when/where ballots were cast). Keep it that way unless explicitly
  asked to add results.
- **Deployment**: not yet deployed anywhere (Vercel/Netlify/GitHub Pages are
  all reasonable for a static Vite build — `npm run build` outputs to
  `dist/`).
- **Testing**: no automated tests yet. The reconciliation checks in
  `gen-data.mjs` are the only automated correctness guard right now.
