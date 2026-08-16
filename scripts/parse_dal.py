#!/usr/bin/env python3
"""Turn EPEC's daily DAL metric snapshots into NovaVote's locality CSVs.

The Daily Absentee List is what exists for every Virginia locality. It is
far thinner than Fairfax's own operational report — no site breakdown, no
mail-versus-drop-box split, no ballots-mailed-per-day, no surrendered
ballots — but it is the same two curves for everyone, which is what makes
a cross-jurisdiction comparison possible at all.

Method, following the publisher's stated instructions:

  * FILEDATE is when the snapshot was taken, NOT when a ballot was cast.
    Snapshots land around 05:00, so the change between consecutive
    snapshots is assigned to the calendar day *before* the later one.
  * ON_MACHINE is cumulative approved early in-person ballots.
  * MAIL_IN (MARKED + PRE_PROCESSED) is cumulative returned mail ballots.
  * COUNTABLE is deliberately unused: it folds in provisional and FWAB,
    so it is not the early-in-person-plus-mail total it looks like.

Negative daily deltas are preserved rather than clamped to zero. They are
real: a DAL correction or a status change moves a ballot back out of a
category, and zeroing them would silently inflate the running total.
"""

import argparse
import csv
import datetime as dt
from collections import defaultdict
from pathlib import Path

OUT = Path("data/parsed")

# Virginia's 2025 early-voting window, and Election Day.
EARLY_FIRST = dt.date(2025, 9, 19)
EARLY_LAST = dt.date(2025, 11, 1)
ELECTION_DAY = dt.date(2025, 11, 4)

# Rows are kept past the election and phase-tagged rather than truncated.
#
# The two series behave differently and the difference is not cosmetic.
# ON_MACHINE moves the day a ballot is cast, so the in-person curve is
# real activity: Fairfax's DAL settles at 137,215 against the county's
# published 137,221, six ballots apart. MAIL_IN moves when a ballot is
# *processed*, which mostly happens after Election Day: Fairfax's DAL
# reads 51,567 on 1 November and climbs to 63,832 by 9 November, against
# a published 64,367. Cutting the file at 1 November would therefore
# under-report mail by a fifth while looking perfectly reasonable.
def phase_of(d):
    if d <= EARLY_LAST:
        return "early"
    if d <= ELECTION_DAY:
        return "election"
    return "post"

LOCALITY_IDS = {
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


def parse_filedate(s):
    return dt.datetime.strptime(s.strip(), "%d-%b-%Y %H:%M:%S")


def num(v):
    v = (v or "").strip().replace(",", "")
    if v == "" or not v.replace("-", "").isdigit():
        return None
    return int(v)


def read_combined(path):
    """{locality: [(filedate, on_machine, mail_in)]} sorted, deduped."""
    by_loc = defaultdict(dict)
    with open(path, newline="", encoding="utf-8-sig") as fh:
        for row in csv.DictReader(fh):
            loc = (row.get("LOCALITY") or "").strip()
            # The per-locality files carry a types row ("string,number,…").
            # The combined file drops it, but guard anyway.
            if not loc or row.get("FILEDATE", "").strip().lower() == "string":
                continue
            try:
                when = parse_filedate(row["FILEDATE"])
            except ValueError:
                continue
            on_machine = num(row.get("ON_MACHINE"))
            mail_in = num(row.get("MAIL_IN"))
            if on_machine is None or mail_in is None:
                continue
            # Later duplicate of an identical timestamp wins.
            by_loc[loc][when] = (on_machine, mail_in)
    return {
        loc: [(w, *vals) for w, vals in sorted(snaps.items())]
        for loc, snaps in by_loc.items()
    }


def series(snaps):
    """Snapshot pairs -> one row per activity date.

    A snapshot taken at 05:00 on day D reports the state through the end
    of D-1. So the change between two consecutive snapshots covers every
    activity day from the earlier snapshot's own calendar date through
    the day before the later one — normally exactly one day.

    Two things break that one-to-one mapping in the 2025 file, and both
    are handled here rather than papered over:

    * **Two snapshots landed on one date** (29 September). Keeping only
      the later one, which is the obvious dedup, silently discards the
      earlier one's delta — 727 in-person ballots in Loudoun. Deltas are
      summed into the activity date instead, so nothing is dropped.

    * **No snapshot was published for two days** (27 and 28 September),
      so the 29 September file's delta covers a three-day span. The whole
      delta is assigned to the span's **first** day and every day in the
      span is flagged, rather than dumping three days of ballots onto the
      last one. For this cycle that is not a guess: the span is Friday to
      Sunday, no locality offered weekend voting that early, and Fairfax's
      own report — which is not derived from this file — records 1,982
      in-person ballots on the Friday and zero on both weekend days, an
      exact match for the 1,982 the span carries. The flag stays anyway:
      a future gap might fall mid-week, where the placement really would
      be an assumption, and it should be visible when it is.
    """
    day = {}          # activity date -> [early delta, mail delta]
    spans = {}        # activity date -> days the covering snapshot spanned
    cum = {}          # activity date -> (on_machine, mail_in) as of that date

    for i in range(1, len(snaps)):
        when, on_machine, mail_in = snaps[i]
        prev_when, prev_machine, prev_mail = snaps[i - 1]

        span_start = prev_when.date()
        span_end = when.date() - dt.timedelta(days=1)
        # A duplicate same-date snapshot inverts these; both then resolve
        # to the one activity date the pair actually describes.
        target = min(span_start, span_end)
        covered = (span_end - span_start).days + 1

        acc = day.setdefault(target, [0, 0])
        acc[0] += on_machine - prev_machine
        acc[1] += mail_in - prev_mail
        cum[span_end] = (on_machine, mail_in)

        if covered > 1:
            for n in range(covered):
                spans[span_start + dt.timedelta(days=n)] = covered

    if not day:
        return []

    rows = []
    run_early = run_mail = 0
    first, last = min(day), max(max(day), max(cum))
    d = first
    while d <= last:
        early_d, mail_d = day.get(d, (0, 0))
        run_early += early_d
        run_mail += mail_d
        rows.append({
            "date": d.isoformat(),
            "phase": phase_of(d),
            "early_in_person_daily": early_d,
            "early_in_person_cumulative": run_early,
            "mail_returned_daily": mail_d,
            "mail_returned_cumulative": run_mail,
            "combined_daily": early_d + mail_d,
            "combined_cumulative": run_early + run_mail,
            # Flagged, not hidden: a negative delta is a correction and the
            # reader should be able to see that it happened.
            "is_correction": "true" if (early_d < 0 or mail_d < 0) else "false",
            # 1 on a normal day; N on each day of an N-day snapshot gap.
            "span_days": spans.get(d, 1),
        })
        d += dt.timedelta(days=1)

    # The running totals are what the CSV publishes, so they have to land
    # exactly where the file's own last cumulative snapshot does. If they
    # don't, a delta was dropped and every figure downstream is wrong.
    final_machine, final_mail = snaps[-1][1], snaps[-1][2]
    if (run_early, run_mail) != (final_machine, final_mail):
        raise SystemExit(
            f"deltas sum to {run_early}/{run_mail} but the last snapshot "
            f"reads {final_machine}/{final_mail} — a delta was lost"
        )
    return rows


def write(loc, rows):
    OUT.mkdir(parents=True, exist_ok=True)
    slug = LOCALITY_IDS.get(loc)
    if not slug:
        print(f"  [skip] {loc}: not a tracked jurisdiction")
        return None
    path = OUT / f"{slug}-2025-general_dal_daily.csv"
    cols = ["date", "phase", "early_in_person_daily", "early_in_person_cumulative",
            "mail_returned_daily", "mail_returned_cumulative",
            "combined_daily", "combined_cumulative", "is_correction",
            "span_days"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    return path


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("combined", help="NoVA_2025_DAL_metrics_combined.csv")
    a = ap.parse_args()

    data = read_combined(a.combined)
    print(f"read {len(data)} localities\n")

    print(f"{'locality':<24} {'early days':>10} {'in person':>10} "
          f"{'mail @11/1':>11} {'mail final':>11}")
    for loc in sorted(data):
        all_rows = series(data[loc])
        # The file opens a couple of days before early voting does. Those
        # rows are dropped, but only after checking they are empty — if a
        # ballot were recorded before the polls opened, silently trimming
        # it would break the cumulative column for the whole cycle.
        pre = [r for r in all_rows if r["date"] < EARLY_FIRST.isoformat()]
        moved = [r for r in pre if r["combined_daily"] != 0]
        if moved:
            raise SystemExit(
                f"{loc}: activity recorded before {EARLY_FIRST} "
                f"({moved[0]['date']}: {moved[0]['combined_daily']}) — "
                f"the early-voting window is wrong"
            )
        rows = [r for r in all_rows if r["date"] >= EARLY_FIRST.isoformat()]
        if not rows:
            print(f"  {loc}: no rows in the early-voting window")
            continue
        early = [r for r in rows if r["phase"] == "early"]
        last = rows[-1]
        path = write(loc, rows)
        if path:
            print(f"{loc:<24} {len(early):>10} "
                  f"{last['early_in_person_cumulative']:>10,} "
                  f"{early[-1]['mail_returned_cumulative']:>11,} "
                  f"{last['mail_returned_cumulative']:>11,}")


if __name__ == "__main__":
    main()
