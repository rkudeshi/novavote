#!/usr/bin/env python3
"""Fetch daily weather for every cycle's early-voting window.

One observation per day per jurisdiction, taken at that jurisdiction's
centroid — not per voting site. Early voting spans ~25 miles inside
Fairfax alone, and the weather that plausibly moves turnout (a washout, a
cold snap) is regional, so a single point per locality is both honest and
enough. Sampling per site would imply a precision the measure does not
have.

Source: Open-Meteo's historical archive (ERA5 reanalysis). Free, no API
key, no attribution requirement beyond the licence note below.

Runs in CI — the dev sandbox has no outbound network.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ARCHIVE = "https://archive-api.open-meteo.com/v1/archive"
CENTROIDS = Path("data/locality_centroids.json")
OUT = Path("data/weather.json")
UA = {"User-Agent": "NovaVote/1.0 (Virginia early-voting turnout site)"}

# Election year -> inclusive date range to cover. Runs well past Election
# Day: the reports carry post-election rows while late mail is still
# being received (2023 has rows through 11/13), and those days need
# weather too.
WINDOWS = {
    2020: ("2020-09-16", "2020-11-16"),
    2021: ("2021-09-15", "2021-11-16"),
    2022: ("2022-09-21", "2022-11-20"),
    2023: ("2023-09-18", "2023-11-16"),
    2024: ("2024-09-16", "2024-11-16"),
    2025: ("2025-09-15", "2025-11-16"),
}

# Locality -> the slug its cycle ids use. Fairfax is the only one with
# cycles back to 2020; the rest start in 2023 (see LOCALITY_ELECTIONS in
# scripts/gen-data.mjs). Fetching a window a locality has no cycle for
# costs one request and means a new cycle needs no change here.
SLUGS = {
    "Fairfax County": "fairfax",
    "Loudoun County": "loudoun",
    "Prince William County": "prince-william",
    "Arlington County": "arlington",
    "Alexandria City": "alexandria",
    "Fairfax City": "fairfax-city",
    "Falls Church City": "falls-church",
    "Manassas City": "manassas",
    "Manassas Park City": "manassas-park",
}

# WMO weather codes -> short label. Grouped: the point is "was it the kind
# of day that keeps people home", not meteorological precision.
WMO = {
    0: "Clear", 1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Rime fog",
    51: "Light drizzle", 53: "Drizzle", 55: "Heavy drizzle",
    56: "Freezing drizzle", 57: "Freezing drizzle",
    61: "Light rain", 63: "Rain", 65: "Heavy rain",
    66: "Freezing rain", 67: "Freezing rain",
    71: "Light snow", 73: "Snow", 75: "Heavy snow", 77: "Snow grains",
    80: "Rain showers", 81: "Rain showers", 82: "Violent rain showers",
    85: "Snow showers", 86: "Heavy snow showers",
    95: "Thunderstorm", 96: "Thunderstorm with hail", 99: "Thunderstorm with hail",
}


ATTEMPTS = 4


def fetch(lat, lon, start, end):
    """One archive query, retried on a transient failure.

    Fifty-four windows go out back to back and the archive rate-limits.
    A single refusal used to take the whole run down, and because the
    workflow step is non-blocking that showed up as a green step that
    quietly changed nothing.
    """
    last = None
    for attempt in range(1, ATTEMPTS + 1):
        try:
            return _fetch_once(lat, lon, start, end)
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as e:
            last = e
            code = getattr(e, "code", None)
            if code and code not in (408, 429, 500, 502, 503, 504):
                raise
            wait = 3 * attempt
            print(f"      retry {attempt}/{ATTEMPTS} after {e} — waiting {wait}s",
                  flush=True)
            time.sleep(wait)
    raise SystemExit(f"archive request failed after {ATTEMPTS} attempts: {last}")


def _fetch_once(lat, lon, start, end):
    q = urllib.parse.urlencode({
        "latitude": f"{lat:.4f}",
        "longitude": f"{lon:.4f}",
        "start_date": start,
        "end_date": end,
        "daily": ",".join([
            "weather_code",
            "temperature_2m_max",
            "temperature_2m_min",
            "precipitation_sum",
            "rain_sum",
            "snowfall_sum",
            "wind_speed_10m_max",
        ]),
        "temperature_unit": "fahrenheit",
        "precipitation_unit": "inch",
        "wind_speed_unit": "mph",
        "timezone": "America/New_York",
    })
    req = urllib.request.Request(f"{ARCHIVE}?{q}", headers=UA)
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)


def summarise(payload):
    d = payload["daily"]
    days = {}
    for i, date in enumerate(d["time"]):
        code = d["weather_code"][i]
        precip = d["precipitation_sum"][i]
        snow = d["snowfall_sum"][i]
        days[date] = {
            "code": code,
            "label": WMO.get(code, f"code {code}"),
            "tempMax": d["temperature_2m_max"][i],
            "tempMin": d["temperature_2m_min"][i],
            "precip": precip,
            "rain": d["rain_sum"][i],
            "snow": snow,
            "wind": d["wind_speed_10m_max"][i],
            # Pre-computed so the UI doesn't re-derive a judgement call:
            # a quarter inch is roughly "you'd notice it queueing".
            "wet": bool(precip and precip >= 0.25),
            "snowy": bool(snow and snow > 0),
        }
    return days


def main():
    if not CENTROIDS.exists():
        sys.exit(f"{CENTROIDS} missing — run scripts/fetch_boundary.py first")
    localities = json.loads(CENTROIDS.read_text())["localities"]

    # Merged into whatever is already there, and written after every
    # cycle. Fifty-four windows is long enough that a refusal partway
    # through is a real possibility, and a run that throws away the
    # fifty it did fetch would never converge.
    out = json.loads(OUT.read_text()) if OUT.exists() else {}
    out.update({
        "_comment": (
            "Daily weather for each cycle's early-voting window, one "
            "observation per day at the jurisdiction's centroid, from "
            "Open-Meteo's ERA5 archive. Generated by "
            "scripts/fetch_weather.py — do not hand-edit."
        ),
        "source": "https://open-meteo.com/ (ERA5 reanalysis)",
        "licence": "Open-Meteo data under CC BY 4.0",
        "centroids": {n: {"lat": c["lat"], "lon": c["lon"]}
                      for n, c in sorted(localities.items())},
    })
    out.setdefault("cycles", {})

    def save():
        out["cycles"] = dict(sorted(out["cycles"].items()))
        OUT.write_text(json.dumps(out, indent=2) + "\n")

    wanted = [(f"{slug}-{year}-general", name, year)
              for name, slug in SLUGS.items() for year in WINDOWS]
    todo = [w for w in wanted if w[0] not in out["cycles"]]
    print(f"{len(wanted)} cycles wanted, {len(wanted) - len(todo)} already held, "
          f"{len(todo)} to fetch", flush=True)

    failed = []
    for cycle, name, year in todo:
        c = localities.get(name)
        if not c:
            sys.exit(f"no centroid for {name}")
        start, end = WINDOWS[year]
        try:
            days = summarise(fetch(c["lat"], c["lon"], start, end))
        except SystemExit as e:
            print(f"   {cycle:<28} FAILED: {e}", flush=True)
            failed.append(cycle)
            continue
        out["cycles"][cycle] = days
        save()
        wet = sum(1 for v in days.values() if v["wet"])
        snowy = sum(1 for v in days.values() if v["snowy"])
        print(f"   {cycle:<28} {len(days):>3} days, {wet:>2} wet, "
              f"{snowy:>2} snowy", flush=True)

    save()
    print(f"\nwrote {OUT}: {len(out['cycles'])} cycles, "
          f"{sum(len(v) for v in out['cycles'].values()):,} days", flush=True)
    if failed:
        sys.exit(f"{len(failed)} cycle(s) not fetched: {failed}. "
                 f"Re-run — what did land is saved.")


if __name__ == "__main__":
    main()
