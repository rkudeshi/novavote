#!/usr/bin/env python3
"""Fetch and parse every active source in data/sources.json.

Driven by .github/workflows/daily-pull.yml. During early voting the county
republishes the same URL daily with one more row of data, so re-running
this each morning keeps the site current.

Safety properties that matter for an unattended job:
  * The parse is self-checking (see parse_report.py) — a layout change
    fails the run rather than committing wrong numbers.
  * A source that 404s is reported but does not fail the whole run, so
    one dead URL doesn't block the others.
  * Output goes to data/parsed/, the same place the historical CSVs live,
    so gen-data.mjs needs no special case for "today's" data.
"""

import argparse
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SOURCES = ROOT / "data" / "sources.json"
WORK = ROOT / "pdf-extract"


def fetch(url, dest):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (NovaVote daily pull)"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = r.read()
    if not data.startswith(b"%PDF"):
        raise ValueError(f"not a PDF (got {data[:16]!r})")
    dest.write_bytes(data)
    return len(data)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="", help="restrict to one cycle id")
    args = ap.parse_args()

    config = json.loads(SOURCES.read_text())
    sources = [s for s in config.get("sources", []) if s.get("active")]
    if args.only:
        sources = [s for s in sources if s["cycle"] == args.only]

    if not sources:
        print("No active sources configured — nothing to pull.")
        print("Set \"active\": true on an entry in data/sources.json to enable.")
        return 0

    WORK.mkdir(exist_ok=True)
    failures = []

    for src in sources:
        cycle, url, year = src["cycle"], src.get("url", ""), src["year"]
        print(f"\n=== {cycle} ===", flush=True)
        if not url:
            print("  no url configured — skipping")
            failures.append(f"{cycle}: no url")
            continue

        pdf = WORK / f"{cycle}.pdf"
        try:
            size = fetch(url, pdf)
            print(f"  fetched {size:,} bytes", flush=True)
        except Exception as e:
            print(f"  FETCH FAILED: {type(e).__name__}: {e}", flush=True)
            failures.append(f"{cycle}: fetch — {e}")
            continue

        # parse_report.py exits non-zero if any column fails to reconcile
        # against the report's own published totals.
        result = subprocess.run(
            [sys.executable, str(ROOT / "scripts" / "parse_report.py"), str(pdf),
             "--year", str(year), "--cycle", cycle],
            cwd=ROOT,
        )
        if result.returncode != 0:
            failures.append(f"{cycle}: parse/reconcile failed")

    if failures:
        print("\nFAILURES:")
        for f in failures:
            print(f"  - {f}")
        return 1
    print("\nAll active sources pulled and reconciled.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
