#!/usr/bin/env python3
"""Fetch Fairfax County's boundary from the Census cartographic files.

Produces src/data/fairfax-boundary.json — a small GeoJSON-ish polygon set
used by the site map. Runs in CI (the dev sandbox has no outbound
network).

Fairfax County is a doughnut: the independent cities of Fairfax City and
Falls Church sit inside its borders but are separate jurisdictions with
their own elections, so they are emitted separately and drawn as holes.
"""

import io
import json
import urllib.request
import zipfile
from pathlib import Path

SRC = "https://www2.census.gov/geo/tiger/GENZ2023/shp/cb_2023_us_county_500k.zip"
OUT = Path("src/data/fairfax-boundary.json")

# GEOID -> role
WANT = {
    "51059": "county",        # Fairfax County
    "51600": "enclave",       # Fairfax City
    "51610": "enclave",       # Falls Church
}


def _rdp(pts, tol):
    """Ramer-Douglas-Peucker on an *open* polyline."""
    if len(pts) < 3:
        return list(pts)
    (x0, y0), (x1, y1) = pts[0], pts[-1]
    dx, dy = x1 - x0, y1 - y0
    norm = (dx * dx + dy * dy) ** 0.5
    worst_i, worst_d = 0, -1.0
    for i in range(1, len(pts) - 1):
        x, y = pts[i]
        if norm == 0:
            # Degenerate baseline (endpoints coincide): fall back to radial
            # distance, otherwise every point measures as infinitely far.
            d = ((x - x0) ** 2 + (y - y0) ** 2) ** 0.5
        else:
            d = abs(dy * x - dx * y + x1 * y0 - y1 * x0) / norm
        if d > worst_d:
            worst_i, worst_d = i, d
    if worst_d <= tol:
        return [pts[0], pts[-1]]
    return _rdp(pts[: worst_i + 1], tol)[:-1] + _rdp(pts[worst_i:], tol)


def simplify(ring, tol=0.0012):
    """Simplify a closed ring. The map is a locator, not a survey, so
    ~100m of fidelity is far more than enough.

    A closed ring can't go through RDP directly — its first and last
    points coincide, so the baseline has zero length. Split it in half
    and simplify each arc, then reclose.
    """
    if len(ring) < 4:
        return ring
    closed = ring[0] == ring[-1]
    open_ring = ring[:-1] if closed else list(ring)
    if len(open_ring) < 4:
        return ring

    mid = len(open_ring) // 2
    out = _rdp(open_ring[: mid + 1], tol)[:-1] + _rdp(open_ring[mid:], tol)

    # Never return something degenerate — fall back to even decimation
    # rather than dropping a shape entirely.
    if len(out) < 4:
        step = max(1, len(open_ring) // 400)
        out = open_ring[::step]
    if out[0] != out[-1]:
        out = out + [out[0]]
    return out


def main():
    import shapefile  # pyshp

    req = urllib.request.Request(SRC, headers={"User-Agent": "Mozilla/5.0 (NovaVote)"})
    with urllib.request.urlopen(req, timeout=180) as r:
        blob = r.read()
    print(f"[fetch] {len(blob):,} bytes", flush=True)

    zf = zipfile.ZipFile(io.BytesIO(blob))
    base = next(n[:-4] for n in zf.namelist() if n.endswith(".shp"))
    reader = shapefile.Reader(
        shp=io.BytesIO(zf.read(base + ".shp")),
        dbf=io.BytesIO(zf.read(base + ".dbf")),
        shx=io.BytesIO(zf.read(base + ".shx")),
    )

    fields = [f[0] for f in reader.fields[1:]]
    geoid_i = fields.index("GEOID")
    name_i = fields.index("NAME")

    features = []
    for sr in reader.iterShapeRecords():
        geoid = sr.record[geoid_i]
        if geoid not in WANT:
            continue
        pts = [list(p) for p in sr.shape.points]
        parts = list(sr.shape.parts) + [len(pts)]
        rings = []
        for a, b in zip(parts, parts[1:]):
            ring = simplify(pts[a:b])
            if len(ring) > 3:
                rings.append([[round(x, 5), round(y, 5)] for x, y in ring])
        rings.sort(key=len, reverse=True)
        features.append({
            "geoid": geoid,
            "name": sr.record[name_i],
            "role": WANT[geoid],
            "rings": rings,
        })
        print(f"[shape] {geoid} {sr.record[name_i]}: {len(rings)} ring(s), "
              f"{sum(len(r) for r in rings)} points", flush=True)

    missing = set(WANT) - {f["geoid"] for f in features}
    if missing:
        raise SystemExit(f"missing expected shapes: {sorted(missing)}")

    xs = [p[0] for f in features if f["role"] == "county" for r in f["rings"] for p in r]
    ys = [p[1] for f in features if f["role"] == "county" for r in f["rings"] for p in r]
    doc = {
        "source": SRC,
        "note": "Census 2023 cartographic boundary, simplified for display.",
        "bbox": [min(xs), min(ys), max(xs), max(ys)],
        "features": features,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, separators=(",", ":")))
    print(f"[write] {OUT} ({OUT.stat().st_size:,} bytes) bbox={doc['bbox']}", flush=True)


if __name__ == "__main__":
    main()
