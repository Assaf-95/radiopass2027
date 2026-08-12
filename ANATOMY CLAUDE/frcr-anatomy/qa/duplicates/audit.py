"""Deterministic exact-duplicate detection across the whole anatomy bank.

fingerprint = sha256( imageSHA + normalisedStem + normalisedAnswers
                    + normalisedLabels + normalisedAnnotations )

Normalisation collapses whitespace and case ONLY. Anatomical wording is never
normalised: "left"/"right", "artery"/"vein", "medial"/"lateral" all remain
distinguishing, so two questions differing only in laterality never collide.
Numeric annotation coordinates are rounded to 2 dp so that 0.5000000 and 0.5
match while a materially different arrow position does not.
"""
import hashlib, json, os, re, collections

FILES=[('upper-limb','Upper Limb','upperLimb'),('lower-limb','Lower Limb','lowerLimb'),
       ('head-neck','Head and Neck','headNeck'),('spine','Spine','spine'),
       ('thorax','Thorax','thorax'),('abdo-pelvis','Abdomen and Pelvis','abdoPelvis')]

def norm(s):
    return re.sub(r'\s+',' ',(s or '').strip()).lower()

def img_sha(path):
    p=os.path.join('public/images', path.lstrip('/').replace('images/',''))
    if not os.path.exists(p): return 'MISSING:'+path
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda: f.read(1<<20), b''): h.update(b)
    return h.hexdigest()

def round_map(m):
    if not m: return []
    return sorted((k, round(float(v.get('x',0)),2), round(float(v.get('y',0)),2))
                  for k,v in m.items())

def glyphs(g):
    if not g: return []
    return sorted((x.get('letter'), round(float(x.get('x',0)),2), round(float(x.get('y',0)),2))
                  for x in g)

def crop(c):
    if not c: return None
    return tuple(round(float(c[k]),4) for k in ('x','y','w','h'))

inv=[]; shacache={}
for sid,title,fname in FILES:
    data=json.load(open(f'src/data/{fname}.json'))
    live=[q for q in data if not q.get('excludeFromPlay')]
    for i,q in enumerate(data):
        ip=q['imagePath']
        if ip not in shacache: shacache[ip]=img_sha(ip)
        disp=None
        if not q.get('excludeFromPlay'):
            disp=live.index(q)+1
        answers={k:(norm(v.get('officialAnswer')), tuple(sorted(norm(x) for x in v.get('acceptedVariants') or [])),
                    bool(v.get('lateralityRequired')), norm(v.get('prompt')))
                 for k,v in (q.get('answers') or {}).items()}
        parts=[shacache[ip], norm(q.get('questionText')), repr(crop(q.get('imageCrop'))),
               repr(sorted(answers.items())), repr(sorted(q.get('labels') or [])),
               repr(round_map(q.get('markerPositions'))), repr(round_map(q.get('markerLabelPositions'))),
               repr(glyphs(q.get('labelGlyphs'))), norm(q.get('teachingText'))]
        fp=hashlib.sha256('||'.join(parts).encode()).hexdigest()
        # softer key: same image + same answers, ignoring stem/teaching wording
        soft=hashlib.sha256('||'.join([shacache[ip], repr(sorted(answers.items())),
                                       repr(round_map(q.get('markerPositions')))]).encode()).hexdigest()
        inv.append({'section':sid,'regionTitle':title,'displayQuestionNumber':disp,
            'questionId':q['id'],'visibility':'LIVE' if disp else 'WITHHELD',
            'imagePath':ip,'imageSha256':shacache[ip],'questionText':q.get('questionText'),
            'labels':q.get('labels'),'answers':{k:v.get('officialAnswer') for k,v in (q.get('answers') or {}).items()},
            'teachingText':(q.get('teachingText') or '')[:200],
            'fingerprint':fp,'softFingerprint':soft})

os.makedirs('qa/duplicates', exist_ok=True)
json.dump(inv, open('qa/duplicates/anatomy-question-inventory.json','w'), indent=1)

exact=collections.defaultdict(list)
soft =collections.defaultdict(list)
for e in inv:
    exact[e['fingerprint']].append(e); soft[e['softFingerprint']].append(e)
exact_groups={k:v for k,v in exact.items() if len(v)>1}
soft_groups ={k:v for k,v in soft.items()  if len(v)>1 and k not in {e['fingerprint'] for g in exact_groups.values() for e in g}}
img=collections.defaultdict(list)
for e in inv: img[e['imageSha256']].append(e)
img_groups={k:v for k,v in img.items() if len(v)>1}

print(f'questions analysed        : {len(inv)}')
print(f'EXACT duplicate groups    : {len(exact_groups)}')
print(f'PROBABLE duplicate groups : {len(soft_groups)}   (same image+answers+markers, different wording)')
print(f'shared-image groups       : {len(img_groups)}   (same image reused — NOT a duplicate by itself)')
for k,v in list(soft_groups.items())[:6]:
    print('   probable:', ', '.join(f"{e['regionTitle']} Q{e['displayQuestionNumber']}" for e in v))
json.dump({'exact':{k:[e['questionId'] for e in v] for k,v in exact_groups.items()},
           'probable':{k:[e['questionId'] for e in v] for k,v in soft_groups.items()},
           'sharedImage':{k:[e['questionId'] for e in v] for k,v in img_groups.items()}},
          open('qa/duplicates/duplicate-groups.json','w'), indent=1)
