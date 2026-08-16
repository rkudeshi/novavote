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
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path("probe-out")
UA = {"User-Agent": "Mozilla/5.0 (NovaVote data survey)"}

EVENT = "2025 November General"

# Early-voting schedules: the county publishes hours as prose on its
# elections pages, and the Wayback CDX API is how past cycles' versions of
# those pages are found. Neither host is reachable from the dev sandbox.
SCHEDULE = [
    "https://www.fairfaxcounty.gov/elections/early-voting",
    "https://fairfaxvotes.org/early/",
    "http://web.archive.org/cdx/search/cdx?url=fairfaxcounty.gov/elections/early-voting&output=json&limit=60&filter=statuscode:200&collapse=timestamp:6",
    "http://web.archive.org/cdx/search/cdx?url=fairfaxcounty.gov/elections/absentee-locations*&output=json&limit=80&filter=statuscode:200&collapse=urlkey",
]

CANDIDATES = [
    # ELECT landing pages — harvested for links to the actual data files.
    "https://www.elections.virginia.gov/resultsreports/registrationturnout-statistics/",
    "https://www.elections.virginia.gov/resultsreports/",
    "https://www.elections.virginia.gov/resultsreports/absentee-statistics/",
    # Official ELECT results — these carry ballots cast by method per
    # locality, which is the early in-person / by-mail split we want.
    "https://results.elections.virginia.gov/",
    f"https://results.elections.virginia.gov/vaelections/{EVENT}/Site/Locality.html",
    f"https://results.elections.virginia.gov/vaelections/{EVENT}/Json/ElectionEvent.json",
]


# Links worth following out of an HTML landing page: data files, and
# anything whose text mentions absentee / early / turnout.
INTERESTING = re.compile(
    r'(\.csv|\.xlsx?|\.zip|\.json|absentee|early[-_ ]?vot|turnout|november.?2025|2025.?november)',
    re.I,
)


def harvest(base, html):
    """Print every link on an HTML page that looks like data."""
    hrefs = re.findall(r'href=["\']([^"\']+)["\']', html, re.I)
    hits = []
    for h in hrefs:
        if h.startswith(("mailto:", "javascript:", "#")):
            continue
        full = urllib.parse.urljoin(base, h)
        if INTERESTING.search(full):
            hits.append(full)
    seen, out = set(), []
    for h in hits:
        if h not in seen:
            seen.add(h)
            out.append(h)
    print(f"[links] {len(out)} candidate data links:", flush=True)
    for h in out[:80]:
        print("   ", h, flush=True)
    return out


def probe(url):
    print(f"\n{'=' * 78}\n{url}\n{'=' * 78}", flush=True)
    # Spaces and other literal characters are common in ELECT's paths.
    url = urllib.parse.quote(url, safe=":/?#[]@!$&'()*+,;=%~")
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
        if "html" in ctype.lower():
            harvest(url, text)
        else:
            print(text[:6000], flush=True)
        return None

    OUT.mkdir(exist_ok=True)
    name = url.rstrip("/").split("/")[-1] or "index"
    (OUT / f"{name}").write_text(json.dumps(data, indent=2)[:400_000], encoding="utf-8")
    print("[json] top-level keys:", list(data)[:40] if isinstance(data, dict) else f"list[{len(data)}]", flush=True)
    print(json.dumps(data, indent=2)[:2500], flush=True)
    return data


def main():
    args = sys.argv[1:]
    if args and args[0] == "--schedule":
        urls = SCHEDULE + args[1:]
    else:
        urls = args or CANDIDATES
    for u in urls:
        probe(u)


if __name__ == "__main__":
    main()
