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
SRC = Path("data/sources/dal")

# One entry per cycle. The window is not computed from "45 days before
# Election Day": Virginia's rule lands a day or two off in practice, and
# Fairfax's own report gives the real first and last day for every cycle
# this project holds. Those are what is used.
CYCLES = {
    2025: {
        "file": SRC / "2025" / "NoVA_2025_DAL_metrics_combined.csv",
        "early_first": dt.date(2025, 9, 19),
        "early_last": dt.date(2025, 11, 1),
        "election": dt.date(2025, 11, 4),
    },
    2024: {
        "file": SRC / "2024" / "NoVA_2024_DAL_metrics_combined.csv",
        "early_first": dt.date(2024, 9, 20),
        "early_last": dt.date(2024, 11, 2),
        "election": dt.date(2024, 11, 5),
    },
    2023: {
        "file": SRC / "2023" / "NoVA_2023_DAL_metrics_combined.csv",
        "early_first": dt.date(2023, 9, 22),
        "early_last": dt.date(2023, 11, 4),
        "election": dt.date(2023, 11, 7),
    },
}

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
def phase_of(d, cycle):
    if d < cycle["early_first"]:
        return "pre"
    if d <= cycle["early_last"]:
        return "early"
    if d <= cycle["election"]:
        return "election"
    return "post"

# Keyed by the upper-cased name, because the archives disagree on case
# and on column name: 2025 writes "Fairfax County" under LOCALITY, the
# 2023 and 2024 archives write "FAIRFAX COUNTY" under SOURCE_LOCALITY.
LOCALITY_IDS = {
    "FAIRFAX COUNTY": ("Fairfax County", "fairfax"),
    "LOUDOUN COUNTY": ("Loudoun County", "loudoun"),
    "PRINCE WILLIAM COUNTY": ("Prince William County", "prince-william"),
    "ARLINGTON COUNTY": ("Arlington County", "arlington"),
    "ALEXANDRIA CITY": ("Alexandria City", "alexandria"),
    "FAIRFAX CITY": ("Fairfax City", "fairfax-city"),
    "FALLS CHURCH CITY": ("Falls Church City", "falls-church"),
    "MANASSAS CITY": ("Manassas City", "manassas"),
    "MANASSAS PARK CITY": ("Manassas Park City", "manassas-park"),
}
LOCALITY_COLUMNS = ("LOCALITY", "SOURCE_LOCALITY")


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
            loc = ""
            for col in LOCALITY_COLUMNS:
                if row.get(col):
                    loc = row[col].strip().upper()
                    break
            # Some archives carry a types row ("string,number,…") under the
            # header. Skipping it is not optional: int("number") throws.
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


def series(snaps, cycle):
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

    # The first snapshot is a baseline, not a delta — but it is not always
    # zero. Fairfax's 2024 archive opens with one mail ballot already
    # recorded, and ignoring it left the running total one short of the
    # file's own final figure, which the assertion at the end caught. It
    # is credited to the day that snapshot describes.
    if snaps:
        first_when, first_machine, first_mail = snaps[0]
        if first_machine or first_mail:
            base = first_when.date() - dt.timedelta(days=1)
            day[base] = [first_machine, first_mail]
        cum[first_when.date() - dt.timedelta(days=1)] = (first_machine, first_mail)

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

    first, last = min(day), max(max(day), max(cum))
    dates = []
    d = first
    while d <= last:
        dates.append(d)
        d += dt.timedelta(days=1)
    values = [list(day.get(x, (0, 0))) for x in dates]

    """Fold a restatement into the days that undo it.

    A negative daily figure means the snapshot under-reported, not that
    ballots were withdrawn. On 4 October 2023 every one of the nine
    localities dips at once — Prince William by 5,137, Fairfax by 4,216 —
    and the 5 October snapshot puts it all back. Left alone that reads as
    a collapse followed by the busiest day of the cycle, and "busiest
    day" for Loudoun 2023 was reporting 6,002 ballots that never
    happened on that date.

    Clamping the negative to zero is the one thing that must not happen:
    it would inflate the running total by the full amount. Instead the
    negative day is merged with the days that restore it, exactly as a
    snapshot gap is merged — the pair describes a real two-day total, the
    split between them is unknowable, and the total lands on the span's
    first day. The cumulative column is untouched by this, which is what
    the assertion at the end of this function checks.
    """
    RESTORE_WINDOW = 2       # a real restatement is put back within a day
    restated = set()
    i = 0
    while i < len(values):
        early, mail = values[i]
        if early >= 0 and mail >= 0:
            i += 1
            continue
        # Look ahead only as far as a restatement plausibly reaches, and
        # only commit the merge if it actually clears. A -1 that is never
        # restored — an Election Day status correction, of which there
        # are a handful — would otherwise swallow every remaining day and
        # destroy a week of real post-election mail detail to chase one
        # ballot. Those are left alone, negative and flagged.
        run_e, run_m = early, mail
        hit = None
        for j in range(i + 1, min(i + 1 + RESTORE_WINDOW, len(values))):
            run_e += values[j][0]
            run_m += values[j][1]
            if run_e >= 0 and run_m >= 0:
                hit = j
                break
        if hit is None:
            i += 1
            continue
        values[i] = [run_e, run_m]
        for j in range(i + 1, hit + 1):
            values[j] = [0, 0]
        covered = hit - i + 1
        for k in range(i, hit + 1):
            spans[dates[k]] = max(spans.get(dates[k], 1), covered)
            restated.add(dates[k])
        i = hit + 1

    # Any negative left is a small unrestored correction; it stays visible.
    restated.update(x for x, v in zip(dates, values) if v[0] < 0 or v[1] < 0)

    rows = []
    run_early = run_mail = 0
    for x, (early_d, mail_d) in zip(dates, values):
        run_early += early_d
        run_mail += mail_d
        rows.append({
            "date": x.isoformat(),
            "phase": phase_of(x, cycle),
            "early_in_person_daily": early_d,
            "early_in_person_cumulative": run_early,
            "mail_returned_daily": mail_d,
            "mail_returned_cumulative": run_mail,
            "combined_daily": early_d + mail_d,
            "combined_cumulative": run_early + run_mail,
            # Flagged, not hidden: the reader should be able to see that a
            # restatement happened here, and on which days it landed.
            "is_correction": "true" if x in restated else "false",
            # 1 on a normal day; N on each day of an N-day snapshot gap or
            # restatement span.
            "span_days": spans.get(x, 1),
        })

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


def write(loc, year, rows):
    OUT.mkdir(parents=True, exist_ok=True)
    known = LOCALITY_IDS.get(loc)
    if not known:
        print(f"  [skip] {loc}: not a tracked jurisdiction")
        return None
    _, slug = known
    path = OUT / f"{slug}-{year}-general_dal_daily.csv"
    cols = ["date", "phase", "early_in_person_daily", "early_in_person_cumulative",
            "mail_returned_daily", "mail_returned_cumulative",
            "combined_daily", "combined_cumulative", "is_correction",
            "span_days"]
    with open(path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        w.writerows(rows)
    return path


def run(year, cycle):
    path = cycle["file"]
    if not path.exists():
        print(f"== {year}: no archive at {path} — skipping\n")
        return
    data = read_combined(path)
    first = cycle["early_first"]
    print(f"== {year} general (early voting {first} – {cycle['early_last']}, "
          f"Election Day {cycle['election']})")
    print(f"   read {len(data)} localities from {path}")
    print(f"   {'locality':<24} {'early days':>10} {'in person':>10} "
          f"{'mail at close':>13} {'mail final':>11}")

    for loc in sorted(data):
        all_rows = series(data[loc], cycle)
        # Trim leading empty days only. The archives open days or weeks
        # before in-person voting does, and a ballot really can be
        # recorded in that window — Arlington has one on 16 September
        # 2024, four days before the polls opened, which is what a UOCAVA
        # ballot coming back early looks like. Cutting to a fixed window
        # would drop it and break the cumulative column, so the window
        # only tags the phase and the series starts wherever activity
        # does. Days before the window are tagged "pre".
        started = next((i for i, r in enumerate(all_rows)
                        if r["combined_daily"] != 0), None)
        if started is None:
            print(f"   {loc}: no activity recorded")
            continue
        rows = all_rows[started:]
        pre = [r for r in rows if r["phase"] == "pre"]
        if pre:
            print(f"   [note] {LOCALITY_IDS.get(loc, (loc,))[0]}: "
                  f"{sum(r['combined_daily'] for r in pre)} ballot(s) recorded "
                  f"before {first}, kept and tagged pre")
        early = [r for r in rows if r["phase"] == "early"]
        last = rows[-1]
        path_out = write(loc, year, rows)
        if path_out:
            name = LOCALITY_IDS[loc][0]
            print(f"   {name:<24} {len(early):>10} "
                  f"{last['early_in_person_cumulative']:>10,} "
                  f"{early[-1]['mail_returned_cumulative']:>13,} "
                  f"{last['mail_returned_cumulative']:>11,}")
    print()


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("years", nargs="*", type=int,
                    help="cycles to parse (default: all in CYCLES)")
    a = ap.parse_args()

    years = a.years or sorted(CYCLES, reverse=True)
    for year in years:
        if year not in CYCLES:
            raise SystemExit(f"no archive registered for {year}")
        run(year, CYCLES[year])


if __name__ == "__main__":
    main()
