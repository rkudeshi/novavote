/* Minimal scale + path helpers. The custom charts are hand-rolled SVG
   rather than recharts so the reveal animations can be driven off a
   single progress value. */

export const linear = (d0, d1, r0, r1) => (v) =>
  d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);

export const niceMax = (v) => {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  return Math.ceil(v / mag) * mag;
};

/** Catmull-Rom -> cubic bezier, for a smooth line through every point. */
export function smoothPath(pts) {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : '';
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x},${c1y} ${c2x},${c2y} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/** Take the leading `p` fraction of points, interpolating the last step
    so a reveal animation moves continuously instead of snapping. */
export function partial(pts, p) {
  if (p >= 1) return pts;
  if (p <= 0) return [];
  const exact = (pts.length - 1) * p;
  const whole = Math.floor(exact);
  const frac = exact - whole;
  const head = pts.slice(0, whole + 1);
  if (frac > 0 && pts[whole + 1]) {
    const [x0, y0] = pts[whole];
    const [x1, y1] = pts[whole + 1];
    head.push([x0 + (x1 - x0) * frac, y0 + (y1 - y0) * frac]);
  }
  return head;
}
