# RADIOPASS PHYSICS — design notes

The course engine of RadioPass Physics, mounted under `/physics`. It began as an
alternative experience at `/physics-v2` running beside the original site; the
comparison ended in August 2026 and the two are **one product** — the dashboard
at `/physics` (src/physics/Home.tsx, shared site chrome) and everything under it
from this folder (own chrome). The folder name `physics2` and the `V2*` symbol
names are internal history, not learner-facing; nothing a learner sees says V2.

## The thesis

The site first grew as a collection of excellent artifacts — labs, a question
bank, a fact bank, films, scroll stories — each with its own design system and
its own front door. The learner met a pile of products. This engine is **one
product with one spine: nine topics**, and inside every topic the same three
things in the same order: a concise primer (the physics, distilled), practice
(the topic's questions), and review (what you got wrong, resurfaced). The
question bank is the centre of gravity — the primer exists to make the
questions answerable, and question feedback links back into the primer by
section.

The fact bank is dissolved, not deleted: its facts became primer "numbers"
blocks, "essentials" lists, and the concept notes under question feedback.

**The simulations live in the topics.** A primer used to end with doors into
the deep laboratories; the lesson drawings themselves are now embedded as film
plates at the section that teaches each one, exported from the lab files by
step id (see the `lessonDraw` resolvers in `src/labs/*.tsx`) — the same
functions the lessons run, never copies. The guided lessons remain at their own
routes, reached from the dashboard; their pathnames are frozen because
completion telemetry is keyed on them.

## Identity: notes and films

A radiology trainee's world is two surfaces: the **paper** of the syllabus,
past papers and revision notes, and the **dark screen** where images live. The
engine is built from exactly those two materials:

- The interface is paper: near-white cool grey, near-black ink, hairline rules,
  a restrained bronze accent.
- Every simulation, spectrum and image sits in a **film plate**: a dark mounted
  panel with a technique annotation in the corner, the way a radiograph carries
  its exposure factors. The sims are dark-palette canvases; framed as films
  they look deliberate on paper, and none of them needed repainting.

Type: Fraunces does the reading voice — titles AND primer prose, at text
optical sizes; Inter does UI, labels and metadata; the mono stack does physics
values, units and equations, in the voice of an instrument readout.

Verdicts: deep green / brick red, used only for marking. Bronze is used only
for position, links and emphasis. Nothing else gets colour.

## Architecture

Routes — all built from `src/physics/routes.ts` (`PHYSICS_ROOT`, `topicHref`,
`practiceHref`); `/physics-v2/*` forwards here with query and hash preserved:

- `/physics` — the dashboard (outside this folder): the learner's record, the
  course by parts, the practice doors. Shared site chrome.
- `/physics/:topicId` — the topic: orientation, numbered primer sections with
  their sims embedded, each section ending in its practice gate; essentials at
  the end. Own chrome (`components/Shell.tsx`).
- `/physics/:topicId/practice` — the session player. `?section=&filter=`.
- `/physics/questions` — the bank as its own destination.
- `/physics/review` — accuracy per topic, the re-test pools, flagged questions.
- `/physics/mock` — the timed papers (rendered by src/qbank).

**The record.** One progress store, shared with the question bank
(`src/qbank/Shell.tsx`). A question's record is its list of attempts; standing
(unseen / needs re-test / mastered) is derived, never stored. Re-testing
appends an attempt and can genuinely fix a question; the first attempt is
immutable and is the cold-accuracy figure. Mock papers write attempts tagged
`mode:'mock'`. Reading a topic records `module.started` to the shared learner
timeline, which is the single author of Continue everywhere; the local key
`radiopass.physics2.v1` survives only as a label cache for the Continue chip.

**Question → section binding is a checked-in map**, not a runtime heuristic:
`mapping/questionMap.ts`, one row per bank question with provenance (`tag`,
`kw`, or `manual` with a required note). `npm run physics:map` validates it —
E1-E6 fail the build, W1-W3 count the review debt — and runs at the head of the
test harness. The matching rules live as plain data in `mapping/sections.ts`
and `mapping/concepts.ts` so tooling can read them without a browser; the
content files spread them back in (`{ ...S.tube, primer: [...] }`).

Provenance masking: no "recall", no years, no high-yield chips, ever.

## What the engine reuses

- Question data: `QB_QUESTIONS` (the corrected bank).
- Stores: qbank progress/marks, learner events, auth.
- Sims: the lab lesson drawings via their `lessonDraw` exports; `/visuals/*.html`
  instruments in an `InstrumentFrame`; `src/mri5/sims/*` self-contained React
  sims; small new sims only where nothing suitable exists.
- The learner's existing record, migrated lazily and never rewritten on read.

## Restraint rules

- One accent. No modality colour system on paper — the film plates carry the
  modality's own palette inside them.
- Cards only where a thing is genuinely a unit (a film plate, a question).
  Lists and sections are typographic: numbers, rules, space.
- Every number shown to the learner is real (their record or the bank's
  counts), and every accuracy is labelled with which accuracy it is.
- No marketing copy anywhere inside the study surfaces.
