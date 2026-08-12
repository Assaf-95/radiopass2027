"""Compose ONE frontal body: the scout skeleton as the connective frame,
the premium thorax and abdomen renders seated on it, and the forearm render
mirrored onto both arms. Landmarks come from the scout's own coordinate
system (vertex 1.0 ... sole -1.0), so every placement is computed, not eyed.
"""
import os
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
import numpy as np

SP = os.path.dirname(os.path.abspath(__file__))  # tools/body — scout.png lives here
HERO = ('/Users/User1/Desktop/Claude/radiopass-main/ANATOMY CLAUDE/'
        'frcr-anatomy/public/images/hero')

W, H = 1600, 4800
py = lambda y: (1 - y) / 2 * (H - 160) + 80  # scout body-space -> px

# --- 1. The frame: brighten the point cloud and give it breath ------------
scout = Image.open(os.path.join(SP, 'scout.png')).convert('RGBA')
a = np.array(scout).astype(np.float32)
# Lift: the raw render is exposure-safe but dim; the frame should read as a
# radiographic body, not a dust sketch. Legs got the least ink — lift them more.
gain = np.linspace(1.0, 1.0, H)
gain[: int(py(0.6))] = 1.7          # head and neck open the page — presence
gain[int(py(0.0)):] = 1.5           # pelvis down
gain[int(py(-0.5)):] = 1.8          # knees down
a[:, :, 3] = np.clip(a[:, :, 3] * 2.2 * gain[:, None], 0, 255)
scout = Image.fromarray(a.astype(np.uint8))
# Densify: the cloud twice, one pixel apart, then a soft and a wide glow —
# the frame should read as a radiograph, not a star field.
dense = scout.copy()
dense.alpha_composite(scout, (1, 1))
glow = dense.filter(ImageFilter.GaussianBlur(6))
wide = dense.filter(ImageFilter.GaussianBlur(18))
frame = Image.alpha_composite(wide, Image.alpha_composite(glow, dense))

body = Image.new('RGBA', (W, H), (0, 0, 0, 0))
body.alpha_composite(frame)

def feather(im, top=0.10, bot=0.10):
    """Vertical alpha feather so an overlay never shows an edge."""
    m = np.array(im, dtype=np.float32)
    h = m.shape[0]
    ramp = np.ones(h, dtype=np.float32)
    t = int(h * top); b = int(h * bot)
    if t: ramp[:t] = np.linspace(0, 1, t)
    if b: ramp[-b:] = np.linspace(1, 0, b)
    m[:, :, 3] *= ramp[:, None]
    return Image.fromarray(m.astype(np.uint8))

def content_rows(im, thresh=18):
    """First/last rows carrying real alpha, so scaling maps content, not box."""
    al = np.array(im)[:, :, 3]
    rows = np.nonzero((al > thresh).sum(axis=1) > 3)[0]
    return rows.min(), rows.max()

def place(im, target_top_px, target_bot_px, cx_px, opacity=1.0, fea=(0.1, 0.1)):
    """Scale so the image's CONTENT spans [top, bot] px, centred on cx."""
    t, b = content_rows(im)
    scale = (target_bot_px - target_top_px) / (b - t)
    nw, nh = round(im.width * scale), round(im.height * scale)
    im2 = im.resize((nw, nh), Image.LANCZOS)
    if opacity < 1:
        m = np.array(im2, dtype=np.float32)
        m[:, :, 3] *= opacity
        im2 = Image.fromarray(m.astype(np.uint8))
    im2 = feather(im2, *fea)
    x = round(cx_px - nw / 2)
    y = round(target_top_px - t * scale)
    body.alpha_composite(im2, (max(0, x), y))
    return dict(x=x, y=y, w=nw, h=nh)

# --- 2. Seat the premium renders on the frame -----------------------------
thorax = Image.open(os.path.join(HERO, 'thorax.webp')).convert('RGBA')
abdo = Image.open(os.path.join(HERO, 'abdo-pelvis.webp')).convert('RGBA')
CX = W / 2
# Thorax: larynx just under the chin, costal margin below the xiphoid.
tr = place(thorax, py(0.735), py(0.25), CX, fea=(0.06, 0.16))
# Abdomen: tucked under the costal margin, pelvic brim at the pelvis.
ar = place(abdo, py(0.34), py(-0.04), CX, fea=(0.14, 0.12))

# --- 2b. Optional premium region slots ------------------------------------
# One slot per region of the render series (style block: same camera, same
# lighting, near-black ground, gold rim beam). Generate a region, drop it in
# public/images/hero under the listed name, re-run this script, and it is
# seated on the frame at its landmark span — exactly as the thorax and
# abdomen are. Content spans are body landmarks, not image edges.
SLOTS = [
    ('region-2-neck.webp',   0.735, 0.58,  CX, (0.10, 0.14)),  # skull base -> thoracic inlet
    ('region-5-pelvis.webp', 0.10, -0.18,  CX, (0.12, 0.12)),  # iliac crests -> ischia/femoral heads
    ('region-7-thigh.webp', -0.10, -0.60,  CX, (0.10, 0.12)),  # proximal femur -> knee
    ('region-8-leg.webp',   -0.52, -0.94,  CX, (0.10, 0.10)),  # tibial plateau -> ankle mortise
    ('region-9-foot.webp',  -0.88, -1.02,  CX, (0.08, 0.04)),  # talus -> toes
]
for name, y_top, y_bot, cx, fea in SLOTS:
    path = os.path.join(HERO, name)
    if not os.path.exists(path):
        continue
    seg = Image.open(path).convert('RGBA')
    r = place(seg, py(y_top), py(max(y_bot, -1.0)), cx, fea=fea)
    print(f'slot {name:22} seated at y {r["y"]/12:.0f}..{(r["y"]+r["h"])/12:.0f}vh')

# --- 3. Harmonise and export ----------------------------------------------
out = body.resize((1200, 3600), Image.LANCZOS)
out = ImageEnhance.Contrast(out).enhance(1.04)
dest = os.path.join(HERO, 'body-full.webp')
out.save(dest, 'WEBP', quality=86, method=6)
print('written', dest, out.size, os.path.getsize(dest) // 1024, 'KB')

# Landmark table for the page (BODY_VH=400 -> vh = px/12 at source scale).
for name, y in [('vertex', 1.0), ('chin', 0.735), ('shoulder', 0.645),
                ('xiphoid', 0.36), ('pubis', 0.0), ('knee', -0.5),
                ('ankle', -0.915), ('sole', -1.0)]:
    print(f'{name:9} {py(y)/12:6.1f}vh')
for k, r in [('thorax', tr), ('abdo', ar)]:
    print(f'{k:7} y {r["y"]/12:.0f}..{(r["y"]+r["h"])/12:.0f}vh  x {r["x"]}..{r["x"]+r["w"]}px')

prev = Image.new('RGB', out.size, (0, 0, 0))
prev.paste(out, (0, 0), out)
prev.resize((300, 900)).save(os.path.join(SP, 'body_preview.png'))
