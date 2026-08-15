/* ------------------------------------------------------------------
   Version archive.

   Old versions are kept as real, running React components under
   src/versions/, not screenshots — so /versions/v1 is the actual v1 UI
   driven by the current data, and it keeps working as the site evolves.

   To archive the current design when v3 begins: copy src/pages + the
   components it owns into src/versions/v2/, add an entry to VERSIONS,
   and point its `render` at the copy.
------------------------------------------------------------------ */
import { Link } from '../lib/router.jsx';

export const VERSIONS = [
  {
    slug: 'v2',
    name: 'Version 2',
    date: '2026-08',
    current: true,
    headline: 'Light theme, multi-election, cross-jurisdiction comparison',
    notes: [
      'Light "warm paper" theme replacing the dark navy.',
      'Home page leads with cross-cycle comparison indexed to days-until-Election-Day.',
      'The oval heatmap is gone: site data now shows deviation from the countywide pattern instead of redrawing the same curve per row.',
      'Per-election pages at /e/<id>, plus this archive.',
    ],
  },
  {
    slug: 'v1',
    name: 'Version 1',
    date: '2026-08',
    headline: 'Dark navy single-page dashboard, Fairfax 2025 only',
    notes: [
      'The original Claude artifact, rebuilt as a Vite + React project.',
      'Signature element was a site x day grid of ballot-punch ovals.',
      'One dataset, one page, no routing.',
    ],
  },
];

export default function Versions() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">Archive</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Every version of this site</h1>
        <p className="lede" style={{ marginBottom: 36 }}>
          Each past design stays live and browsable rather than being replaced.
          They run on the current data, so you can watch the same numbers move
          through successive redesigns.
        </p>

        <ol className="versions">
          {VERSIONS.map((v) => (
            <li key={v.slug} className="card version">
              <div className="version-head">
                <div>
                  <h2 className="h2">{v.name}</h2>
                  <div className="version-meta">
                    {v.date}
                    {v.current && <span className="pill">Current</span>}
                  </div>
                </div>
                {v.current ? (
                  <Link to="/" className="btn">You're looking at it →</Link>
                ) : (
                  <Link to={`/versions/${v.slug}`} className="btn">View {v.name} →</Link>
                )}
              </div>
              <p className="version-headline">{v.headline}</p>
              <ul className="version-notes">
                {v.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/** Chrome shown above an archived version so it's clear what you're seeing. */
export function VersionFrame({ version, children }) {
  return (
    <>
      <div className="version-bar">
        <div className="wrap version-bar-in">
          <span>
            <strong>Archived {version.name}</strong> — {version.headline}
          </span>
          <span className="version-bar-links">
            <Link to="/versions">All versions</Link>
            <Link to="/">Current site →</Link>
          </span>
        </div>
      </div>
      {children}
    </>
  );
}
