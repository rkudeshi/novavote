# NovaVote — Fairfax County Data (Nov 2025 General & Special Election)

Source: [Fairfax County Absentee & Early Voting Daily Report](https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf) (final, dated 11/7/2025).

## Files

| File | Contents |
|---|---|
| `mailed_absentee_ballots.csv` | Ballots mailed/emailed to voters, by date, split domestic vs. UOCAVA (military/overseas) mail vs. UOCAVA email |
| `returned_by_mail.csv` | Ballots returned by mail/email, by date |
| `returned_by_dropbox.csv` | Ballots returned via drop box, by date |
| `early_in_person_by_site.csv` | In-person early voting counts by date **and by site** (17 sites) |
| `ab_applicants_voted_early_in_person.csv` | Voters who requested a mail ballot but voted early in person instead, by date |

All dates are ISO format (`YYYY-MM-DD`). All totals reconcile exactly against the county's published grand totals (87,547 / 51,413 / 12,954 / 137,221 / 1,654).

## Known caveats

- **Early-voting sites — 16, not 17**: The PDF's header reads "Herndon Fortnightly," which is **one** site (Herndon Fortnightly Library), not two. An earlier revision of this dataset split it in two, which silently shifted every site column from Jim Scott onward by one position. Row totals still reconciled, so the error only surfaced when each site column was checked against its own published grand total. `build_csvs.py` now asserts all 16 column totals individually.
- **Site opening dates**: Only 3 sites (Government Center, Mt. Vernon, North County) operated before **Oct 23, 2025**; the other 13 opened Oct 23 through Election Day. Blank cells before that date mean "not yet open," not zero turnout.
- **`returned_by_mail.csv` — `undeliverable_subset_of_mail` column**: this is a sub-count *within* the mail total (not additive to it — `returned_by_mail + returned_by_email = total_returned` holds on every row). For 14 dates, the source PDF's text layer had digits merged with no separator (e.g. `"1010"`, `"3,24310"`). The `total`/`mail`/`email` split for those rows was recovered reliably because the identity `mail + email = total` gave a unique valid split — but the `undeliverable` sub-count has no equivalent check, so those specific values (flagged `undeliverable_is_estimated = True`) should be treated as best-effort, not verified. One date (2025-09-25) couldn't be split at all; total/mail/email were instead recovered from the grand-total residual, and `undeliverable` is left blank.
- This report is Fairfax County's own "Unofficial" daily report, not certified results.

## Next steps toward the full NovaVote site
- Add other localities (Arlington, Loudoun, Prince William, Alexandria, Richmond, Virginia Beach) as their equivalent reports are located/parsed.
- **Precinct-level data**: the upstream source is the Virginia Dept. of Elections (ELECT) Daily Absentee List (DAL), plus the Registered Voter List and Comprehensive Absentee Application List. Digital Poll Watchers / EPEC *purchase* these files from ELECT and republish analysis — they are a downstream analyst, not the primary source, and they take explicit positions on ballot questions. Go to ELECT directly.
- Replace the approximate site coordinates in `gen_data.py` with authoritative geocodes for map plotting.
- Consider a small scraper + parser pipeline (this was built by hand from PDF text extraction; a library like `pdfplumber` run directly against the PDF bytes would be more robust for future election cycles).
