#!/usr/bin/env python3
"""Discover Fairfax County AB Daily Report PDFs published on the county site.

The two historical URLs we were handed turned out to be mid-cycle
snapshots (the 2024 one literally stops on 9/24). This crawls the
county's election pages and lists every absentee/early-voting PDF it can
find, plus how far into its cycle each one actually runs, so the final
end-of-cycle reports can be identified rather than guessed at.

Runs in CI — the dev sandbox can't reach fairfaxcounty.gov.
"""

import re
import sys
import urllib.parse
import urllib.request

SEEDS = [
    "https://www.fairfaxcounty.gov/elections/absentee",
    "https://www.fairfaxcounty.gov/elections/early-voting",
    "https://www.fairfaxcounty.gov/elections/results",
    "https://www.fairfaxcounty.gov/elections/past-elections",
    "https://www.fairfaxcounty.gov/elections/",
]

UA = {"User-Agent": "Mozilla/5.0 (NovaVote report discovery)"}
PDF_RE = re.compile(r'href=["\']([^"\']+\.pdf[^"\']*)["\']', re.I)
INTERESTING = re.compile(r"(absentee|early|ab[-_ ]?daily|daily[-_ ]?report)", re.I)


def get(url, binary=False):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=90) as r:
        data = r.read()
    return data if binary else data.decode("utf-8", "replace")


def probe(url):
    """Report a PDF's page count and the last date its text layer mentions."""
    import io

    import pdfplumber

    try:
        raw = get(url, binary=True)
    except Exception as e:
        return f"unreachable ({type(e).__name__})"
    try:
        with pdfplumber.open(io.BytesIO(raw)) as pdf:
            pages = len(pdf.pages)
            text = "\n".join((p.extract_text() or "") for p in pdf.pages)
    except Exception as e:
        return f"{len(raw):,}B, unreadable ({type(e).__name__})"

    dates = re.findall(r"\b(\d{1,2})-(Sep|Oct|Nov)\b", text)
    order = {"Sep": 9, "Oct": 10, "Nov": 11}
    last = max(((order[m], int(d)) for d, m in dates), default=None)
    # The in-person grand total is the quickest completeness signal.
    totals = re.findall(r"Total\s+([\d,]{4,})", text)
    return (
        f"{len(raw):,}B, {pages}p, "
        f"last date {last[0]}/{last[1]}" if last else f"{len(raw):,}B, {pages}p, no dates"
    ) + (f", totals seen: {totals[:6]}" if totals else "")


def main():
    seen = {}
    for seed in SEEDS:
        try:
            html = get(seed)
        except Exception as e:
            print(f"[seed] {seed} -> {type(e).__name__}: {e}", flush=True)
            continue
        links = {urllib.parse.urljoin(seed, h) for h in PDF_RE.findall(html)}
        hits = {l for l in links if INTERESTING.search(l)}
        print(f"[seed] {seed} -> {len(links)} pdfs, {len(hits)} absentee-ish", flush=True)
        for l in sorted(hits):
            seen.setdefault(l, seed)

    print(f"\n=== {len(seen)} candidate reports ===", flush=True)
    for url in sorted(seen):
        print(f"\n{url}", flush=True)
        print(f"  {probe(url)}", flush=True)

    if not seen:
        print("\nNo candidates found from the seed pages.", flush=True)
        sys.exit(0)


if __name__ == "__main__":
    main()
