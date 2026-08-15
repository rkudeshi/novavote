#!/usr/bin/env python3
"""Probe candidate sources for Northern Virginia early-voting totals.

The dev sandbox cannot reach elections.virginia.gov or vpap.org, so this
runs on a CI runner and dumps whatever each candidate URL returns. It is a
*reconnaissance* script: it prints status, content type and a head of the
body so the response shape can be read, and writes anything that parses as
JSON to probe-out/ for inspection.

It deliberately does not transform or store totals. Numbers only enter the
site through scripts/build_nova_totals.py, which reconciles what it writes.
"""

import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

OUT = Path("probe-out")
UA = {"User-Agent": "Mozilla/5.0 (NovaVote data survey)"}

EVENT = "2025 November General"

CANDIDATES = [
    # Official ELECT results — these carry ballots-cast by method per locality
    # in recent cycles, which is exactly the early in-person / by-mail split.
    f"https://results.elections.virginia.gov/vaelections/{EVENT}/Json/ElectionEvent.json",
    f"https://results.elections.virginia.gov/vaelections/{EVENT}/Json/Index.json",
    "https://results.elections.virginia.gov/vaelections/index.html",
    # ELECT turnout statistics landing pages.
    "https://www.elections.virginia.gov/resultsreports/registrationturnout-statistics/",
    "https://www.elections.virginia.gov/resultsreports/absentee-early-voting-statistics/",
    # VPAP visualisations (downstream analyst — a pointer, not a primary source).
    "https://www.vpap.org/visuals/visual/early-voting-comparison/",
]


def probe(url):
    print(f"\n{'=' * 78}\n{url}\n{'=' * 78}", flush=True)
    req = urllib.request.Request(url, headers=UA)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            body = r.read()
            ctype = r.headers.get("Content-Type", "?")
            print(f"[ok] {r.status} {ctype} {len(body):,} bytes", flush=True)
    except urllib.error.HTTPError as e:
        print(f"[http {e.code}] {e.reason}", flush=True)
        return None
    except Exception as e:
        print(f"[error] {type(e).__name__}: {e}", flush=True)
        return None

    text = body.decode("utf-8", "replace")
    try:
        data = json.loads(text)
    except ValueError:
        print(text[:1200], flush=True)
        return None

    OUT.mkdir(exist_ok=True)
    name = url.rstrip("/").split("/")[-1] or "index"
    (OUT / f"{name}").write_text(json.dumps(data, indent=2)[:400_000], encoding="utf-8")
    print("[json] top-level keys:", list(data)[:40] if isinstance(data, dict) else f"list[{len(data)}]", flush=True)
    print(json.dumps(data, indent=2)[:2500], flush=True)
    return data


def main():
    urls = sys.argv[1:] or CANDIDATES
    for u in urls:
        probe(u)


if __name__ == "__main__":
    main()
