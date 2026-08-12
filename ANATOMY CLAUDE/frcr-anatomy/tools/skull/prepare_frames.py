"""Turn a folder of raw skull stills into the two ladders the hero scrubs.

The one decision that matters here is the crop. ONE bounding box, the union of
every frame's own subject box, is applied to every frame — crop each frame to
its own box and the skull swims around inside the square as it turns, which
reads as jitter rather than as rotation. The printed centroid table is the
only guard against that: registration drift is invisible in a still and
obvious in a column of numbers.

Frames are composited onto opaque black and the alpha channel is DROPPED. The
pin behind them is already #000, so nothing is lost, and lossy WebP stores the
alpha plane losslessly — carrying it costs 20-40% more bytes for a channel the
canvas is told to ignore (getContext('2d', {alpha: false})).

    python3 tools/skull/prepare_frames.py      # or: npm run stills
    npm run frames                             # regenerate the manifest
"""
import io
import os
import re
import sys

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

SP = os.path.dirname(os.path.abspath(__file__))          # tools/skull
ROOT = os.path.dirname(os.path.dirname(SP))              # repo root
SOURCE = os.path.join(SP, 'source')
OUT = os.path.join(ROOT, 'public', 'images', 'hero', 'skull')

LADDERS = (720, 480)
POSTER = 1400
PAD = 0.04          # breathing room around the union box, as a fraction
MAX_ASPECT = 1.55   # how tall the square may be relative to the subject's width
STEP = 10           # frames are numbered in tens so denser arcs slot between
QUALITY = 76
POSTER_QUALITY = 80
LADDER_BUDGET = 1_200_000   # bytes; the runtime caps transfer at this too

EXTS = ('.png', '.jpg', '.jpeg', '.webp')


def source_angle(name):
    """The camera angle a still was rendered at, if the filename says so.

    The renders arrive named like `frame-06-angle-022-5-right-oblique.png`,
    where 022-5 means 22.5 degrees. That number is the only record of where
    each frame sits around the turn, and the frames are NOT evenly spaced —
    this set jumps 27, 72, 135. The manifest reads the angle back out of the
    OUTPUT filename to space the rotation correctly, so renumbering these to
    a plain 10, 20, 30... would quietly throw the spacing away and put the
    lurch back. Returns None when there is no angle to find, in which case
    the caller falls back to ordinals.
    """
    m = re.search(r'angle[-_]?(\d+)(?:[-_](\d))?', name, re.I)
    if not m:
        return None
    return float(m.group(1)) + (float(m.group(2)) / 10 if m.group(2) else 0.0)


def out_name(name, all_names):
    """skull-NNNN.webp, where NNNN is the angle when the source knows it and a
    step-of-ten ordinal when it does not. Either way the number sorts and the
    manifest turns it into a position around the turn."""
    a = source_angle(name)
    if a is None:
        return f'skull-{(all_names.index(name) + 1) * STEP:04d}.webp'
    return f'skull-{int(round(a)):04d}.webp'


def natural(name):
    """Sort still-0002 before still-0010, which a plain sort does not."""
    return [int(t) if t.isdigit() else t.lower() for t in re.split(r'(\d+)', name)]


def debeam(arr, pad=16):
    """Take the render's vertical light beam out.

    That beam is the PHYSICS site's visual language and does not belong on the
    anatomy hero. It is additive light in a narrow column, so it is capped at
    what the pixels either side of it imply rather than cut out — anything
    genuinely running down the midline (interhemispheric fissure, nasal
    septum) keeps its own brightness instead of being erased.

    Located per frame, deliberately: across a supposedly identical set of
    renders the column has been found at x=182, 212 and 194. A fixed position
    misses it and gouges the anatomy instead.
    """
    lum = arr.max(axis=2)
    x = int(lum[:70].mean(axis=0).argmax())          # over black, above the crown
    x0, x1 = max(0, x - pad), min(arr.shape[1] - 1, x + pad)
    left = arr[:, max(0, x0 - 6):x0].mean(axis=1)
    right = arr[:, x1 + 1:x1 + 7].mean(axis=1)
    w = np.linspace(0, 1, x1 - x0 + 1)[None, :, None]
    ramp = left[:, None, :] * (1 - w) + right[:, None, :] * w
    out = arr.copy()
    out[:, x0:x1 + 1] = np.minimum(arr[:, x0:x1 + 1], ramp + 6)
    return out


def isolate(arr, thr=34, feather=5):
    """Keep the specimen, drop the set dressing.

    The source renders are full PAGE MOCKUPS — nav bar, headline, buttons,
    scale bars and little MRI insets are painted into the pixels. Used as-is
    the page would show two of everything. Taking the largest bright blob and
    matting it onto black removes all of it in one step, and leaves the head
    sitting on the same #000 the hero already uses.
    """
    lum = arr.max(axis=2)
    m = ndimage.binary_opening(lum > thr, np.ones((7, 7)))
    lab, n = ndimage.label(m)
    if n == 0:
        return arr
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    big = ndimage.binary_fill_holes(
        ndimage.binary_dilation(lab == (sizes.argmax() + 1), np.ones((11, 11))))
    soft = np.asarray(
        Image.fromarray((big * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(feather))
    ).astype(np.float32) / 255.0
    return arr * soft[..., None]


def clean(im):
    """De-beam then isolate. Run BEFORE the subject box is measured, or the
    box is drawn around the MRI insets rather than around the head."""
    arr = np.asarray(im.convert('RGB')).astype(np.float32)
    arr = isolate(debeam(arr))
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))


def subject_box(im):
    """The tightest box holding the specimen: alpha if there is any, else
    luminance against the near-black ground the renders are lit on."""
    if 'A' in im.getbands():
        box = im.getchannel('A').point(lambda v: 255 if v > 12 else 0).getbbox()
        if box:
            return box
    grey = im.convert('L').point(lambda v: 255 if v > 18 else 0)
    return grey.getbbox() or (0, 0, im.width, im.height)


def squared(box, w, h):
    """Pad, then square about the subject, then pull back inside the canvas.

    The frames have to be square — the runtime draws them into a square canvas
    — but the subject is not: head plus cervical spine measures roughly 530
    wide by 970 tall. Squaring on the tall side therefore leaves nearly half of
    every frame as empty margin and renders the head small in the hero.

    MAX_ASPECT caps how much of that tail the square has to accommodate. Above
    it the bottom of the spine is allowed to fall outside the crop, which costs
    a decorative tail and buys a materially larger head. The square is anchored
    to the TOP of the subject, never the centre, so what gets cut is always the
    far end of the spine and never the cranium.
    """
    x0, y0, x1, y1 = box
    bw, bh = x1 - x0, y1 - y0
    side = min(max(bw, min(bh, bw * MAX_ASPECT)) * (1 + 2 * PAD), w, h)
    cx = (x0 + x1) / 2
    x0 = min(max(cx - side / 2, 0), w - side)
    y0 = min(max(y0 - bh * PAD, 0), h - side)
    return (round(x0), round(y0), round(x0 + side), round(y0 + side))


def flatten(im, box, size):
    """Crop to the shared box, seat it on opaque black, resize, drop alpha."""
    cut = im.crop(box)
    plate = Image.new('RGB', cut.size, (0, 0, 0))
    plate.paste(cut, (0, 0), cut if 'A' in cut.getbands() else None)
    return plate.resize((size, size), Image.LANCZOS)


def encode(im, quality):
    buf = io.BytesIO()
    im.save(buf, 'WEBP', quality=quality, method=6)
    return buf.getvalue()


def main():
    if not os.path.isdir(SOURCE):
        sys.exit(f'no source folder: {SOURCE}')
    names = sorted(
        (n for n in os.listdir(SOURCE) if n.lower().endswith(EXTS)),
        key=natural,
    )
    if not names:
        sys.exit(f'no stills in {SOURCE} — drop the renders in there first.')

    print(f'{len(names)} stills from {SOURCE}')
    frames = []
    for n in names:
        im = Image.open(os.path.join(SOURCE, n))
        im.load()
        frames.append(clean(im))
    print('  de-beamed and isolated onto black')

    w = min(f.width for f in frames)
    h = min(f.height for f in frames)
    if any(f.width != w or f.height != h for f in frames):
        print('  ! stills are not all the same size; the union box uses the smallest.')

    boxes = [subject_box(f) for f in frames]
    union = (
        min(b[0] for b in boxes),
        min(b[1] for b in boxes),
        max(b[2] for b in boxes),
        max(b[3] for b in boxes),
    )
    box = squared(union, w, h)
    print(f'union crop {box}  ({box[2] - box[0]}px square)')

    # Registration: the specimen's centroid and area must barely move. A row
    # that jumps is the frame that will jolt.
    print('\n  #  file                         cx      cy      area')
    for i, (name, b) in enumerate(zip(names, boxes), start=1):
        cx, cy = (b[0] + b[2]) / 2, (b[1] + b[3]) / 2
        area = (b[2] - b[0]) * (b[3] - b[1])
        print(f'  {i:>3} {name[:26]:<26} {cx:>7.0f} {cy:>7.0f} {area:>9,}')

    # Encode everything in memory first: a ladder over budget must not leave
    # half a sequence on disk for the manifest generator to pick up.
    plan = {}
    for size in LADDERS:
        blobs = [encode(flatten(f, box, size), QUALITY) for f in frames]
        total = sum(len(b) for b in blobs)
        print(f'\n{size}px ladder: {len(blobs)} frames, {total / 1000:,.0f} kB total, '
              f'{total / len(blobs) / 1000:,.1f} kB each')
        if total > LADDER_BUDGET:
            # A warning, not an abort. This measures the WHOLE ladder on disk,
            # but the runtime never transfers the whole ladder — it decimates
            # to a memory budget and caps the bytes it will fetch, so the
            # number compared here is not the number a reader pays. Aborting
            # made the tool refuse its own documented workflow: the README
            # recommends 40-60 stills and promises "over-supplying is free",
            # yet 18 frames at 720px was enough to trip the exit and leave no
            # poster written — which switches the hero off entirely.
            print(f'  ! {size}px ladder is {total / 1000:,.0f} kB on disk, over the '
                  f'{LADDER_BUDGET / 1000:,.0f} kB guide. The runtime decimates and caps '
                  f'what it fetches, so this is usually fine; lower QUALITY or supply '
                  f'fewer stills if you want the folder itself smaller.')
        plan[size] = blobs

    poster = encode(flatten(frames[0], box, POSTER), POSTER_QUALITY)
    print(f'poster: {len(poster) / 1000:,.0f} kB at {POSTER}px')

    for size, blobs in plan.items():
        d = os.path.join(OUT, str(size))
        os.makedirs(d, exist_ok=True)
        stale = [n for n in os.listdir(d) if n.lower().endswith('.webp')]
        for n in stale:
            os.remove(os.path.join(d, n))
        if stale:
            print(f'{size}px: removed {len(stale)} frames from the previous run')
        for name, blob in zip(names, blobs):
            with open(os.path.join(d, out_name(name, names)), 'wb') as fh:
                fh.write(blob)

    os.makedirs(OUT, exist_ok=True)
    with open(os.path.join(OUT, 'poster.webp'), 'wb') as fh:
        fh.write(poster)

    print(f'\nwritten to {OUT}\nnow run: npm run frames')


if __name__ == '__main__':
    main()
