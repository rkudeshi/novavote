import csv
from datetime import date

YEAR_SEP_OCT = 2025
YEAR_NOV = 2025

def to_iso(d):
    day, mon = d.split('-')
    day = int(day)
    month = {'Sep': 9, 'Oct': 10, 'Nov': 11}[mon]
    return date(2025, month, day).isoformat()

# ---------------------------------------------------------------
# 1. MAILED ABSENTEE BALLOTS (page 2)
# columns: Date, Total, Domestic, UOCAVA_Mail, UOCAVA_Email
# ---------------------------------------------------------------
mailed_raw = """
19-Sep 73759 67784 1679 4296
20-Sep 1461 1409 24 28
21-Sep 0 0 0 0
22-Sep 689 664 6 19
23-Sep 9 0 0 9
24-Sep 431 416 4 11
25-Sep 831 804 19 8
26-Sep 369 352 8 9
27-Sep 0 0 0 0
28-Sep 0 0 0 0
29-Sep 842 831 10 1
30-Sep 570 520 16 34
1-Oct 396 364 13 19
2-Oct 420 397 13 10
3-Oct 352 341 4 7
4-Oct 0 0 0 0
5-Oct 0 0 0 0
6-Oct 884 828 22 34
7-Oct 386 358 8 20
8-Oct 309 283 6 20
9-Oct 381 363 4 14
10-Oct 357 342 7 8
11-Oct 0 0 0 0
12-Oct 0 0 0 0
13-Oct 825 774 19 32
14-Oct 409 395 8 6
15-Oct 382 358 7 17
16-Oct 431 406 9 16
17-Oct 213 200 3 10
18-Oct 0 0 0 0
19-Oct 0 0 0 0
20-Oct 978 938 9 31
21-Oct 404 376 8 20
22-Oct 441 417 9 15
23-Oct 424 404 8 12
24-Oct 518 485 7 26
25-Oct 0 0 0 0
26-Oct 0 0 0 0
27-Oct 49 42 0 7
28-Oct 10 8 1 1
29-Oct 4 4 0 0
30-Oct 10 9 0 1
31-Oct 2 2 0 0
1-Nov 0 0 0 0
2-Nov 0 0 0 0
3-Nov 1 0 0 1
""".strip().split('\n')

mailed_rows = []
for line in mailed_raw:
    parts = line.split()
    d, total, dom, uo_mail, uo_email = parts
    mailed_rows.append([to_iso(d), int(total), int(dom), int(uo_mail), int(uo_email)])

with open('mailed_absentee_ballots.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total_mailed', 'domestic', 'uocava_mail', 'uocava_email'])
    w.writerows(mailed_rows)
    total_check = sum(r[1] for r in mailed_rows)
    print('Mailed total check:', total_check, 'vs published 87547')

# ---------------------------------------------------------------
# 2. RETURNED BY MAIL (page 3)
# columns: Date, Total, Mail, Email, Undeliverable(subset of Mail, informational)
# Total = Mail + Email (verified across every unambiguous row)
# ---------------------------------------------------------------
returned_mail_raw = """
19-Sep 0 0 0 0
20-Sep 0 0 0 0
21-Sep 0 0 0 0
22-Sep 1 0 1 0
23-Sep 2 0 2 0
24-Sep 7 0 7 0
25-Sep REVIEW REVIEW REVIEW REVIEW
26-Sep 3244 3243 1 0
27-Sep 0 0 0 0
28-Sep 0 0 0 0
29-Sep 6770 6743 27 375
30-Sep 39 25 14 122
1-Oct 3494 3477 17 189
2-Oct 2252 2226 26 95
3-Oct 1687 1668 19 12
4-Oct 0 0 0 0
5-Oct 0 0 0 0
6-Oct 3738 3688 50 77
7-Oct 151 135 16 8
8-Oct 2130 2116 14 18
9-Oct 1351 1321 30 13
10-Oct 1130 1097 33 17
11-Oct 1091 1091 0 0
12-Oct 0 0 0 0
13-Oct 0 0 0 0
14-Oct 1806 1756 50 12
15-Oct 176 155 21 21
16-Oct 1633 1580 53 15
17-Oct 1769 1729 40 8
18-Oct 0 0 0 0
19-Oct 0 0 0 0
20-Oct 2807 2748 59 50
21-Oct 112 81 31 3
22-Oct 1466 1431 35 33
23-Oct 1236 1181 55 14
24-Oct 989 948 41 15
25-Oct 0 0 0 0
26-Oct 0 0 0 0
27-Oct 2343 2263 80 8
28-Oct 335 314 21 20
29-Oct 1323 1266 57 3
30-Oct 1163 1123 40 16
31-Oct 1971 1930 41 20
1-Nov 1041 1041 0 1
2-Nov 0 0 0 0
3-Nov 941 857 84 27
4-Nov 814 782 32 2
5-Nov 950 909 41 7
6-Nov 944 914 30 0
7-Nov 470 431 39 12
""".strip().split('\n')

# Dates where the source PDF's text extraction ran digits together with no
# separator (e.g. "1010", "3,24310"). Total/Mail/Email were recovered reliably
# because Total=Mail+Email holds on every clean row and was used to check the
# split. The "undeliverable" sub-count (a subset of Mail) has no such check,
# so treat those specific values as estimated, not verified.
ESTIMATED_UNDELIVERABLE_DATES = {
    '22-Sep', '23-Sep', '24-Sep', '26-Sep', '7-Oct', '11-Oct',
    '17-Oct', '21-Oct', '27-Oct', '29-Oct', '1-Nov', '4-Nov', '5-Nov', '6-Nov'
}

known_rows = []
review_date = None
for line in returned_mail_raw:
    parts = line.split()
    d = parts[0]
    if parts[1] == 'REVIEW':
        review_date = d
        continue
    total, mail, email, undel = map(int, parts[1:])
    assert mail + email == total, f"mismatch on {d}: {mail}+{email}!={total}"
    estimated = d in ESTIMATED_UNDELIVERABLE_DATES
    known_rows.append([d, total, mail, email, undel, estimated])

GRAND_TOTAL = 51413
GRAND_MAIL = 50303
GRAND_EMAIL = 1110
GRAND_UNDEL = 1778

sum_total = sum(r[1] for r in known_rows)
sum_mail = sum(r[2] for r in known_rows)
sum_email = sum(r[3] for r in known_rows)

resid_total = GRAND_TOTAL - sum_total
resid_mail = GRAND_MAIL - sum_mail
resid_email = GRAND_EMAIL - sum_email
# Undeliverable is unrecoverable for this row via residual (it's not
# reliably additive/known for every ambiguous row) - leave blank rather
# than publish a number we can't verify (a naive residual gives an
# impossible value, e.g. exceeding that day's mail count).
print(f"\nReconstructed {review_date} row from grand-total residuals:")
print(f"  total={resid_total}, mail={resid_mail}, email={resid_email}, undeliverable=UNKNOWN (left blank)")
print(f"  check: mail+email = {resid_mail+resid_email} (should equal total {resid_total})")

final_rows = []
for d, total, mail, email, undel, estimated in known_rows:
    final_rows.append([to_iso(d), total, mail, email, undel, estimated])
final_rows.append([to_iso(review_date), resid_total, resid_mail, resid_email, '', True])
final_rows.sort(key=lambda r: r[0])

with open('returned_by_mail.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total_returned', 'returned_by_mail', 'returned_by_email',
                 'undeliverable_subset_of_mail', 'undeliverable_is_estimated'])
    w.writerows(final_rows)

# ---------------------------------------------------------------
# 3. RETURNED BY DROPBOX (page 4)
# columns: Date, Total, Mail(?), E-mail(?), Returned unused -- actually header says
# "Total Mail E-mail Returned unused" but this is drop box so relabel generically
# ---------------------------------------------------------------
dropbox_raw = """
19-Sep 0 0 0 0
20-Sep 0 0 0 0
21-Sep 0 0 0 0
22-Sep 0 0 0 0
23-Sep 24 24 0 0
24-Sep 158 158 0 0
25-Sep 217 216 1 0
26-Sep 241 241 0 0
27-Sep 0 0 0 0
28-Sep 0 0 0 0
29-Sep 434 434 0 0
30-Sep 196 196 0 0
1-Oct 211 211 0 0
2-Oct 177 177 0 0
3-Oct 188 188 0 0
4-Oct 0 0 0 0
5-Oct 0 0 0 0
6-Oct 373 373 0 0
7-Oct 149 149 0 0
8-Oct 161 161 0 0
9-Oct 92 92 0 0
10-Oct 129 129 0 0
11-Oct 55 55 0 0
12-Oct 0 0 0 0
13-Oct 211 210 1 0
14-Oct 181 181 0 0
15-Oct 169 169 0 0
16-Oct 136 136 0 0
17-Oct 111 111 0 0
18-Oct 0 0 0 0
19-Oct 0 0 0 0
20-Oct 265 264 1 0
21-Oct 168 168 0 0
22-Oct 161 161 0 0
23-Oct 594 594 0 0
24-Oct 569 569 0 0
25-Oct 659 656 3 0
26-Oct 308 308 0 0
27-Oct 443 442 1 0
28-Oct 383 382 1 0
29-Oct 446 445 1 0
30-Oct 412 412 0 0
31-Oct 472 472 0 0
1-Nov 681 679 2 0
2-Nov 0 0 0 0
3-Nov 403 402 1 0
4-Nov 3377 3375 2 0
""".strip().split('\n')

dropbox_rows = []
for line in dropbox_raw:
    parts = line.split()
    d, total, mail, email, unused = parts
    dropbox_rows.append([to_iso(d), int(total), int(mail), int(email), int(unused)])

with open('returned_by_dropbox.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total_returned_dropbox', 'dropbox_mail_ballot', 'dropbox_email_ballot', 'returned_unused'])
    w.writerows(dropbox_rows)
    print('\nDropbox total check:', sum(r[1] for r in dropbox_rows), 'vs published 12954')

# ---------------------------------------------------------------
# 4. EARLY IN PERSON VOTING BY SITE (page 5)
# Only 3 sites open before 23-Oct: Government Center, Mt. Vernon, North County
# 13 more sites open starting 23-Oct
# ---------------------------------------------------------------
# NOTE: The PDF header reads "Herndon Fortnightly" — this is ONE site
# (Herndon Fortnightly Library), not two. There are 16 sites, not 17.
# Confirmed two ways: (1) the 16 per-site grand totals sum exactly to 137,221,
# and (2) the 13 satellite sites are listed alphabetically, and "Herndon
# Fortnightly" falls correctly between "Great Falls" and "Jim Scott".
sites = ["Government Center", "Mt. Vernon", "North County", "Burke", "Centreville",
          "Franconia", "Great Falls", "Herndon Fortnightly", "Jim Scott", "Lorton",
          "Mason", "McLean", "Sully", "Thomas Jefferson", "Tysons-Pimmit", "West Springfield"]

SITE_GRAND_TOTALS = [34906, 14924, 16349, 6198, 4722, 7315, 2965, 4356,
                     5346, 4073, 6216, 7615, 3944, 4312, 5536, 8444]

early_raw = """
19-Sep 2432 1301 454 677
20-Sep 2032 990 387 655
21-Sep 0
22-Sep 1746 939 313 494
23-Sep 1730 925 359 446
24-Sep 1406 717 285 404
25-Sep 1364 691 333 340
26-Sep 1982 1100 414 468
27-Sep 0
28-Sep 0
29-Sep 1680 904 395 381
30-Sep 1403 790 326 287
1-Oct 1496 862 327 307
2-Oct 1733 1031 352 350
3-Oct 2073 1249 409 415
4-Oct 0
5-Oct 0
6-Oct 1706 976 383 347
7-Oct 1479 817 362 300
8-Oct 1271 716 270 285
9-Oct 1284 699 316 269
10-Oct 2030 1143 465 422
11-Oct 0
12-Oct 0
13-Oct 2158 1274 436 448
14-Oct 1727 988 383 356
15-Oct 1429 749 343 337
16-Oct 1314 690 312 312
17-Oct 1879 1053 387 439
18-Oct 0
19-Oct 0
20-Oct 1797 936 437 424
21-Oct 1608 832 394 382
22-Oct 1425 753 353 319
23-Oct 8012 696 331 374 558 464 697 261 402 461 480 606 698 372 388 454 770
24-Oct 8913 1167 406 463 580 437 753 299 407 490 355 675 722 378 380 538 863
25-Oct 12112 1494 707 901 806 595 859 403 600 741 495 647 1025 501 576 722 1040
26-Oct 5089 490 281 301 318 280 349 173 225 313 193 349 508 237 273 402 397
27-Oct 7917 990 471 420 587 354 647 223 302 413 322 559 696 320 342 471 800
28-Oct 7282 958 462 414 475 350 583 206 306 392 319 506 589 314 296 432 680
29-Oct 7408 975 490 547 501 322 588 213 302 387 297 511 555 320 297 419 684
30-Oct 8425 1132 608 629 573 401 671 243 350 430 327 546 592 308 362 461 792
31-Oct 10550 1715 667 814 626 481 797 319 456 562 433 640 761 421 441 553 864
1-Nov 19329 2164 1306 1622 1174 1038 1371 625 1006 1157 852 1177 1469 773 957 1084 1554
""".strip().split('\n')

early_rows = []
for line in early_raw:
    parts = line.split()
    d = parts[0]
    nums = list(map(int, parts[1:]))
    total = nums[0] if nums else 0
    site_vals = nums[1:] if len(nums) > 1 else []
    row = [to_iso(d), total]
    for i in range(len(sites)):
        row.append(site_vals[i] if i < len(site_vals) else '')
    early_rows.append(row)
    if site_vals:
        s = sum(site_vals)
        if s != total:
            print(f"WARNING: {d} site sum {s} != total {total}")

with open('early_in_person_by_site.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total'] + [s.lower().replace(' ', '_').replace('.', '').replace('-', '_') for s in sites])
    w.writerows(early_rows)
    print('\nEarly in-person total check:', sum(r[1] for r in early_rows), 'vs published 137221')

# Verify each site column sums to its published grand total. This is the check
# that catches column misalignment (a shift can still leave row totals correct).
for i, site in enumerate(sites):
    col_sum = sum(r[2 + i] for r in early_rows if r[2 + i] != '')
    expected = SITE_GRAND_TOTALS[i]
    flag = 'OK' if col_sum == expected else '*** MISMATCH ***'
    print(f'  {site:22s} {col_sum:7d} vs {expected:7d}  {flag}')

# ---------------------------------------------------------------
# 5. SATELLITE / AB-APPLICANTS WHO VOTED EARLY IN PERSON INSTEAD (page 6)
# ---------------------------------------------------------------
satellite_raw = """
19-Sep 3 3 0
20-Sep 46 45 1
21-Sep 0 0 0
22-Sep 46 46 0
23-Sep 46 39 7
24-Sep 26 10 16
25-Sep 27 11 16
26-Sep 26 12 14
27-Sep 0 0 0
28-Sep 0 0 0
29-Sep 20 8 12
30-Sep 16 7 9
1-Oct 23 5 18
2-Oct 15 9 6
3-Oct 29 11 18
4-Oct 0 0 0
5-Oct 0 0 0
6-Oct 12 2 10
7-Oct 26 15 11
8-Oct 15 3 12
9-Oct 21 5 16
10-Oct 23 6 17
11-Oct 0 0 0
12-Oct 0 0 0
13-Oct 33 15 18
14-Oct 21 9 12
15-Oct 21 7 14
16-Oct 17 5 12
17-Oct 18 11 7
18-Oct 0 0 0
19-Oct 0 0 0
20-Oct 31 11 20
21-Oct 25 12 13
22-Oct 17 9 8
23-Oct 76 49 27
24-Oct 93 54 39
25-Oct 132 62 70
26-Oct 53 25 28
27-Oct 87 53 34
28-Oct 81 40 41
29-Oct 88 52 36
30-Oct 90 36 54
31-Oct 126 91 35
1-Nov 225 160 65
""".strip().split('\n')

sat_rows = []
for line in satellite_raw:
    parts = line.split()
    d, total, not_surr, surr = parts
    assert int(not_surr) + int(surr) == int(total), f"mismatch {d}"
    sat_rows.append([to_iso(d), int(total), int(not_surr), int(surr)])

with open('ab_applicants_voted_early_in_person.csv', 'w', newline='') as f:
    w = csv.writer(f)
    w.writerow(['date', 'total', 'ballot_not_surrendered', 'ballot_surrendered'])
    w.writerows(sat_rows)
    print('\nSatellite total check:', sum(r[1] for r in sat_rows), 'vs published 1654')

print("\nDone.")
