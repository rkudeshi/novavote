#!/usr/bin/env python3
"""Geocode the early-voting site addresses in data/site_locations.json.

Uses the US Census Geocoder, which is free, needs no API key, and is the
authoritative source for US address geocoding — appropriate here because
the map is plotted on Census boundary geometry, so address and boundary
come from the same coordinate reference.

Runs in CI; the dev sandbox has no outbound network. Writes lat/lon back
into the same file so a coordinate always traces to a real address.

Only sites missing a coordinate are looked up unless --force is passed,
so re-runs are cheap and stable.
"""

import argparse
import json
import sys
import time
import urllib.parse
import urllib.request
from pathlib import Path

SRC = Path("data/site_locations.json")
CENSUS = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress"
# Nominatim asks for a descriptive UA identifying the application.
NOMINATIM = "https://nominatim.openstreetmap.org/search"
UA = {"User-Agent": "NovaVote/1.0 (Virginia early-voting turnout site; geocoding 16 fixed addresses)"}

# Fairfax County's bounding box, generously padded. A geocoder that falls
# back to a state or ZIP centroid tends to land far outside this; better to
# fail loudly than to plot a site in the wrong place.
BBOX = (-77.60, 38.55, -76.95, 39.10)


def geocode_census(site):
    """Preferred source: same reference frame as the boundary geometry."""
    one_line = f"{site['address']}, {site['city']}, {site['state']} {site['zip']}"
    q = urllib.parse.urlencode({
        "address": one_line,
        "benchmark": "Public_AR_Current",
        "format": "json",
    })
    req = urllib.request.Request(f"{CENSUS}?{q}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        payload = json.load(r)
    matches = payload.get("result", {}).get("addressMatches", [])
    if not matches:
        return None
    c = matches[0]["coordinates"]
    return float(c["y"]), float(c["x"]), matches[0].get("matchedAddress", ""), "census"


def geocode_nominatim(site):
    """Fallback for addresses missing from the Census range files — which
    happens for newer developments and office parks (Jim Scott on Vaden Dr
    and Sully on Stonecroft Blvd were both misses)."""
    q = urllib.parse.urlencode({
        "street": site["address"],
        "city": site["city"],
        "state": site["state"],
        "postalcode": site["zip"],
        "country": "USA",
        "format": "json",
        "limit": "1",
    })
    req = urllib.request.Request(f"{NOMINATIM}?{q}", headers=UA)
    with urllib.request.urlopen(req, timeout=60) as r:
        results = json.load(r)
    if not results:
        return None
    m = results[0]
    return float(m["lat"]), float(m["lon"]), m.get("display_name", ""), "openstreetmap"


def geocode(site):
    """Census first, OpenStreetMap only if it misses. Returns the source so
    provenance stays visible in the committed data."""
    try:
        got = geocode_census(site)
    except Exception as e:
        print(f"        census error: {type(e).__name__}: {e}", flush=True)
        got = None
    if got:
        return got
    print("        census had no match; trying openstreetmap", flush=True)
    time.sleep(1.1)          # Nominatim asks for <= 1 request/second
    try:
        return geocode_nominatim(site)
    except Exception as e:
        print(f"        openstreetmap error: {type(e).__name__}: {e}", flush=True)
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--force", action="store_true",
                    help="re-geocode sites that already have coordinates")
    args = ap.parse_args()

    doc = json.loads(SRC.read_text())
    sites = doc["sites"]
    failures = []
    changed = 0

    for s in sites:
        if s.get("lat") is not None and not args.force:
            print(f"  skip  {s['key']:<22} already geocoded", flush=True)
            continue

        one_line = f"{s['address']}, {s['city']}, {s['state']} {s['zip']}"
        got = geocode(s)
        if not got:
            print(f"  MISS  {s['key']:<22} no match from any source for {one_line!r}",
                  flush=True)
            failures.append(s["key"])
            continue
        lat, lon, matched, source = got

        if not (BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]):
            print(f"  OUT   {s['key']:<22} {lat},{lon} outside the expected area "
                  f"(matched {matched!r}, via {source}) — not applied", flush=True)
            failures.append(s["key"])
            continue

        s["lat"] = round(lat, 6)
        s["lon"] = round(lon, 6)
        s["matchedAddress"] = matched
        s["geocodeSource"] = source
        changed += 1
        print(f"  ok    {s['key']:<22} {s['lat']:.5f}, {s['lon']:.5f}  "
              f"[{source}] <- {matched[:60]}", flush=True)
        time.sleep(0.4)   # be polite to a free public service

    SRC.write_text(json.dumps(doc, indent=2) + "\n")
    print(f"\ngeocoded {changed} site(s); {len(failures)} unresolved", flush=True)

    if failures:
        print("unresolved: " + ", ".join(failures), flush=True)
        # Non-fatal: gen-data.mjs refuses to build a site with no coordinate,
        # so an unresolved address surfaces there rather than shipping.
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
