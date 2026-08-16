# RadioPass Physics V2 — design notes

An alternative experience mounted at `/physics-v2`. V1 is untouched; V2 imports V1's
data and simulation work but renders none of V1's chrome. Delete this folder and the
three-line route registration in App.tsx and V2 is gone.

## The thesis

V1 grew as a collection of excellent artifacts — labs, a question bank, a fact bank,
films, scroll stories — each with its own design system and its own front door. The
learner met a pile of products. V2 is **one product with one spine: nine topics**,
and inside every topic the same three things in the same order: a concise primer
(the physics, distilled), practice (the topic's questions), and review (what you
got wrong, resurfaced). The question bank is the centre of gravity — the primer
exists to make the questions answerable, and question feedback links back into the
primer by section.

The fact bank is dissolved, not deleted: its facts became primer "numbers" blocks,
"essentials" lists, and the concept notes that appear under question feedback.

## Identity: notes and films

A radiology trainee's world is two surfaces: the **paper** of the syllabus, past
papers and revision notes, and the **dark screen** where images live. V2 is built
from exactly those two materials:

- The interface is paper: near-white cool grey, near-black ink, hairline rules,
  a restrained bronze accent (the V1 amber, darkened for light ground — brand
  continuity without the dark theme).
- Every simulation, spectrum and image sits in a **film plate**: a dark mounted
  panel with a technique annotation in the corner, the way a radiograph carries
  its exposure factors. The existing sims are dark-palette canvases; framed as
  films they look deliberate on paper, and none of them needed repainting.

Type: Fraunces (already the brand display face) does the reading voice — titles
AND primer prose, at text optical sizes; Inter does UI, labels and metadata; the
mono stack does physics values, units and equations, in the voice of an
instrument readout. This is the inverse of V1 (Inter body, Fraunces display) —
same family, different deployment, so the two versions are siblings rather than
strangers.

Verdicts: deep green / brick red, used only for marking. Bronze is used only for
position, links and emphasis. Nothing else gets colour.

## Architecture

Routes:

- `/physics-v2` — home: continue, the nine topics with real standing, review door.
- `/physics-v2/:topicId` — the topic: orientation, numbered primer sections
  (progressive disclosure), each ending in its practice gate; essentials list at
  the end; deep-lab links last.
- `/physics-v2/:topicId/practice` — the session player. `?section=&filter=&n=`.
- `/physics-v2/review` — the revision surface: accuracy per topic, wrong stems
  ready for re-test, flagged questions, recently missed key points.

Shared record: V2 reads and writes the SAME stores as V1 — `readQbProgress` /
`recordQbScore` / marks from `src/qbank/Shell.tsx` — so answers count once and
follow the learner between the two experiences. Submission-is-final is preserved;
re-testing marks locally and never rewrites the permanent record. V2 keeps its own
small resume store (`radiopass.physics2.v1`, registered in PER_USER_KEYS).

Question → section binding: each section declares `visualTags` (the recovered
tag join in recall.json) and a keyword fallback; every question in a topic is
assigned to exactly one section. Feedback then says "Reread §1.3 Filtration →".

Provenance masking (unchanged from V1): no "recall", no years, ever. High-yield
weighting is silent.

## What V2 reuses

- Question data: `QB_QUESTIONS` (467 questions, corrected topics, 100% key points).
- Stores: qbank progress/marks, learner events (reads only), auth.
- Sims: `/visuals/*.html` instruments in a V2 frame (spectrum, magnification);
  `src/mri5/sims/*` self-contained React sims (weighting, precession, k-space,
  slice selection, artefacts, safety zones…); `src/us` scenes for Doppler and
  aliasing; small new sims (CT windowing) only where nothing suitable exists.
- The learner's existing record.

## Restraint rules

- One accent. No modality colour system on paper — the film plates carry the
  modality's own palette inside them.
- Cards only where a thing is genuinely a unit (a film plate, a question). Lists
  and sections are typographic: numbers, rules, space.
- Every number shown to the learner is real (their record or the bank's counts).
- No marketing copy anywhere inside the study surfaces.
