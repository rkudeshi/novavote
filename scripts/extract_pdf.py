#!/usr/bin/env python3
"""Download Fairfax County AB Daily Report PDFs and dump their text layer.

This exists because the report is only published as a PDF. Run it in CI (see
.github/workflows/extract-report.yml) where outbound network is available;
the raw text lands in the workflow log and as an artifact, which is what
scripts/build_csvs_*.py transcriptions are built from.

The Nov 2025 report is included deliberately as a control: we already have
validated CSVs for it, so if a parser reproduces 2025's published grand
totals from this text, the same approach can be trusted on other cycles.
"""

import argparse
import sys
import urllib.request
from pathlib import Path

REPORTS = {
    "nov2025": "https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf",
    # The end-of-cycle 2024 report. The county publishes several dated
    # versions of the same report through a cycle; "- 11.07" is the one
    # taken after Election Day. "nov2024_snapshot" below is the "- 9.24"
    # file this project started from, which stops five days into early
    # voting at 14,129 in-person ballots — it is kept for reference but
    # must never overwrite the final data.
    "nov2024": "https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB%20Daily%20Report%20-%20NOV%202024%20-%2011.07.pdf",
    "nov2024_snapshot": "https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB%20Daily%20Report%20-%20NOV%202024%20-%209.24.pdf",
    "nov2023": "https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/ab%20daily%20report%20november%202023.pdf",
}

OUT = Path("pdf-extract")


def fetch(name, url):
    dest = OUT / f"{name}.pdf"
    if dest.exists():
        return dest
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (NovaVote data fetch)"})
    with urllib.request.urlopen(req, timeout=120) as r:
        data = r.read()
    dest.write_bytes(data)
    print(f"[fetch] {name}: {len(data):,} bytes <- {url}", flush=True)
    return dest


def parse_pages(spec):
    """'1', '1-3', '2,5-6' -> a set of 1-based page numbers. None = all."""
    if not spec:
        return None
    out = set()
    for part in spec.split(","):
        part = part.strip()
        if "-" in part:
            a, b = part.split("-", 1)
            out.update(range(int(a), int(b) + 1))
        elif part:
            out.add(int(part))
    return out or None


def dump(name, path, pages=None):
    import pdfplumber

    text_out = OUT / f"{name}.txt"
    chunks = []
    with pdfplumber.open(path) as pdf:
        print(f"\n{'=' * 78}\n{name}: {len(pdf.pages)} pages\n{'=' * 78}", flush=True)
        for i, page in enumerate(pdf.pages, 1):
            if pages and i not in pages:
                continue
            header = f"\n----- {name} PAGE {i} -----"
            body = page.extract_text() or "(no text layer)"
            print(header, flush=True)
            print(body, flush=True)
            chunks.append(header + "\n" + body)

            # Table extraction often recovers column structure the raw text
            # layer merges together — dump it alongside for cross-checking.
            for t_i, table in enumerate(page.extract_tables() or [], 1):
                thead = f"\n----- {name} PAGE {i} TABLE {t_i} -----"
                trows = "\n".join(
                    " | ".join("" if c is None else str(c).replace("\n", " ") for c in row)
                    for row in table
                )
                print(thead, flush=True)
                print(trows, flush=True)
                chunks.append(thead + "\n" + trows)
    text_out.write_text("\n".join(chunks), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("reports", nargs="*", help="report keys (default: all)")
    ap.add_argument("--pages", default="",
                    help="restrict output to these pages, e.g. '1' or '1-3'")
    args = ap.parse_args()

    OUT.mkdir(exist_ok=True)
    names = args.reports or list(REPORTS)
    pages = parse_pages(args.pages)
    failures = []
    for name in names:
        try:
            dump(name, fetch(name, REPORTS[name]), pages)
        except Exception as e:  # keep going so one dead URL doesn't hide the rest
            print(f"[ERROR] {name}: {type(e).__name__}: {e}", flush=True)
            failures.append(name)
    if failures:
        print(f"\n[FAILED] {', '.join(failures)}", flush=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
