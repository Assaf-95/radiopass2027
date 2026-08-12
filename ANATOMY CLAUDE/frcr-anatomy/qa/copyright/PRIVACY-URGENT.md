# PRIVACY — URGENT (separate from copyright)

Generated 2026-08-08

Patient privacy is a higher-priority issue than copyright and is deliberately kept out
of the copyright lists. These are carried over from the prior pre-upload audit and
re-verified in this session.

## 1. Burned-in overlay text on a published chest radiograph — VERIFIED THIS SESSION

- File: `public/cxr/radiograph-2.png` (1176x1205), also shipped in `dist/cxr/`
- Two lines of white alphanumeric glyphs on the black collimation border, bottom-left
  (~3,208 bright pixels in the bottom 40 rows).
- Scan of the dark border found **541 overlay-like pixels** on radiograph-2 vs **15** on radiograph-1.
- The text is too degraded at the shipped resolution for me to read, so I cannot confirm
  whether it contains an identifier. **It must be read at full resolution before upload.**
- My earlier "zero coloured pixels" check could not have caught this: the text is white on
  black and completely desaturated, so a chroma test is blind to it. That was a real gap.
- These files are NOT part of the question bank (they are the chest X-ray atlas), which is
  why they do not appear in the 501-question audit.

## 2. Third party IP address rendered to every learner

- `121.246.53.177` appears in a Cambridge Books Online download stamp stored in
  `references` and rendered under "Source explanation & references".
- An IP address is personal data under UK/EU GDPR. It belongs to whoever downloaded the
  source ebook, not to you.

## 3. Clinical images of undocumented origin

- The 15 REVIEW-1 questions, plus the CT/MRI stacks and chest films, are real clinical
  studies. Provenance and any consent/anonymisation basis is undocumented in the repo.
- Listed in `unknown-provenance.md`.

## Not modified

Per your instruction nothing was altered during this audit — no image cropped, no field
edited, no question removed.
