#!/usr/bin/env python3
"""Parse a Fairfax County AB Daily Report PDF into the NovaVote CSV schema.

Runs in CI (see .github/workflows/extract-report.yml) because the dev
sandbox can't reach fairfaxcounty.gov.

Why a parser instead of hand transcription: each report prints its own
grand-total row on every table, so the parse is self-checking. Every
daily column is summed and asserted against the published total —
including each early-voting site column individually, which is the check
that caught the Herndon Fortnightly column-shift bug in the 2025 data.

Layout notes that drive the design:
  * A logical table is split across pages BOTH by date range and by site
    subset (2023 page 8 = early dates x sites A-G, page 9 = same dates x
    sites H-Z, page 10 = later dates x sites A-C, ...). So values are
    accumulated into a (date, column) dict and only assembled at the end.
  * The site roster changes between cycles: 2023 has "Providence" and no
    "Jim Scott"; 2025 is the reverse. Columns are discovered per report,
    never hardcoded.
  * The grand-total header row repeats on continuation pages.
"""

import argparse
import csv
import re
import sys
import unicodedata
from collections import defaultdict
from datetime import date
from pathlib import Path

MONTHS = {"Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6,
          "Jul": 7, "Aug": 8, "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12}

DATE_RE = re.compile(r"^(\d{1,2})-([A-Z][a-z]{2})$")

# Page-header text -> logical section. Order matters: the dropbox header
# also contains "Returned Absentee Ballots", so it is tested first.
SECTIONS = [
    ("dropbox", "by Dropbox"),
    ("returned_mail", "by Mail"),
    ("mailed", "Mailed Absentee Ballots"),
    ("ab_applicants", "Who Voted Early In Person"),
    ("early", "Early In Person Voting"),
]


def norm_key(s):
    """'Tysons- Pimmit' -> 'tysons_pimmit'; 'Mt. Vernon' -> 'mt_vernon'."""
    s = unicodedata.normalize("NFKD", s or "")
    s = s.replace("\n", " ").strip().lower()
    s = re.sub(r"[^\w\s]", " ", s)
    return re.sub(r"\s+", "_", s.strip())


def parse_num(v):
    """'2,051' -> 2051; '' / None -> None. Non-numeric junk -> None.

    A cell holding two integers ("8 1") is a fused cell: the text layer
    ran two rows together. Return None so the identity repair below can
    recover it from the row's own total rather than guessing a split.
    """
    if v is None:
        return None
    t = str(v).replace(",", "").replace("\n", " ").strip()
    if not t:
        return None
    return int(t) if re.fullmatch(r"-?\d+", t) else None


# total = sum(components). The reports guarantee these, so a single
# missing component in an otherwise-populated row is recoverable exactly.
# "early" is special-cased: its components are the site columns, which
# are discovered per report.
IDENTITIES = {
    "mailed": ("total", ["domestic", "uocava", "e_mail_uocava"]),
    "returned_mail": ("total", ["domestic", "uocava", "e_mail_uocava"]),
    "dropbox": ("total", ["domestic", "uocava", "e_mail_uocava"]),
    "ab_applicants": ("total", ["ballot_not_surrendered", "ballot_surrendered"]),
}


def repair(values, col_order):
    """Fill cells the text layer fused, using total = sum(components).

    Only fires when exactly one component is missing AND at least one
    other is present — so a site that simply had not opened yet (many
    components blank) is never invented, only genuinely dropped digits
    are restored.
    """
    repaired = []
    for section, rows in values.items():
        if section == "early":
            total_key = "total"
            components = [k for k in col_order[section] if k != "total"]
        elif section in IDENTITIES:
            total_key, components = IDENTITIES[section]
            components = [c for c in components if c in col_order[section]]
        else:
            continue
        if not components:
            continue

        for iso, row in rows.items():
            total = row.get(total_key)
            if total is None:
                continue
            missing = [c for c in components if row.get(c) is None]
            present = [c for c in components if row.get(c) is not None]
            if len(missing) != 1 or not present:
                continue
            derived = total - sum(row[c] for c in present)
            if derived < 0:
                continue
            row[missing[0]] = derived
            repaired.append(f"{section} {iso}: {missing[0]} = {derived} (from row total)")
    return repaired


def to_iso(label, year):
    m = DATE_RE.match((label or "").strip())
    if not m:
        return None
    day, mon = int(m.group(1)), m.group(2)
    if mon not in MONTHS:
        return None
    return date(year, MONTHS[mon], day).isoformat()


def classify(page_text):
    head = (page_text or "")[:400]
    for name, needle in SECTIONS:
        if needle.lower() in head.lower():
            return name
    return None


def parse(pdf_path, year):
    import pdfplumber

    # values[section][date][column] = int ; totals[section][column] = int
    values = defaultdict(lambda: defaultdict(dict))
    totals = defaultdict(dict)
    col_order = defaultdict(list)
    anomalies = []

    with pdfplumber.open(pdf_path) as pdf:
        for pno, page in enumerate(pdf.pages, 1):
            section = classify(page.extract_text())
            if not section:
                continue
            for table in page.extract_tables() or []:
                if not table or len(table) < 2:
                    continue

                # Header: cell 0 is "Date". Some tables carry a two-row
                # header — a spanning group label ("Returned by Dropbox")
                # over the real column names — in which case row 1 starts
                # with an empty cell and supplies the names.
                header = table[0]
                if norm_key(header[0]) != "date":
                    continue
                body_start = 1
                if len(table) > 1 and not (table[1][0] or "").strip():
                    header = [
                        (sub or top) for top, sub in zip(header, table[1])
                    ] + header[len(table[1]):]
                    body_start = 2

                cols = {}
                for idx, raw in enumerate(header[1:], start=1):
                    key = norm_key(raw)
                    if key:
                        cols[idx] = key
                        if key not in col_order[section]:
                            col_order[section].append(key)

                for row in table[body_start:]:
                    if not row:
                        continue
                    label = (row[0] or "").strip()
                    is_total = norm_key(label) == "total"
                    iso = None if is_total else to_iso(label, year)

                    if not is_total and iso is None:
                        # Overlapping text layers occasionally fuse two rows
                        # ("2T6o-Otaclt"). Record and skip; the grand-total
                        # assertion is what catches any real data loss.
                        if label:
                            anomalies.append(f"p{pno} {section}: unparsed row label {label!r}")
                        continue

                    for idx, key in cols.items():
                        if idx >= len(row):
                            continue
                        n = parse_num(row[idx])
                        if n is None:
                            continue
                        if is_total:
                            prev = totals[section].get(key)
                            if prev is not None and prev != n:
                                anomalies.append(
                                    f"p{pno} {section}: total for {key} was {prev}, now {n}")
                            totals[section][key] = n
                        else:
                            prev = values[section][iso].get(key)
                            if prev is not None and prev != n:
                                anomalies.append(
                                    f"p{pno} {section} {iso}: {key} was {prev}, now {n}")
                            values[section][iso][key] = n

    return values, totals, col_order, anomalies


def verify(values, totals, col_order):
    """Sum every daily column and compare to the report's own total row.

    Returns the failures as (section, key) as well as the printable
    report, because *which* column failed decides what can still ship:
    a report whose county-level totals all reconcile is usable even when
    its per-site split does not.
    """
    report = []
    failed = []
    for section in sorted(values):
        for key in col_order[section]:
            published = totals[section].get(key)
            if published is None:
                continue
            summed = sum(
                d[key] for d in values[section].values() if d.get(key) is not None
            )
            match = summed == published
            if not match:
                failed.append((section, key))
            report.append(
                f"  {'OK ' if match else '!! '} {section:<14} {key:<24} "
                f"sum={summed:>8,} published={published:>8,}"
            )
    return failed, report


def write_csvs(values, totals, col_order, outdir, cycle, sites=True):
    outdir.mkdir(parents=True, exist_ok=True)
    written = []

    def dump(name, section, header_map):
        if section not in values:
            return
        dates = sorted(values[section])
        keys = [k for k in col_order[section] if k in header_map]
        path = outdir / f"{cycle}_{name}.csv"
        with path.open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["date"] + [header_map[k] for k in keys])
            for d in dates:
                w.writerow([d] + [values[section][d].get(k, "") for k in keys])
        written.append(path)

    # For the sectioned tables the column names are stable across cycles.
    dump("mailed_absentee_ballots", "mailed",
         {"total": "total_mailed", "domestic": "domestic",
          "uocava": "uocava_mail", "e_mail_uocava": "uocava_email"})
    dump("returned_by_mail", "returned_mail",
         {"total": "total_returned", "domestic": "returned_by_mail",
          "uocava": "returned_uocava", "e_mail_uocava": "returned_by_email",
          "undeliverable": "undeliverable", "returned_unused": "returned_unused"})
    dump("returned_by_dropbox", "dropbox",
         {"total": "total_returned_dropbox", "domestic": "dropbox_domestic",
          "uocava": "dropbox_uocava", "e_mail_uocava": "dropbox_email_uocava",
          "returned_unused": "returned_unused"})
    dump("ab_applicants_voted_early_in_person", "ab_applicants",
         {"total": "total", "ballot_not_surrendered": "ballot_not_surrendered",
          "ballot_surrendered": "ballot_surrendered"})

    # Early in person: every column except "total" is a site, discovered
    # from the report rather than hardcoded (the roster changes by cycle).
    #
    # `sites=False` writes the daily county total on its own. That is for
    # the case where the total reconciles and the split does not: the
    # county figure is verified and belongs on the site, the split is not
    # and must not be published as though it were.
    if "early" in values:
        site_keys = [k for k in col_order["early"] if k != "total"] if sites else []
        path = outdir / f"{cycle}_early_in_person_by_site.csv"
        with path.open("w", newline="") as f:
            w = csv.writer(f)
            w.writerow(["date", "total"] + site_keys)
            for d in sorted(values["early"]):
                row = values["early"][d]
                w.writerow([d, row.get("total", "")] + [row.get(k, "") for k in site_keys])
        written.append(path)

        if sites:
            meta = outdir / f"{cycle}_site_totals.csv"
            with meta.open("w", newline="") as f:
                w = csv.writer(f)
                w.writerow(["site_key", "published_total"])
                for k in site_keys:
                    w.writerow([k, totals["early"].get(k, "")])
            written.append(meta)

    return written


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf")
    ap.add_argument("--year", type=int, required=True)
    ap.add_argument("--cycle", required=True, help="e.g. fairfax-2023-general")
    ap.add_argument("--outdir", default="data/parsed")
    args = ap.parse_args()

    values, totals, col_order, anomalies = parse(Path(args.pdf), args.year)

    print(f"\n=== {args.cycle} ===")
    for section in sorted(values):
        print(f"  section {section}: {len(values[section])} dated rows, "
              f"{len(col_order[section])} columns -> {col_order[section]}")

    if anomalies:
        print("\n  anomalies:")
        for a in anomalies:
            print(f"    - {a}")

    fixes = repair(values, col_order)
    if fixes:
        print("\n  recovered from row identities (total = sum of parts):")
        for f in fixes:
            print(f"    - {f}")

    failed, report = verify(values, totals, col_order)
    print("\n  reconciliation vs the report's own Total rows:")
    print("\n".join(report) or "    (no published totals found)")

    # A report whose county-level columns all reconcile is worth shipping
    # even when its per-site split does not. The 2024 final report is
    # exactly that case: 239,326 early ballots, 114,183 issued, 69,977
    # returned by mail and 23,678 by drop box all land on the county's own
    # printed totals, while seven site columns come up short because one
    # page's text layer is scrambled. Publishing the verified county
    # series and withholding the unverified split is better than
    # withholding a whole cycle, and far better than shipping site figures
    # that do not add up.
    sites_only = bool(failed) and all(
        section == "early" and key != "total" for section, key in failed
    )
    written = write_csvs(
        values, totals, col_order, Path(args.outdir), args.cycle,
        sites=not sites_only,
    )
    print("\n  wrote:")
    for p in written:
        print(f"    {p}")

    if sites_only:
        print(
            f"\n  PARTIAL: {len(failed)} site columns do not reconcile "
            f"({', '.join(k for _, k in failed)}).\n"
            f"  Every county-level column does, so the daily county totals are "
            f"written and the\n  per-site split is withheld. Fix the site parse "
            f"to restore it."
        )
        return
    if failed:
        print("\n  RECONCILIATION FAILED — not trustworthy, do not ship these CSVs")
        sys.exit(2)
    print("\n  all columns reconcile")


if __name__ == "__main__":
    main()
