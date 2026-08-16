#!/usr/bin/env python3
"""Check data/registration.json against the state's own turnout files.

This **writes nothing**. `data/registration.json` is supplied directly
and is the authority for active registered voters; this is the second
opinion on it. The state publishes one CSV per election with a row per
**precinct**, and summed by locality its registration columns are an
independent count of the same thing.

Coverage is partial and that is expected: the turnout directory carries
November generals for 2020, 2021 and 2022 and nothing later — nothing in
its index mentions 2024 or 2025 at all, and 2023 has only special
elections. So this checks three of six cycles. A disagreement is printed,
never acted on.

RUNS IN CI. The dev sandbox cannot reach this host.

SCOPE: this project holds no results or partisan data by design. These
are turnout files, not results files, and only the registration columns
are read. Nothing here reads a candidate, a party, or a contest.
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
TABLE = Path("data/registration.json")

# How far the two may differ before it is worth stopping over. They are
# both counts of active registrants but not necessarily on the same day,
# and a few weeks of registration either side of an election moves the
# figure by a fraction of a percent.
TOLERANCE = 0.03

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
}

# Deliberately NOT read: TotalVoteTurnout, absentee_ballots,
# in_person_ballots. Summed by locality they do not describe ballots —
# Fairfax 2020 comes out at 1,020,701 against 751,830 active voters, a
# 136% turnout, and the county's real 2020 turnout was around 594,000.
# Whatever those columns count, it is not one ballot per row, and a
# figure that cannot be reconciled does not belong on the site. The
# registration columns pass the county cross-check in two separate
# cycles, so they are kept and those are not.

# The nine jurisdictions in scope. Keyed by the name this project uses;
# the state writes cities without the word "City", so both spellings are
# matched.
LOCALITIES = [
    "Fairfax County", "Loudoun County", "Prince William County",
    "Arlington County", "Alexandria City", "Fairfax City",
    "Falls Church City", "Manassas City", "Manassas Park City",
]



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
              f"active {acc['registered']:>9,}  "
              f"total {acc.get('registeredTotal', 0):>9,}")
    return out


def main():
    argparse.ArgumentParser(description=__doc__).parse_args()

    table = json.loads(TABLE.read_text())["elections"]
    names = index()
    print(f"directory lists {len(names)} turnout files")

    checked = worst = 0
    misses = []
    for date, year in ELECTIONS.items():
        print(f"\n== {year} November general")
        filename = november_general(names, year)
        if not filename:
            print("   not in the index — no second opinion for this cycle")
            continue
        try:
            state = read_election(filename)
        except urllib.error.HTTPError as e:
            print(f"   HTTP {e.code} {e.reason}")
            continue
        except Exception as e:                       # noqa: BLE001
            print(f"   failed: {type(e).__name__}: {e}")
            continue

        for name, acc in sorted(state.items()):
            want = table.get(date, {}).get(name, {}).get("registered")
            if want is None:
                print(f"   [gap] {name}: state says {acc['registered']:,}, "
                      f"the table has no figure")
                continue
            got = acc["registered"]
            off = abs(got - want) / want
            checked += 1
            worst = max(worst, off)
            if off > TOLERANCE:
                misses.append(f"{date} {name}: state {got:,} vs table {want:,} "
                              f"({off * 100:.1f}%)")

    print(f"\n-- {checked} figures compared, worst {worst * 100:.2f}% apart")
    if misses:
        print(f"   {len(misses)} beyond {TOLERANCE * 100:.0f}%:")
        for m in misses:
            print(f"     {m}")
        print("   The table stands — it is the authority. This is a flag, "
              "not a correction.")
    else:
        print("   every compared figure agrees within tolerance")


if __name__ == "__main__":
    sys.exit(main())
