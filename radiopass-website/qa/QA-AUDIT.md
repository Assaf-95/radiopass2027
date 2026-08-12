# RadioPass Full QA Audit

Last updated: end of first full pass on physics; anatomy source-reviewed, live-blocked.

## Summary

- Physics routes discovered: 65 (all live-crawled: desktop 1440×900, tablet 834×1194, mobile 390×844 — console errors, horizontal overflow, verified DOM collisions)
- Anatomy routes discovered: 19 (representative sample; source-reviewed only — live testing blocked by the HTTP Basic Auth gate, which automated tooling can't get past)
- Real defects found and fixed this pass: 4 (1 anatomy, 3 physics — see below)
- False positives caught and correctly ruled out before touching code: 3 (documented below — each looked real at first glance, verification via `elementFromPoint`/computed-style disproved it)
- Live functional bug reported by user (progress not saving after login on physics): investigated, could not reproduce directly (blocked by email-confirmation requirement — no way to get a fully authenticated test session without inbox access), added error observability as the actionable outcome (see below)

## P0 open
(none confirmed)

## P1 open
(none confirmed open — see Fixed below)

## P2 open
(none — both items below were resolved and verified live this pass)

## Fixed this pass

### [Anatomy] Fixed header covers page heading on 4 page templates — P1
- Files: `src/pages/SectionHub.css`, `src/pages/Dashboard.css`, `src/pages/Disputes.css`, `src/pages/CustomCaseEditor.css`
- Root cause: `.app-header` (Layout.css) is `position: fixed`, height `104px` (`--header-h`), goes opaque the instant `window.scrollY > 24`. These four page roots only had `padding: 24px 24px 80px` — nowhere near enough, so the heading/back-link rendered under the header.
- Confirmed NOT an issue on `ChestXrayAtlas.css`/`MriViewer.css` (already `calc(100svh - var(--header-h))`), `Home.css` (intentionally hero-style), `QuestionPlayer.css` (header doesn't render on question routes at all).
- Fix: top padding changed to `calc(var(--header-h) + 24px)` on all four.
- Verification: `tsc -b` passes. **Still not visually verified live** — anatomy remains auth-gated.

### [Physics] "Mock exam" nav link undiscoverable at ~1280-1350px desktop/tablet width — P2
- File: `src/qbank/qbank.css`
- `.qb-nav-links` is a horizontally-scrolling flex row (8 subject links) with a hidden scrollbar and no visible affordance that there's more content to scroll to. At common desktop/tablet widths it doesn't fit, so the last 1-3 items scroll out with zero hint.
- Fix: added a right-edge fade (`mask-image` gradient), the standard pattern for a hidden-scrollbar scrollable row.
- Verified live, both desktop and tablet: nav now cuts off cleanly under the fade, `elementFromPoint` confirms no ghost painting, real destination still reachable via the "Timed mock exam" card lower on the page (why this stayed P2 not P1/P0).

### [Physics] Ultrasound lab: horizontal page overflow on every page at mobile width — P1/systemic
- File: `src/us/us.css`
- Found on ~15 of ~21 ultrasound-lab routes at 390px width: `document.documentElement.scrollWidth=403` vs `clientWidth=390`.
- Root cause traced precisely (not guessed): `.us-topbar-actions` (LIVE badge + Guided/Manual toggle + Focus view + Reset button, `flex: none`, never shrinks) needs more width than the ~350px available after the topbar's own 20px×2 padding, even with the progress-pill already correctly hidden at this breakpoint.
- Fix: trimmed `.us-topbar` side padding (20px→14px) and `.us-topbar-actions` gap (9px→6px) inside the existing `max-width:620px` block — reclaims the ~13px needed without hiding or shrinking any control.
- Verified live on `/ultrasound-lab` and `/ultrasound-lab/doppler`: `scrollWidth` now exactly equals `clientWidth` (390=390) on both. Fix is in the shared component, so it applies to all ultrasound-lab pages, not just the two spot-checked.

### [Physics] Silent sync failures now observable — hardening, not a confirmed bug fix
- Files: `src/lib/syncedStore.ts`, `src/qbank/Shell.tsx`, `src/qbank/qbank.css`
- Context: user reported progress not saving after logging in with their real account. Investigated live: couldn't get a fully authenticated test session (fresh signup requires email confirmation, no inbox access available to me). Directly probed the Supabase REST API with the anon key — got a `42501 permission denied` on `qbank_progress`, but that's *expected* for the unauthenticated `anon` role (RLS correctly blocking it), not evidence of a real bug for actual signed-in (`authenticated`-role) users. Could not get further without real credentials.
- Given every sync failure (push or pull) was previously caught and silently discarded with no trace anywhere, made the failure mode observable instead of continuing to guess blindly: `console.error` on any push/pull failure, plus a small warning dot next to the account chip in the question-bank header when a store currently has an unresolved sync error (title-text explains it's local-only until it clears).
- This does not fix a specific confirmed root cause (none was found) — it turns the *next* occurrence into something diagnosable from either the browser console or a visible UI signal, instead of a silent, unreproducible mystery.
- Verified: `tsc -b` passes, deployed live. Genuinely reproducing/confirming the user's original report still needs either their real credentials (never to be requested) or them checking the indicator/console next time it happens.

### [Physics] Main site header wraps/collides at ~761-900px width (tablets) — P1
- File: `src/styles.css`
- Root cause: the header's own content (brand + full nav-links + login link + CTA button) needs ~771px, and only switched to the working hamburger-menu mode at `max-width:760px` — so the entire 761-900px band (portrait tablets, including the 834px iPad-class width tested) sat right at that edge and wrapped into a ragged, overlapping second line instead of either fitting or getting the mobile menu.
- Fix: extracted just the header's show/hide toggle rules into a new `@media(max-width:900px)` block, rather than widening the existing 760px block wholesale (which also contains phone-tuned hero/footer/card rules that shouldn't apply at tablet widths).
- Verified live at 834px on `/about`: clean single-row header with hamburger icon, no wrap.
- Also checked: the homepage's separate `.hm-nav` has ~107px of margin at the same width — not affected, no change needed there.

### [Physics] MRI Lab "Free Lab" (`/mri-lab/laboratory`): teaching text genuinely covered by playback controls at ≤960px — P1
- File: `src/mri/mri.css`
- Root cause, precisely traced: `.mri-workspace` is `display:grid` with an explicit `height: clamp(460px, calc(100vh - 268px), 700px)` sized for its desktop two-column layout (canvas + an internally-scrolling inspector column). The `max-width:960px` breakpoint correctly switches it to a single stacked column and sets `min-height:0` — but `min-height:0` does not cancel the still-active explicit `height`, so the container stayed capped at ~700px. Stacked, the canvas + inspector's real combined content needs 1000px+, so the excess painted straight through the fixed-height box into the transport controls below — confirmed via `elementFromPoint`: the description paragraph's own center point was actually rendering "Scrub through the sequence…" (the scrubber), not its own text.
- Fix: added `height: auto` to the same breakpoint. Confirmed `.mri-inspector-column` has no dependent percentage-height of its own (only `overflow-y:auto`, relying on the grid row's stretch at desktop) — at auto height it simply renders at natural content height with normal page scroll, which is standard/correct mobile behaviour, not a regression.
- Verified live: `.mri-workspace` height now 2033px (fits real content), paragraph's center point now correctly paints itself.

## Correctly ruled out as false positives (verify-before-modify in action)

- **"Mock exam" vs "Log in to sync progress"** (desktop) — `getBoundingClientRect()` flagged an overlap; `elementFromPoint()` proved only "Log in..." is actually painted there. `getBoundingClientRect` doesn't account for ancestor overflow-clipping, so a scrolled-out-of-view item still reports its full unclipped rect. (Real underlying issue — undiscoverability — captured above and fixed anyway.)
- **Tablet-width nav overlaps (MRI/Ultrasound/Nuclear Medicine vs "Log in"/"Open the labs")** — same root cause and same verification method; all confirmed as clipped-not-painted after the fade fix, via `elementFromPoint` at the account chip's own coordinates.
- **"Generic lesion..." vs "MAGNETISATION" on `/mri-lab/laboratory`** — looked like real overlapping text in a screenshot. Traced via `elementFromPoint` at the exact screen coordinates: the "Generic lesion at 10 milliseconds: longitudinal..." text is `.mri-sr-only` — a correctly-implemented screen-reader-only element (`1px×1px`, `clip: rect(0,0,0,0)`), not rendered on screen at all. What looked like an overlap in the screenshot was a misreading of unrelated, correctly-positioned nearby text.

## Anatomy — reviewed clean (source-level, live testing still blocked)
- `ImageViewer.css` — marker/arrow positions are percentages within a JS-computed image content box, not viewport pixels; `container-type: inline-size` for label text sizing. Already the "normalised coordinates" architecture generally recommended for responsive image annotation — directly relevant groundwork for the authoring-tool phase.
- `ScanVolume.css` — DICOM corner-overlay labels already drop two of four corners at the breakpoint where they'd collide with copy. Already handled.
- `QuestionPlayer.css` — `flex:1; min-height:0` + `overflow-y:auto` on mobile is the correct pattern for unbounded content (long question stems) in a fixed-height container. Flagged unverified-but-plausibly-fine; not touched without live evidence of an actual problem.

## Major finding for the authoring-tool phase (not a QA item, but discovered during this pass)
An in-app "Custom Case Editor" already exists at `/section/:sectionId/custom` (`CustomCaseEditor.tsx`) — image upload, click-to-place arrow markers (SVG leader lines, badge offset off the structure), persistence to `localStorage` + image blobs in IndexedDB, reuses the real question-player as its preview. Uses **free-text answers** graded against `acceptedVariants` (the same engine behind all 500+ existing questions, per `grading.ts`), not multiple-choice A/B/C/D/E. The requested authoring-tool feature set (real crop tool, draggable/rotatable/resizable arrows, Question Bank/Mock destination assignment) should extend this, not fork a parallel MCQ system — flagged to the user, proceeding on that basis pending any correction.

## Remaining / next
- Get anatomy access resolved (gate lifted, or explicit go-ahead to stay source-review-only) to actually verify the header-offset fix and everything else live.
- Second full regression pass per the QA loop across all 65 physics routes, now that 6 fixes are deployed.
- Admin anatomy question-authoring tool: not yet started (sequenced after this QA pass; major architectural note above needs the user's sign-off or correction before building).
- User's original "progress doesn't save" report: observability shipped, root cause not confirmed — needs the user to check the new sync-warning indicator or console next time it happens, since I can't get a real authenticated test session without their credentials (which I should never ask for).
