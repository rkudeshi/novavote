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

## Two levels of data, and why

**For Fairfax, the county's own report is the authority — with one
documented exception.** The state's daily file also carries Fairfax and
is normally used to *check* and augment. It overrides a county figure
only where the discrepancy is large **and** there is contextual evidence
that the county figure is the wrong one; `mailFrom: 'daily'` on a cycle
is how that is expressed, and Fairfax 2023 vote-by-mail is the only
instance. The county's own figures stay on the dataset as `superseded`,
its report's totals are still asserted (so the parse stays checked), and
the divergence still prints on every build.

**Fairfax 2023 vote-by-mail comes from the daily file.** The workbook
reports 30,240 by mail and 6,533 by drop box — 36,773 on 70,465 issued,
a **52% return rate against 73-84% in every other Fairfax cycle**. The
daily file reads 47,771, which is 68% and in line, and that same file
lands on 2023's in-person total *exactly* (64,382) and on 2024's and
2025's to within a rounding error. The cost is carried rather than
hidden: the daily file has no post-versus-drop-box split, so this cycle
loses it (`detail.returnRoute: false`), the report's two superseded
tables are dropped from the tabbed view rather than shown contradicting
the headline, and the page says so. Every other Northern Virginia locality is
built from that daily file,
which carries two cumulative counts — early ballots cast in person, and
mail ballots returned — and nothing else. That is the **locality baseline
template**: `LOCALITY_CYCLES` + `buildLocalityCycle()` in `gen-data.mjs`,
fed by `scripts/parse_dal.py` from snapshots in `data/sources/dal/`. It
produces the same dataset shape as a report cycle with four things
carried as **null, never zero**: no site breakdown, no mail-versus-drop-box
split, no daily ballots-issued count, no surrendered ballots.

`ds.detail` (`{sites, returnRoute, ballotsIssued, surrendered}`) is what
the UI reads. Ask it rather than inferring absence from a zero — a zero
renders as "nobody used a drop box" instead of "that isn't recorded
here". Report cycles derive their own flags from the columns their CSVs
actually have, so 2022 (no surrendered-ballot section) describes itself
correctly too.

**The method is checkable, which is the only reason it ships.** Fairfax
appears in the same statewide file *and* publishes its own report, so the
two can be compared directly. `checkLocalityMethod()` runs on every build
and prints both series for every cycle that has both:

- **In person is asserted** (0.5%). 2025: 137,215 vs the county's
  137,221. 2024: 239,315 vs 239,326. 2023: 64,382 vs 64,382, exactly.
  Don't remove it — 24 locality datasets rest on it.
- **Mail is reported, not asserted.** 2025 is 0.83% apart and 2024 is
  0.03%. **2023 is 30% apart and the daily file wins there** — see below.

Two properties of that file are real, not artefacts, and both are handled
in `parse_dal.py`:

- **In person moves the day a ballot is cast; mail moves when a ballot is
  *processed***, which mostly happens after Election Day. Fairfax reads
  51,567 mail on 1 Nov and climbs to 63,832 by 9 Nov. Cutting the file at
  1 Nov under-reports mail by a fifth while looking perfectly reasonable.
  Rows are kept past the election and phase-tagged (`early`/`election`/
  `post`) instead.
- **Snapshot gaps and duplicates.** Two snapshots landed on 29 Sept 2025;
  keeping only the later one silently drops the earlier one's delta (727
  Loudoun ballots). And no file was published for 27–28 Sept, so the 29th
  covers three days. That whole delta is assigned to the span's **first**
  day and every day in the span is flagged `span_days`. For this cycle
  that is verified, not guessed: Fairfax's own report — which is not
  derived from this file — records 1,982 in person on the Friday and zero
  on both weekend days, exactly matching the span. A future gap could
  fall mid-week, where placement really would be an assumption, so the
  flag stays.

**Negative daily figures are restatements, never clamped.** Zeroing one
inflates the running total by its full amount. On 4 October 2023 all nine
localities dip at once — Prince William by 5,137, Fairfax by 4,216 — and
the next day's snapshot puts it all back. Left alone that reads as a
collapse followed by the busiest day of the cycle; Loudoun 2023's
"busiest day" was reporting 6,002 ballots that never happened then. So a
negative day is merged with the day that restores it, exactly as a
snapshot gap is merged, and both are flagged. The merge only commits if
it clears within a day: a handful of unrestored -1s after Election Day
would otherwise swallow a week of real post-election mail. Those stay
negative and flagged. All four 2023 cycles now peak on the final
Saturday, which is what they should do.

The publisher asks that this series be labelled as derived rather than
official. It carries `status: 'Unofficial daily totals'` — no source is
named in user-facing text, per the presentation rules below.

## Data pipeline

Four scripts, all self-checking:

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
- `scripts/parse_dal.py` — differences the daily absentee snapshots into
  one row per activity date per locality. Asserts the summed deltas land
  exactly on the file's own final cumulative figure, so a dropped delta
  fails rather than quietly shrinking a total, and refuses to trim
  pre-window rows that carry activity.
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

**Opening hours** (`data/site_schedules.json`) come from Fairfax
Electoral Board records and Registrar's reports, supplied by someone who
worked in the office — they are not on any page the site could scrape,
and county pages are unreachable from the sandbox anyway. Shape is
ordered `groups`; for a (site, date) the **last matching group wins**,
which is how "everyone does X, except the Government Center" is expressed
without repeating fifteen site keys, and how 2020's two mid-cycle
extensions override the base schedule. Whether a site was *open* on a
date still comes from the ballot record, never from here — which is why
Great Falls 2020 needs no special case despite operating three Saturdays
only. The hours are **published on the page** (`Schedule.jsx`) as well as
divided by: the Government Center opening at 8am against the satellites'
1pm is most of why it takes a quarter of the in-person vote.

**Weather** (`data/weather.json`, from `scripts/fetch_weather.py`) is one
observation per day at the county centroid — not per site. Early voting
spans ~25 miles and the weather that plausibly moves turnout is regional,
so a county-level series is both honest and sufficient. Open-Meteo's ERA5
archive, free and key-less. `wet` (>=0.25in) and `snowy` are precomputed
so the UI doesn't re-derive that judgement. It appears in the map
scrubber, the grid read-out and the full table. The fetch window must run
*past* Election Day — reports carry post-election rows while late mail
arrives (2023 has rows through 11/13).

**Final reports are xlsx, daily reports are PDFs.** `scripts/parse_xlsx_report.py`
handles the county's end-of-cycle workbooks (Nov 2020-2023, archived in
`data/sources/`). Two layouts: 2021-2023 put one column per site, 2020
splits every site into congressional-district sub-columns closed by a
`Total`. Run `--all` to reparse every report with its expected totals,
which live in the script.

**Check a sheet against a *different* sheet.** The parser asserts each
series against the workbook's Summary tab, not against the daily sheet's
own total row. An early version matched `Early Voting Option` before
`Early Voting` and reported the same wrong figure for three straight
years while passing its own check, because both sides came from the same
wrong sheet. `DECOYS` in that script exists for this.

## Known data problems

**2024 is complete, but has no per-site split.** The end-of-cycle report
("- 11.07") parses and every county-level column lands exactly on the
report's own printed totals: 239,326 in person, 114,183 issued by mail,
69,977 returned by mail, 23,678 by drop box, 5,127 who voted in person
instead. Seven **site** columns come up short — one page's text layer is
scrambled (the parser flags an unparsed row label, `1T7o-Otaclt`, which
is "17-Oct" and "Total" interleaved). `parse_report.py` therefore writes
the verified county series and **withholds the split** rather than
publishing figures that do not add up; the cycle carries
`detail.sites: false` and its map, treemap, site grid and schedule are
absent. Fixing the site parse would restore them. The old "- 9.24"
five-day snapshot is still downloaded as `nov2024_snapshot.pdf` for
reference and is deliberately never parsed.

2023 *was* also a snapshot, from a PDF ending 23 Oct at 13,981 in-person
ballots. The county's final xlsx has 64,382, so that cycle is now
complete. The 2023 PDF parse is deliberately absent from
`extract-report.yml` — leaving it in would overwrite the final data with
the snapshot on every run.

**2020's own report has no registered-voter count.** It carries no Active
Voters line. The cycle still sets `registeredVoters: null`, but no longer
drops out of share-of-electorate views: the state's own 2020 file
supplies 751,830 via `data/registration.json`, which is that year's real
count rather than a neighbouring year's borrowed. Its Summary also disagrees with its own daily sheets by 42
(mail) and 125 (drop box) ballots the county never attributed to a
congressional district; the daily series is authoritative here.

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

**Never write the CI-skip marker literally in a commit message** — the
bracketed `skip`/`ci` token GitHub recognises. GitHub concatenates a
branch's commit messages into the body of a squash merge, so the token
rides onto `main` and suppresses **every** workflow for that push,
including the Pages deploy. This has bitten twice: once from the extract
workflow's own commit (now removed), and once from a commit message that
merely *described* the problem. Refer to it in prose, never as the token.
A merge that lands green is not proof the site deployed — check that a
deploy run exists for the merge SHA, and dispatch `deploy.yml` manually if
not.

`.github/workflows/daily-pull.yml` runs daily and pulls every source
marked `"active": true` in `data/sources.json`, parses, reconciles and
commits. It no-ops while nothing is active. To turn on the 2026 cycle:
fill in the URL, set `active: true`, and add the cycle to `CYCLES` in
`gen-data.mjs`. Nothing else needs to change.

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on
every push to `main`.

## Not done yet / where to pick up
- **Final 2023/2024 reports** — the two we have are partial (above).
- **Past cycles for the eight non-Fairfax localities.** Nov 2023, 2024
  and 2025 are in (see the locality baseline above); 2020-2022 are not.
  The publisher's archive doesn't currently expose them in this format.
  Same template when it does — land the snapshots under
  `data/sources/dal/<year>/`, add a year to `LOCALITY_ELECTIONS` and to
  `CYCLES` in `parse_dal.py`.
  Naming convention is "<Name> City", never "City of <Name>".
  `src/data/jurisdictions.js` is the scope list; a jurisdiction with no
  reconciled dataset carries `total: null` and renders as "no figures
  recorded yet" — **never** fill it with an estimate or a press figure.
- **Registered-voter counts are in.** `data/registration.json` holds
  registered voters per locality per November general, 2020-2025,
  snapshot 1 November each year, supplied directly. It is the **sole
  source** — no cycle carries its own figure any more. One consistent
  series across every locality and year is the whole point of a column
  whose job is to compare a county of 800,000 with a city of 12,000; a
  per-cycle figure from a different publisher would make the column
  compare definitions instead of places.
  - The figure divided by is the **total** — active plus inactive. An
    inactive registrant is still a registered voter who can turn up and
    vote. `active` is carried alongside for reference.
  - That choice also resolves what looked like a bad Fairfax number. The
    county's own report prints 809,786 for 2025: 7% above the supplied
    active count (754,532) but within 0.14% of the supplied total
    (808,667). The same county line matches the *active* count for 2021,
    2022 and 2023 instead. That inconsistency across the county's own
    years is exactly why nothing reads it.
  - `scripts/fetch_turnout.py` is the second opinion, not the source. It
    **writes nothing**: it sums the state's per-precinct turnout files by
    locality and prints any disagreement in either column. Its coverage
    is 2020-2022 only — nothing in that directory's index mentions 2024
    or 2025, and 2023 has only special elections.
  - Its **turnout columns do not reconcile** and are deliberately unread:
    summed by locality they put Fairfax 2020 at 1,020,701 ballots against
    751,830 active voters, a 136% turnout against a real figure near
    594,000. Do not resurrect them without working out what they count.
  - Reading the **first matching row** instead of summing gives one
    precinct's numbers and looks entirely plausible (906 active voters for
    Fairfax County). Keep the sum.
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

**Cross-jurisdiction comparisons are always percentages.** Fairfax casts
more early ballots than the other eight jurisdictions put together, so
anything scaled to raw totals is a chart of how big Fairfax is and every
other row collapses to a stub. The home page's jurisdiction bars are each
drawn to that jurisdiction's own 100%, split by how the vote was cast;
the count sits beside the bar as context, never as the encoded quantity.
The same rule killed a "busiest single day" figure, which Fairfax won by
construction — it is now the most *concentrated* day, a share of that
jurisdiction's own cycle.

**Percentages follow magnitude.** `pct()` in `src/lib/format.js` prints
no decimal at or above 10% and one below it — a tenth is noise on "68%"
but load-bearing on "6.4%". Pass an explicit `digits` only to override.

**The full table is tabbed, one tab per source table.** The report is a
stack of separate tables — ballots issued, returned by mail, returned by
drop box, mail requesters who voted in person instead, turnout by site —
each with its own sub-columns. `TABLE_SPECS` in `gen-data.mjs` carries
them through whole and `SourceTables.jsx` renders them; a cycle gets only
the tables and columns its CSVs actually have, so 2020–2023 (totals only)
and 2024 (which splits returns differently from 2025) each describe
themselves. **Sub-columns are hidden by default** — UOCAVA and domestic
splits are a small fraction of every table and showing them triples the
width for a reader who came for the total. Each table's own column totals
are pinned to the bottom of the scroll area, which is how a reader checks
a column against a published figure. Row marks (best-effort undeliverable,
upstream correction, multi-day span) sit against the date they qualify.

**Site turnout is a treemap** (`Treemap.jsx`, squarified). Tiles fill the
box with no gaps so areas are compared adjacently; a loose grid of
free-standing squares made the reader estimate across whitespace. Tile
colour is a sequential ramp walked **monotonically by rank** — cycling it
put the darkest colour back on a small site — and label colour is derived
from the fill's luminance, never from rank.

**Layout thresholds are measured in pixels, not percent.** `useWidth()`
in `src/lib/motion.js` measures the real element; a percentage threshold
is the same number on a 1000px bar and a 350px one, which is how labels
ended up clipped mid-word on a phone.

**Grid tracks holding flex bars need `minmax(0, 1fr)`.** A non-wrapping
flex row's min-content width is the *sum* of its items' min-content
widths, so a labelled bar reports ~400px on a phone and a default `auto`
track grows to fit it — dragging the whole card past the viewport. This
is what caused the mobile overflow; don't revert `.rs` to a bare `grid`.

**Motion is decoration on a page that reads without it.** Everything
animated degrades to its final state under `prefers-reduced-motion`, and
no fact is conveyed by animation alone — a wet day is a different glyph
*and* a different colour, not just a moving one.

**Labels live on the mark.** Bars and squares carry their own name, count
and share inside the shape; a shape too small for text gets a direct
label immediately beneath its own chart, never a detached legend.

**Source PDFs** are archived to `data/sources/` by the extract workflow —
a reference copy in the repo, deliberately *not* under `public/`, so the
built site never serves them.
