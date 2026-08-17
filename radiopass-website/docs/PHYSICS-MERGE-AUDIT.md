# RADIOPASS PHYSICS — merge audit

**This is an audit. No source file was created, modified or deleted.** The only file written is
this document. Everything below was read from the working tree on 17 Aug 2026 and, where a claim
was load-bearing, re-verified directly against the file.

**Working tree is mid-edit.** 25 files modified, 7 untracked. Another workflow is actively
reshaping `src/physics2/content/{digital,fluoro,ct,nm}.tsx`, `src/labs/{digital,fluoro,ct,nm,xray}.tsx`,
`src/physics2/pages/{Topic,Questions}.tsx`, `src/physics2/components/{Question,Shell}.tsx`,
`src/physics2/v2.css`, `src/mri5/{Sim,sims/RelaxationLab}.tsx`, and has added seven uncommitted
sim files under `src/physics2/components/sims/`. Two in-flight changes are treated here as
**settled intent, not drift**: `COURSE_PARTS` re-cut from 5 to 7 parts with the owner's exam-syllabus
headings (`src/physics/course.ts:87-135`), and the `Topic.tsx` footer rewritten from a lab menu into
a two-step finish block.

The decision this audit serves: `/physics` and `/physics-v2` become **one product, RADIOPASS PHYSICS**.
No learner-facing "V1"/"V2". `/physics` is the dashboard; a Course of nine topics; Questions; Review;
Mock Exams. Bespoke simulations embed at the point of need, not linked at the end. Progress is always
real.

---

## 1. What from the current /physics stays

Keep `src/physics/Home.tsx` as the product's front door. It is the only surface with the
"every number is derived from stored activity" discipline written into it, and the owner's decision
explicitly keeps its resume logic.

| Keep | Where | Why |
|---|---|---|
| `readSnapshot()` and its header contract | `src/physics/Home.tsx:1-23, 54-110` | The refusal to invent a readiness % or a fake history. This is the honesty guarantee, in code. |
| Continue resolution by timestamp arbitration | `src/physics/Home.tsx:203-228` | Two candidates (last module, last qbank subject) compared on ISO timestamp. Keep the shape; add a third candidate for the course engine. |
| Honest empty state | `src/physics/Home.tsx:230-242`, `.ph-empty` in `physicshome.css:121-138` | Only the CTA target (`/visual-lab`) needs repointing at the course. |
| `Stat` component + `.ph-stats/.ph-stat/.ph-continue` | `Home.tsx:155-162`, `physicshome.css:53-119` | Token-only, tabular-nums, one accented control. |
| **`PartMark` emblems** | `Home.tsx:374-471`, `.ph-mark` in `physicshome.css:161-173` | Seven bespoke thin-stroke instrument emblems in modality colours. Expensive to recreate, exactly the intended design language. Only the keying changes. |
| `COURSE_PARTS` — the 7 syllabus headings | `src/physics/course.ts:87-135` | Just re-cut to the owner's own exam-syllabus wording. This is the course's outline. |
| `CourseModule.lessons[]` — the 12 lesson pathnames | `src/physics/course.ts:138-289` | These pathnames **are** the telemetry keys and the addresses of the bespoke simulations. See §8. |
| `.ph-part` row grid + 720px collapse | `physicshome.css:190-215` | The module-row layout. |
| Bank totals foot line | `Home.tsx:353-359`, `src/qbank/data/index.ts:142-145` | Real denominator, derived from `QB_QUESTIONS.length`. |

**Delete on merge:** the `/physics-v2` door (`Home.tsx:342-344`) and `.ph-secondary-new`
(`physicshome.css:333-343`) — the only learner-facing "V2" string on this surface.

**Repoint:** `PRACTICE_DESTINATIONS` (`Home.tsx:133-149`) still targets `/question-bank`,
`/question-bank/mock`, `/question-bank/review/incorrect`; all three become `/physics/*`.

**Stale comments to fix while there:** `Home.tsx:248` and `:335-336` say "five destinations"/"five parts"
(there are 3 and 7). `Home.tsx:17-22` says finished mocks "are not yet recorded anywhere" — false;
`src/qbank/pages/Mock.tsx:243` records `mock.completed` and `mockHistory()` exists at
`src/lib/learner.ts:229-233`. **Mock Exams can show real history on day one.**

---

## 2. What from Physics V2 becomes canonical

The nine-topic engine is the course. It is route-agnostic in every part that matters.

| Becomes canonical | File | Note |
|---|---|---|
| The content model | `src/physics2/types.ts` | 9 primer block kinds. No V2 identity, no routing. |
| The primer renderer | `src/physics2/components/Primer.tsx` | Nine-kind switch (`:107-202`), `FilmPlate`, and `InstrumentFrame` (`:36-84`) — the same-origin iframe dresser that injects `#v2-dress` CSS, deletes selectors, fires one-shot clicks and auto-fits height. The single most valuable file in the folder. |
| Question→section binding | `src/physics2/lib/assign.ts` | Algorithm is replaced (§5), but the interface (`assignments()`, `sectionOf()`) and the per-topic cache stay. |
| Derived standing | `src/physics2/lib/derive.ts` | Everything computed from the shared qbank store. This is already what "progress must be real" looks like. |
| Recall-artefact stripping | `src/physics2/lib/clean.ts` | Independent. |
| The syllabus registry | `src/physics2/topics.ts` + `src/physics2/content/*.tsx` | 9 topics, 57 sections, ~3,540 lines of authored primer. **This is the product.** |
| The sim library | `src/physics2/components/sims/` (18 files, 7 uncommitted) | Self-contained React components, no routing. |
| `v2.css` | `src/physics2/v2.css` | All classes `v2-`-prefixed and scoped under `.v2-root`; no `body`/`html`/`:root` selectors, so it cannot leak. Only the prefix is V2-branded — rename it or leave it; do not restructure it. |

**Registry decision: `V2_TOPICS` wins as the unit of study, but absorbs `COURSE_PARTS` and
`lessons[]` rather than deleting them.** Add `part: number` and `lessons: CourseLesson[]` to
`V2Topic`; keep `coursePosition()` keyed on the same unchanged pathnames; delete the duplicated
`outcomes[]` from `course.ts` (it exists in both and will drift).

**One id collision must be resolved first:** V1 module id is `xray-core`, V2 topic id is `xray`.
`src/labs/xray.tsx:32` does `moduleById('xray-core')!` — a non-null assertion that throws on rename.
Recommend renaming the **V2 topic** to `xray-core` is wrong (it's the public URL slug); instead keep
topic id `xray` and fix the single assertion in `xray.tsx`. The other eight ids already match.

**V2 scaffolding that retires or folds:**

- `src/physics2/components/Shell.tsx:86` — `<Link to="/physics">Switch to the current site</Link>`.
  **Verified present.** This is the merge's headline deletion.
- `src/physics2/pages/Home.tsx` — a *second* dashboard. Collapse into `src/physics/Home.tsx`,
  contributing its nine-topic list with real standing (`:58-83`) and its Review/Mock doors (`:85-98`).
- `src/physics2/lib/store.ts` + key `radiopass.physics2.v1` — a deliberately separate resume store
  ("so the two experiences don't steer each other's Continue links", `store.ts:5-6`). With one product
  that rationale is void. Merge into the learner event log. The key is registered in
  `src/lib/perUserKeys.ts:36`; retiring it means removing that entry or the guard test drifts.
- `topic.labs[]` — 9 declarations of "linked at the end" doors. Replaced by embedding (§3).
- Dead CSS orphaned by the uncommitted `Topic.tsx` rewrite: `.v2-labs` (1 rule) and `.v2-pager` (6 rules).
- `src/physics2/DESIGN.md` framing ("an alternative experience… delete this folder and V2 is gone",
  lines 3-5). Its architecture section is the merge spec; its framing is obsolete.

**Two defects to fix during the merge, both in V2:**

1. `src/physics2/pages/Questions.tsx:67` — "Start now" links to `/practice` with **no `filter`**, which
   defaults to `unseen`. A learner who finished the topic hits the dead-end "Every question here has
   been answered". `Topic.tsx` gets this right (auto-flips `unseen`→`again`); `Questions.tsx` does not.
2. `src/physics2/components/Question.tsx:98` — `question.source.toLowerCase().includes('recall')`
   rendered as a visible "High-yield" chip. `DESIGN.md:68` states recall provenance must be silent.
   The chip is a 1:1 proxy for it. Remove the chip or derive the weighting from something else.

---

## 3. Which labs/simulators embed into which topic and section

**This is the migration's work list.** Four invocation contracts exist:

- **A — draw fn** `(ctx, w, h, p, t) => void`. Mounts in `src/physics2/components/sims/DrawCanvas.tsx`.
  Extracting one from a lab is a **one-line export**; the pattern already exists at
  `src/labs/ct.tsx:808` (`lessonDraw`) and `:1309` (`filmDraw`).
- **B — propless component** `<Foo />`. Drops straight into a `kind:'element'` sim. Zero adaptation.
- **C — prop-driven scene** `<FooStage {...state} time phase />`. Needs a wrapper lifting the state
  bundle out of the driver page. Expensive.
- **D — standalone HTML** in `public/visuals/`, mounted via `kind:'iframe'` + `InstrumentFrame`.

Already embedded: **25 mounts** across the nine topics. Available and orphaned: ~49 lab draws,
31 mri5 sims, 18 us scenes, 7 HTML pages.

| # | Topic | Section (`id`) | Asset to embed | Source | Contract | Work |
|---|---|---|---|---|---|---|
| 01 | X-ray | `foundations` | `enter`, `fates` draws | `src/labs/xraygeo.tsx:378,404` | A | export |
| 01 | X-ray | `tube` | *(embedded)* `xray-tube-physics-canvas.html` | `src/physics2/content/xray.tsx:76` | D | done |
| 01 | X-ray | `tube` | `xray-focal-spot-unsharpness.html` | `public/visuals/` | D | mount |
| 01 | X-ray | `spectrum` | *(embedded)* `XraySpectrum` | `sims/XraySpectrum.tsx` | B | done |
| 01 | X-ray | `filtration` | `xray-beam-quality.html`; `hvl`, `mu` draws | `public/visuals/`; `xraygeo.tsx:528,487` | D + A | mount + export |
| 01 | X-ray | `interactions` | *(embedded)* `xray-guided-interactions.html`; `expo` draw | `content/xray.tsx:206`; `xraygeo.tsx:446` | D + A | export |
| 01 | X-ray | `geometry` | *(embedded)* `radiographic-magnification.html` | `content/xray.tsx:261` | D | done |
| 01 | X-ray | `quality` | line-focus + attenuation sections of `diagrams-16-24.html` | `public/visuals/` | D | mount w/ `hide[]` |
| 02 | Digital | `cr` | *(embedded)* `CrReaderStages` | `sims/CrReader.tsx` ← `labs/digital.tsx:91` | B | done |
| 02 | Digital | `panels` | *(embedded)* `DrConversionStacks`; `dr-indirect`, `dr-direct` | `sims/CrReader.tsx`; `labs/digital.tsx:553,587` | B + A | export 2 |
| 02 | Digital | `sampling` | *(embedded)* `PixelMatrix`; `matrix` draw | `sims/PixelMatrix.tsx`; `labs/digital.tsx:632` | B + A | export |
| 02 | Digital | `latitude` | `dynamic-range` draw (dose creep) | `labs/digital.tsx:654` | A | **export — no V2 equivalent** |
| 02 | Digital | `quality` | `mtf` draw (MTF/DQE) | `labs/digital.tsx:689` | A | **export — no V2 equivalent; section has 0 questions** |
| 02 | Digital | `processing` | `processing` draw | `labs/digital.tsx:718` | A | export; **section has 0 questions** |
| 03 | Fluoro | `chain` | `chain` draw | `labs/fluoro.tsx:512` | A | export; **section has 0 questions** |
| 03 | Fluoro | `intensifier` | *(embedded)* `FluoroIntensifier` | `sims/FluoroIntensifier.tsx` ← `labs/fluoro.tsx:74` | B | done |
| 03 | Fluoro | `distortion` | *(embedded)* `IiDistortion` | `sims/FluoroScenes.tsx` | B | done |
| 03 | Fluoro | `abc` | *(embedded)* `FluoroAbc`; `abc` draw | `sims/FluoroAbc.tsx`; `labs/fluoro.tsx:616` | B + A | export |
| 03 | Fluoro | `dose` | `pulsed` (pulsed fluoro + LIH), `skin` (skin dose) | `labs/fluoro.tsx:664,686` | A | **export — exam-core, unrepresented** |
| 03 | Fluoro | `dsa` | *(embedded)* `DsaSubtraction` | `sims/FluoroScenes.tsx` | B | done |
| **04** | **Mammo** | `energy` | `why-low` draw | `src/labs/mammo.tsx:21` | A | **export; section has 0 questions** |
| **04** | **Mammo** | `spectrum` | *(embedded)* `XraySpectrum` Mo/28kVp preset; `target-filter`, `pairs` | `content/mammo.tsx`; `labs/mammo.tsx:54,107` | B + A | **export 2; section has 0 questions** |
| **04** | **Mammo** | `compression` | `compression` draw | `labs/mammo.tsx:144` | A | **export** |
| **04** | **Mammo** | `geometry` | `tube-geometry`, `magnification` draws; mammo-unit + DBT panels of `diagrams-1-5.html` | `labs/mammo.tsx:182,250`; `public/visuals/` | A + D | **export 2 + mount; section has 0 questions** |
| **04** | **Mammo** | `quality` | `grid-aec`, `resolution`, `cnr` draws | `labs/mammo.tsx:218,299,323` | A | **export 3** |
| **04** | **Mammo** | `tomo` | `tomo-dose` draw; DBT geometry panel | `labs/mammo.tsx:348`; `diagrams-1-5.html` | A + D | **export + mount** |
| 05 | CT | `acquisition` | *(embedded)* `CtGenerations`; `gantry`, `rows`, `array`, `bowtie` | `sims/CtScenes.tsx`; `labs/ct.tsx:66,568,1004,939` | B + A | export 4 |
| 05 | CT | `hu-window` | *(embedded)* `CtWindowing`; `hu`, `window` draws | `sims/CtWindowing.tsx`; `labs/ct.tsx:180,207` | B + A | export 2 |
| 05 | CT | `helical` | *(embedded)* `CtHelixPitch`; `pitch`, `conebeam` | `sims/CtScenes.tsx`; `labs/ct.tsx:604,1164` | B + A | export 2 |
| 05 | CT | `noise-quality` | *(embedded)* `CtBackProjection`; `noise`, `projection`, `reconstruction` | `sims/CtScenes.tsx`; `labs/ct.tsx:641,101,141` | B + A | export 3 |
| 05 | CT | `dose` | `dose-metrics` (CTDI/DLP), `modulation`; CT dose-profile panel of `diagrams-6-10.html` | `labs/ct.tsx:666,694`; `public/visuals/` | A + D | export 2 + mount |
| 05 | CT | `artefacts` | *(embedded)* `CtRingArtefact`; `artefacts` draw (beam hardening / partial volume) | `sims/CtScenes.tsx`; `labs/ct.tsx:725` | B + A | export |
| 06 | NM | `tracer` | `tc99m`, `generator`, `ideal`, `decay` draws | `src/labs/nm.tsx:833,869,910,1317` | A | export 4 — **`generator` (Mo-99 milking) is exam-core** |
| 06 | NM | `camera` | *(embedded)* `GammaCameraBuild`; `collimator`, `pha` draws; parallel-hole panel of `diagrams-6-10.html` | `sims/NmScenes.tsx`; `labs/nm.tsx:1001,1038` | B + A + D | export 2 + mount |
| 06 | NM | `performance` | `performance` draw | `labs/nm.tsx:1074` | A | export; **section has 0 questions** |
| 06 | NM | `acquisition` | *(embedded)* `NmAcquisition`; **`drawSpect`** (already exported, zero consumers), `spect-recon`, `attenuation`; SPECT panel of `diagrams-1-5.html` | `sims/NmScenes.tsx`; `labs/nm.tsx:28,1124,1166` | B + A + D | **mount `drawSpect` — SPECT is absent from the topic today** |
| 06 | NM | `pet` | *(embedded)* `PetCoincidence`; `pet-detail` draw; PET panel of `diagrams-16-24.html` | `sims/NmScenes.tsx`; `labs/nm.tsx:1208` | B + A + D | export + mount |
| 06 | NM | `quant` | `dose` draw | `labs/nm.tsx:1246` | A | export |
| 07 | MRI | `signal` | *(embedded)* `PrecessionAndLarmorSim`; `MriAxes`, `ProtonLab`, `FlipAngle`, `ResonanceB1`, `FidSimulator`, `PhaseCoherenceAndSignal` | `src/mri5/sims/` | B | **mount only — 6 propless components** |
| 07 | MRI | `relaxation` | *(embedded)* `RelaxationLab` *(being reworked)*; `T2vsT2Star`, `TrTeDiagram` | `src/mri5/sims/` | B | mount 2 |
| 07 | MRI | `sequences` | *(embedded)* `SpinEchoSimulator`, `InversionRecoverySim`; `EchoTrain`, `SequenceFamilyMap`, `ErnstAngleSim`, `SeVsGreSim`, `SusceptibilityBloomSim` | `src/mri5/sims/` | B | mount 5 |
| 07 | MRI | `weighting` | *(embedded)* `WeightingLab`; `GadoliniumSim`, `RelaxivityCurve`, `BbbEnhancement` | `src/mri5/sims/` | B | mount 3 |
| 07 | MRI | `encoding` | *(embedded)* `SliceSelectionSim`, `KSpaceExplorer`; `LocalisationProblem`, `EncodingMap`, `FrequencyEncoding`, `PhaseEncodingSim`, `ReceiverBandwidth` | `src/mri5/sims/` | B | mount 5 |
| 07 | MRI | `quality` | *(embedded)* `ArtefactGallery`; `ImageQualityLab`, `DiffusionSim`, `AdcMap`, `TofSim`, `PhaseContrastSim`, `SpectrumSim` | `src/mri5/sims/` | B | mount 6 |
| 07 | MRI | `safety` | *(embedded)* `SafetyZonesSim`; `ScannerCrossSection` (takes `{built?: LayerId[]}`), `ShieldingShift` | `src/mri5/sims/` | B | mount 2 |
| 08 | US | `waves` | `WaveChamber`, `PulseEchoStage`; wave period/frequency panel of `diagrams-16-24.html` | `src/us/scenes/`; drivers `src/us/pages/{Fundamentals,PulseEcho}.tsx` | C + D | **wrapper needed** |
| 08 | US | `impedance` | *(embedded)* `UsImpedance`; `InterfaceStage`, `ReflectionStage`, `RefractionStage` | `sims/UsImpedance.tsx`; `src/us/scenes/` | B + C | wrapper ×3 |
| 08 | US | `attenuation` | *(embedded)* `FreqPenetration`; `AttenuationStage` | `sims/FreqPenetration.tsx`; `src/us/scenes/` | B + C | wrapper |
| 08 | US | `transducer` | `TransducerStage`, `BeamStage`, `ResolutionStage`, `ProbeStage` | `src/us/scenes/` | C | wrapper ×4 |
| 08 | US | `doppler` | *(embedded)* `DopplerAliasing`; `DopplerStage`, `ConsoleStage` | `sims/DopplerAliasing.tsx`; `src/us/scenes/` | B + C | wrapper ×2 |
| 08 | US | `artefacts` | *(embedded)* `UsArtefacts` (8 of 19 kinds); **11 unused kinds**: `ringdown`, `gratinglobe`, `beamwidth`, `slicethickness`, `rangeambiguity`, `speckle`, `anisotropy`, `doppler-{blooming,flash,twinkle}` | `sims/UsArtefacts.tsx` ← `us/scenes/ArtefactStage.tsx` | B | **extend the existing picker — cheapest US win** |
| 08 | US | `safety` | `SafetyStage`, `QaStage`, `HarmonicStage`, `ContrastStage`, `ElastoStage` | `src/us/scenes/` | C | wrapper ×5 |
| 09 | Safety | `quantities` | depth-dose panel of `diagrams-1-5.html`; interaction-probability panel of `diagrams-6-10.html` | `public/visuals/` | D | mount |
| 09 | Safety | `radiobiology` / `effects` | — | — | — | **no asset exists; authored primer only** |
| 09 | Safety | `legislation` / `limits` | — | — | — | **no asset exists** |
| 09 | Safety | `staff` | *(embedded)* `InverseSquare`; X-ray room shielding panel of `diagrams-6-10.html` | `sims/InverseSquare.tsx`; `public/visuals/` | B | mount |

**Priority order by cost/benefit:**

1. **Mammography (topic 04)** — the worst gap. One sim embedded, **ten purpose-built drawings
   unreachable** in `src/labs/mammo.tsx`, and nothing in that file is exported. Highest value per hour.
2. **MRI (topic 07)** — 31 propless mri5 sims, zero adaptation beyond mounting. Largest single win.
3. **The ~49 lab draws** — all already `(ctx,w,h,p,t)`. One-line export each, no physics rewrite.
4. **The 11 unused `ArtefactStage` kinds** — extending an existing picker, not new code.
5. **US scenes (contract C)** — most expensive; state bundles must be lifted out of
   `src/us/pages/*.tsx`. Defer to last.

Also stranded but out of scope for the merge: `src/mri/` (the older `/mri-lab` tree — `MagnetisationChamber`,
`SequenceTimeline`, `TissueGraphs`, six `src/labs/seq/*` sequence lessons, 47 chamber steps) reaches
neither surface. Note it; don't attempt it in phases 2-6.

**Dead export to clean up:** `GammaCameraChain` (`src/physics2/components/sims/NmScenes.tsx:21`) is
only self-referenced at `:113`; no content file mounts it. Likely mid-refactor — confirm with the
workflow currently editing that file before touching it.

---

## 4. Progress, re-test and mastery — changing the model without losing learner data

### The defect, precisely

`src/qbank/Shell.tsx:158-160` (verified verbatim):

```ts
export function recordQbScore(questionId, correct, outOf, choices?, topic?) {
  const all = progressStore.read()
  if (all[questionId]) return          // first write wins, permanently
```

There is **one slot per question and it is write-once**. "Wrong" is computed everywhere as
`attempt.correct < attempt.outOf` against that slot: `src/physics2/lib/derive.ts:41,65-70`,
`src/physics2/pages/Practice.tsx:44-47`, `src/qbank/pages/Review.tsx:63`.

Concretely: a learner scores 3/5 on `b54`, re-tests it, scores 5/5. `Practice.tsx` calls
`recordQbScore` → the guard returns → **nothing is written**. `b54` stays 3/5 forever, stays in the
re-test pool, stays in Review's "to fix", and keeps dragging topic accuracy down. `resetQbProgress()`
(`Shell.tsx:174`) is exported and **called from nowhere in `src/`** — there is no user-reachable undo.

Three further honesty problems:

- **The "re-test, your permanent record is unchanged" promise is false** for unseen questions
  (`Practice.tsx:137`). `filter=again` serves the whole pool and `filter=flagged` serves anything
  flagged — and a question can be flagged before it is ever submitted
  (`Question.tsx:193-212` renders mark buttons regardless of `submitted`). For those, the re-test
  **does** become the permanent record while the UI says it did not.
- **Mock papers write nothing to `qbank_progress`.** `src/qbank/pages/Mock.tsx:242,292` emit only
  `mock.started`/`mock.completed`. Sitting three 40-question papers leaves the dashboard at 0 answered.
- **Accuracy is silently first-attempt-only**, labelled just "accuracy" (`derive.ts:51`,
  `physics2/pages/Home.tsx:72`, `physics/Home.tsx:166`). Defensible as an exam predictor; not what a
  learner reads it as; can never move after the first pass.

### Proposed schema — store attempts, derive everything else

`mastered` and `needsReview` are policy. Policy changes must never require a second migration.
**Same localStorage key, same Supabase table, superset object. Do not bump the key** — nothing copies
it forward, so a bump strands every existing record.

```ts
export type QbOneAttempt = {
  at: string                      // ISO 8601; '' only for legacy records predating submittedAt
  correct: number
  outOf: number
  choices?: QbChoices
  mode: 'bank' | 'retest' | 'mock'
}

export type QbAttempt = {
  /* Legacy fields, PRESERVED and mirroring the LATEST attempt. Any un-migrated
     reader — an older build on the learner's other laptop, a page not yet
     updated — keeps working, and stops calling a fixed question wrong. */
  correct: number
  outOf: number
  choices?: QbChoices
  submittedAt?: string

  v?: 2
  /* Newest last. Capped at 10; oldest re-tests drop, attempts[0] never drops. */
  attempts?: QbOneAttempt[]
}
```

Derived on read by one pure function, never stored:

```ts
export type QbStanding = {
  firstAttempt: QbOneAttempt | null
  latestAttempt: QbOneAttempt | null
  bestAttempt: QbOneAttempt | null   // highest ratio, ties → earliest
  attemptCount: number
  lastAttemptAt: string | null
  mastered: boolean                  // latest is full marks AND ≥2 full-mark attempts
  needsReview: boolean               // attemptCount > 0 && latest is short of full marks
}
```

Policy, stated in code because each is currently implicit and wrong:

- `unseen` = `attemptCount === 0` (unchanged).
- **The re-test pool is "latest attempt short of full marks", not "ever wrong".** One-line fix for the
  stuck-wrong defect.
- `mastered` requires **two** full-mark attempts, so one lucky pass on five true/false stems is not
  mastery. Optionally require the second ≥24 h after the first.
- Dashboards show **two labelled accuracies**: first-attempt (immutable, the exam predictor) and
  latest-attempt (the revision signal). Never one unlabelled number.

### Lazy migration

Run `upgradeAttempt(raw)` inside `createSyncedStore`'s existing `sanitize` hook
(`src/lib/syncedStore.ts:52` — declared and currently unused by the progress store). That covers both
first load and the post-`pullAndMerge` seed.

```ts
function upgradeAttempt(raw: unknown): QbAttempt {
  const a = raw as Partial<QbAttempt> & Record<string, unknown>
  if (a?.v === 2 && Array.isArray(a.attempts)) return a as QbAttempt
  return {
    ...a,                                              // legacy fields kept byte-for-byte
    v: 2,
    attempts: [{
      at: typeof a?.submittedAt === 'string' ? a.submittedAt : '',
      correct: Number(a?.correct) || 0,
      outOf: Number(a?.outOf) || 0,
      choices: a?.choices as QbChoices | undefined,
      mode: 'bank',
    }],
  } as QbAttempt
}
```

- **Never write on read.** The upgraded shape persists only on the learner's next submission. A
  read-triggered write would push a full-blob Supabase upsert for every visitor on first page load.
- Idempotent and rollback-safe: the current build reads an upgraded record and sees exactly the four
  fields it expects.
- **The merge function must change.** `src/qbank/Shell.tsx:145` is
  `(local, remote) => ({...remote, ...local})` — whole-record, local device wins, **the other device's
  attempts are discarded**. Replace with a per-question union of `attempts` keyed on
  `${at}|${correct}|${outOf}`, then re-cap and re-derive. This is the identity-union pattern already
  proven at `src/lib/learner.ts:143-147`. Legacy records with `at: ''` de-dupe on `correct|outOf` alone.
- **No Supabase DDL.** `supabase/schema.sql:12-16` stores `data jsonb`.
- Size: 467 questions × 10 attempts × ~5 choices is well under 500 KB worst case — below the
  `learner_events` cap already tolerated.

**Write sites:** drop the guard at `Shell.tsx:160`, append instead, take a `mode` argument. Callers to
update: `src/physics2/components/Question.tsx:89`, `src/qbank/pages/Practice.tsx:93`,
`src/qbank/pages/Review.tsx:71`, plus a **new** call in `src/qbank/pages/Mock.tsx` `submitPaper`
(~:225-255) with `mode:'mock'` so mock work stops being invisible. Keep emitting `question.answered`
on every attempt — currently suppressed by the same guard.

**Read sites:** `src/physics2/lib/derive.ts:35-70`, `src/physics/Home.tsx:54-110`,
`src/qbank/pages/Review.tsx:60-66`, `src/qbank/pages/Practice.tsx:35-39`,
`src/physics2/pages/Practice.tsx:40-53`, `src/physics2/pages/Topic.tsx:84-120`.

### Four numbers that must be relabelled or fixed at the same time

Nothing on the dashboard is fabricated, but four are mislabelled or unreachable:

1. **"laboratories opened"** (`Home.tsx:197`) = `us.visited.length`. `markVisited` has exactly one
   caller — `src/us/components/Layout.tsx:255` — so it counts **ultrasound experiment pages**, not
   laboratories. Opening `/ct-lab`, `/nm-lab`, `/xray-lab` contributes nothing; a learner who finished
   ultrasound reads "21 laboratories opened".
2. **"modules completed"** (`Home.tsx:199`) counts distinct `module.completed` **lesson routes**, not
   modules. Twelve lesson paths across nine modules, so four X-ray lessons read "4 modules completed"
   while the list below shows one tick. It also counts off-spine routes (`/mri-lab/core`,
   `/mri-lab/encoding` via the shared player), so it can exceed 9.
3. **Two modules can never be ticked.** `us` lists `/ultrasound-lab` and `safety` lists
   `/fact-bank/protection`; neither surface records any learner event (no `record(` call in `src/us/**`
   or `src/factbank.tsx`). Permanently `0/1`. MRI is the exception —
   `src/mri5/Section.tsx:361` records `contentId: '/mri'`.
4. **"21 stages"** (`Home.tsx:291`) is a string literal. Correct today (21 slugs in
   `src/mri5/sections.ts`, 21 `path:` entries in `US_STAGES`) but it will silently lie the moment
   either spine changes. Derive it.

Two further gaps, both under-reporting:

5. **Stale on a synced device.** `useMemo(readSnapshot, [])` (`Home.tsx:165`) snapshots once and never
   subscribes. `pullAndMerge` (`src/lib/syncedStore.ts:110-119`) resolves *after* mount, so on a new
   device or cold sign-in the dashboard shows the pre-sync (empty) numbers until a manual reload — the
   empty state can appear for a learner with a full record. Every store exposes `subscribe()`; nothing
   uses it. **Fix this in the merge; it reads as data loss.**
6. **Continue drops the position inside a lesson.** `LessonPage` keeps the step in `?step=N`
   (`src/labs/lesson.tsx:380-384, 528-539`) but `module.started` records `window.location.pathname`
   only (`:417`), so Continue returns to the lesson intro. MRI records the exact section path.

**Do not count `answered` as `Object.entries(progress).length`** (`Home.tsx:62`) — that is the raw store
size, not an intersection with the bank, while `derive.ts:35` iterates the topic pool. If an id ever
leaves the bank (ids come from a fingerprint dedupe, `src/qbank/data/index.ts:92-107`) the dashboard
will read "470 of 467". Count against the bank in both places.

---

## 5. Replacing heuristic question→section assignment with an auditable mapping

### What it does today

`src/physics2/lib/assign.ts:29-41` — three ordered attempts, all resolved by **array declaration
order**, none recorded:

1. `q.visualTags` ∩ `section.tags` — first intersecting section wins.
2. `section.kw` regex against `title + all stem text` — first match wins.
3. `topic.sections.find(s => s.fallback)`, else `sections[0]`.

Pool membership is `QB_QUESTIONS.filter(q => topic.qbTopics.includes(q.topic))` (`assign.ts:47`).

Measured across all 467 bank questions / 1495 stems:

| Topic | Sections | Pool | via tag | via kw | **fallback** | Fallback lands on |
|---|---|---|---|---|---|---|
| xray | 7 | 88 | 57 | 25 | 6 | `quality` |
| digital | 6 | 21 | 0 | 19 | 2 | `latitude` |
| fluoro | 6 | 20 | 13 | 4 | 3 | `dose` |
| mammo | 6 | 11 | 9 | 0 | 2 | `quality` |
| ct | 6 | 59 | 28 | 24 | 7 | `acquisition` |
| nm | 6 | 72 | 32 | 27 | **13** | `camera` |
| mri | 7 | 74 | 49 | 19 | 6 | `sequences` |
| us | 7 | 70 | 28 | 35 | 7 | `artefacts` |
| safety | 6 | 52 | 24 | 27 | 1 | `legislation` |
| **total** | **57** | **467** | **240** | **180** | **47 (10.1%)** | |

- **117 questions where tag and keyword disagree.** The tag wins silently.
- **245 questions are ambiguous** — more than one section's tags or keywords match; resolved purely by
  declaration order. E.g. `b253` matches `[spectrum, interactions, geometry]` by tag and
  `[spectrum, interactions, geometry, quality]` by keyword; it lands on `spectrum` because `spectrum`
  is declared third.
- **23 questions carry `visualTags` no section in their own topic claims** and silently drop to the
  keyword path (the tags are claimed cross-topic — e.g. `b6` sits in Digital carrying
  `xray-focal-spot-unsharpness`, claimed only by xray).
- **7 sections receive zero questions:** `digital/quality`, `digital/processing`, `fluoro/chain`,
  `mammo/energy`, `mammo/spectrum`, `mammo/geometry`, `nm/performance`. `Topic.tsx:98` gates the
  practice block on `pooled > 0`, so those seven primers **have no practice gate at all** — a section
  that teaches with no way to test it.
- **Three fallbacks are bank-level topic errors:** `b35` (a Doppler ultrasound question, tag
  `doppler-angle`), `b248` ("Regarding MRI (part 3)") and `b443` (DRLs, tag `irmer-irr`) are all filed
  under Nuclear Medicine and all land in `nm/camera`.
- **Concepts have the identical defect** (`Question.tsx:33-36`, first regex wins): **106 of 467**
  questions match no concept — nothing appears under "The governing principle" when they get it wrong —
  and **172** match more than one, first declared wins, unrecorded.

### Proposed: one checked-in map

`src/physics2/mapping/questionMap.ts`, one row per bank question:

```ts
export type QuestionMapEntry = {
  q: string                     // bank question id
  topic: string                 // topic id
  section: string               // section id within that topic
  concept?: string              // concept id on that topic
  by: 'manual' | 'tag' | 'kw'   // provenance: how this row was decided
  overrideTopic?: true          // deliberately contradicts q.topic
  note?: string                 // REQUIRED when by:'manual' or overrideTopic
}
```

`assignments()` becomes a lookup. **No fallback in the app** — an unmapped question renders as
unassigned and is reported by the validator, rather than dumped into whichever section happens to be
first. The `topic` column lets `b35`/`b248`/`b443` be re-homed without editing `questions.base.json`,
so the bank keeps its provenance.

Bootstrap once from today's resolver, stamping `by` with the path that produced each row: 240 `tag`
rows and 180 `kw` rows arrive as a starting point; the 47 fallbacks plus the 117 disagreements become
the review list. **~164 rows of real editorial work, not 467.**

**Prerequisite:** section metadata (`id`, `title`, `tags`, `kw`, `fallback`) currently lives inside nine
`.tsx` content files alongside JSX. Lift it into a plain `src/physics2/mapping/sections.ts` that those
files import. Then the validator runs under the project's existing
`node --import ./scripts/ts-register.mjs` pattern instead of needing a Vite server (Node's type-stripping
has no JSX), and the mapping surface becomes editable without touching JSX.

### Validation script

`scripts/physics-map-validate.ts`, wired as `npm run physics:map`, modelled on the existing
`scripts/questions-validate.ts` (per-topic count table, errors, warnings, `exit 1` on error). Add to
`scripts/run-tests.sh` so it gates a release.

**Errors (fail the build):**

- **E1** every bank question id appears in the map exactly once (catches unmapped *and* duplicated)
- **E2** every mapped `q` exists in the bank (catches rows stranded when a question is dropped by the
  fingerprint dedupe)
- **E3** every `(topic, section)` pair exists in the section registry
- **E4** every `concept` id exists on that topic
- **E5** `topic` matches `q.topic` unless `overrideTopic: true` **and** `note` is present
- **E6** no section has zero mapped questions unless it declares `allowEmpty: true` — the seven empty
  sections above must be filled or explicitly waived

**Warnings (report, don't fail):**

- **W1** review debt — rows still stamped `by:'tag'` or `by:'kw'`, never hand-reviewed. Prints
  "164 of 467 rows unreviewed" and should trend to zero.
- **W2** drift — a question whose text now matches a *different* section's `kw` than the one it is
  mapped to. This is what catches a section rename or a primer rewrite silently invalidating the map.
- **W3** concept coverage — questions with no `concept` (106 today), per topic.

**Timing is safe.** `git diff -U0` on the four in-flight content files shows **no changes to any `id:`,
`tags:`, `kw:` or `fallback:` line** — the active work is primer prose and embedded sims. The
assignment surface is stable; the map can be generated against the current tree without racing it.

---

## 6. Final route map, with redirects

Every physics route is declared inline in `src/App.tsx:745-792`.

| Canonical | Source today | Note |
|---|---|---|
| `/physics` | `/physics` | Dashboard. **Keeps the shared site header.** |
| `/physics/course` | `/physics-v2` | Nine-topic syllabus |
| `/physics/:topicId` | `/physics-v2/:topicId` | `xray, digital, fluoro, mammo, ct, nm, mri, us, safety` |
| `/physics/:topicId/practice` | `/physics-v2/:topicId/practice` | reads `?section=` and `?filter=` |
| `/physics/questions` | `/physics-v2/questions` | |
| `/physics/review` | `/physics-v2/review` | |
| `/physics/mock` | `/question-bank/mock` | |
| `/physics/tour` | unchanged | cinematic page, own chrome |

**Redirects** — client-side `<Navigate replace>` in `App.tsx`:

```
/physics-v2                     → /physics/course
/physics-v2/review              → /physics/review
/physics-v2/questions           → /physics/questions
/physics-v2/:topicId            → /physics/:topicId
/physics-v2/:topicId/practice   → /physics/:topicId/practice   ← MUST preserve location.search
```

The practice redirect is the one that bites. `src/physics2/pages/Practice.tsx:206` stores the resume
path as a **full URL including query**. A `<Navigate>` that drops `location.search` silently discards
the section filter and dumps the learner into a different question set.

`public/_redirects` is `/*  /index.html  200` — a pure SPA fallback. No server-side or host config
work is needed.

**The topic-slug collision.** Mounting `/physics/:topicId` puts a catch-all one segment under
`/physics`, adjacent to `/physics/tour`, `/physics/questions`, `/physics/review`, `/physics/mock`,
`/physics/course`. React Router v6 ranks static segments above dynamic ones, so this is safe today —
but any future topic id colliding with a reserved word is a silent capture.
**Recommendation: keep the flat catch-all** (clean URLs matter more than the risk) **and add a unit
test asserting `V2_TOPICS.map(t => t.id)` never intersects
`['tour','course','questions','review','mock']`.** Do not namespace to `/physics/topic/:topicId`.

**Chrome list — `src/App.tsx:286-310`.** Replace the `/physics-v2` tree entry with **`/physics/`
(trailing slash, mandatory)**. `/physics` bare must stay OFF the list; the comment at `:287-291`
records that it was deliberately removed so the dashboard keeps the shared header. A bare `/physics`
tree entry would strip the header from the dashboard and regress that fix. `/physics/tour` is already
listed exactly and becomes redundant under a `/physics/` tree — harmless, but note it.

**Lesson routes DO NOT MOVE.** `/xray-lab/*`, `/ct-lab*`, `/nm-lab*`, `/mri*`, `/ultrasound-lab/*` stay
exactly where they are. See §8 — renaming them orphans every completion record on every device.
**Merge the navigation and the chrome, not the URLs.**

**Three full-page-reload anchors to convert to `<Link>` when `/physics/mock` becomes canonical:**
`src/physics2/components/Shell.tsx:59`, `src/physics2/pages/Home.tsx:94`,
`src/physics2/pages/Questions.tsx:76` — all plain `<a href="/question-bank/mock">`, each hard-reloading
the SPA and dropping React state.

**32 hardcoded `/physics-v2` strings across 8 files** must all change; there is no route-prefix
constant. `src/App.tsx:294,745` · `physics2/components/Shell.tsx:45,50,53,56` ·
`physics2/pages/Home.tsx:42,61,86` · `Topic.tsx:30,38,45,102,114,151,165,176,185` ·
`Practice.tsx:63,68,171,181,192,206` · `Review.tsx:43,81,91,98,104` · `Questions.tsx:21,67,80` ·
`Question.tsx:258` · `src/physics/Home.tsx:342`. Four of these (`Topic.tsx:38`, `Practice.tsx:206`,
`Review.tsx:43`, `Questions.tsx:21`) are `visit={{ path: ... }}` — they write into localStorage, so
they are stored-state changes as well as link changes. **Introduce a `PHYSICS_ROOT` constant during
this pass** so it never happens again.

Any new route must go through `lazyImport` (`src/App.tsx:21-37`), not bare `lazy` — it races the
import against a 10 s timeout with a `sessionStorage` reload guard shared with `main.tsx`'s
`vite:preloadError` handler.

---

## 7. Files that can eventually be retired

Retire **after** the phase they belong to lands, never before.

| File / symbol | Retire when | Note |
|---|---|---|
| `src/physics2/pages/Home.tsx` | Phase 2 | Second dashboard. Its topic list and doors fold into `src/physics/Home.tsx`. |
| `src/physics2/lib/store.ts` + key `radiopass.physics2.v1` | Phase 3 | Separate resume store. **Remove the entry at `src/lib/perUserKeys.ts:36` at the same time or the sign-out guard test drifts.** Needs a resume migration or the learner loses their place. |
| `topic.labs[]` in all 9 `content/*.tsx` | Phase 5, per topic | 11 links: `us.tsx:466`, `nm.tsx:375,376`, `mammo.tsx:355`, `mri.tsx:526,527`, `digital.tsx:369`, `xray.tsx:416`, `ct.tsx:412,413`, `fluoro.tsx:349`. `safety.tsx` already ships `labs: []`. Retire each topic's array only once its sims are embedded. |
| `.v2-labs`, `.v2-pager` in `src/physics2/v2.css` | Now | 7 rules, already orphaned by the uncommitted `Topic.tsx` rewrite. |
| `GammaCameraChain` (`sims/NmScenes.tsx:21`) | After confirming with the active workflow | Self-referenced only; no content file mounts it. |
| `outcomes[]` in `src/physics/course.ts` | Phase 2 | Duplicated in `topics.ts`; will drift. |
| `src/physics/Home.tsx:342-344` + `.ph-secondary-new` | Phase 2 | The `/physics-v2` door. |
| `src/physics2/components/Shell.tsx:86` | Phase 2 | "Switch to the current site". |
| `src/physics2/DESIGN.md` framing (lines 3-5) | Phase 6 | Rewrite as the merged spec; the architecture section is worth keeping. |
| `public/visuals/xray-spectrum-simulator.html` | Phase 5, topic 01 | Superseded by the native `XraySpectrum` component. |
| `src/physics2/components/Shell.tsx` (whole file) | Phase 6 | Only once one merged chrome exists. Its `document.title` line (`:29`) already reads "RadioPass Physics" — correct as-is. |

**Do not retire:** any `src/labs/*` lesson file, `src/us/**`, `src/mri5/**`, `src/mri/**`,
`public/visuals/*.html` other than the one above. They are the source of the embedded sims and the
holders of the telemetry pathnames.

---

## 8. Major risks and hidden coupling

**R1 — Telemetry is keyed by live pathname. This is the hardest constraint in the merge.**
`src/labs/lesson.tsx:415-437` records `contentId: window.location.pathname`. Consequences:
(a) Continue is a **stored URL** rendered straight into `<Link to={s.lastModule.path}>`
(`src/physics/Home.tsx:211`) — move a route and every recorded Continue 404s;
(b) completion ticks are a set intersection against hardcoded paths (`Home.tsx:275` via
`COURSE_MODULES`; `src/labs/xray.tsx:94-95,106,178,181` via literals) — move a route without migrating
the log and every module silently reverts to "not started", which reads as data loss;
(c) events are **synced to Supabase** (`src/lib/learner.ts:135-149`, table `learner_events`), deduped by
`JSON.stringify` of the whole record, so old-path events merge back onto every device — this cannot be
fixed client-side alone. **Mitigation: freeze all lesson pathnames.** If a cosmetic rename is wanted
later it needs a read-time translation layer in `completedModules()`/`lastOfType()`, not a route edit.
Note `src/mri5/Section.tsx:361` already uses two conventions in one module (`'/mri'` for completed,
`sectionPath(slug)` for started).

**R2 — Two Continue mechanisms that do not know about each other.** V1 uses the synced
`learner_events`; V2 uses the localStorage-only `radiopass.physics2.v1`, with a module-level `cache`
(`store.ts:16`) and no cross-tab invalidation. `store.ts:1-8` says the separation is deliberate. The
merge inverts that requirement. **Merged naively, the dashboard Continue points at a lesson and the
course-header Continue points at a topic primer, both live on screen, disagreeing.** One product needs
one Continue.

**R3 — If the course engine becomes the product, the dashboard's ticks and "modules completed" go to
zero.** V2 topic pages emit **no** `module.started`/`module.completed` at all — only `noteVisit` to
localStorage. `physics/Home.tsx:107` and `:275` would read blank for a learner who used the course
engine exclusively. **Mitigation: retire `noteVisit` into `record({type:'module.started'})` in the same
change that merges the routes.** This is a real-progress regression if missed, and the owner's decision
names progress honesty as non-negotiable.

**R4 — Two syllabus registries with two id vocabularies.** `src/physics/course.ts` (9 modules in 7
parts, keyed to lesson pathnames; `xray-core`) vs `src/physics2/topics.ts` (9 topics keyed to
`qbTopics`; `xray`). Same nine subjects. `course.ts:1-17` was written specifically to end the
"two authors for 'next topic'" problem; keeping both re-creates it. `src/labs/xray.tsx:32`'s
`moduleById('xray-core')!` throws on rename. `src/labs/lesson.tsx:41` imports `coursePosition`,
`moduleOrdinal`, `practiceHref` and `COURSE_MODULES.length` for the "Module N of 9" header, the
prev/next pager that crosses module boundaries, and the practice gate — **deleting `COURSE_MODULES`
breaks the bespoke lessons' navigation.**

**R5 — `PartMark` keying.** The emblem switch keys on part ids `matter|xray|ct|nm|mri|us|safety`. Six
of seven coincide with topic ids; only `matter` ↔ topic `xray` needs an explicit remap. Miss it and
one emblem silently disappears.

**R6 — `src/qbank/labLink.test.ts` parses `src/App.tsx` with a regex** (`/<Route\s+path="([^"]+)"/g`)
and asserts every href in `US_KEYWORDS`/`MRI_KEYWORDS`/`TOPIC_LABS` (`src/qbank/types.ts:127-193`)
resolves. Good: route renames fail loudly. Bad: **if routing is ever moved out of `App.tsx` into a
config module, this test passes vacuously** except for its `routes.length > 50` guard. Do not refactor
routing out of `App.tsx` during this merge.

**R7 — content data pinned to lab routes.** `src/us/engine/{facts,questions,reference}.ts` hold ~200
`/ultrasound-lab/*` deep links; `src/mri/components/Layout.tsx:16-48`, `src/labs/seq/shared.tsx:19-74`
and `src/labs/mriportal.tsx:44-146` hold parallel MRI spines (99 `/mri-lab` occurrences across 33
files). 259 route occurrences across 36 files total. All safe **provided R1's freeze holds.**

**R8 — static HTML outside the router.** `public/ct-story.html:180,331,332` and
`public/visuals/xray-tube-physics-canvas.html:14,16,17` hardcode `/physics`, `/xray-lab`,
`/question-bank/*`. `/physics` survives the merge, but `/question-bank/*` becoming `/physics/*` means
these anchors need editing or a permanent alias. They leave the SPA entirely and only return by
hardcoded href.

**R9 — the working tree is being edited as this lands.** Phases 2-4 touch routing, stores and mapping;
the active workflow touches primer content and sims. These are disjoint **today**. Confirm before
starting phase 5, which lands in exactly the files the other workflow owns.

**Shared correctly — do not disturb:** `src/qbank/Shell.tsx`'s `readQbProgress`/`readQbMarks`/
`recordQbScore` (keys `radiopass.qbank.progress.v1`, `radiopass.qbank.marks.v1`, tables
`qbank_progress`, `qbank_marks`). Both surfaces already read and write the same store, so answers
genuinely count once wherever they are given. Auth is uniform (`useAuth()` from `src/lib/auth.tsx`),
no divergence.

**Could not verify:** the "measured" assignment figures in §5 (240 tag / 180 kw / 47 fallback, 117
disagreements, 245 ambiguous, 23 orphan tags, 106 unmatched concepts) come from one auditor's Vite
`ssrLoadModule` run against the current tree and were not independently re-run here. Re-derive them as
the first step of the map bootstrap rather than trusting the numbers. Also unverified: the exact
content of the owner's phase list — the phases below are inferred from the merge decision and the
audit's dependency order.

---

## Phased plan

Topic order throughout: **X-ray → Digital → Fluoroscopy → Mammography → CT → Nuclear medicine → MRI →
Ultrasound → Safety.**

**Phase 2 — one shell, one route tree, no "V2".**
Rebase all 32 `/physics-v2` strings behind a single `PHYSICS_ROOT` constant. Add the five
`<Navigate replace>` redirects, preserving `location.search` on the practice route. Swap the
`hasOwnChrome` entry `/physics-v2` → `/physics/` (trailing slash; `/physics` bare stays off).
Delete `Shell.tsx:86` and `physics/Home.tsx:342-344`. Fold `physics2/pages/Home.tsx` into
`physics/Home.tsx`. Merge the two registries: add `part` and `lessons[]` to `V2Topic`, keep
`coursePosition()` on unchanged pathnames, remap `PartMark`'s `matter`→`xray`, fix
`labs/xray.tsx:32`, drop the duplicate `outcomes[]`. Convert the three `<a href="/question-bank/mock">`
to `<Link to="/physics/mock">`. Add the reserved-slug test. **Lesson pathnames unchanged.**

**Phase 3 — one honest progress model.**
Ship `QbAttempt` v2 + `QbStanding` with lazy `sanitize`-hook migration and the per-question attempts
union in the merge function. Drop the write-once guard; add `mode`; record mocks. Retire `noteVisit`
into `record({type:'module.started'})` so course reading reaches the shared timeline and Continue has
one author. Subscribe the dashboard to the stores so a synced device is not stale. Relabel
"laboratories opened" and "modules completed"; derive the "21 stages" literal; fix
`answered` to count against the bank; make `readSnapshot` surface real mock history.

**Phase 4 — the auditable mapping.**
Lift section metadata into `src/physics2/mapping/sections.ts`. Bootstrap `questionMap.ts` from the
current resolver with `by` provenance. Ship `scripts/physics-map-validate.ts` as `npm run physics:map`,
wired into `scripts/run-tests.sh` with E1-E6 failing and W1-W3 reporting. Work the ~164-row review
list. Fill or waive the seven empty sections; re-home `b35`, `b248`, `b443`. Remove the "High-yield"
chip (`Question.tsx:98`) and fix the missing `filter` at `Questions.tsx:67`.

**Phase 5 — embed the simulations, one topic at a time, in syllabus order.**
Work the §3 table. Per topic: export the lab draws (one line each, `labs/ct.tsx:808` is the pattern),
mount them as `kind:'element'` sims at the named section, then delete that topic's `labs[]` array.
Start with **X-ray** (proves the D-contract `InstrumentFrame` path), then **Digital** and
**Fluoroscopy** (proves the A-contract export path on files already mid-edit — coordinate first), then
**Mammography** (the biggest gap: ten unreachable drawings, nothing exported), then **CT** and
**Nuclear medicine** (add `drawSpect`, which is exported with no consumer), then **MRI** (31 propless
sims, largest volume, least risk), then **Ultrasound** (contract C — budget wrapper work per scene;
extend the `UsArtefacts` picker to the 11 unused kinds first as the cheap win), then **Safety** (mount
the `diagrams-6-10.html` shielding panel; accept that no dedicated safety lab exists).

**Phase 6 — retire and document.**
Delete the §7 list in dependency order. Remove `radiopass.physics2.v1` and its `perUserKeys.ts:36`
entry once the resume migration has shipped and settled. Strip the dead `.v2-labs`/`.v2-pager` rules.
Rewrite `src/physics2/DESIGN.md` as the merged spec. Fix the stale comments in `physics/Home.tsx`
(:17-22, :248, :335-336) and `course.ts`. Final pass: grep for the string "V2" across `src/` and
confirm nothing learner-facing survives.
