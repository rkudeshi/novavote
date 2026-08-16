#!/usr/bin/env python3
"""Registered-voter counts per locality, from the state's turnout files.

Share of the electorate is the one measure that compares a county of
810,000 with a city of 10,000 on equal footing, and it needs a
denominator. Only Fairfax has one so far, because only Fairfax's own
report prints it — eight of nine jurisdictions on the home page show a
dash, and four of six Fairfax cycles drop out of the comparison.

The state publishes one CSV per election with a row per **precinct**,
carrying that precinct's registration and turnout. Summed by locality it
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

# Election date -> the year whose November general file to look for. The
# state's filenames are not uniform ("Turnout-2022 November General.csv"
# is not the shape every year uses), so the directory index is read and
# the year's November general file is found in it rather than guessed.
# Keep this in step with CYCLES in scripts/gen-data.mjs.
ELECTIONS = {
    "2025-11-04": 2025,
    "2024-11-05": 2024,
    "2023-11-07": 2023,
    "2022-11-08": 2022,
    "2021-11-02": 2021,
    "2020-11-03": 2020,
}

# These files are per *precinct*, not per locality — one row per precinct
# with its own registration and turnout counts. A locality figure is the
# sum of its precincts. Reading the first matching row instead gives one
# precinct's numbers and looks entirely plausible: it reported 906 active
# voters for Fairfax County, against the county's own 735,000.
SUM_COLUMNS = {
    "registered": ["active registered voters", "activeregisteredvoters"],
    "registeredTotal": ["total registered voters", "totalregisteredvoters"],
    "ballotsCast": ["total vote turnout", "totalvoteturnout"],
    "absentee": ["absentee ballots", "absentee_ballots"],
    "inPerson": ["in person ballots", "in_person_ballots"],
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


def index():
    """Every turnout filename the directory lists, newest years first."""
    html = get(BASE)
    names = re.findall(r'href=["\']([^"\']*Turnout[^"\']*\.csv)["\']', html, re.I)
    return [urllib.parse.unquote(n.split("/")[-1]) for n in names]


def november_general(names, year):
    """The year's November general file, by name rather than by guess."""
    hits = [n for n in names
            if str(year) in n and re.search(r"nov", n, re.I)
            and re.search(r"gen", n, re.I)
            and not re.search(r"special|primary|recall|town|city elect", n, re.I)]
    # Shortest wins: "Turnout-2022 November General.csv" over any file that
    # merely mentions the same election in a longer, more specific name.
    return sorted(hits, key=len)[0] if hits else None


def read_election(filename):
    url = BASE + urllib.parse.quote(filename)
    rows = rows_of(get(url))
    if not rows:
        raise SystemExit(f"{filename}: no rows")
    header = list(rows[0])

    loc_col = pick_column(header, ["locality name", "locality", "county city"])
    print(f"   file: {filename}")
    print(f"   columns: {header}")
    if not loc_col:
        raise SystemExit(f"{filename}: no locality column")

    cols = {}
    for field, wants in SUM_COLUMNS.items():
        c = pick_column(header, wants, avoid=("%", "percent", "pct"))
        if c:
            cols[field] = c
    print(f"   locality={loc_col!r}  summing={cols}")
    if "registered" not in cols:
        raise SystemExit(f"{filename}: no registered-voter column")

    # One row per precinct: add them up per locality.
    tally = {}
    precincts = {}
    for r in rows:
        key = norm(r.get(loc_col))
        if not key:
            continue
        acc = tally.setdefault(key, {f: 0 for f in cols})
        precincts[key] = precincts.get(key, 0) + 1
        for field, c in cols.items():
            acc[field] += num(r.get(c)) or 0

    out = {}
    for want in LOCALITIES:
        key = norm(want)
        acc = tally.get(key)
        if acc is None and want.endswith(" City"):
            # Some files drop the "City" suffix; fall back only when the
            # bare name is not also a county in this scope.
            bare = norm(want[: -len(" City")])
            if f"{bare} county" not in tally:
                acc = tally.get(bare)
                key = bare
        if acc is None:
            near = [k for k in tally if norm(want).split()[0] in k]
            print(f"   [miss] {want}   (names present: {near[:4]})")
            continue
        out[want] = acc
        print(f"   {want:<24} {precincts.get(key, 0):>4} precincts  "
              f"registered {acc['registered']:>9,}  "
              f"cast {acc.get('ballotsCast', 0):>9,}")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true",
                    help="write data/registration.json (default is dump only)")
    a = ap.parse_args()

    names = index()
    print(f"directory lists {len(names)} turnout files; "
          f"{sum(1 for n in names if re.search(r'20(2[0-9])', n))} from the 2020s")

    doc = {}
    for date, year in ELECTIONS.items():
        print(f"\n== {year} November general")
        filename = november_general(names, year)
        if not filename:
            near = [n for n in names if str(year) in n][:6]
            print(f"   not in the index (files mentioning {year}: {near})")
            continue
        try:
            doc[date] = read_election(filename)
        except urllib.error.HTTPError as e:
            print(f"   HTTP {e.code} {e.reason}")
        except Exception as e:                       # noqa: BLE001
            print(f"   failed: {type(e).__name__}: {e}")

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
