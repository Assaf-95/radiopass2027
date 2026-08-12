# Chest radiograph anatomy lab

Two real, unmodified chest radiographs with an interactive annotation layer.

## Run it

```bash
npm install
npm run dev
```

Then open the **Chest X-ray** entry in the header, or go straight to
`#/cxr`. The development annotation editor is at `#/cxr?editAnnotations=true`
and is not reachable from the learner interface.

## Files

| File | Purpose |
| --- | --- |
| `chestStructures.ts` | The forty structures: numbering, wording, category, quiz synonyms and the teaching note. |
| `radiographs.ts` | Per-film coordinates. Each radiograph has its own complete set; nothing is shared. |
| `../../components/cxr/AnnotationOverlay.tsx` | SVG leaders, arrowheads and the two label rails, including collision resolution. |
| `../../pages/ChestXrayAtlas.tsx` | Viewer, navigation, search, filtering, quiz and editor. |
| `../../../public/cxr/*.png` | The radiographs. Cropped only of PACS interface chrome; pixels otherwise untouched. |

## What was done to the images

Nothing but the removal of interface chrome. For each screenshot the red PACS
badge and border rules were detected by colour and cropped off, then the frame
was trimmed to the radiographic content. Both apices, both hemidiaphragms, both
costophrenic angles, the shoulder girdles and the **R** marker are all retained.
No mirroring and no resampling of the anatomy. Radiograph 2 carried two lines of burned-in overlay text in the bottom-left collimation border; that corner is painted black in place, which changes no anatomy and no annotation coordinate. The "R" side marker is kept.

- Radiograph 1: 1344×1020 → 1004×989
- Radiograph 2: 1212×1260 → 1176×1205

## Coordinates

Normalised 0–1 against the radiograph itself, not the viewport. The overlay
recomputes the displayed `object-fit: contain` box on resize and full screen,
so arrows do not drift.

## Not demonstrated

See `NOT_DEMONSTRATED` in `radiographs.ts`. These are surfaced to the learner
rather than pointed at approximately:

- **26 / 27 nipple markers** — absent from both films. No radiopaque marker has
  been applied to either patient, and the expected nipple position is not the
  same thing as a marker.
- **35 posterior twelfth rib** — not confidently delineable against the upper
  abdomen on either exposure.
- **36 right horizontal fissure** — visible but faint on Radiograph 1, where it
  is flagged as an inferred edge; genuinely absent on Radiograph 2.
