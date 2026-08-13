# Skull hero frames

The rotating skull on the home page is read from here. **This folder is empty
on purpose** — with no frames the manifest is empty, the hero never mounts,
and the page renders exactly as it did before the feature existed.

```
poster.webp                 1400x1400. Frame 0, same crop. Required.
chest.webp                  ../chest.webp — the static thorax. Any aspect.
720/skull-0010.webp ...     square 720x720, in display order
480/skull-0010.webp ...     square 480x480, the same arc for phones
```

Rules the build enforces:

- a ladder directory's **name is the pixel edge** of its frames (`720`, `480`);
  add a `960/` later and large screens upgrade with no code change
- every frame must be **square** and match its directory name, or the build
  fails — a stretched frame reads as jitter, not as a broken file
- any `*.webp` is accepted, sorted numerically; **array order is the only
  contract**. `skull-NNNN.webp` in steps of ten is the convention, so
  `skull-0015.webp` can be slotted in later without renaming anything

To produce all of this from raw stills, drop them in `tools/skull/source/` and
run `npm run stills`.

**After adding or removing anything here, regenerate the manifest:**

```bash
npm run frames
```

`npm run dev` and `npm run build` run it for you. Full notes in
`tools/skull/README.md`.
