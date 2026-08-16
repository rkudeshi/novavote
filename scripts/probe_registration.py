#!/usr/bin/env python3
"""Reconnaissance for per-locality registered-voter counts.

Share of the electorate is the one measure that puts a county of 810,000
and a city of 10,000 on the same footing, and right now only Fairfax 2025
has a denominator — eight of the nine jurisdictions on the home page show
a dash. The counts exist; they are published by the state. The dev
sandbox cannot reach any of the hosts that serve them, so this runs on a
CI runner and dumps what each candidate returns, before any parser is
written against a response shape nobody has seen.

It stores nothing. Numbers only enter the site through a script that
reconciles what it writes.

SCOPE NOTE: the state's results host is probed here because its
per-locality pages carry a registered-voter count. Only that count is of
interest. This project holds no results or partisan data by design, and a
parser written against these pages must take the registration figure and
nothing else.
"""

import argparse
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path("probe-out")
UA = {"User-Agent": "Mozilla/5.0 (NovaVote data survey)"}
TIMEOUT = 25

LOCALITIES = [
    "Fairfax County", "Loudoun County", "Prince William County",
    "Arlington County", "Alexandria City", "Fairfax City",
    "Falls Church City", "Manassas City", "Manassas Park City",
]

# Machine-readable first. The state's open-data portal runs CKAN, whose
# API answers with JSON and needs no scraping; only if that turns up
# nothing do the HTML landing pages matter.
CANDIDATES = [
    "https://data.virginia.gov/api/3/action/package_search?q=registered+voters&rows=25",
    "https://data.virginia.gov/api/3/action/package_search?q=registration+statistics&rows=25",
    "https://data.virginia.gov/api/3/action/organization_show"
    "?id=virginia-department-of-elections&include_datasets=true",
    "https://www.elections.virginia.gov/resultsreports/registrationturnout-statistics/",
    "https://www.elections.virginia.gov/casting-a-ballot/registration-statistics/",
    "https://www.elections.virginia.gov/resultsreports/registration-statistics/registrant-counts/",
    "https://results.elections.virginia.gov/vaelections/2025%20November%20General/Json/ElectionEvent.json",
    "https://results.elections.virginia.gov/vaelections/2025%20November%20General/Index.html",
]

# Links worth following out of a landing page.
INTERESTING = re.compile(
    r"(\.csv|\.xlsx?|\.zip|\.json|registrant|registration|registered|turnout)", re.I
)


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.status, r.headers.get("Content-Type", ""), r.read()


def show_json(name, body):
    try:
        doc = json.loads(body)
    except ValueError:
        return False
    OUT.mkdir(exist_ok=True)
    (OUT / f"{name}.json").write_bytes(body)

    # CKAN package_search / organization_show both nest results the same
    # way; print titles and resource URLs, which is the whole point.
    results = None
    if isinstance(doc, dict):
        res = doc.get("result")
        if isinstance(res, dict):
            results = res.get("results") or res.get("packages")
        elif isinstance(res, list):
            results = res
    if results:
        for pkg in results[:25]:
            if not isinstance(pkg, dict):
                continue
            print(f"    * {pkg.get('title') or pkg.get('name')}")
            for r in (pkg.get("resources") or [])[:6]:
                print(f"        [{r.get('format')}] {r.get('url')}")
    else:
        print(f"    (json, {len(body)} bytes) keys: "
              f"{list(doc)[:12] if isinstance(doc, dict) else type(doc).__name__}")
    return True


def show_html(base, body):
    text = body.decode("utf-8", "replace")
    seen = set()
    for href in re.findall(r'href=["\']([^"\']+)["\']', text, re.I):
        if not INTERESTING.search(href) or href in seen:
            continue
        seen.add(href)
        print(f"    -> {urllib.parse.urljoin(base, href)}")
        if len(seen) >= 25:
            break
    if not seen:
        print(f"    (html, {len(text)} chars, no data-looking links)")
    # Does the page name the localities we need at all?
    hits = [n for n in LOCALITIES if n.replace(" City", "").lower() in text.lower()]
    if hits:
        print(f"    mentions: {', '.join(hits[:6])}"
              f"{' …' if len(hits) > 6 else ''}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("urls", nargs="*", help="override the built-in candidate list")
    a = ap.parse_args()

    for i, url in enumerate(a.urls or CANDIDATES):
        print(f"\n== {url}")
        try:
            status, ctype, body = get(url)
        except urllib.error.HTTPError as e:
            print(f"    HTTP {e.code} {e.reason}")
            continue
        except Exception as e:                      # noqa: BLE001 — recon
            print(f"    failed: {type(e).__name__}: {e}")
            continue
        print(f"    HTTP {status}  {ctype}  {len(body)} bytes")
        if "json" in ctype.lower() or body[:1] in (b"{", b"["):
            if show_json(f"reg-{i}", body):
                continue
        show_html(url, body)


if __name__ == "__main__":
    main()
