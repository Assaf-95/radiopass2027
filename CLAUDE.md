# RadioPass — project context for Claude

**This file is read automatically at the start of every session.** It exists because project
history is scoped per-folder, and work was previously spread across ~14 folders — so each new
chat started from zero and re-proposed things already finished.

**Always start Claude from this folder:** `/Users/User1/Desktop/Claude/radiopass-main`

Reconstructed 12 August 2026 from 21 prior sessions (27 Jul – 12 Aug 2026).

---

## What RadioPass is

An interactive learning platform for the **FRCR Part 1** exam (UK radiology trainees).
Teaches **physics** and **anatomy** through browser simulations the learner manipulates
directly, rather than static notes.

**Audience:** UK radiology trainees and international candidates (India/Pakistan expected to be
the largest international share), and specifically **people who failed before**. The founder sat
this exam and struggled with physics — that shared experience is the product's positioning.

**Model:** paid, with a free trial. Not public yet.

**Owner:** a radiology doctor, not a professional developer.

---

## The two applications

| Folder | What | Stack | Backend |
|---|---|---|---|
| `radiopass-website/` | Physics labs, question bank, accounts | React 19 + TS + Vite | Supabase (auth + progress) |
| `ANATOMY CLAUDE/frcr-anatomy/` | Anatomy site, deploys to `/anatomy/` | React + TS + Vite | None — fully static |

Everything else in the parent folder is old backups. `docs/HANDOVER.md` has the full developer
handover, including the security review request and the list of dead folders to ignore.

```bash
cd radiopass-website && npm run dev    # port 5182
```

`npm run package` builds the combined deployable bundle (physics at root, anatomy at `/anatomy/`).

**State as of 9 Aug 2026** (per HANDOVER.md, not re-verified since): build passes, 130 tests
across 5 files, 0 npm vulnerabilities, 7 production deps.

---

## Standing rules — these were established repeatedly. Do not re-litigate them.

### 1. Never rebuild from scratch. Ever.

Stated explicitly many times: *"Do not restart the application, replace the existing design,
discard completed questions, or create a separate prototype."* Inspect what exists, understand
it, then **improve it in place**. If a demo or component already exists, bring it forward and
adapt it — don't author a replacement.

### 2. Never redesign the home page unless explicitly asked.

This has caused the worst blow-ups in the project. The home page is liked and considered done.
Touch it only on direct instruction.

### 3. Anatomy marking scheme — the most-repeated correction in the entire history

Each answer is worth **2 marks**; the candidate scores **0, 1, or 2**.

- **Synonyms score full marks.** C1 = atlas. Aqueduct of Sylvius = cerebral aqueduct.
  Foramen of Monro. Fifth phalanx / fifth metatarsal. These are the same structure — 2 marks.
- **Correct but less specific = 1 mark.** "Clavicle" when the answer is distal clavicle.
  "Radius" when the answer is radial head. "Scapula" when the answer is blade of scapula.
- **Do not demand unnecessary detail.** "Manubrium" scores 2 — "manubrium of the sternum" is
  not required.
- **Missing laterality costs 1 mark only**, never both.
- **Never deduct for spelling.**
- Judge the **anatomical structure named**, not literal string match against the official wording.

### 4. Explanations must teach, not adjudicate

Never just *"incorrect, the official answer is X."* Say what the structure is and **why** —
describe the imaging features that identify it. Example the owner gave: if the candidate answers
hepatic artery but it's the portal vein, explain the echogenic borders, the branching pattern,
the location. Keep the tone informal, not formal. This applies across the whole project.

Where a mistake is a classic exam trap, name it — e.g. anterior/posterior longitudinal ligament
are named relative to the **vertebral body**, not the spinal cord.

### 5. Learning-module UX — the second most-repeated demand

**One concept per screen. No scrolling within a concept.**

The learner should never have to scroll while reading one idea against its diagram — text and
animation must be visible together on one screen. Use side-by-side layout if stacked doesn't
fit. Scrolling is only for moving to the *next* idea.

Step-by-step, spoon-fed: one fact → diagram changes → next fact → diagram changes. The big
dense "chunky" reference pages are still wanted, but kept **at the end as reference**, not shown
on first click.

Key teaching text should be large and visually dominant. Exam-critical points must not occupy
less visual space than metadata, navigation, or decorative whitespace.

**Quality bar: the ultrasound lab and CT lab.** When building or fixing another module, match
those.

### 6. Animations must be physically honest

Smooth, continuous motion — never stepped or jumpy. The CT gantry rotates consistently in one
direction (it does not reverse mid-sweep). Scroll-driven 3D (the skull → chest hero) must be
continuous with no jump between stages.

### 7. Admin vs. candidate

Authoring is **admin-only**, behind an admin login. Candidates may never upload images, change
images, or add/edit labels.

Image editor requirements (built iteratively, painfully): labels as **arrow / point / line /
circle**, freely switchable; adjustable **angle**, **thickness**, and **size**; arrows must be
**thin and sharply pointed** (structures are tiny); colours limited to **white, black, yellow,
blue**; **crop** on replacement images; and the **image must stay fixed while labels are
edited** — label positions are millimetre-accurate.

Patient identifiable data must be cropped out of all images.

### 8. Question and label conventions

Options and image labels are **a, b, c, d, e** — matching each other. Never 1/2/3 or 51/52/53.
Any case numbers burned into source images must be removed.

### 9. Question bank behaviour

Filters: unseen · answered incorrectly · flagged · favourited · all. Progress, scores, flags and
favourites **persist** — closing the browser or switching device must not lose them.

Mock exams: **3 mocks × 40 questions × 5 true/false statements, 90 minutes each.** Same concepts
as the source material but **reworded and flipped** — never copy-paste duplicates.

### 10. Design language

One coherent theme across physics and anatomy. Professional, academic, elegant — the owner's
word is **"expensive looking."** The home page is a shop window, not a lesson: keep it clean and
uncluttered.

---

## Decisions already made — don't reopen

- **Netlify was deliberately deleted** (9 Aug 2026) and the local build is still the
  source of truth — but the owner has since bought hosting again and the app is going
  back onto Netlify (20 Aug 2026). This is not a reversal of the earlier decision: the
  distribution is still `npm run package` → a plain folder, and Netlify receives that
  folder by drag-and-drop rather than building from a repo. No CI, no build hooks, no
  `netlify.toml`. Deploy by dragging onto the SITE's Deploys tab; dragging onto the
  Sites page creates a second site instead of updating the first.
- **The bundle carries config for both kinds of host, and they must stay in step.**
  `public/.htaccess` for Apache (GoDaddy and other cPanel hosts) and
  `public/_redirects` + `public/_headers` for Netlify. Each states the same two
  intents — deep links fall back to the shell, hashed assets cache forever and the
  shell never does. Change one without the other and the same build behaves
  differently depending on where it landed.
- **Domains** (checked against live DNS, 20 Aug 2026):
  - `radiopass.co.uk` — the live brand. Registered, DNS at GoDaddy
    (`ns23/ns24.domaincontrol.com`). **`www` already serves a separate marketing
    landing page** published through ChatGPT's custom-domain feature
    (`custom-domains.chatgpt.site`, behind Cloudflare) — it is NOT this React
    app, and it is not to be taken down without the owner saying so.
  - `app.radiopass.co.uk` — **where this app goes** (owner's decision, 20 Aug
    2026). A CNAME added at GoDaddy alongside the existing records, so the
    landing page is untouched and the move is reversible. Do NOT switch the
    domain's nameservers to a host's own DNS: that moves control of every
    record and would take the landing page with it.
  - `passradiology.co.uk` — registered, but no nameservers and no records at
    all. Parked, pointing nowhere, currently unused.
- **Copyright on anatomy images: set aside by explicit decision.** The owner will manage image
  replacement himself once online. Do not re-raise it or block on it.
- **Supabase** backs physics only (auth + progress). RLS is the entire security boundary; the
  anon key is public by design and is not a leaked credential.
- Anatomy has a **Structure Atlas** — keep it.
- Physics modules need a **simplified version alongside** the existing one. Add; never replace.
- A **security review by a human developer** is wanted before going live and taking payments.
  See `docs/HANDOVER.md` and `docs/SECURITY-REVIEW-CHECKLIST.md`.

---

## Working style

- **Give the plan before executing.** A direct past complaint: *"you never told me the plan, you
  just keep doing it and doing it."* State what you're about to do, then do it.
- Once he's said go, **don't stop to ask permission repeatedly.**
- **Summarise what changed** when you finish — he often can't tell from the UI alone.
- Most of his messages are **voice-dictated**. Typos and odd word breaks are transcription
  artefacts, not new requirements. Read for intent. ("Fabal" = Fable, "Netfly" = Netlify,
  "epilepsy exists" ≈ "the API/page exists".)
- Frustration in the transcripts is almost always about **regression** — something that worked
  breaking, or work being redone. Protect existing work above all else.

---

## Marketing (planned, not executed)

Channels that matter: **Telegram** (highest priority — large FRCR candidate groups), **X**,
**Reddit**, **Facebook**, **WhatsApp groups**, **Instagram**. Deliverables exist at
`docs/RadioPass-Launch-Strategy.md`, `docs/RadioPass-Community-Map.docx`,
`docs/RadioPass-Outreach-Pack.docx`. A professional email address is still outstanding.

---

## State as of 19 Aug 2026 — the physics merge landed

All six phases of `radiopass-website/docs/PHYSICS-MERGE-AUDIT.md` are done (each phase heading
there carries its commit hash), on branch `physics-visual-course-and-merge-audit`. Do not
re-propose any of it:

- **One product at `/physics`.** No learner-facing "V1"/"V2". `/physics-v2/*` redirects.
  Route constants live in `src/physics/routes.ts`; `src/physics/routes.test.ts` fails the
  build on drift.
- **Progress model**: attempts accumulate per question (`QbAttempt` v2, lazy migration, never
  rewritten on read). Re-tests clear wrong answers; mocks write to the question record; two
  labelled accuracies (first/latest). Never reintroduce a single unlabelled "accuracy".
- **Question→section mapping is a checked-in file**, `src/physics2/mapping/questionMap.ts`,
  validated by `npm run physics:map` (E1–E6 gate the build via scripts/run-tests.sh).
- **The free sample is decided and live at `/free-trial`**: X-ray §1.1–1.3 + MRI §7.1 + the
  question set x57/b417/b415/x53/b385, configured in `TRIAL` in `src/lib/access.ts` and pinned
  by tests. The gate wording is the owner's, verbatim: "Sign up if you would like to progress
  to the next set."
- **Deployment**: `npm run package` → `deploy/` is THE distribution (drop-in folder; Netlify
  stays deleted). **Rebuild it after any change that should ship** — it is not rebuilt
  automatically, and a stale bundle once carried an abandoned experiment.

### Authoring surfaces — built 19 Aug 2026, do not rebuild or duplicate

The owner edits his own content. Five surfaces exist; extend them, never author a
replacement.

| Route | What |
|---|---|
| `/admin` | Author console — links to everything below (`src/portal/Admin.tsx`) |
| `/admin/questions` | Physics wording: search 467 by id/heading/statement, edit stem, explanation, key point |
| `/anatomy/admin/structures` | Structure folders + "Scan the question bank" (finds 417 groupings) |
| `/anatomy/section/:id/images` | Every film in a section: remove, bring back, rename, replace |
| `/anatomy/section/:id/q/:qid/wording` | Stem, official answer, accepted variants, laterality |

`/anatomy/admin` is the anatomy hub and also links all of it.

**Two content backends, and ONE is chosen per load — never composed.**
`loadContent()` picks the Node API (`src/anatomy/lib/content/api.ts`) wherever it is
configured, i.e. `ATLAS_ADMIN_PASSWORD` is set; otherwise Supabase
(`src/anatomy/lib/content/supabaseBackend.ts`, key `anatomy-overlay`). Physics wording
and structure folders are Supabase-only. Read `contentBackend()` for what is active;
save through `saveQuestionPatch()` / `uploadQuestionAsset()` — never call
`patchQuestion` from a page again.

**Do not "improve" this by merging the two overlays per question.** That design was
built and rejected: no editor page sends a whole patch (the film manager sends only
`image`, the wording editor only `edit`), so any per-question precedence rule erases
marker geometry on something as innocent as a rename.

`src/anatomy/lib/content/merge.ts` is a line-for-line port of `server/lib/overlay.mjs`,
and `merge.test.ts` runs BOTH over the same fixtures. If you change one, change the
other or that test fails — two implementations of a merge that decides marking is how
one edit comes to mean different things on two deployments.

Both backends are overlays: the bundled JSON is never mutated and every edit is
revertible. Sign-in is the owner's Supabase account (`admin` grant in `entitlements`);
`isAdmin()` accepts it, so no localStorage passcode is needed.

**Rules the editors encode — do not weaken:**
- The wording editor MERGES into the existing edit document. Writing a fresh one
  erases the marker geometry the annotation editor saved.
- Image removal is SOFT (`removedAt`). The question, answers and labels survive.
- Physics wording cannot change a true/false value — there is nowhere in the
  document to put one. Flipping one would re-mark work already submitted.
  Pinned by `src/qbank/overlay.test.ts`.
- `structureKey` must never fold left/right, proximal/distal, or toe/finger.
  Pinned by `src/anatomy/lib/structureScan.test.ts`.

Still to do: nothing yet lets folders drive what the Atlas displays — a folder
records the grouping but the Atlas has not been pointed at it.

### 3D models (owner-made, in ~/Downloads) — the standing rule

`sodium-atom.glb` opens X-ray §1.1 and `gamma-detector-head.glb` sits in NM §6.2, built up layer
by layer along the photon's path. The rest (tungsten, hydrogen-spin, rotating-anode tube) are
**paused by the owner's explicit correction**:
adding several at once, restyled, looked bad and was reverted. The rule now: **one model at a
time, rendered with its exported materials (no re-lighting, no re-texturing), and a screenshot
shown to the owner BEFORE it is mounted in any topic.** `SIMPLEFY -atom.glb` is mislabelled
physics (K2 L4 M8, no nucleus) — do not use it.
