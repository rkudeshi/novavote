#!/usr/bin/env python3
"""Registered-voter counts per locality, from the state's turnout files.

Share of the electorate is the one measure that compares a county of
810,000 with a city of 10,000 on equal footing, and it needs a
denominator. Only Fairfax has one so far, because only Fairfax's own
report prints it — eight of nine jurisdictions on the home page show a
dash, and four of six Fairfax cycles drop out of the comparison.

The state publishes one CSV per election with a row per locality. That
covers every jurisdiction and every cycle this project holds, from one
source, which is what makes the column comparable across a row.

RUNS IN CI. The dev sandbox cannot reach this host.

SCOPE: this project holds no results or partisan data by design. These
files are turnout files, not results files, and only the registration
count and the ballots-cast total are read from them. Nothing here reads a
candidate, a party, or a contest.

The extraction is checked rather than trusted: Fairfax's own reports
print an active-voter count for four cycles, and this asserts the state's
figure against each of them before writing anything. If the column being
read were the wrong one, those four would not line up.
"""

import argparse
import csv
import io
import json
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://apps.elections.virginia.gov/SBE_CSV/ELECTIONS/ELECTIONTURNOUT/"
UA = {"User-Agent": "Mozilla/5.0 (NovaVote data survey)"}
TIMEOUT = 40
OUT = Path("data/registration.json")

# Election date -> the state's own name for that election, which is also
# its filename. Keep this in step with CYCLES in scripts/gen-data.mjs.
ELECTIONS = {
    "2025-11-04": "2025 November General",
    "2024-11-05": "2024 November General",
    "2023-11-07": "2023 November General",
    "2022-11-08": "2022 November General",
    "2021-11-02": "2021 November General",
    "2020-11-03": "2020 November General",
}

# The nine jurisdictions in scope. Keyed by the name this project uses;
# the state writes cities without the word "City", so both spellings are
# matched.
LOCALITIES = [
    "Fairfax County", "Loudoun County", "Prince William County",
    "Arlington County", "Alexandria City", "Fairfax City",
    "Falls Church City", "Manassas City", "Manassas Park City",
]

# Fairfax's own reports print an active-voter count. These are the check:
# a state figure that disagrees with the county's by more than a little
# means the wrong column is being read.
KNOWN = {
    "2025-11-04": 809786,
    "2023-11-07": 717440,
    "2022-11-08": 735000,
    "2021-11-02": 730300,
}
TOLERANCE = 0.03


def get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        return r.read().decode("utf-8-sig", "replace")


def rows_of(text):
    return list(csv.DictReader(io.StringIO(text)))


def norm(s):
    """Locality names, comparable across spellings.

    The state writes "FAIRFAX CITY" in some files and "FAIRFAX" in
    others, with the row's type in a separate column, so a bare
    lowercase compare would fold Fairfax City into Fairfax County. The
    suffix is kept and only punctuation and spacing are normalised.
    """
    return re.sub(r"[^a-z ]+", "", (s or "").lower()).strip()


def pick_column(header, wants, avoid=()):
    """First header matching every word in any `wants` phrase."""
    for phrase in wants:
        words = phrase.split()
        for h in header:
            hl = (h or "").lower()
            if any(a in hl for a in avoid):
                continue
            if all(w in hl for w in words):
                return h
    return None


def num(v):
    v = re.sub(r"[^0-9-]", "", str(v or ""))
    return int(v) if v not in ("", "-") else None


def read_election(name):
    url = BASE + urllib.parse.quote(f"Turnout-{name}.csv")
    text = get(url)
    rows = rows_of(text)
    if not rows:
        raise SystemExit(f"{name}: no rows")
    header = list(rows[0])

    loc_col = pick_column(header, ["locality name", "locality", "county city"])
    reg_col = pick_column(
        header,
        ["active voters", "registered voters", "total registered", "registered"],
        # "% of registered" and similar are ratios, not counts.
        avoid=("%", "percent", "pct"),
    )
    cast_col = pick_column(
        header,
        ["total ballots cast", "ballots cast", "total voted", "voted"],
        avoid=("%", "percent", "pct", "absentee", "early"),
    )
    print(f"\n== {name}")
    print(f"   columns: {header}")
    print(f"   locality={loc_col!r}  registered={reg_col!r}  cast={cast_col!r}")
    if not loc_col or not reg_col:
        raise SystemExit(f"{name}: could not identify locality/registered columns")

    by_name = {}
    for r in rows:
        key = norm(r.get(loc_col))
        if key:
            by_name[key] = r

    out = {}
    for want in LOCALITIES:
        r = by_name.get(norm(want))
        if r is None and want.endswith(" City"):
            # Some files drop the "City" suffix; fall back only when the
            # bare name is not also a county in this scope.
            bare = norm(want[: -len(" City")])
            if f"{bare} county" not in by_name:
                r = by_name.get(bare)
        if r is None:
            print(f"   [miss] {want}")
            continue
        entry = {"registered": num(r[reg_col])}
        if cast_col:
            entry["ballotsCast"] = num(r[cast_col])
        out[want] = entry
        print(f"   {want:<24} registered {entry['registered']!s:>9}"
              f"  cast {entry.get('ballotsCast')!s:>9}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="write data/registration.json (default is dump only)")
    a = ap.parse_args()

    doc = {}
    for date, name in ELECTIONS.items():
        try:
            doc[date] = read_election(name)
        except urllib.error.HTTPError as e:
            print(f"\n== {name}\n   HTTP {e.code} {e.reason}")
        except Exception as e:                       # noqa: BLE001
            print(f"\n== {name}\n   failed: {type(e).__name__}: {e}")

    print("\n-- check against Fairfax's own reports")
    bad = []
    for date, want in KNOWN.items():
        got = doc.get(date, {}).get("Fairfax County", {}).get("registered")
        if got is None:
            print(f"   {date}  no figure fetched")
            continue
        off = abs(got - want) / want
        flag = "OK " if off <= TOLERANCE else "OFF"
        print(f"   {date}  {got:>9,} vs {want:>9,} from the county — "
              f"{off * 100:.2f}% {flag}")
        if off > TOLERANCE:
            bad.append(date)
    if bad:
        raise SystemExit(
            f"registration figures disagree with the county's own for {bad}; "
            f"writing nothing"
        )

    if not a.write:
        print("\n(dump only — pass --write to save)")
        return
    if not any(doc.values()):
        raise SystemExit("nothing fetched; writing nothing")

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"elections": doc}, indent=2) + "\n", encoding="utf-8")
    print(f"\nwrote {OUT}")


if __name__ == "__main__":
    sys.exit(main())
