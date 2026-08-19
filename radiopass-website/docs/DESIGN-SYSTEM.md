# The RadioPass visual system — PASS 1 master reference (19 Aug 2026)

The owner's universal redesign brief, implemented. One visual universe across
homepage, anatomy, physics, question bank, labs, in dark and light, on every
width. This file is the contract: every surface derives from it; nothing
invents its own values.

## Where it lives

- **`src/design/tokens.css`** — the ONE token file: palette (dark `:root`,
  light `:root[data-theme='light']`), type scale, spacing, containers,
  radii, motion, `--header-h`. Nothing else declares a colour system.
- **`src/design/theme.tsx`** — `useTheme()` + `<ThemeToggle/>`. Attribute
  `data-theme` on `<html>`, key `radiopass-theme-v2`, dark by default.
- **`src/design/logo.tsx`** — `<Logo/>` (mark + RADIOPASS wordmark, optional
  branch word) and `<LogoMark/>` (full | compact). Vector, no baked glow;
  colours from `--logo-flow` / `--logo-focus`, monochrome via currentColor.
- **`src/styles.css`** — shared chrome (header, footer, buttons, `.rp-logo`,
  `.rp-theme-toggle`, `.rp-sculpt`).

## Palette rules

- The ground is the **environment**, not a flat fill: `background:
  var(--ground-env)` (a fixed radial from `--ground-lift` through `--ground`
  to `--ground-deep`). Page-level grounds come from `body::before` in
  styles.css; sections needing their own band use `--surface`.
- Structure and drawing lines: `--structure-core` → `--structure` → `--rim`
  (brightest). The single brightest point on a screen is `--beam`.
- Hairlines: `var(--hairline)` (separators, quiet borders) and
  `var(--hairline-lit)` (hover/current borders). Never invent an rgba ivory
  or white border again.
- **The warm accent (`--core`, hot state `--core-hot`) is spent ONLY on what
  is active, current, or focal**: the Continue control, the live progress
  fill, the active filter, the current nav location, the focal point of a
  drawing. Roughly ten parts cool to one part warm per screen. Never on
  every heading/border/icon.
- **The diagnostic zone is sacrosanct**: any real radiograph/CT/MRI/US image
  sits on `--dicom-bg` (#000) with `--dicom-chrome` furniture and
  `--dicom-label` text. No navy cast, no amber border, no glow, no theme
  response. `--film` aliases `--dicom-bg`.
- Marking semantics keep their own hues (`--success`/`--error`, anatomy's
  green/amber/red for 2/1/0 marks). Do not fold them into the accent.

## Type rules

- Display: `var(--font-display)` → Archivo. Titles at weight 300–400,
  tracking −0.01em, `--lh-tight`. The brand word RADIOPASS is Archivo 500,
  letterspaced .3em, always one word.
- The old grammar `<span>`/`<em>` = *amber italic serif* is retired. Display
  emphasis is now **upright**, coloured `var(--rim)` (cool). Amber emphasis
  is allowed only when the phrase names the active/focal thing.
- Body: Inter via `--font-body`, `--fs-body`, `--lh-body`, measure ≤ 68ch,
  left aligned, never justified.
- Technical/data voice: `--font-mono` for kVp/mAs/HU/counts/DICOM-style
  annotation, letterspaced uppercase for eyebrows and codes.
- No px font-size outside tokens.css. Use the `--fs-*` scale.

## Shape, depth, motion

- Radii: 8px controls (`.button`), `--radius`/`--radius-lg` (10/14) for real
  surfaces. Nothing pill-shaped unless semantically a pill.
- Depth = surface luminance + hairline + rim light. Box shadows only on
  floating chrome (menus/dialogs). UI elements never glow; scientific
  objects may (softly, physically plausibly).
- Motion: interface = `--dur`/`--ease`; sculptural/scientific movement =
  `--dur-slow`/`--ease-glide` (slow, purposeful). Hover: ≤2px translate or
  ≤1.5% scale + illumination shift. No bounce, no elastic, nothing on a
  timer. `prefers-reduced-motion` zeroes all durations globally.

## Chrome

- Every header: height `var(--header-h)` (64px), sticky/fixed, glass
  `color-mix(in srgb, var(--ground) 78%, transparent)` + blur, 1px
  `--hairline` bottom. Left: `<Logo branch="…"/>`. Right: actions +
  `<ThemeToggle/>`. Nav links quiet (`--muted` → `--ink` hover); the current
  location may be `--core`.
- Cards are not the default container. Prefer whitespace, hairline rules,
  scale and alignment. A visible bordered surface must be a genuinely
  independent interactive thing. Never nest bordered boxes.

## Sculptural objects

- Anatomy renders live in `src/assets/sculpture/` (brain, chest, msk, gi,
  renal — 1400px JPEGs). Present them with `.rp-sculpt` (see styles.css):
  screen-blended onto the environment, rectangle feathered away, slow
  illumination response on hover, dark chamber behind them in light mode.
  Show them LARGE with generous negative space — never as tiny cropped
  textures, never labelled, never inside anatomy questions.
- Physics keeps its drawn thin-line instrument language (PartMark emblems,
  signal vignettes, canvas scenes): stroke 1–1.6px, `--structure`/`--rim`
  lines, `--core` only for the energetic/focal element. Physics objects get
  the same monumental presentation (size + negative space), so the two
  halves read as one universe.

## Light mode

- Same token names, re-valued: pearl ground, white surfaces, graphite text,
  structure lines darkened (`--rim` becomes deep steel), warm accent
  deepened for AA. Never a pure-white hospital page; never an inversion.
- Films and the diagnostic zone do not change.
- Anything painted in canvas must read its colours from computed CSS
  variables (or expose a palette hook) — hex literals in draw code will not
  theme.

## Breakpoints

1400 / 1280 / 1024 / 768 / 430 / 390 (see tokens.css). Mobile-first: one
object at a time, stacked controls, no horizontal overflow, 44px targets
(touch.css keeps its roster — do not rename classes it lists without
updating it).

## What must not change

- Route paths, gate wording, TRIAL contents, COUNTS, question/marking
  behaviour, progress semantics (two labelled accuracies), owner-decided
  hero simplifications, `case 'xxx':` literals in physics/Home.tsx PartMark
  (routes.test.ts reads them as text).
- `src/physics2/*` carries another session's uncommitted work — do not touch
  those files in this pass.
