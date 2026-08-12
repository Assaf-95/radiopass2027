# The full-body composition

`compose_body.py` builds `public/images/hero/body-full.webp` — the single
frontal specimen the homepage scrolls through. It seats each render on the
point-cloud frame (`scout.png`, rendered from `src/lib/anatomy.ts`) at
computed landmarks, feather-masked so the joins dissolve.

## Region slots

Generate each region with the site's style block (same camera distance, same
lens, near-black #050708 ground, single cool white-gold axial rim beam,
transparent or black background), save it under `public/images/hero/`, and
re-run `python3 tools/body/compose_body.py`:

| File | Region | Seated span |
|---|---|---|
| `region-2-neck.webp` | Cervical spine & neck | skull base → thoracic inlet |
| `thorax.webp` | Thorax (already in) | larynx → costal margin |
| `abdo-pelvis.webp` | Abdomen (already in) | costal margin → pelvic brim |
| `region-5-pelvis.webp` | Pelvis & hip joints | iliac crests → femoral heads |
| `region-7-thigh.webp` | Femur & knee | proximal femur → knee |
| `region-8-leg.webp` | Tibia, fibula & ankle | tibial plateau → mortise |
| `region-9-foot.webp` | Foot | talus → toes |

A frontal skull (`region-1` replacement for the point-cloud head) can be
seated the same way — add a slot at `(1.0, 0.70)` when it exists.

Black-background renders: remove the background first (any alpha-keying
tool); the composer expects transparency.
