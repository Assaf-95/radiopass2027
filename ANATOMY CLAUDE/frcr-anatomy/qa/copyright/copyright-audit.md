# Anatomy Copyright / Provenance Audit — Full Report

Generated 2026-08-08

## Method

1. Recovered the prior pre-upload audit findings (`prior-findings.json`) and treated them as leads only.
2. Established the displayed-number rule from the source: `QuestionPlayer` renders
   `Question {index+1}` where `index` is the position in `DATA[section]` filtered by
   `excludeFromPlay`. Validated against the running app on four questions.
3. Built a master inventory of all 501 questions (499 live + 2 withheld).
4. Ran per-image forensics on all 501 files: sha256, perceptual hash, burned-in text
   band detection, colour fraction, page-white fraction.
5. Classified every question against its own evidence. Zero unaudited.

## Region integrity

| Region | Live | Withheld | Audited | Concerns | Unknown provenance |
|---|---:|---:|---:|---:|---:|
| Upper Limb | 156 | 0 | 156 | 150 | 6 |
| Lower Limb | 133 | 2 | 135 | 130 | 5 |
| Head and Neck | 102 | 0 | 102 | 102 | 0 |
| Spine | 44 | 0 | 44 | 43 | 1 |
| Thorax | 31 | 0 | 31 | 30 | 1 |
| Abdomen and Pelvis | 33 | 0 | 33 | 31 | 2 |

## What the evidence shows

- **Every** question carries a `sourceFile` naming the artefact it was extracted from.
  486 name one of six published FRCR anatomy textbook PDFs; 15 name the author’s own Keynote deck.
- 414 questions carry the book’s own `caseLabel` (e.g. "Case 12.17") — the publisher’s
  internal case numbering, carried straight into the data.
- The images are captures of the printed pages, not transcriptions: the book’s typography,
  case headings, printed sub-questions and its own arrow annotations are present in the files.
- 96 images retain printed-page white margin, consistent with a page scan.
- Named publishers appear in `references` on 55 questions and are rendered to the learner.
- **No LICENSE file, permission statement or user-visible attribution exists anywhere in the repository.**
- 0 exact-duplicate image files; each question has its own file.

## Important limits on this audit

- This is a provenance and QA audit, not a legal determination. Whether any particular use
  is infringing or falls under an exception is a question for a qualified adviser.
- "HIGH-RISK" here means: reproduction of published material with no documented permission
  found in the repository. It does not assert that permission does not exist elsewhere.
- The 15 REVIEW-1 questions are *not* claimed to be infringing. Their underlying clinical
  images simply have no documented origin.
