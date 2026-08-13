# Merging the anatomy build into `radiopass-website`

**Status: not started, and not to be started without the owner's explicit instruction.**
This is the survey, written while the two builds were being made to behave as one product.

---

## The question it answers

Is the separate build **technical debt**, or is it **limiting functionality**?

**It is mostly technical debt — with two places where it genuinely limits us.** Detail in
"What the split actually costs" below. Nothing a learner can currently see is broken by it.

---

## 1. What the two builds are

| | `radiopass-website` | `ANATOMY CLAUDE/frcr-anatomy` |
|---|---|---|
| Router | `BrowserRouter`, real paths | `HashRouter`, `#/…` |
| Vite base | default (`/`) | `./` (relative) |
| Deps | 7 runtime (incl. Supabase, three.js) | 3 runtime (react, react-dom, router) |
| Backend | Supabase (auth + progress) | own Node content API + adapters |
| Tests | vitest, 188 | none (script-based validators) |
| Deployed at | domain root | `/anatomy/` |

`npm run package` builds both and stitches them: physics at the root, anatomy copied into
`/anatomy/`, plus a generated `.htaccess`.

---

## 2. Routes

Anatomy owns 15 routes under a hash router. Under a merged `BrowserRouter` they become real
paths:

| Today | Merged |
|---|---|
| `/anatomy/#/` | `/anatomy` |
| `/anatomy/#/atlas`, `/atlas/:chapter`, `/atlas/:chapter/:structure` | `/anatomy/atlas/…` |
| `/anatomy/#/section/:sectionId` | `/anatomy/section/:sectionId` |
| `/anatomy/#/section/:sectionId/q/:questionId` | `/anatomy/section/:sectionId/q/:questionId` |
| `/anatomy/#/volume`, `/cxr`, `/mri/:studyId`, `/dashboard`, `/disputes` | prefixed likewise |
| `/anatomy/#/admin`, `/section/:id/custom`, `/…/replace-image` | prefixed likewise |

**Collision check: none.** No anatomy route name collides with a physics one once prefixed.
`/dashboard` and `/admin` would collide unprefixed — both exist on the physics side — so the
`/anatomy` prefix is not cosmetic, it is required.

**Cost:** every external link and bookmark of the form `/anatomy/#/…` breaks. A hash-to-path
redirect shim is needed and is cheap (read `location.hash` once on mount at `/anatomy`, replace).

---

## 3. Imports and shared code

Nothing is imported across the boundary today. Three things are **mirrored by hand** and must
converge on merge:

1. **`src/lib/learner.ts`** — deliberately duplicated, same key, same schema version. This is
   the clearest single win of merging: one file instead of two that must change together.
2. **Design tokens.** Physics has `src/design/tokens.css`; anatomy has its own `--text`,
   `--bg`, `--rule`, `--amber-accent` set. They are visually reconciled but not shared.
3. **Cross-branch URL resolution.** `Crossing.tsx`, `ANATOMY_HREF` in `App.tsx` and
   `PHYSICS_URL` in anatomy's `Layout.tsx` all exist only because of the split. All three
   delete on merge.

---

## 4. Data and content APIs

- **Question data:** six JSON files, ~510 questions, imported directly. Move as-is.
- **`structureCues.json`** (349 KB) and the 1,418-line grader move as-is.
- **Content API:** anatomy has a real server (`server/`, adapters for express/netlify/vercel,
  filesystem or Netlify Blobs store) plus a Vite dev middleware. Physics has no server at all —
  it is a static build against Supabase. **This is the single biggest structural decision in
  the merge:** the merged app either keeps the Node server (and stops being purely static), or
  the content overlay moves to Supabase and the server is retired.
- **Overlay + edit layering** (`applyOverlay` → `applyEdit` through `getSectionQuestions`) is
  self-contained and moves unchanged.

---

## 5. Image paths

~2,900 anatomy images under `public/images/…`, referenced as root-absolute `/images/…` and
resolved through `assetUrl()` precisely because the base is relative today.

**Collision risk: real.** Physics also has `public/visuals/` and `public/images/`. Anatomy's
images must land under `public/anatomy/images/…` and `assetUrl()` must gain that prefix — a
one-line change in one function, which is why `assetUrl()` existing is fortunate.

Custom-case images live in **IndexedDB** under `idb://` refs. Same origin before and after, so
they survive untouched.

---

## 6. Persistence

Both already share an origin in the packaged deployment, so **localStorage merges for free** —
this is why the mirrored learner log works today. Keys are already distinctly namespaced
(`frcr-anatomy-*`, `radiopass-*`, `radiopass.*`). **No migration needed, and no learner loses
progress.** This is the least risky part of the whole exercise.

---

## 7. Auth, entitlement and admin

- Physics: Supabase account + `EntitlementProvider` + `canAccess()`.
- Anatomy: **no learner account at all** (the fake one was removed), and an editor gate that is
  a server session or a build-time passcode.

On merge, anatomy pages come inside the entitlement provider and can use `canAccess({branch:
'anatomy', …})`. The editor gate stays as it is — it guards authoring, not content, and the
content API re-checks every write server-side regardless.

**This is limitation #1:** anatomy currently cannot see the signed-in user, so it cannot sync
progress to Supabase, cannot show account state, and cannot enforce an anatomy entitlement.
Today that is invisible because early access grants everything — **it stops being invisible the
day anatomy-only or trial access is sold.**

---

## 8. Build configuration

- Anatomy's `base: './'` becomes `/`.
- `HashRouter` → `BrowserRouter` with the `/anatomy` prefix.
- Anatomy's `prebuild` (`build-hero-frames.mjs`) and its Python `tools/` folder join the
  physics build scripts.
- `scripts/package.mjs` loses its stitching step entirely.
- Anatomy's oxlint config merges; its three deps are already a subset of physics'.

---

## 9. Protected anatomy data — the non-negotiable

`scripts/anatomy-mapping.ts` + `anatomy-mapping-baseline.json` (510 questions, 2,279 labels)
move with the data and **must run green before and after every step of the merge.** The baseline
must never be re-recorded to make a failing merge pass.

`questions:validate` moves with it.

---

## 10. Tests

Anatomy has no test runner. On merge it inherits vitest, and the two script validators
(`anatomy:verify`, `questions:validate`) should additionally become vitest specs so they run in
the same command as everything else.

---

## What the split actually costs

**Genuine functional limits (2):**

1. **Anatomy cannot see the account.** No Supabase progress sync, no cross-device anatomy
   progress, no anatomy entitlement enforcement. Blocks anatomy-only plans and any trial that
   includes anatomy.
2. **Two headers, two design token sets.** Reconciled by hand this pass; they will drift again
   without shared source.

**Technical debt (not user-visible):** the mirrored `learner.ts`, three URL-resolution helpers,
duplicated build config, anatomy's missing test runner, and the packaging step.

**Recommendation:** merge **before** selling anatomy-only or trial access, and not before. The
learner-facing coherence is already solved without it. The right trigger is the entitlement
requirement in (1), not tidiness.

**Suggested order** (each step independently revertible, `anatomy:verify` green throughout):
routes and base → images and `assetUrl` → design tokens → learner log de-duplication →
entitlement provider → content API decision → delete the stitching step.
