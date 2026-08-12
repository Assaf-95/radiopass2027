# The scroll-rotated skull hero

The home page opens on one skull that turns as you scroll and then hands over
to a static thorax. The rotation is a frame sequence, not a video: a scrubbed
`<video>` snaps `currentTime` to keyframes on iOS Safari, which is exactly the
seek accuracy this needs.

**Nothing is on disk yet, and that is a supported state.** With no frames the
manifest is empty, the hero component never mounts, and the page is byte-for-
byte what it was before. Adding frames is the only thing that turns it on.

## Dropping frames in

```bash
# 1. put the raw stills here, in the order they should play
tools/skull/source/*.png            # or .jpg / .jpeg / .webp

# 2. build both ladders and the poster
npm run stills

# 3. regenerate the manifest (npm run dev and npm run build also do this)
npm run frames
```

`prepare_frames.py` writes:

```
public/images/hero/skull/poster.webp     1400x1400, the first still
public/images/hero/skull/720/skull-0010.webp, skull-0020.webp, ...
public/images/hero/skull/480/skull-0010.webp, skull-0020.webp, ...
```

## Doing it by hand instead

The generator is deliberately tolerant, so hand-built frames are fine:

- A ladder is any directory under `public/images/hero/skull/` whose **name is
  a number**, and that number **is** the pixel edge of its frames: `720/`,
  `480/`. Dropping a `960/` directory in later upgrades large screens with no
  code change.
- Frames are **any** `*.webp` in a ladder directory, sorted numerically. Array
  order is the only contract — nothing at runtime reads the number.
- The convention is `skull-NNNN.webp` in **steps of ten**. The gaps are the
  point: `skull-0015.webp` slots between 0010 and 0020 to double the density
  of one arc without renaming a thing.
- Every frame must be **square** and must match its directory name. The build
  hard-fails otherwise, because a stretched frame reads as jitter rather than
  as a broken file.
- The chest is a single `public/images/hero/chest.webp`, any aspect.
  `thorax.webp` in the same folder is a usable placeholder.

`npm run frames` prints what it found, or `hero frames: none — the hero is off
and the page is unchanged`.

## How many stills

At most 6 degrees between frames reads as smooth; about 3 is silky. Over a
**180-degree arc** that is 40 to 60 stills. Ten stills is 18 to 36 degrees a
step and will read as a flip-book — no code change fixes that, because the
smoothing is on the scroll, not on the angle.

Over-supplying is free: the runtime decimates to a memory budget (34 frames at
720px, 26 at 480px), so 200 frames in the folder cost the same RAM and roughly
the same bytes as 34, and simply buy angular resolution up to the cap.

## Caching

`netlify.toml` gives `/images/hero/*` a week with a month of
stale-while-revalidate. Correctness never depends on it — every frame carries
`?v=<rev>` from the manifest — and if the site is served from Hostinger rather
than Netlify that file does nothing at all. The poster is the exception: it is
referenced from `index.html` without a query, so replacing it means renaming
it or accepting up to a week of staleness.

## Debug hooks

- `?skull=0.55` pins scroll progress at 0.55, runs the loader and forces the
  canvas live — a deterministic mid-rotation capture in a pane where rAF
  never fires.
- `?skull=off` forces the no-frames path, so the pre-change page can be
  diffed in the same session.
- `data-hero-ready="1"` lands on `.skull-hero` after the first successful
  draw, so a headless capture can wait on a selector instead of a sleep.
