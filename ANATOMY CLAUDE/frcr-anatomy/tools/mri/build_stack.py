"""Turn a screen recording of someone scrolling an MRI into a clean slice stack.

A screen recording is not a slice stack. It holds many frames per slice while
the reader pauses, it scrolls back and forth over the same anatomy, and it
re-encodes everything with compression noise. So frames are not slices, and
timestamps are not slice order.

The approach:

  1. Crop to the MRI viewport (the recording's own letterbox is discarded, the
     P orientation marker is kept).
  2. Collapse runs of frames that are the same slice, using a perceptual
     distance that ignores codec noise.
  3. Order the distinct slices anatomically rather than temporally, by walking
     the sequence and dropping revisits — a slice already seen is a scroll
     back over anatomy already covered, not a new level.
"""
import os, json, sys
import numpy as np
from PIL import Image

SP = os.path.dirname(os.path.abspath(__file__))


def load_frames(d):
    names = sorted(n for n in os.listdir(d) if n.endswith('.png'))
    return [os.path.join(d, n) for n in names]


def viewport(paths, sample=40):
    """Bounding box of the pixels that ever carry signal."""
    acc = None
    step = max(1, len(paths) // sample)
    for p in paths[::step]:
        a = np.asarray(Image.open(p).convert('L'), dtype=np.uint8)
        acc = a if acc is None else np.maximum(acc, a)
    rows = np.where(acc.max(axis=1) > 18)[0]
    cols = np.where(acc.max(axis=0) > 18)[0]
    return int(cols[0]), int(rows[0]), int(cols[-1]) + 1, int(rows[-1]) + 1


def signature(path, box, size=(64, 56)):
    """Small normalised greyscale image — enough to tell slices apart, coarse
    enough that HEVC noise does not register as a change."""
    im = Image.open(path).convert('L').crop(box).resize(size, Image.BILINEAR)
    v = np.asarray(im, dtype=np.float32)
    v -= v.mean()
    n = np.linalg.norm(v)
    return v.ravel() / (n + 1e-6)


def dist(a, b):
    return float(1 - np.dot(a, b))


def build(frames_dir, out_dir, same_thresh=0.005, revisit_thresh=0.007):
    paths = load_frames(frames_dir)
    if not paths:
        raise SystemExit('no frames in ' + frames_dir)
    box = viewport(paths)
    print(f'frames {len(paths)}  viewport {box}')

    sigs = [signature(p, box) for p in paths]

    # 1. Collapse held frames into one representative per distinct slice.
    reps = [0]
    for i in range(1, len(paths)):
        if dist(sigs[i], sigs[reps[-1]]) > same_thresh:
            reps.append(i)
    print(f'distinct frames after collapsing holds: {len(reps)}')

    # 2. Order every distinct frame anatomically.
    #
    #    Removing revisits BEFORE ordering was wrong: the recording makes two
    #    passes over the same anatomy, and near-duplicates from the second pass
    #    survive a tight threshold and then interleave with the first, giving a
    #    stack that alternates thigh, hip, thigh, hip. Ordering the whole set
    #    first puts every frame at its true level regardless of which pass it
    #    came from, and duplicates then sit next to each other where they can
    #    simply be merged.
    #
    #    Adjacent slices are the most similar images in the set, which makes
    #    this a seriation problem: embed the similarity graph on a line and
    #    read the order off it. The Fiedler vector of the normalised Laplacian
    #    is that embedding.
    S = np.stack([sigs[i] for i in reps])
    D = 1 - S @ S.T
    np.fill_diagonal(D, 0)
    sigma = np.median(D[D > 0]) or 1.0
    W = np.exp(-(D ** 2) / (2 * sigma ** 2))
    np.fill_diagonal(W, 0)
    deg = W.sum(axis=1)
    dinv = 1 / np.sqrt(np.maximum(deg, 1e-9))
    L = np.diag(deg) - W
    Ln = (L * dinv).T * dinv
    _, vecs = np.linalg.eigh(Ln)
    order = list(np.argsort(vecs[:, 1] * dinv))

    #    The spectral order is globally right but can invert neighbours where
    #    consecutive levels look almost identical. Treat it as a shortest
    #    Hamiltonian path over the same distances and improve it with 2-opt:
    #    the correct stack is the order in which each slice most resembles the
    #    one before it.
    def path_cost(o):
        return float(sum(D[o[i], o[i + 1]] for i in range(len(o) - 1)))

    improved = True
    while improved:
        improved = False
        for i in range(1, len(order) - 1):
            for j in range(i + 1, len(order)):
                a, b = order[i - 1], order[i]
                c = order[j]
                d_ = order[j + 1] if j + 1 < len(order) else None
                delta = D[a, c] - D[a, b]
                if d_ is not None:
                    delta += D[b, d_] - D[c, d_]
                if delta < -1e-9:
                    order[i:j + 1] = order[i:j + 1][::-1]
                    improved = True
    print(f'path cost after 2-opt: {path_cost(order):.4f}')
    ordered = [reps[k] for k in order]

    # 3. Merge along that order. Neighbours closer than the threshold are the
    #    same anatomical level seen more than once.
    kept = [ordered[0]]
    for i in ordered[1:]:
        if dist(sigs[i], sigs[kept[-1]]) > revisit_thresh:
            kept.append(i)
    print(f'unique slices after merging repeat passes: {len(kept)}')

    # 4. Orient superior -> inferior. The superior end cuts the pelvis, where
    #    the section is broad and contains bowel and iliac wing; the inferior
    #    end is a single rounded thigh. Sectional area settles the direction.
    def spread(i):
        a = np.asarray(Image.open(paths[i]).convert('L').crop(box), dtype=np.uint8)
        return float((a > 40).mean())
    if spread(kept[0]) < spread(kept[-1]):
        kept = kept[::-1]
    print('ordered superior -> inferior')

    os.makedirs(out_dir, exist_ok=True)
    for f in os.listdir(out_dir):
        os.remove(os.path.join(out_dir, f))
    manifest = []
    for n, i in enumerate(kept):
        im = Image.open(paths[i]).convert('L').crop(box)
        name = f'slice_{n:03d}.png'
        im.save(os.path.join(out_dir, name), optimize=True)
        manifest.append({'index': n, 'file': name, 'sourceFrame': os.path.basename(paths[i])})
    meta = {'count': len(kept), 'viewport': box,
            'width': box[2] - box[0], 'height': box[3] - box[1], 'slices': manifest}
    json.dump(meta, open(os.path.join(out_dir, 'manifest.json'), 'w'), indent=1)
    print(f'wrote {len(kept)} slices to {out_dir}  ({meta["width"]}x{meta["height"]})')
    return meta


if __name__ == '__main__':
    which = sys.argv[1] if len(sys.argv) > 1 else 'mine'
    build(os.path.join(SP, 'frames_' + which), os.path.join(SP, 'stack_' + which))
