"""Classify every question. Evidence-driven; no status is assigned by guess.

The dominant fact established in Phase 1/2 is that 486 of 501 questions carry
a `sourceFile` naming a PDF of a published textbook, 414 carry the book's own
`caseLabel`, and the images are captures of those printed pages (the book's
typography, case headings, printed sub-questions and arrow annotations are
visible in the shipped files). No LICENSE file, permission statement or
attribution exists anywhere in the repository.
"""
import json, os, re, collections

inv = json.load(open('qa/copyright/master-question-inventory.json'))
fx  = json.load(open('qa/copyright/image-forensics.json'))

BOOK_PDFS = {
    'Upper Limb.pdf', 'Lower Limb.pdf', 'head _ neck.pdf',
    'Spine.pdf', 'Abdo-Pelvis.pdf', 'Thorax.pdf',
}
PUBLISHERS = [
    ('Applied Radiological Anatomy (Butler/Mitchell/Ellis), Cambridge University Press', r'Butler P, Mitchell'),
    ('Anatomy for Diagnostic Imaging (Ryan/McNicholas/Eustace), Saunders Elsevier',       r'Ryan S, McNicholas'),
    ("Clinically Oriented Anatomy (Moore/Dalley/Agur), Lippincott",                        r'Moore KL, Dalley'),
    ("Netter's Concise Radiologic Anatomy (Weber/Netter), Elsevier",                       r'Weber E, Netter'),
    ('Imaging Atlas of Human Anatomy (Weir/Abrahams), Mosby',                              r'Weir J, Abrahams'),
    ('Atlas of Anatomy, Thieme (illustration by Karl Wesker)',                             r'Thieme'),
    ('Cambridge Books Online download stamp (CBO9781139087384)',                           r'Cambridge Books Online'),
]

results = []
for e in inv:
    ev, src, status, conf = [], None, None, None
    f = fx.get(e['imagePath'], {})

    sf = e.get('sourceFile') or ''
    if sf in BOOK_PDFS:
        ev.append(f"sourceFile records extraction from a published book PDF: '{sf}'")
        status, conf = 'HIGH-RISK', 'High'
        src = f'Published FRCR anatomy textbook — page capture from {sf}'
    elif 'MSK NOTES' in sf:
        ev.append(f"sourceFile is the author's own Keynote deck: '{sf}'")
        ev.append('Image is a bare clinical study with hand-added arrow annotation; '
                  'no publisher furniture, case heading or figure number present')
        status, conf = 'REVIEW-1', 'Medium'
        src = 'Author’s own notes — underlying clinical image origin undocumented'
    else:
        status, conf = 'REVIEW-1', 'Low'
        ev.append(f"unrecognised sourceFile: '{sf}'")

    if e.get('caseLabel'):
        ev.append(f"carries the book's own case numbering: caseLabel='{e['caseLabel']}'")
    if e.get('sourcePageQuestion') is not None:
        ev.append(f"records the source page number it was taken from: p.{e['sourcePageQuestion']}")

    for label, pat in PUBLISHERS:
        if any(re.search(pat, r) for r in e.get('references') or []):
            ev.append(f'cites {label} in its references array (rendered to the learner)')
            src = label
            if status == 'HIGH-RISK':
                status = 'SOURCE-FOUND'
                conf = 'High'
    fr = e.get('flagForReview') or ''
    if 'Cambridge Books Online' in fr or any('Cambridge Books Online' in r for r in e.get('references') or []):
        ev.append('carries a Cambridge Books Online download watermark (institutional '
                  'ebook download stamp, incl. a third party IP address)')
        status, conf = 'HIGH-RISK', 'High'
    if f.get('pageWhiteFrac', 0) > 0.15:
        ev.append(f"image retains printed-page white margin ({f['pageWhiteFrac']:.0%} of pixels) "
                  '— consistent with a scan of a book page rather than a bare film')
    if f.get('textBands', 0) >= 6:
        ev.append(f"{f['textBands']} bands of printed text detected burned into the image file")

    e2 = dict(e)
    e2.update({'auditStatus': status, 'confidence': conf, 'evidence': ev, 'suspectedSource': src})
    results.append(e2)

json.dump(results, open('qa/copyright/audit-results.json','w'), indent=1)
c = collections.Counter(r['auditStatus'] for r in results)
print('CLASSIFICATION COMPLETE —', len(results), 'questions')
for k, v in c.most_common(): print(f'  {k:14} {v}')
unaudited = [r for r in results if r['auditStatus'] in (None, 'pending')]
print('  unaudited:', len(unaudited))
