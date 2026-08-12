# Local reference archive — not shipped

132 standalone HTML prototypes built before the current modules existed, plus
the index that used to drive the in-app `/library` page.

**These are deliberately not part of the build.** They live outside `public/`
and `src/`, so Vite never copies them into `dist` and nothing links to them.

Why they were pulled:

* 14 of them reference a stylesheet that does not exist beside them, so they
  render with browser default styling — serif text, blue underlined links —
  and a canvas authored at a fixed 1600px then forces the page to scroll
  sideways. That is what a reader saw when they opened one.
* All 132 are superseded. Every physics topic they covered is now a maintained
  module under `/mri`, `/ultrasound-lab`, `/ct-lab`, `/nm-lab` or `/xray-lab`,
  with verified numbers and a responsive layout.
* They were publicly reachable from the homepage and the author console, with
  no navigation back into the site and no owner.

To look at one, open the file directly:

    open reference/library/visual-lab/xray-tube-physics-canvas.html

`library-page.tsx.bak` is the React page that used to list them. It is kept so
the archive can be put back behind an author-only route later if that is ever
wanted; it is not imported by anything.
