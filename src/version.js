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

export const VERSION = '3.0';

export const VERSIONS = [
  {
    v: '3.0',
    commit: null,        // current — served at the site root
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
