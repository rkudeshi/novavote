/* ------------------------------------------------------------------
   Weather glyph.

   Replaces the ☔ / ❄ / ○ emoji. Emoji render differently on every
   platform and carry a colour we don't control, which made the wet-day
   marker read as decoration rather than data.

   These are drawn: a cloud with drops that actually fall, or flakes that
   drift and turn. The motion is deliberately slow and small — it marks a
   day as wet at a glance without competing with the figures beside it.
   All of it stops under prefers-reduced-motion, leaving the same static
   shape, so the wet/dry distinction never depends on animation.
------------------------------------------------------------------ */

const CLOUD = 'M6.2 12.2a3 3 0 0 1 .5-6 4.2 4.2 0 0 1 8 .9 2.6 2.6 0 0 1-.4 5.1H6.2Z';

export default function WeatherIcon({ wet, snowy, size = 16 }) {
  const kind = snowy ? 'snow' : wet ? 'rain' : 'dry';
  return (
    <svg
      className={`wx-icon is-${kind}`}
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'dry' ? (
        /* A dry day is a quiet ring, not a rayed sun. This marker repeats
           on most rows of a dense table, so it has to recede; the rayed
           version read as clutter and its rotated rays escaped the glyph
           box. Only wet and snowy days earn motion. */
        <circle cx="10" cy="10" r="4" className="wx-sun" />
      ) : (
        <>
          <path d={CLOUD} className="wx-cloud" />
          {kind === 'rain'
            ? [4.5, 8.5, 12.5].map((x, i) => (
                <line
                  key={x}
                  x1={x + 6} y1="13.5" x2={x + 4.6} y2="17"
                  className="wx-drop"
                  style={{ animationDelay: `${i * 0.26}s` }}
                />
              ))
            : [5, 9.5, 14].map((x, i) => (
                <g key={x} className="wx-flake" style={{ animationDelay: `${i * 0.4}s` }}>
                  <line x1={x - 1.4} y1="15.4" x2={x + 1.4} y2="15.4" />
                  <line x1={x} y1="14" x2={x} y2="16.8" />
                </g>
              ))}
        </>
      )}
    </svg>
  );
}
