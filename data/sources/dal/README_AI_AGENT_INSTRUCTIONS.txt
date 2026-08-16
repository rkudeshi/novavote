2025 NORTHERN VIRGINIA DAL METRICS: AI AGENT INSTRUCTIONS

PURPOSE
Use these files to reproduce the simple countywide daily pre-election participation series from the Fairfax-style report for the November 4, 2025 Virginia general election.

SOURCE
The CSVs are processed daily Daily Absentee List (DAL) metric snapshots published by Digital Poll Watchers / Electoral Process Education Corp. (EPEC), derived from Virginia Department of Elections (ELECT) DAL data. Source page: https://digitalpollwatchers.org/2025-va-november-general-election-dal-file-metrics/

JURISDICTIONS INCLUDED
Alexandria City
Arlington County
Fairfax City
Fairfax County
Falls Church City
Loudoun County
Manassas City
Manassas Park City
Prince William County

FILES
Each jurisdiction has an untouched CSV from the EPEC locality-level metrics archive.
NoVA_2025_DAL_metrics_combined.csv stacks all 9 files and adds LOCALITY as the first column.

IMPORTANT DATA CHARACTERISTIC
These are DAILY CUMULATIVE DAL SNAPSHOTS, not voter-level raw DAL files and not event-date records. FILEDATE is the timestamp when the snapshot was taken. It is NOT the date a voter cast or returned a ballot. Most snapshots are around 5:00 AM, so the increase from one morning snapshot to the next generally reflects activity posted since the prior snapshot, usually the preceding calendar day's activity.

The original locality CSVs contain a second row that declares data types (string, number, number, ...). Ignore that row when loading data. The combined CSV has already removed it.

CORE FIELDS TO USE
ON_MACHINE = cumulative approved early in-person ballots in the DAL snapshot. EPEC definition: BALLOT_STATUS == ON_MACHINE and APP_STATUS == APPROVED.
MAIL_IN = cumulative returned mail/absentee ballots counted by EPEC as MARKED + PRE_PROCESSED.
MARKED = approved records with BALLOT_STATUS == MARKED.
PRE_PROCESSED = approved records with BALLOT_STATUS == PRE-PROCESSED.
COUNTABLE = EPEC's broader countable category: PROVISIONAL + MARKED + PRE_PROCESSED + ON_MACHINE + FWAB. Do NOT use COUNTABLE as the simple early-in-person-plus-mail total unless that broader definition is intentionally desired.

TARGET OUTPUT
For each locality, create one row per activity date with at least:
activity_date
early_in_person_daily
early_in_person_cumulative
mail_returned_daily
mail_returned_cumulative
combined_daily
combined_cumulative

CALCULATION
1. Parse FILEDATE as a datetime and sort ascending.
2. Remove duplicate FILEDATE rows if any, keeping the last exact duplicate.
3. For each snapshot row i after the first usable row:
   early_delta = ON_MACHINE[i] - ON_MACHINE[i-1]
   mail_delta = MAIL_IN[i] - MAIL_IN[i-1]
4. Because the snapshots are generally taken around 5:00 AM, assign each snapshot-to-snapshot delta to the calendar date immediately BEFORE FILEDATE[i]. In formula form:
   activity_date = DATE(FILEDATE[i]) - 1 day
5. Set:
   early_in_person_daily = early_delta
   mail_returned_daily = mail_delta
   combined_daily = early_delta + mail_delta
6. For cumulative values, use the current snapshot totals:
   early_in_person_cumulative = ON_MACHINE[i]
   mail_returned_cumulative = MAIL_IN[i]
   combined_cumulative = ON_MACHINE[i] + MAIL_IN[i]
7. Restrict the public-facing early-voting series to the actual 2025 early-voting period. Virginia in-person early voting began Friday, September 19, 2025 and ended Saturday, November 1, 2025. Do not label post-election DAL corrections as early-voting activity.
8. The election was Tuesday, November 4, 2025. Mail-ballot records may continue changing after November 4 because of valid post-election receipt/processing and corrections. If the goal is a pre-election-only curve comparable to the Fairfax operational report, stop the primary chart at November 3 or clearly distinguish post-election changes.

DATA-QUALITY RULES
- Do NOT replace negative daily deltas with zero automatically. A negative delta can indicate a DAL correction or status change. Preserve the raw delta and optionally flag it as a correction.
- Do NOT interpret FILEDATE itself as the vote date.
- Do NOT claim these files identify the physical early-voting location. They are locality-level aggregate snapshots.
- Do NOT use ISSUED changes as 'ballots mailed that day.' ISSUED is a current-status count, not a daily mail-out field.
- Do NOT split mail returns into USPS vs drop box. These files do not contain return method.
- If comparing to an official locality report and totals differ slightly, preserve both and label this series as DAL-derived. DAL status corrections and timing can cause differences.

SIMPLE EXAMPLE
If the September 20 05:00 snapshot has ON_MACHINE=2,432 and the September 19 05:00 snapshot has ON_MACHINE=0, then:
activity_date = 2025-09-19
early_in_person_daily = 2,432
early_in_person_cumulative = 2,432

If the September 21 05:00 snapshot has ON_MACHINE=4,464, then:
activity_date = 2025-09-20
early_in_person_daily = 4,464 - 2,432 = 2,032
early_in_person_cumulative = 4,464

OPTIONAL OUTPUT FOR A WEBSITE
Recommended normalized table:
election_date, locality, activity_date, early_in_person_daily, early_in_person_cumulative, mail_returned_daily, mail_returned_cumulative, combined_daily, combined_cumulative, source, source_method

Use:
election_date = 2025-11-04
source = Digital Poll Watchers / EPEC, derived from Virginia ELECT DAL
source_method = Daily cumulative DAL snapshot differencing

LIMITATION RELATIVE TO THE FAIRFAX ATTACHMENT
This reproduces the simple locality-wide daily early-in-person and returned-mail curves. It does NOT reproduce Fairfax's early-voting-site breakdown, mail-vs-drop-box return breakdown, daily ballot-mailing counts, or surrendered-ballot data.
