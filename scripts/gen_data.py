import csv, json

def read(fn):
    with open(fn) as f:
        return list(csv.DictReader(f))

early = read('early_in_person_by_site.csv')
mail = read('returned_by_mail.csv')
drop = read('returned_by_dropbox.csv')
mailed = read('mailed_absentee_ballots.csv')

SITE_KEYS = [k for k in early[0].keys() if k not in ('date', 'total')]

SITE_LABELS = {
    'government_center': 'Government Center',
    'mt_vernon': 'Mt. Vernon',
    'north_county': 'North County',
    'burke': 'Burke',
    'centreville': 'Centreville',
    'franconia': 'Franconia',
    'great_falls': 'Great Falls',
    'herndon_fortnightly': 'Herndon Fortnightly',
    'jim_scott': 'Jim Scott',
    'lorton': 'Lorton',
    'mason': 'Mason',
    'mclean': 'McLean',
    'sully': 'Sully',
    'thomas_jefferson': 'Thomas Jefferson',
    'tysons_pimmit': 'Tysons-Pimmit',
    'west_springfield': 'West Springfield',
}

# Approximate coordinates for the Fairfax County early voting sites (community
# centers / govt buildings). Rounded; for map plotting these should be
# replaced with authoritative geocodes.
SITE_COORDS = {
    'government_center': (38.8554, -77.3607),
    'mt_vernon': (38.7293, -77.1043),
    'north_county': (38.9526, -77.3494),
    'burke': (38.7934, -77.2717),
    'centreville': (38.8401, -77.4386),
    'franconia': (38.7712, -77.1524),
    'great_falls': (39.0018, -77.2872),
    'herndon_fortnightly': (38.9696, -77.3861),
    'jim_scott': (38.8676, -77.2280),
    'lorton': (38.7009, -77.2278),
    'mason': (38.8462, -77.1520),
    'mclean': (38.9343, -77.1775),
    'sully': (38.8879, -77.4344),
    'thomas_jefferson': (38.8462, -77.1861),
    'tysons_pimmit': (38.9021, -77.1936),
    'west_springfield': (38.7743, -77.2158),
}

def num(v):
    return int(v) if v not in ('', None) else None

mail_by_date = {r['date']: r for r in mail}
drop_by_date = {r['date']: r for r in drop}
mailed_by_date = {r['date']: r for r in mailed}

days = []
all_dates = sorted(set(list(mail_by_date) + list(drop_by_date) + list(mailed_by_date) + [r['date'] for r in early]))
early_by_date = {r['date']: r for r in early}

for d in all_dates:
    e = early_by_date.get(d)
    m = mail_by_date.get(d)
    dr = drop_by_date.get(d)
    ml = mailed_by_date.get(d)
    sites = {}
    if e:
        for k in SITE_KEYS:
            v = num(e[k])
            if v is not None:
                sites[k] = v
    days.append({
        'date': d,
        'inPerson': num(e['total']) if e else None,
        'sites': sites,
        'returnedMail': num(m['total_returned']) if m else None,
        'returnedDropbox': num(dr['total_returned_dropbox']) if dr else None,
        'ballotsMailed': num(ml['total_mailed']) if ml else None,
    })

site_totals = {k: num(early[0][k]) for k in SITE_KEYS}
# recompute totals from rows (row 0 is a date row, not the total row)
site_totals = {}
for k in SITE_KEYS:
    site_totals[k] = sum(num(r[k]) or 0 for r in early)

first_open = {}
for k in SITE_KEYS:
    for r in early:
        if num(r[k]) is not None:
            first_open[k] = r['date']
            break

sites_meta = []
for k in SITE_KEYS:
    lat, lon = SITE_COORDS[k]
    sites_meta.append({
        'key': k,
        'label': SITE_LABELS[k],
        'total': site_totals[k],
        'opened': first_open[k],
        'lat': lat,
        'lon': lon,
    })

dataset = {
    'id': 'fairfax-2025-general',
    'locality': 'Fairfax County',
    'localityType': 'county',
    'electionName': 'General & Special Elections',
    'electionDate': '2025-11-04',
    'reportDate': '2025-11-07',
    'status': 'Final (county-labeled unofficial)',
    'registeredVoters': 809786,
    'totalBallotsCast': 201588,
    'turnoutPct': 24.89,
    'totals': {
        'ballotsMailed': 87547,
        'returnedMail': 51413,
        'returnedDropbox': 12954,
        'inPerson': 137221,
        'abApplicantsVotedInPerson': 1654,
    },
    'sourceUrl': 'https://www.fairfaxcounty.gov/elections/sites/elections/files/Assets/Documents/PDF/AB-Daily-Report-Nov2025.pdf',
    'sites': sites_meta,
    'days': days,
}

with open('data.js', 'w') as f:
    f.write('// AUTO-GENERATED from validated CSVs. Do not hand-edit.\n')
    f.write('export const FAIRFAX_2025 = ')
    f.write(json.dumps(dataset, indent=2))
    f.write(';\n')

print('sites:', len(sites_meta))
print('days:', len(days))
print('site total sum:', sum(site_totals.values()))
print(json.dumps(sites_meta, indent=1)[:600])
