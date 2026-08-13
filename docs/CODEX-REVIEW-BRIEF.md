# RadioPass — independent review brief

You are being asked for a second opinion on a large refactor. Be blunt. Nothing here is
precious, and "this was a mistake" is a useful answer.

**Repo root:** `/Users/User1/Desktop/Claude/radiopass-main`
**The application:** `radiopass-website/` — everything else is archive/reference and must not be
modified.

---

## What the product is

An FRCR Part 1 (UK radiology) exam-revision platform with two branches:

- **Anatomy** — 510 image-based questions across six body regions, marked 0/1/2 per label, plus a
  Structure Atlas derived from those questions.
- **Physics** — 467 true/false questions, ~20 simulator labs, timed mock papers.

Owner is a radiologist, not a professional developer. Not launched. Paid product with a free
trial planned.

## What was done, in four passes

1. **Historical recovery.** ~10 abandoned project folders were forensically audited; genuinely
   lost work was recovered into the live app (orphaned scroll scenes, a 2,210-line procedural CT
   volume engine, a question-bank validator that had never been run, a missing diagram set, and
   453 questions' worth of dropped provenance metadata).
2. **Product architecture.** A central entitlement model, a `/free-trial` route whose content
   configuration is deliberately empty, learner homes at `/anatomy` and `/physics`, and a shared
   learner event log.
3. **Physical merge.** Anatomy was a separate Vite app served at `/anatomy/` via a hash router.
   It is now part of the one application: one React root, one BrowserRouter, one build.
4. **UX consolidation.** Shared typefaces, one breadcrumb, navigation language, mobile fixes.

## The hard constraint

Anatomy question content is **frozen**. The owner has manually verified every image, label letter
and anatomical answer. A regression gate enforces it:

```bash
cd radiopass-website && npm run anatomy:verify
# expected: 510 questions, 2,279 labels — every existing mapping unchanged
```

The gate compares **by letter, not by position** — deliberately, so answers shifting up after a
deletion cannot pass. `scripts/anatomy-mapping-baseline.json` is the baseline and must never be
re-recorded to make a failing change pass.

---

## Run it yourself

```bash
cd radiopass-website
npm install
npx tsc -b --noEmit        # typecheck
npm test                   # 191 tests / 10 files
npm run anatomy:verify     # protected-content gate
npm run questions:validate # 508 questions, 0 errors
npm run build
npm run dev                # then visit / , /anatomy, /physics, /free-trial
```

## Read the reasoning

The commit messages carry the *why*, including the bugs found and why each decision was made.
Three tags mark the checkpoints:

```bash
git log baseline-before-historical-recovery..HEAD          # 30 commits, full reasoning
git tag -l                                                  # the three protected baselines
git diff --stat merged-baseline-protected..HEAD             # the most recent pass only
```

---

## Where the interesting decisions are

Read these first; they carry the architecture and its justification in their header comments.

| File | The decision |
|---|---|
| `src/lib/access.ts` | Entitlement as a **set of grants**, not a tier ladder. Trial config deliberately empty. |
| `src/lib/entitlement.tsx` | The only place auth meets access. Early-access currently grants `full`. |
| `src/lib/learner.ts` | Append-only event log **alongside** existing stores, not a migration. |
| `src/lib/perUserKeys.ts` | What sign-out clears, and what it deliberately does not. |
| `src/anatomy/AnatomyRoutes.tsx` | How anatomy mounts; legacy `#/` redirect. |
| `src/anatomy/lib/assetUrl.ts` | Why image *paths* were not rewritten during the merge. |
| `src/anatomy/anatomy.css` | Why anatomy's CSS is scoped under `.rp-anatomy`. |
| `scripts/anatomy-mapping.ts` | The protected-content gate. |
| `src/qbank/pages/Mock.tsx` | Mock integrity: no reveal, whole-paper denominator, reload survival. |
| `vite.config.ts` | What the merge deleted and why. |

---

## Questions I actually want answered

1. **Is the anatomy content genuinely safe?** The gate compares question id → image → label
   letter → answer → laterality → accepted variants. Is that the right set? What could change
   *without* the gate noticing?

2. **Is scoping anatomy's CSS under `.rp-anatomy` sound**, or should the class collisions have
   been resolved by renaming rather than scoping? Eight CSS variables collided by name across the
   two halves.

3. **Is the entitlement model over- or under-built?** It has six grants and one `canAccess()`
   entry point, with no payment provider yet. Early access grants `full` to any signed-in account
   — one constant.

4. **Is the learner event log the right shape?** It is append-only, capped at 4,000 events,
   localStorage-only, and duplicated nothing from the existing progress stores. It is not synced
   to Supabase, so mock history is device-local.

5. **Sparse labels.** Deleting label B from A,B,C now leaves A,C — letters are never renumbered,
   because they are printed on the films. Does anything downstream assume contiguous letters?

6. **What did we get wrong?** Particularly: anything that will hurt at launch, anything that will
   be expensive to undo, and anything a radiologist would find embarrassing.

## Known, deliberate gaps — not defects

- Anatomy mock exams do not exist; the destination says so rather than showing invented papers.
- Free-trial content is unconfigured on purpose; the owner has not chosen it.
- The anatomy content API is a Node server, deliberately not migrated to Supabase during the merge.
- No "exam readiness" score — no defensible methodology exists.
- `lab.completed` is defined but never written: a simulator has no end.
- ~73 historical anatomy facts are inventoried but not imported; they need medical review.
- An image-provenance/copyright audit sits unresolved in `ANATOMY CLAUDE/frcr-anatomy/qa/copyright/`.
