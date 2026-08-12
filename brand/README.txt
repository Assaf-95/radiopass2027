RadioPass — identity
====================

The mark: WINDOW/LEVEL
----------------------
A lens whose interior is divided by the window/level transfer curve —
flat, ramp, flat — the function a radiologist applies before anything can
be seen. The exposure floats inside the ring on a dark channel, an image
seen through an instrument. The ramp rises at exactly 60°; the lit and
dark halves are congruent under a half-turn (two exams, one preparation).

Chosen from seven independently drawn directions, rendered at full and
favicon size and scored blind by three judges (identity craft / FRCR
examiner / production). Runner-up and the rest are in alternates/.

Files
-----
radiopass-mark.svg        primary mark, currentColor — set colour via CSS
radiopass-mark-gold.svg   baked #D9A84E, for dark grounds
radiopass-mark-ink.svg    baked #14161A, for light grounds
favicon.svg               favicon cut on an ink tile — thicker strokes for 16–32 px
favicon-transparent.svg   favicon cut, currentColor, no tile
lockup-radiopass.svg      mark + "RadioPass" wordmark
lockup-radiology-pass.svg mark + "Radiology Pass" wordmark
index.html                the full presentation (open in a browser)
alternates/               the six unchosen directions

Colours
-------
Ink   #0B0D10   (site background)
Gold  #D9A84E   (the only accent)
Paper #F2EEE6   (wordmark on dark)

Wordmark
--------
Fraunces, weight 500 — the site's display serif. The lockup SVGs import it
from Google Fonts, which works when the file is opened directly in a
browser; embedded via <img> they fall back to Georgia. For print or final
production, open the lockup in any vector editor with Fraunces installed
and convert the text to outlines.

Rules of thumb
--------------
- One colour at a time. Never gradient, never outline the fill.
- Use favicon.svg below ~40 px; the primary's 6-unit stroke is drawn for
  larger sizes.
- Clear space: half the mark's diameter on every side.
- Don't rotate, don't mirror — the ramp rises left-to-right, always.
