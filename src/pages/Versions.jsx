/* ------------------------------------------------------------------
   Version archive.

   Each archived entry links to a real build of that release's git tag,
   generated at deploy time into /versions/<v>/. They are frozen: their
   own markup, styles and data as of that release, so nothing here can be
   broken by a later refactor — and nothing needs the current app to keep
   a compatibility shim for an old design.

   Consequence worth knowing: the archive links only resolve on a
   deployed build. In local dev there is nothing at those paths.
------------------------------------------------------------------ */
import { ARCHIVED, CURRENT, VERSION, VERSIONS } from '../version.js';
import { Link } from '../lib/router.jsx';

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const archiveHref = (v) => `${BASE}/versions/${v}/`;

export default function Versions() {
  return (
    <section className="section">
      <div className="wrap">
        <div className="eyebrow">Archive</div>
        <h1 className="h1" style={{ marginBottom: 16 }}>Every version of this site</h1>
        <p className="lede" style={{ marginBottom: 14 }}>
          Each release stays browsable at its own address. These are real
          frozen builds of the release, not the current site re-skinned — so
          they show the design <em>and</em> the data exactly as they stood.
        </p>
        <p className="note" style={{ marginBottom: 36 }}>
          Versioning: a significant change bumps the major number, a smaller one
          the minor. Currently on <strong>v{VERSION}</strong>.
        </p>

        <ol className="versions">
          <li className="card version is-current">
            <div className="version-head">
              <div>
                <h2 className="h2">Version {CURRENT.v}</h2>
                <div className="version-meta">
                  {CURRENT.date}
                  <span className="pill">Current</span>
                </div>
              </div>
              <Link to="/" className="btn">You're looking at it →</Link>
            </div>
            <p className="version-headline">{CURRENT.headline}</p>
            <ul className="version-notes">
              {CURRENT.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          </li>

          {ARCHIVED.map((r) => (
            <li key={r.v} className="card version">
              <div className="version-head">
                <div>
                  <h2 className="h2">Version {r.v}</h2>
                  <div className="version-meta">{r.date}</div>
                </div>
                {/* A full page load, not a client route — the archive is a
                    separate build with its own assets. */}
                <a className="btn" href={archiveHref(r.v)}>
                  View v{r.v} →
                </a>
              </div>
              <p className="version-headline">{r.headline}</p>
              <ul className="version-notes">
                {r.notes.map((n) => <li key={n}>{n}</li>)}
              </ul>
            </li>
          ))}
        </ol>

        <p className="note" style={{ marginTop: 28 }}>
          {VERSIONS.length} releases archived. Older builds keep the data they
          shipped with, so figures there may differ from the current site as
          sources are corrected or extended.
        </p>
      </div>
    </section>
  );
}
