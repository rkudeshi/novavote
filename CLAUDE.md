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

**Frontend — v2 (`src/`)**. Vite + React, light theme, real routes.

```
/                     cross-cycle overview + comparison
/elections            index of every locality-election
/e/<cycle-id>         per-election detail (charts, map, table)
/versions             version archive (linked from the footer only)
/versions/v4          archived build; a bare major drops its ".0"
```

Routing is a ~60-line path router (`src/lib/router.jsx`). GitHub Pages has
no rewrite rules, so `vite.config.js` copies `index.html` to `404.html` at
build time — Pages serves that for any deep path and the app boots and
reads `location.pathname`. Don't switch to hash routing without a reason.

**Deploy path**: the site is served at the root of its own subdomain,
`novavote.raviudeshi.com`, so `base` in `vite.config.js` is `/` and
`public/CNAME` carries the domain into the built artifact. It was
`/novavote/` while the site sat at `raviudeshi.com/novavote/` — a project
repo is served under its repo name only on `<user>.github.io` or a
*user-site* apex domain; give the repo its own custom domain and Pages
serves it from that domain's root. `base` tracks where the site is
**served**, not what the repo is called, and getting it wrong renders a
blank page: the HTML loads and every asset URL 404s. If the domain
changes again, `base`, `public/CNAME` and the archive `--base` in
`deploy.yml` all move together.

**The visualisations, and why they are what they are.** v1's signature
site x day oval grid was removed. It failed structurally: early voting
follows the same arc everywhere, so every row was a copy of the county
curve and the grid mostly encoded the calendar. Its replacements:

- `ReportSummary` — leads every election page. The county's PDF opens
  with one small table and eleven loose percentages taken over **three
  different denominators** (registered voters, ballots issued, ballots
  returned) with none of them labelled, so "74%", "80%", "32%" and "68%"
  are answers to four different questions presented as a list. This is
  the same figures as three proportional bars, one per question, each
  part carrying its count, its share, and what it is a share of. Bar 3
  is the one the PDF cannot draw: 87,547 issued − 51,413 − 12,954 −
  1,654 leaves **21,526 mail ballots never returned**, a quarter of
  every ballot issued and the most interesting number on the page.
  A mid-cycle cycle relabels that residual "not returned as of this
  report" and drops the ratios over its tiny denominators — for a
  five-day snapshot, "99.5% never returned" would be a lie of framing.
  Two of the county's own labels are deliberately **not** reused; see
  LABEL NOTES at the foot of the component.
- `SurgeChart` — daily volume against **days until Election Day**, not
  calendar date. That indexing is what makes cycles and jurisdictions
  comparable at all; a Tuesday in 2023 and a Tuesday in 2025 are not the
  same moment, but "14 days out" is. Three metrics: daily share, banked
  to date, share of electorate.
- `SiteRhythm` — the site x day grid. Cells carry their value as **text**
  as well as colour; that forces ~42px cells and horizontal scrolling, and
  is worth it. A **metric switcher** changes what a cell means: ballots
  that day, cumulative, % of that site, % of all early ballots, ballots
  per hour, and deviation vs the site's own norm. Colour follows the
  metric's job — sequential (one hue) for magnitude, diverging for the
  deviation view — and the value text flips to white on dark fills based
  on computed luminance. Per-hour is wired end to end but reports itself
  unavailable until `data/site_schedules.json` has hours; see that file's
  header for the resolution order (per-site-per-date -> per-date ->
  per-site-weekday -> weekday).
- `SiteMap` — sites on the real county boundary, circle **area**
  proportional to the chosen metric (circles, not ovals: a fixed aspect
  distorted the area encoding for no analytical gain). Two views. *Whole
  cycle* has a per-day/total toggle, which is the point — sites open on
  different dates, so a raw total mostly measures how long a site was
  open. *Day by day* scrubs or plays through the cycle; its circle scale
  is fixed across all days, never per frame, or the surge would vanish.
  A site that has not opened is a dashed hollow ring, never a zero-radius
  circle: "not open" and "nobody came" must not look the same.

**Typography**: Fraunces (soft serif) for headings, Source Sans 3
(humanist) for body, IBM Plex Mono reserved for genuinely tabular figures.
Small labels use the body face with tracking rather than mono — a blanket
mono for every label was what made the earlier set read as mechanical.
Fonts are **self-hosted** (`src/fonts/`, generated by
`scripts/fetch_fonts.py` in CI) rather than pulled from a font CDN: no
third-party request, and the page renders correctly in the sandbox where
that CDN is unreachable. Only the latin subset and the weights actually
used are shipped — the full set was 900KB, this is ~270KB. `fonts.css` is
committed as a placeholder so the build never breaks when the generated
version is absent.

**Data palette** is colourblind-validated as a set against the white chart
surface (worst all-pairs CVD dE 9.2, normal-vision 24.0). Drop-box aqua
sits under 3:1 contrast, so anything using it ships direct labels and a
table view as relief. Re-validate if those three hexes change.

**Coverage is load-bearing, not documentation.** `coverage.complete` on a
cycle drives dashed curves, "mid-cycle snapshot" badges, a warning banner,
and suppression of final-week stats. It exists because the 2023 and 2024
reports are mid-cycle snapshots (see below) — and it is the same mechanism
an in-progress 2026 cycle will use while daily pulls are running.

## Data pipeline

Three scripts, all self-checking:

- `scripts/build_csvs.py` — regenerates the 2025 CSVs from hand-transcribed
  source data. Asserts every total including each of the 16 site columns
  individually; that per-column check is what caught the Herndon
  Fortnightly bug, so don't remove it.
- `scripts/parse_report.py` — parses any AB Daily Report PDF into the same
  CSV schema. Every report prints its own grand-total row, so each daily
  column is summed and asserted against it; a misparse fails rather than
  committing. Site rosters are discovered per report, never hardcoded.
  Fused cells (the text layer occasionally runs two rows together, e.g.
  `"8 1"`) are recovered from row identities, and only when exactly one
  component is missing — so a site that had not opened is never invented.
- `scripts/gen-data.mjs` — compiles `data/**.csv` into
  `src/data/generated/`. Asserts published totals, rejects unlabelled
  sites, rejects a cycle listing both halves of a site alias, and asserts
  every site coordinate falls inside the county boundary. `totals` also
  carries `abInPerson` (mail requesters who voted in person instead —
  the number that closes the ballot funnel, asserted at 1,654 for 2025)
  and `undeliverable`, which is **null rather than 0** where the report
  has no such column at all, as 2023's does not.

The dev sandbox has **no outbound access to fairfaxcounty.gov**, so PDF
fetching and parsing run in CI (`.github/workflows/extract-report.yml`)
and the CSVs are committed back. `scripts/find_reports.py` crawls the
county site for other published reports.

**Site renames**: `SITE_ALIASES` in `gen-data.mjs` maps an old key onto the
current one so a renamed site joins across cycles. Providence Community
Center -> Jim Scott Community Center is the live example. The build errors
if a single cycle ever lists both.

**Weather** (`data/weather.json`, from `scripts/fetch_weather.py`) is one
observation per day at the county centroid — not per site. Early voting
spans ~25 miles and the weather that plausibly moves turnout is regional,
so a county-level series is both honest and sufficient. Open-Meteo's ERA5
archive, free and key-less. `wet` (>=0.25in) and `snowy` are precomputed
so the UI doesn't re-derive that judgement. It appears in the map
scrubber, the grid read-out and the full table. The fetch window must run
*past* Election Day — reports carry post-election rows while late mail
arrives (2023 has rows through 11/13).

## Known data problems

**The 2023 and 2024 reports are mid-cycle snapshots, not final reports.**
The 2024 PDF's filename ("- 9.24") is literal: it stops 24 Sept 2024, five
days into early voting, at 14,129 in-person ballots — a presidential cycle
ends near 400k. The 2023 one stops 23 Oct, before any satellite site
opened. Both are flagged `coverage.complete: false` and shown as partial.
Finding the genuine end-of-cycle reports is open work.

**v1 metadata was wrong and has been removed.** It carried
`totalBallotsCast: 201588` and `turnoutPct: 24.89`. 201,588 is *exactly*
the early-vote sum (137,221 + 51,413 + 12,954) and 24.89% is that over
registered voters — neither is turnout including Election Day. Anything
derived from them rendered as "100% of ballots were early". If a real
total-turnout figure is ever sourced, add it under a clearly different
name.

**Site coordinates are geocoded** from the county's published addresses in
`data/site_locations.json` (fixed in v3.0 — the earlier hand-stubbed
coordinates were off by up to ~2.7km, e.g. Thomas Jefferson and Mt.
Vernon). `scripts/geocode_sites.py` tries the Census geocoder first —
same reference frame as the boundary geometry — and falls back to
Nominatim for addresses missing from Census range files (Jim Scott and
Sully). It records `geocodeSource` per site, rejects a result outside
Fairfax's bounding box rather than accepting a ZIP-centroid fallback, and
`gen-data.mjs` refuses to build a site with no coordinate at all. Never
hand-edit lat/lon: edit the address and re-run the geocoder, so every
coordinate traces to a real address.

## Versioning

`src/version.js` is the single source of truth. Policy: a **significant**
change bumps the major (2.x -> 3.0), a **smaller** change bumps the minor
(3.0 -> 3.1). The current version shows in the footer.

Past releases are archived as **real builds of the commit they shipped
from**, served at `/versions/<v>/`. `deploy.yml` reads the list out of
`version.js`, checks out each commit in a git worktree, and builds it with
`--base /versions/<v>/`. They are genuine frozen snapshots: an
archived version cannot be broken by a later refactor, needs no CSS
scoping against the current app, and shows the data as it stood then.

Pinned by commit rather than git tag because this project's CI credentials
can push branches but not tags (a tag push returns HTTP 403). The workflow
checks out whatever ref `commit` names, so tags can replace SHAs later with
no other change.

An archive that fails to build is skipped with a log line; the current site
still deploys.

To cut a release: bump `VERSION`, add an entry with the merge commit SHA,
merge.

## Automation

`.github/workflows/daily-pull.yml` runs daily and pulls every source
marked `"active": true` in `data/sources.json`, parses, reconciles and
commits. It no-ops while nothing is active. To turn on the 2026 cycle:
fill in the URL, set `active: true`, and add the cycle to `CYCLES` in
`gen-data.mjs`. Nothing else needs to change.

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on
every push to `main`.

## Not done yet / where to pick up
- **Final 2023/2024 reports** — the two we have are partial (above).
- **Other localities** (Northern Virginia only, by design): Loudoun,
  Prince William, Arlington, Alexandria City, Fairfax City, Falls Church
  City. Naming convention is "<Name> City", never "City of <Name>".
  `src/data/jurisdictions.js` is the scope list; a jurisdiction with no
  reconciled dataset carries `total: null` and renders as "no figures
  recorded yet" — **never** fill it with an estimate or a press figure.
  The comparison charts are already normalised
  (days-until-election, share of electorate), so a new locality is one
  more entry in `CYCLES` plus its CSVs — no chart changes.
- **Registered-voter counts** for 2023/2024, so the "share of electorate"
  comparison covers them; only 2025 has one.
- **Real geocoding** for site coordinates.
- **Precinct-level data**: the right upstream source is the Virginia Dept.
  of Elections (ELECT) — Daily Absentee List (DAL), Registered Voter List
  (RVL), Comprehensive Absentee Application List (CAAL), which are
  purchased files, not a public download. digitalpollwatchers.org (via
  EPEC) buys and republishes analysis of these, but they are a downstream
  analyst with stated positions on ballot questions — fine as a pointer to
  methodology, not as a primary source. Worth investigating VPAP.org and
  ELECT directly.
- **Testing**: no unit tests. The reconciliation assertions in the three
  data scripts are the correctness guard.
- No results or partisan data anywhere, by design. Turnout only — when and
  where ballots were cast, nothing about who they were cast for. Keep it
  that way unless explicitly asked.

## Presentation rules

**Vote by mail is one group, everywhere.** Returned by mail and returned
by drop box are subgroups within it, never peers of in-person voting — a
voter chooses to vote by mail, then chooses how to hand the ballot back.
`methodTotals()` in `src/lib/derive.js` is the single place that grouping
lives; use it rather than adding `returnedMail + returnedDropbox` inline.

**Section copy explains numbers, nothing else.** No commentary on what a
figure "really" means, no criticism of how a source presents its data, no
references to source PDFs or upstream publishers in user-facing text.
Provenance belongs in code comments and this file. A section blurb should
say what the reader is looking at and what it is a share of, then stop.

**Percentages follow magnitude.** `pct()` in `src/lib/format.js` prints
no decimal at or above 10% and one below it — a tenth is noise on "68%"
but load-bearing on "6.4%". Pass an explicit `digits` only to override.

**Site turnout is a treemap** (`Treemap.jsx`, squarified). Tiles fill the
box with no gaps so areas are compared adjacently; a loose grid of
free-standing squares made the reader estimate across whitespace. Tile
colour is a sequential ramp walked **monotonically by rank** — cycling it
put the darkest colour back on a small site — and label colour is derived
from the fill's luminance, never from rank.

**Labels live on the mark.** Bars and squares carry their own name, count
and share inside the shape; a shape too small for text gets a direct
label immediately beneath its own chart, never a detached legend.

**Source PDFs** are archived to `data/sources/` by the extract workflow —
a reference copy in the repo, deliberately *not* under `public/`, so the
built site never serves them.
