# Building an MRI stack from a screen recording

A screen recording is not a slice stack. It holds many frames on one slice
while the reader pauses, it scrolls back over the same anatomy, and it
re-encodes everything. Frame order is not slice order.

## Requirements

Python 3 with `numpy`, `pillow` and `scipy`. No ffmpeg install needed — see
the note at the top of `extract_frames.py` for using the static binary that
ships inside the `imageio-ffmpeg` wheel.

## Steps

```bash
python3 extract_frames.py "/path/to/recording.mov" ./frames_hip
python3 build_stack.py hip            # reads ./frames_hip, writes ./stack_hip
```

`build_stack.py`:

1. crops to the MRI viewport, discarding the recording's letterbox while
   keeping the P orientation marker;
2. collapses runs of identical frames into one image per distinct slice;
3. orders every distinct frame **anatomically** by spectral seriation of the
   slice-similarity graph — the Fiedler vector of the normalised Laplacian —
   refined with 2-opt, because adjacent slices are the most similar images in
   the set;
4. merges neighbours that are the same level seen on a second pass;
5. orients the result superior → inferior from sectional area.

Ordering must come **before** de-duplication. Removing repeats first leaves
near-duplicates from the second pass that then interleave with the first, and
the stack alternates thigh, hip, thigh, hip.

## Publishing to the app

Convert to WebP into `public/mri/<study-id>/sNNN.webp` and set `sliceCount`,
`width` and `height` in `src/data/mri/<study>.json`.
