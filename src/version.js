/* ------------------------------------------------------------------
   Version history — the single source of truth for what version this is.

   Policy: a significant change bumps the major (2.x -> 3.0); a smaller
   change bumps the minor (3.0 -> 3.1).

   Archived versions are **real builds of the commit they shipped from**,
   produced by .github/workflows/deploy.yml and served from /versions/<v>/.
   They are genuine frozen snapshots — their own HTML, CSS and data as of
   that release — not the current app re-skinned. An archived version can
   therefore never be broken by a later refactor, and it shows the data as
   it stood at the time.

   Releases are pinned by commit rather than by git tag because this
   project's CI credentials can push branches but not tags. A commit SHA
   is just as immutable; if tags become available later, `commit` can
   become a tag name with no other change (the workflow just checks out
   whatever ref is here).

   To cut a release:
     1. set the *outgoing* version's `commit` to the SHA it merged as —
        that SHA only exists once its PR has landed, which is why the
        current release always carries `commit: null`,
     2. bump VERSION and add the new entry at the top with `commit: null`,
     3. merge. The deploy workflow rebuilds every archived entry.
------------------------------------------------------------------ */

export const VERSION = '5.3';

/* Archive slug: a bare major release drops its ".0", so 4.0 lives at
   /versions/v4/ and 4.1 at /versions/v4.1/. deploy.yml reads this same
   function, so the built directory and the link can never disagree. */
export const slug = (v) => `v${String(v).replace(/\.0$/, '')}`;

export const VERSIONS = [
  {
    v: '5.3',
    commit: null,        // current — served at the site root
    date: 'August 2026',
    headline: 'Six years of Fairfax early voting',
    notes: [
      'Adds the November 2020, 2021, 2022 and 2023 general elections from the county\u2019s final reports.',
      '2023 was previously a mid-cycle snapshot stopping at 13,981 in-person ballots; the final report has 64,382.',
      'Six cycles now line up on the comparison charts, from the 2020 presidential surge to 2023.',
      'Two sites that only ever appear in older cycles \u2014 Laurel Hill and Gerry Hyland \u2014 join the map.',
      '2020 carries no registered-voter figure, so it sits out the share-of-electorate view rather than borrowing one.',
    ],
  },
  {
    v: '5.2',
    commit: '0e10decb86395bd3567c2d1aa87071c492b15254',
    date: 'August 2026',
    headline: 'Motion, animated weather, and a mobile layout that fits',
    notes: [
      'Fixed the layout overflowing the screen on phones — the overview card and its bars ran past the right edge.',
      'Bars grow from nothing as they come into view, and headline percentages count up.',
      'The home page headline assembles word by word under its number.',
      'Weather is now drawn rather than emoji: rain actually falls, snow drifts, and a dry day is a quiet ring.',
      'Segment labels are decided by measured pixels, so nothing clips mid-word at any width.',
      'Every animation resolves instantly for visitors who ask for reduced motion.',
    ],
  },
  {
    v: '5.1',
    commit: '9e709ed0b857da4e8c330a13ed927c39c278c238',
    date: 'August 2026',
    headline: 'Treemaps, calmer sections, percentages first',
    notes: [
      'Site turnout is now a packed treemap — tiles fill the space with no gaps, so proportions are compared directly rather than across whitespace.',
      'Headline section is now Overview, and each box leads with its percentage; the count sits underneath.',
      'Percentages at or above 10% drop the decimal.',
      'Bars carry one line of text per segment instead of three, and the bar that merely restated a headline box is gone.',
      'Home page gains a key-numbers strip and an early-turnout column per jurisdiction.',
    ],
  },
  {
    v: '5.0',
    commit: 'a36f7b5789c6972bc90504918611751cd5c9d5d2',
    date: 'August 2026',
    headline: 'Northern Virginia at a glance',
    notes: [
      'The home page now leads with a jurisdiction-by-jurisdiction comparison of the November 2025 early vote.',
      'Scope narrowed to Northern Virginia: Falls Church City and Fairfax City added, Richmond and Virginia Beach dropped.',
      'Vote-by-mail is now one group everywhere, with returned by mail and returned by drop box as its two subgroups.',
      'Election pages lead with headline figures as large boxes, with counts and shares carried inside the bars themselves.',
      'New breakdowns: proportional squares per in-person site, and the same treatment for vote-by-mail.',
      'Section copy trimmed to what explains the numbers.',
      'Narrower site-grid columns and a two-line header, so far more of the cycle fits on a phone.',
    ],
  },
  {
    v: '4.1',
    commit: '0cf04081f6a2ba326c48558dc149c9debd6ca20e',
    date: 'August 2026',
    headline: 'The county report’s front page, rebuilt',
    notes: [
      'Each election page now opens with every figure from the county report’s first page, restated as three proportional bars — one per question the page is actually asking.',
      'Each percentage is shown against the denominator it is a share of. The county prints eleven of them over three different denominators without labelling any.',
      'Adds the number the report never states: 21,526 mail ballots — a quarter of every ballot issued — that were never returned.',
      'Mail-ballot requesters who voted in person instead are now carried through the data pipeline, which is what closes the ballot funnel.',
      'The county’s “Total Ballots Cast” and “% Voted (Turnout)” labels are shown with their arithmetic rather than reused; both count early ballots only.',
    ],
  },
  {
    v: '4.0',
    commit: 'ac4e5f0669ba13b6115c34c5789e3484638179fd',
    date: 'August 2026',
    headline: 'Weather, a day-by-day map, and a rebuilt site grid',
    notes: [
      'Daily county weather on every view — the map, the site grid and the full table — so a soft day can be checked against whether it rained.',
      'The map gained a day-by-day scrubber: play through the cycle and watch thirteen sites switch on at once on 23 October.',
      'Site grid metrics reworked and renamed to say what they actually compute, including a plain "vs this site\u2019s daily average".',
      'Day of week added to the grid header; weekends marked.',
      'The full data table is now shaded per column, each on its own scale.',
      'Map markers are circles rather than ovals, so area reads correctly.',
    ],
  },
  {
    v: '3.0',
    commit: '5a8abd3d2589d45e18afa81e73539aca6b0c3ba1',
    date: 'August 2026',
    headline: 'Real geocoded site locations, and a versioned archive',
    notes: [
      'Every early-voting site now sits at its surveyed address rather than a hand-guessed coordinate, geocoded against the same Census reference the county boundary comes from.',
      'Site addresses are shown on the map and in the data.',
      'Past versions are archived as genuine frozen builds of their release tag, rather than the current app re-rendered.',
    ],
  },
  {
    v: '2.1',
    commit: '88043e912837e321e671fb2ee606c08c0099a4a7',
    date: 'August 2026',
    headline: 'New typefaces, and a switchable site grid',
    notes: [
      'Fraunces and Source Sans 3 replace the two geometric faces; fonts self-hosted.',
      'The site grid gained a metric switcher (six measures) and shows values inside the cells.',
    ],
  },
  {
    v: '2.0',
    commit: 'd0241ebb6d037babab3516980ef35b3117ac1082',
    date: 'August 2026',
    headline: 'Light theme, multi-election archive, county map',
    notes: [
      'Light "warm paper" theme replacing the dark navy.',
      'Home page leads with cross-cycle comparison indexed to days-until-Election-Day.',
      'The oval grid was replaced with views that divide out the shared arc.',
      'Added Fairfax 2023 and 2024, plus per-election pages and this archive.',
    ],
  },
  {
    v: '1.0',
    commit: 'f818cef8778098b6034c27b8104d54cd3ffa301c',
    date: 'August 2026',
    headline: 'Dark navy single-page dashboard, Fairfax 2025 only',
    notes: [
      'The original Claude artifact, rebuilt as a Vite + React project.',
      'Signature element was a site x day grid of ballot-punch ovals.',
      'One dataset, one page, no routing.',
    ],
  },
];

export const CURRENT = VERSIONS.find((r) => r.v === VERSION);
export const ARCHIVED = VERSIONS.filter((r) => r.v !== VERSION);
