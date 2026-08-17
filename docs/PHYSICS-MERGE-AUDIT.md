# Physics merge — architecture audit (Phase 1)

**Status:** Phase 1 deliverable. Read this before touching anything in Phases 2–6.
**Derived from:** commit `706ae0b`, branch `claude/physics-migration-audit-37ntti`.
**Date:** 17 August 2026.
**Nothing in the application was modified to produce this document.**

Tree state at the time of writing, verified rather than assumed:
`npm test` → **207 tests / 12 files, all passing**. `npm run build` (`tsc -b && vite build`) → **exit 0**.

---

## Provenance — read this first

An earlier session produced an audit under this name on the owner's local machine and it was
**never committed**, so it does not exist in this repository and could not be read. This document
was re-derived from the source, in a fresh clone, by reading the files directly. Where the earlier
audit's findings were relayed in conversation they have been re-checked here; two were confirmed
with corrected line numbers, one statistic was **wrong and has been recomputed** (see §6).

The same session also reported filling four V2 chapters with 15 film plates. **That work is not in
this repository either.** Only its nuclear-medicine half landed (commit `a770f11` — `drawGammaCamera`
is exported at `src/labs/nm.tsx:259` and consumed by `src/physics2/components/sims/NmScenes.tsx`).
The digital, fluoroscopy and CT half did not: `drawCrReader` at `src/labs/digital.tsx:91` is still a
private function, there is no image-intensifier or CT-generations sim under
`src/physics2/components/sims/`, and the per-chapter sim counts in §7 show the gap numerically.

**Consequence for the plan:** Phase 5 was expected to collide with that unreviewed work. In this
repository it does not — those chapters are still at their pre-workflow state. If the local work is
recovered and pushed, re-read §7 before starting Phase 5.

---

## 1. Two syllabus definitions, and how far apart they actually are

| | V1 | V2 |
|---|---|---|
| File | `src/physics/course.ts` | `src/physics2/topics.ts` + `src/physics2/content/*.tsx` |
| Shape | 5 parts → 9 modules → lessons | 9 topics → 57 sections |
| Bound to | routes (`home`, `lessons[].path`) | question pool (`qbTopics`) |
| Ordering | array position | explicit `num` field |

They are **not** rival curricula. Both describe the same nine modalities in the same teaching order.
The only identifier that differs is the first:

```
V1  xray-core  digital  fluoro  mammo  ct  nm  mri  us  safety
V2  xray       digital  fluoro  mammo  ct  nm  mri  us  safety
     ^^^^^^^^^
```

**One hardcoded assertion breaks if V2's id wins:** `src/labs/xray.tsx:92`

```ts
const xrayCore = moduleById('xray-core')!
```

The non-null assertion means a renamed id is not a type error and not a caught exception — it is a
runtime crash on the X-ray hub, the front door of Part I. This is the single highest-risk line in
the whole migration.

**Also worth knowing:** V1 reuses `safety` as *both* a part id (`COURSE_PARTS[4]`) and a module id
(`COURSE_MODULES[8]`). Harmless today because the two are looked up through different functions, but
a merged registry keyed by a single id space would collide.

**Recommendation.** V2's topic list becomes the study unit, absorbing V1's parts (as grouping
metadata) and lessons (as the "go deeper" doors `V2Topic.labs` already models). Keep the id `xray`,
and fix `src/labs/xray.tsx:92` in the *same commit* — not a follow-up.

---

## 2. Two homes, and the real difference between them

`src/physics/Home.tsx` (345 lines, `/physics`) and `src/physics2/pages/Home.tsx` (103 lines,
`/physics-v2`) both claim to be "the learner's home". They disagree about what progress *means*:

| | V1 `/physics` | V2 `/physics-v2` |
|---|---|---|
| Progress = | lessons completed | **questions answered** |
| Source | `completedModules()` — the learner event log | `standingFor()` — the qbank progress store |
| Continue from | `lastOfType('module.started')` | `readV2State().lastVisited` |
| Continue survives a device change | **yes** — Supabase-backed | **no** — localStorage only |
| Groups by | 5 parts | flat list of 9 |

This is the substantive merge decision, and it is not cosmetic. A learner who has watched every
lesson and answered nothing reads as **complete** on V1 and **not started** on V2. A learner who has
answered everything without opening a lesson reads the opposite.

**The regression to avoid:** V2's Continue is `src/physics2/lib/store.ts` — key
`radiopass.physics2.v1`, plain `localStorage`, no Supabase table, by explicit design ("Deliberately
separate from V1's learner event log so the two experiences don't steer each other's Continue
links"). That was the right call for a parallel experiment. **If V2's home becomes the canonical
home unchanged, Continue silently stops syncing across devices** — a real feature loss for a paying
candidate who studies on a laptop and a phone.

**Recommendation.** One home showing **both** dimensions per topic — lessons done *and* questions
answered — never one collapsed percentage. Continue must move onto the event log
(`createSyncedStore`) before `/physics-v2` becomes canonical.

---

## 3. Routes are the telemetry contract — do not move them

`src/labs/lesson.tsx:418` and `:434` — the module-completion writer:

```ts
record({ type: 'module.started',   subject: 'physics', contentId: window.location.pathname, … })
record({ type: 'module.completed', subject: 'physics', contentId: window.location.pathname, … })
```

**`contentId` is the URL.** Not a slug, not a stable id — the pathname at the moment of completion.
`src/mri5/Section.tsx:361` does the same with the literal `'/mri'`. Every completion tick on the
physics home, and every Continue link, is a pathname comparison against that log.

`src/physics/course.ts:21` already states the rule in its own header comment, and it is correct:

> It does not move any route. `module.started`/`module.completed` telemetry keys off pathnames
> (`labs/lesson.tsx`), and every recorded Continue link would orphan if paths changed.

**Move a lesson route and every existing learner's history for that lesson is lost.** Not corrupted
— orphaned, which is worse, because the log still holds records that no longer match anything and
the UI simply shows the lesson as never done.

**Recommendation.** Freeze all 40+ lesson pathnames. Merge *navigation*, not URLs. If a canonical
route must change, the old pathname stays a legal telemetry key forever and the new route is
additive with a redirect — never a rename.

**One trap already in the code.** `src/App.tsx:287` carries a deliberate comment: `/physics` was
removed from the `hasOwnChrome` exact list so the learner home gets the shared header. The `trees`
list below it *does* contain `/physics-v2`. So the moment `/physics-v2` content is served at
`/physics`, the header disappears unless the chrome lists are updated in the same change.

---

## 4. The progress data model — every store, and which ones sync

| Store | Key | Backend | Written by |
|---|---|---|---|
| Learner events | `radiopass.learner.events.v1` | `learner_events` (Supabase) | `record()` — `src/lib/learner.ts:178` |
| Qbank progress | `radiopass.qbank.progress.v1` | `qbank_progress` | `recordQbScore()` — `src/qbank/Shell.tsx:158` |
| Qbank marks | `radiopass.qbank.marks.v1` | `qbank_marks` | `toggleQbMark()` — `src/qbank/Shell.tsx:197` |
| V2 last-visited | `radiopass.physics2.v1` | **none** | `noteVisit()` — `src/physics2/lib/store.ts:29` |

Three of the four are `createSyncedStore` and account-backed. The fourth is V2's, and is not.

**V2 writes no learner events at all.** `src/physics2/` contains zero imports of `lib/learner`. It
inherits `question.answered` only indirectly, because `recordQbScore` emits one
(`src/qbank/Shell.tsx:170`). So studying a V2 topic produces **no** `module.started` and **no**
`module.completed` — which is precisely why the two homes cannot see each other's activity. The
learner's history is forked by which URL they happened to use.

**Recommendation.** V2 pages emit `module.started`/`module.completed` keyed to the **V1 lesson
pathnames** they correspond to, so a topic studied in V2 lights up the same records V1 already
counts. That makes the merge additive rather than a cutover, and it is the cheapest way to keep both
surfaces honest during the transition.

---

## 5. The mastery model — the write-once guard is the blocker

`src/qbank/Shell.tsx:158–171`:

```ts
export function recordQbScore(questionId, correct, outOf, choices?, topic?) {
  const all = progressStore.read()
  if (all[questionId]) return        // ← submission is final
  …
}
```

The stored attempt is **never overwritten**. The documented intent is sound — a second visit
re-displays the original answer rather than quietly re-scoring it — but it has a consequence the
owner has already hit: **a question answered wrong stays wrong forever.** The only undo is
`resetQbProgress()`, which wipes the entire account. That single `if` is the mechanism behind
questions stuck in the "answered incorrectly" filter after they have been learned and corrected, and
it makes any mastery model impossible, because mastery is by definition a *change* in a question's
standing over time.

**The shape of the fix.** Store attempts, derive mastery:

```ts
type QbAttempt = {
  correct: number; outOf: number          // ← kept: the LATEST attempt, unchanged shape
  choices?: QbChoices
  submittedAt?: string
  attempts?: { correct: number; outOf: number; at: string }[]   // ← added
}
```

Every existing field keeps its current meaning, so every existing reader — `standingFor()`
(`src/physics2/lib/derive.ts:35`), `wrongQuestions()`, the practice filters — continues to work
untouched on day one.

**The migration must be lazy, and there is already a hook for it.** `createSyncedStore` accepts an
optional `sanitize(raw)` (`src/lib/syncedStore.ts:53`, applied at `:66`) which the qbank stores do
not currently pass — `learner.ts:148` does. Add a `sanitize` to `progressStore` that upgrades a
record on read by synthesising `attempts: [{correct, outOf, at: submittedAt}]` from what is already
there.

Three rules, and they are not negotiable:

1. **Do not change `localKey`.** A new key means every learner starts from zero.
2. **Upgrade on read, write on next submission.** Never a bulk rewrite — a learner who never returns
   must lose nothing.
3. **The merge function must survive both shapes.** `merge: (local, remote) => ({...remote, ...local})`
   is whole-record, so an old record from one device and a new one from another must both be legal.

This is the one part of the migration where a mistake is **irreversible for a real learner**. It
deserves its own commit, its own tests, and no other change riding along with it.

---

## 6. Question → section mapping — recomputed

`src/physics2/lib/assign.ts` assigns each question to exactly one section: `visualTags` intersection
first, then a keyword regex against title + stems, then the section marked `fallback` (or the first
section) as catch-all.

**These numbers were re-derived from the source at `706ae0b`**, by instrumenting `assignments()`
across all nine topics. The earlier audit's figure of "~245 ambiguous" is **wrong**; the correct
figure under the definition below is **142**. Its "47 fallback" was right.

| Topic | Pool | Sections | By tag | By keyword | Fallback | Ambiguous | Sections with no questions |
|---|---|---|---|---|---|---|---|
| xray | 88 | 7 | 57 | 25 | 6 | 24 | — |
| digital | 21 | 6 | **0** | 19 | 2 | 14 | `quality`, `processing` |
| fluoro | 20 | 6 | 13 | 4 | 3 | 0 | `chain` |
| mammo | 11 | 6 | 9 | 0 | 2 | 0 | `energy`, `spectrum`, `geometry` |
| ct | 59 | 6 | 28 | 24 | 7 | 18 | — |
| nm | 72 | 6 | 32 | 27 | 13 | 15 | `performance` |
| mri | 74 | 7 | 49 | 19 | 6 | 40 | — |
| us | 70 | 7 | 28 | 35 | 7 | 18 | — |
| safety | 52 | 6 | 24 | 27 | 1 | 13 | — |
| **Total** | **467** | **57** | **240** | **180** | **47** | **142** | **8 sections** |

*Ambiguous* = the question matched **more than one** section at the stage that won it, and
`assign.ts` silently took the first in array order. It is not an error; it is an undeclared
tie-break, and section order in the content file is currently load-bearing.

Four things this changes:

1. **Coverage is complete.** 467 of 467 questions are assigned; **zero orphans**. The `qbTopics`
   bindings cover the whole bank. This was worth confirming before building anything on top.
2. **142 questions hang on array order.** Reordering sections in a content file silently reassigns
   questions — and therefore silently changes which "Reread §1.3 →" a learner is sent to. Any Phase
   5 chapter edit that moves sections around is a live hazard.
3. **`digital` has no tag coverage at all** — 0 of 21 questions matched a `tags` entry. Its whole
   pool is keyword- or fallback-assigned, so it is the least reliable chapter in the set and the
   first that should get `tags` written.
4. **8 sections teach material no question tests.** Their per-section standing reads 0/0 and
   "Reread §x →" can never point at them. Either they need questions bound, or the UI must not show
   them an empty meter.

**Reproducing this.** The instrumentation was a temporary vitest file that walked `V2_TOPICS`,
re-ran `sectionFor`'s logic collecting *all* matches rather than the first, and tallied per topic.
It was deleted after the numbers were taken. If mapping work begins, make it a permanent script
under `scripts/` so the numbers can be re-checked after every content edit.

---

## 7. Simulation inventory — the real content gap

| | Scenes |
|---|---|
| V1 `src/labs/` canvas scenes (`draw:` entries) | **101** |
| V1 ultrasound stages (`US_STAGES`, `src/us/components/Layout.tsx`) | 21 |
| V1 MRI sections (`SECTIONS`, `src/mri5/sections.ts`) | 21 |
| Standalone HTML sims (`public/visuals/`) | 11 files |
| **V2 sims across all nine chapters** | **16** |

V1 canvas scenes by lab: `ct` 23 · `nm` 23 · `digital` 15 · `mammo` 10 · `mricore` 10 · `mriencoding`
8 · `fluoro` 7 · `xraygeo` 5.

V2 sims by chapter: `xray` 4 · `mri` 3 · `nm` 2 · `us` 2 · then **`ct` 1, `digital` 1, `fluoro` 1,
`mammo` 1, `safety` 1**.

That bottom row is the whole problem in one line. **CT has 23 built scenes in V1 and shows 1 in V2.
Digital has 15 and shows 1.** The teaching material exists and is already written; V2 simply does not
mount it. Of V2's 16 sims, 5 are `iframe` embeds of `public/visuals/` pages and 11 are React
elements.

This is what the chapter-filling work was for, and why its absence (see Provenance) matters: it was
the fix for exactly these four chapters.

**The mechanism is already proven.** `src/labs/nm.tsx:259` exports `drawGammaCamera`, and
`src/physics2/components/sims/NmScenes.tsx:12` imports it and mounts it in a `DrawCanvas`. Nothing
was duplicated and the V1 lab still renders. Every remaining chapter follows the same pattern:
export the `draw*` function, mount it as a `kind: 'element'` sim.

**Recommendation.** Treat "export the draw function, mount it in V2" as a mechanical, repeatable
operation, one lab at a time, each with a spot-check that the V1 lesson still renders. Do not
rewrite scenes during the move — a pure move is reviewable, a move-plus-rewrite is not.

---

## 8. What this audit did **not** verify

Stated plainly so nothing here is trusted further than it was checked.

- **No runtime verification.** Nothing was opened in a browser. Every finding is from reading source,
  plus the build and the 207-test suite. Claims about *rendering* are inferences.
- **Physics correctness was not reviewed.** This is an architecture audit. Whether the V2 chapters
  teach correct physics is a separate review, and given that earlier adversarial passes on this
  project found real physics errors, it is one that should actually happen.
- **Supabase was not inspected.** RLS policies, the `learner_events` / `qbank_progress` /
  `qbank_marks` table shapes, and what a real learner's stored data looks like were all taken from
  the client-side code that writes them. **Before shipping §5, confirm the live table shape.**
- **No localStorage was examined.** The migration in §5 is designed against the types, not against a
  real learner's stored records.
- **The mapping numbers in §6 are from one run at `706ae0b`.** They are reproducible and the method is
  described, but they will drift the moment content changes. Re-derive; do not cite.
- **`public/visuals/` HTML sims were not opened.** The five iframe embeds are assumed to work because
  they are already in production.

---

## The phased plan

Ordered so that each phase is independently shippable and nothing destructive happens before the
thing that protects it. **Phases 2 and 3 are the safety work and come first.**

### Phase 2 — Freeze the contract *(no user-visible change)*
1. Add a test asserting every `COURSE_MODULES[].lessons[].path` resolves to a real route in
   `App.tsx`. This is the guard-rail every later phase leans on.
2. Add a test asserting `moduleById('xray-core')` is non-null, so §1's crash becomes a red test
   rather than a broken page.
3. Write down the frozen pathname list as a fixture. A route rename must fail CI.

*Exit:* the route↔telemetry contract is machine-enforced. Nothing has moved.

### Phase 3 — The mastery model *(the irreversible one — alone, on its own branch)*
1. Add `attempts[]` to `QbAttempt`, additive only, existing fields unchanged.
2. Add `sanitize` to `progressStore` that upgrades old records on read.
3. Remove the `if (all[questionId]) return` guard; append an attempt instead.
4. Tests: an old record loads and keeps its score; a re-answer appends; the two-device merge survives
   mixed shapes; `standingFor()` returns identical numbers for pre-migration data.

*Exit:* a wrong answer can be corrected. No learner has lost history. Ship and let it settle before
Phase 4.

### Phase 4 — One syllabus
1. Merge V1's parts and lessons into `V2Topic` (parts as grouping, lessons into `labs`).
2. Keep the id `xray`; fix `src/labs/xray.tsx:92` **in the same commit**.
3. Make `coursePosition()` read from the merged registry, pathnames unchanged.

*Exit:* one syllabus definition. Both homes still render, from the same source.

### Phase 5 — One home, one Continue
1. V2 pages emit `module.started`/`module.completed` against V1 lesson pathnames (§4).
2. Move V2's Continue onto `createSyncedStore` so it syncs (§2).
3. Merge the two homes: both dimensions per topic — lessons done *and* questions answered.
4. Update `hasOwnChrome` in the same change (§3).

*Exit:* one physics home. Continue survives a device change. All history intact.

**Before starting Phase 5:** if the local chapter-filling work has been recovered and pushed, review
it first — it edits the same files.

### Phase 6 — Close the simulation gap
1. Per lab: export the `draw*` functions, mount them in the V2 chapter, spot-check the V1 lesson
   still renders. Pure moves only.
2. Priority by gap size: **CT (23→1), digital (15→1)**, then mammo, fluoro.
3. Write `tags` for `digital`'s sections — the one chapter with zero tag coverage (§6).
4. Make the §6 mapping report a permanent script under `scripts/`.

*Exit:* V2 chapters teach with the scenes that already exist.

### Deferred, deliberately
- **Route canonicalisation** (`/physics-v2` → `/physics`). Do it last, as redirects with the old
  pathnames still honoured as telemetry keys. It is the step with the least upside and the most
  ways to lose learner history.
- **Deleting anything.** No V1 surface is removed in any phase above. Removal is a decision to take
  once the merged home has been used in anger, not during the merge.

---

## The four things most likely to bite

1. **`src/labs/xray.tsx:92`** — `moduleById('xray-core')!` crashes the X-ray hub the moment the id
   changes. Fix it in the same commit as the rename.
2. **`window.location.pathname` as `contentId`** — every route move orphans learner history.
3. **The write-once guard** — the mastery model cannot exist until it is gone, and removing it
   touches real learners' stored data.
4. **Section array order** — 142 questions are assigned by first-match tie-break, so reordering
   sections silently reassigns them.
