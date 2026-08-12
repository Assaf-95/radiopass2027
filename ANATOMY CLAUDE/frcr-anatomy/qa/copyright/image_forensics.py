"""Per-image forensics for the copyright audit.

For every question image, independent of any metadata claim:
  * sha256              — exact duplicates (same file reused by several Qs)
  * perceptual hash     — near duplicates (cropped / re-encoded variants)
  * burned-in text      — clusters of small high-contrast glyph components,
                          which is what printed case labels, figure numbers
                          and question boxes look like on a scanned page
  * colour fraction     — greyscale radiology has none; a screenshot of an
                          application or a printed colour figure does
  * page-white fraction — a scanned book page keeps paper-white margins that
                          a bare radiograph does not
Nothing here is conclusive on its own; it is evidence to classify against.
"""
import hashlib, json, os, sys
import numpy as np
from PIL import Image

def sha256(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda: f.read(1<<20), b''): h.update(b)
    return h.hexdigest()

def phash(im):
    g=im.convert('L').resize((32,32), Image.LANCZOS)
    a=np.asarray(g, dtype=np.float32)
    d=np.fft.fft2(a); d=np.abs(d[:8,:8]); d[0,0]=0
    return ''.join('1' if v>np.median(d) else '0' for v in d.flatten())

def glyph_bands(a):
    """Rows whose bright-pixel runs look like printed characters."""
    H,W=a.shape
    bright=(a>200)|(a<45)
    counts=bright.sum(axis=1).astype(np.float32)
    # a text row has moderate ink; anatomy rows have far more, blank far less
    txt=((counts> W*0.008)&(counts< W*0.22))
    bands=[];run=0
    for i,v in enumerate(txt):
        if v: run+=1
        else:
            if 4<=run<=int(H*0.06): bands.append((i-run,i))
            run=0
    return bands

def analyse(p):
    im=Image.open(p)
    rgb=im.convert('RGB'); rgb.thumbnail((700,700))
    arr=np.asarray(rgb, dtype=np.int16)
    colour=float(((arr.max(axis=2)-arr.min(axis=2))>40).mean())
    g=np.asarray(rgb.convert('L'), dtype=np.uint8)
    return {
        'sha256': sha256(p), 'phash': phash(im),
        'w': im.size[0], 'h': im.size[1], 'mode': im.mode,
        'colourFrac': round(colour,5),
        'pageWhiteFrac': round(float((g>235).mean()),4),
        'nearBlackFrac': round(float((g<20).mean()),4),
        'textBands': len(glyph_bands(g)),
    }

inv=json.load(open('qa/copyright/master-question-inventory.json'))
paths=sorted({e['imagePath'] for e in inv})
out={}
ck='qa/copyright/image-forensics.json'
if os.path.exists(ck): out=json.load(open(ck))
for n,ip in enumerate(paths,1):
    if ip in out: continue
    fp=os.path.join('public/images', ip.lstrip('/').replace('images/',''))
    try: out[ip]=analyse(fp)
    except Exception as ex: out[ip]={'error':str(ex)}
    if n%60==0:
        json.dump(out, open(ck,'w'), indent=0); print(f'  ...{n}/{len(paths)}', flush=True)
json.dump(out, open(ck,'w'), indent=0)
print(f'forensics complete: {len(out)} unique images')
