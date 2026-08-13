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

---

# Appendix A — the 30 commits, with their reasoning

## Fix the question bank bar on a phone, and the specificity that hid the bug
_2026-08-13_

At 390px the bar carried the wordmark, a scrolling subject list, "Log in to
sync progress" and "Open the labs". The two calls to action squeezed the
wordmark until it was CLIPPED MID-WORD — the page read "ADIOPASS" — and the
account prompt ellipsized to "n to sync prog", which is worse than not showing
it at all. The document also scrolled sideways: 407px of content in a 390px
screen.

Both calls to action are hidden below 560px. Neither is lost — the labs are
one tap from the branch home and the account prompt lives in the site header
and on both branch homes — and what remains is what the bar is for: who you
are, where you are, and the subjects.

THE SPECIFICITY, which cost two attempts and is the real lesson. touch.css is
imported last on purpose so coarse-pointer rules win, and it contains
`.qb-nav a { display: inline-flex }`. That selector scores 0-1-1 and outranks a
bare `.qb-nav-cta` at 0-1-0, so on any touch device the button came straight
back however many times it was hidden. Twice I "fixed" it, watched the
computed style still say flex, and assumed HMR staleness — the CSSOM said
otherwise. Scoping through the parent scores 0-2-0 and settles it.

Verified at 390x844 on a freshly started server: both controls display:none,
"RADIOPASS" intact, no horizontal overflow. / , /anatomy, /physics,
/free-trial and /anatomy/atlas were already clean at that width.

typecheck clean; 191 tests; 510 questions / 2,279 labels unchanged; 508
questions 0 errors; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## One display voice, and branch context in the labs
_2026-08-13_

THE TYPEFACES WERE DECLARED THREE TIMES — --pt-serif/--pt-sans/--pt-mono on
the master homepage, --font-display/--font-mono in anatomy, and bare 'Inter'
literals through the physics stylesheet. So the same product announced itself
in a different voice depending which surface you stood on: the master page and
anatomy set their headings in Fraunces while /physics and /free-trial used
Inter. That is precisely the tell that says "two websites", and it survived
the physical merge because the merge joined the code, not the design.

The three voices now live once, in tokens.css. The master homepage aliases
onto them and is visually unchanged; the two branch homes and the trial take
the display face, so /, /anatomy, /physics and /free-trial finally announce
themselves the same way. Layouts stay different, because anatomy is
image-led and physics is destination-led — same grammar, not same template.

BRANCH CONTEXT IN THE LABS. The ultrasound laboratory named itself but not the
branch, so a learner three experiments deep had no way back to Physics and
nothing saying which half of the exam they were in. Its bar now carries

    RadioPass › Physics › Simulator labs

which is the brief's own example, and the same component the question bank
uses. Hidden below 900px, where the lab name alone is enough.

Verified in the browser: /physics and /free-trial now render their headings in
the display face; /ultrasound-lab/doppler shows the full trail; /anatomy/atlas
renders with the anatomy branch nav; no horizontal overflow on any of the six
surfaces checked.

typecheck clean; 191 tests; 510 questions / 2,279 labels unchanged; 508
questions 0 errors; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Branch context everywhere, and nine anatomy links that still 404'd
_2026-08-13_

BRANCH CONTEXT. A learner deep in the question bank could not tell which half
of the exam they were in: the bar carried the wordmark alone, and its only way
out went to the master homepage rather than back to Physics. One shared
Breadcrumb component now reads

    RadioPass › Physics › Question bank
    RadioPass › Anatomy › Atlas › Thorax

for both branches, because the point is that they are one product. It is
deliberately quiet — orientation, not furniture — and the last crumb is the
page you are on, not a link.

NINE UNPREFIXED LINKS. The merge's route sweep matched literal strings and the
simplest template form; these were ternaries, object fields and nested
templates, and every one of them was a 404 a learner could reach by clicking:

  Atlas lightbox   -> the question a film came from
  Film legend      -> a related structure
  Atlas studies    -> the scrolling MRI viewer, and the chest atlas
  Atlas chapter    -> its own breadcrumb, and the source question
  Anatomy home     -> Resume, and the first-section fallback
  Section hub      -> the chapter's Atlas page
  Atlas structure  -> the not-found fallback

Verified by walking /anatomy/atlas/thorax in the browser: 70 links on the
page, zero unprefixed. Image paths were deliberately left alone — they resolve
through assetUrl(), and rewriting them would be rewriting protected data.

ONE DEFAULT TITLE. Seven surfaces restored "RadioPass — FRCR Part 1 Physics,
Made Visual" on unmount, so leaving a lab or the bank left "Physics" in the
tab while an anatomy page was on screen. All seven now restore the product
title the document already declares.

typecheck clean; 191 tests; anatomy:verify exit 0; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Fact bank finds its level; the trial's empty state stops looking broken
_2026-08-13_

PHYSICS. The fact bank, the ultrasound facts, the two recovered scroll scenes
and the six-week plan now sit in a quiet secondary row beneath the five
destinations. They were either absent from the page or would have had to
become a sixth and seventh card, which would have said the branch has seven
equal parts when it has five.

FREE TRIAL. The unconfigured state was a dashed box reading "Free anatomy
content is being chosen" — accurate, and shaped exactly like a tile that
failed to load. It now wears the same clothes as the configured state: the
same rows, the same rhythm, the kinds a trial can hold (question bank,
learning material, mock exams) each marked "Selection pending". The page reads
as a decision not yet taken rather than a page not yet finished, and it will
become the real list by configuration alone.

Still no trial content chosen, and TRIAL is still empty.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Write the learner events that were only ever declared
_2026-08-13_

The event model defined module, lab and question events; only mocks and
anatomy answers had writers. Three more now exist, and each one is emitted at
a point where the event genuinely means something.

MODULE STARTED fires when a learner enters a lesson, not when they land on its
intro screen. MODULE COMPLETED fires only on reaching the finish screen, which
is the one point in this player where "completed" is unambiguous: every
concept has been stepped through. Nothing is emitted for scrolling past,
deep-linking to a step, or closing the tab part way — a completion that can be
earned by accident is worse than no completion at all.

Lab "completed" is still NOT written, because it still has no honest
definition: a simulator has no end. lab.opened stays in the model for when one
does.

QUESTION ANSWERED is recorded inside recordQbScore, alongside the write it
already made and guarded by the same first-submission rule, so revisiting a
question never records a second attempt. The topic travels with it, so the
timeline can name the subject rather than only an id.

CONTINUE ON /physics now reads the timeline as well as the progress store, and
picks whichever is genuinely more recent. A lesson opened but not answered in
leaves no trace in the progress store at all, so before this a learner who
spent an evening in the MRI module was offered "continue" pointing at a
question bank they had not touched that day. Modules completed joins the stats
row when there are any.

Also corrected a docstring that the merge had made false: learner.ts still
described itself as mirrored into a separate anatomy build. One module now,
imported by both branches.

Split the module.* and lab.* union members while wiring this: Extract<> cannot
narrow a member whose `type` is itself a union, so lastOfType('module.started')
resolved to never and lost contentId.

typecheck clean; 191 tests; anatomy:verify exit 0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## The master homepage links into anatomy internally, with no page reload
_2026-08-13_

The portal still minted /anatomy/#/ links — the hash form from when anatomy
was a separate deployment. They resolved, because AnatomyRoutes redirects old
bookmarks, but every one of them was a plain <a> that reloaded the whole
application to reach a route it already contained. The seam was invisible in a
status code and obvious the moment you clicked one.

The ANATOMY_URL helper and its VITE_ANATOMY_URL override are gone; anatomy() now
returns an ordinary internal path, and the five call sites — nav, hero, both
plates and the closing call to action — are <Link>s. The legacy redirect stays
for links already in the wild; nothing in the product mints that form any more.

Verified in the browser: every anatomy link on / is now "/anatomy", clicking a
plate lands on /anatomy with the anatomy subtree rendered, and the navigation
entry count is unchanged — client-side, no reload.

typecheck clean; 191 tests; anatomy:verify 510 questions / 2,279 labels
unchanged; questions:validate 508 questions 0 errors; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Retire the old anatomy app shell; keep the evidence it was holding
_2026-08-13_

The merged application is proven — every route, the editor, the Atlas
projection, the integrity gate and both mock journeys — so the second
buildable copy goes. Keeping one is how two applications drift apart.

Removed: index.html, vite.config.ts, the three tsconfigs, package.json and
its lockfile, .oxlintrc, deno.lock, the launch config, the duplicate favicon,
the old dev-server, and src/{App,main,index,App}.{tsx,css} — the entry files
whose job AnatomyRoutes.tsx now does.

DELIBERATELY KEPT, and the README now says why: qa/copyright (the image
provenance audit — evidence, and a decision the owner has not made),
qa/duplicates, tools/ (the Python skull-frame pipeline), source-material/,
the Netlify edge gate, and DEPLOY.md, which is still accurate for server/.
Nothing there is built, imported or served.

build-hero-frames.mjs came across with the merge and still pointed at the old
layout; repointed at public/anatomy/images/hero and src/anatomy/data. Verified
by running it: 480x10, 720x10, poster ok, chest ok.

Also fixed while walking Journey C: a mock resumed after a reload was filed in
the history as "Built paper" even when it was RadioPass Paper 1. The component
remounts on reload with fresh refs, and the saved attempt did not carry its
own name — so the score was right and its label was wrong, which is worse than
useless when comparing attempts. SavedAttempt now carries attemptId and paper,
optional so an attempt saved before this change still restores.

Verified: Paper 2 started, answered, reloaded, submitted — recorded as
"RadioPass Paper 2" and listed in "Papers you have sat" with score, percentage
and date.

typecheck clean; 191 tests; anatomy:verify exit 0; npm run package produces one
41.6 MB tree from one build.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Close the sign-out leak the merge opened, and fix a 110% score
_2026-08-13_

THE PRIVACY REGRESSION. Sign-out cleared three keys. Anatomy contributes
eleven more, and before the merge that was fine — anatomy was a separate build
with no account, so there was no boundary for its state to cross. There is one
now, and the next candidate at a shared computer would have inherited the
previous one's anatomy answers and marks, appealed marks, place in each
region, days studied, quiz scores, their own drawing on the chest films and
the cross-sectional stacks, plus the editor unlock and one author's unpublished
overrides.

All eleven now clear. Theme and the published content cache deliberately do
not: they describe the device, not the account.

The list moved to its own module so the sign-out path and the test that guards
it read the SAME array. The first version of that test scraped auth.tsx with a
regex — a guard that can pass while the real list is wrong. Three tests now
assert the actual exported list, including that device preferences are absent.

TWO DEFECTS FOUND BY WALKING THE JOURNEY, not by testing.

  * Continue on /anatomy pointed at /section/spine/q/… with no /anatomy
    prefix — a 404. The route-prefixing sweep matched literal strings but not
    this one, which is built from a template with a variable. Swept again for
    the template form; this was the only one.
  * The anatomy scoreband printed 110%. maxScore covers every question in a
    section while rawScore only accumulates the attempted ones, and the home
    page bridged that with a pro-rata guess (maxScore x attempted / total). A
    question carrying more labels than the section average therefore scored
    above its own share. SectionStats now reports attemptedMaxScore, summed
    from the marking that actually ran, so accuracy has a real denominator.
    The same sitting now reads 100%.

Journey A verified end to end on the merged app: open a spine question, answer
all five labels, score 10/10 under the 0/1/2 scheme, one question.answered
event recorded, return to /anatomy and find Continue -> Spine ->
/anatomy/section/spine/q/spine-p0004 with the scoreband reading 100% and
1/508 answered.

191 tests; tsc, build, anatomy:verify all clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Scope every anatomy stylesheet, and fix the header the merge broke
_2026-08-13_

THE BUG VISUAL INSPECTION CAUGHT AND TESTS DID NOT. On /anatomy the wordmark
was crushed to zero width and the header actions overflowed the container by
97px. The cause was one-directional CSS leakage the first scoping pass missed:
index.css was scoped, but the twenty COMPONENT stylesheets were not, and 26
class names collided between the two halves.

Eleven of those were physics rules general enough to match inside anatomy —
.brand, .brand-mark, .eyebrow, .account-chip, .hero-actions, .hm-hero-copy and
five .mri-* viewer classes. Physics's .brand-mark is a 29px circle; applied to
anatomy's text wordmark it collapsed it. Scoping anatomy alone could not fix
that, because the leak ran the other way.

Fixed at source, in two parts:

  * all 20 remaining anatomy stylesheets scoped under .rp-anatomy, so anatomy
    can never reach out;
  * the 13 anatomy class names that collide with physics GLOBAL rules renamed
    to rpa-*, so physics can never reach in. Zero leaks remain, verified by
    re-running the same analysis.

THE HEADER. Thirteen nav items plus the brand and the account controls did not
fit 1280px, and flex resolved that by crushing the brand. Trimmed to the same
shape physics uses — the two branches, this branch's four destinations, the
trial — and .rpa-brand is now flex:none so a crowded bar can never do that
again. The cross-sectional viewers and the disputes list moved to the anatomy
home as a quiet secondary row rather than being lost.

The brand's "Anatomy" sub-label is gone too: since the nav gained real branch
links it printed the same word twice and physically overlapped the Anatomy
link 34px to its right. Which branch you are in is the nav's job, and it marks
it as current.

Verified at 1280x860 and 375x812: no horizontal overflow, brand 159px and not
overlapped, actions inside the container, nine nav items.

anatomy:verify and questions:validate both exit 0; 188 tests; tsc and build
clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## One build, one deployment — and fix the rewrite that would have 404'd anatomy
_2026-08-13_

PACKAGING. scripts/package.mjs compiled two applications and copied the second
into deploy/anatomy/. There is one application now: /anatomy is an ordinary
route, its media ships through public/anatomy/ like any other asset, and the
stitching step is gone along with the index.html relativising hack that
existed only because the anatomy build used a relative base.

npm run package now runs one typecheck and one build: deploy/ is 41.5 MB with
34.8 MB of anatomy media, and there is deliberately NO deploy/anatomy/
index.html — /anatomy must reach the app shell, not a second shell.

THE DEPLOYMENT BUG THIS UNCOVERED, which no test would have caught. public/
.htaccess carried:

    RewriteRule ^anatomy(/.*)?$ - [L]

"anything under /anatomy: stop rewriting, serve as-is" — correct when anatomy
was a separate app with its own index.html, and fatal after the merge. Every
anatomy deep link on the live host would have 404'd: /anatomy/atlas is a route
now, not a file. The second condition was wrong too — it tested !-d, and
public/anatomy IS a real directory, so a bare /anatomy would have been served
as a directory rather than handed to the router.

Both replaced by the rule a single-page app actually wants: anything that is
not a real FILE goes to the shell. Real assets — assets/, visuals/*.html,
anatomy/images/* — are files and are served before that rule is reached.
Verified: /anatomy/images/spine/p0004.webp serves 200 from the packaged tree
and no ^anatomy exclusion remains.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Unify auth and the dev server; bring the anatomy content API across intact
_2026-08-13_

ONE ACCOUNT. Anatomy could not see the signed-in learner before the merge —
it was a separate build — so its header could only ever talk about "this
browser". It now reads the one RadioPass session: the menu shows the signed-in
email, offers Sign in or Sign out, and says progress follows the account
between devices. One sign-in, one sign-out, both branches. The study numbers
below it were always real and are unchanged; what is new is that the app can
say WHOSE they are.

THE DEV SERVER WAS SERVING TWO DIFFERENT ANATOMIES. vite.config.ts carried a
`serveAnatomyDist` middleware from the split era that intercepted every
/anatomy request and served the old standalone build's dist/ as static files.
After the merge it did not merely go stale — it shadowed the real routes, so a
HARD LOAD of /anatomy returned the old build while client-side navigation
reached the new one. Two anatomies depending on how you arrived, and the kind
of fault that survives a test suite untouched. Deleted.

Found the other half of the CSS scoping contract at the same time: anatomy.css
places every rule under `.rp-anatomy`, and nothing was rendering that class,
so anatomy pages came up with none of their own styling. AnatomyRoutes now
wraps the subtree.

THE CONTENT API IS PRESERVED, NOT MIGRATED. server/ and its Vite middleware
move into the application unchanged and are mounted on the merged dev server,
so the authoring paths are exercised in development against the same handler
production runs rather than first meeting reality on the live site. Per the
brief this backend is deliberately untouched — one architectural change at a
time, and the Supabase question is a separate decision.

Verified on the running merged app: /api/content responds 200 with the real
overlay document; a hard load of /anatomy renders the scoped page with its own
ground (#0B0D10), the unified Anatomy/Physics nav and the four destinations;
images resolve through the new prefix (/anatomy/images/hero/skull/poster.webp
-> 200); and eleven routes across both branches all return 200.

anatomy:verify exit 0; 188 tests; tsc and build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Merge anatomy into the application: one React root, one router
_2026-08-13_

RadioPass is one application. The anatomy tree — 94 source files, 755 media
files — now lives at radiopass-website/src/anatomy and public/anatomy, mounted
at /anatomy/* inside the application's own BrowserRouter.

PROTECTED CONTENT SURVIVED INTACT. anatomy:verify after the move: 510
questions, 2,279 labels, every existing mapping unchanged. Not one question id,
image association, label letter, answer, variant or laterality flag was
touched — the files moved with `git mv` and the validators moved with them, so
the gate ran against the merged tree and passed on the first attempt.

THE PATHS DID NOT MOVE, THE RESOLVER DID. Anatomy data holds 510 records of
root-absolute image paths ("/images/…", "/cxr/…"). Rewriting them would have
been rewriting protected content, so assetUrl() absorbs the new /anatomy media
prefix instead — one function, no data touched. It already existed to absorb
root/subdomain/subfolder deployment differences, so this cost nothing.

CSS IS SCOPED, NOT MERGED. The two halves each declared variables on :root and
EIGHT collided by name — --accent, --line, --border, --radius-sm, --radius-lg,
--shadow, --shadow-lg, --bg-elevated. Sharing one document would have silently
repainted physics with anatomy's values, decided by load order. Anatomy's
stylesheet is regenerated with every selector under `.rp-anatomy`; its
appearance is unchanged and it cannot escape its subtree. The document-shell
rules are dropped (the application owns those) and `body` becomes the wrapper,
so the anatomy ground still paints behind anatomy pages.

OLD LINKS STILL WORK. Every anatomy address ever shared was /anatomy/#/… from
the hash router, and those are in bookmarks and messages between candidates.
LegacyHashRedirect rewrites them to real paths before the routes are matched.

DUPLICATION DELETED, not merely deprecated: the mirrored learner.ts (the two
copies that had to change together), the PHYSICS_URL helper, and the Crossing
redirect page. Cross-branch links are now internal <Link>s — anatomy's header
routes to /physics and /free-trial directly, with no page reload and no seam.

CODE-SPLITTING PRESERVED. The lazy boundaries were chosen with care and are
kept exactly: Home, SectionHub and QuestionPlayer stay eager because they are
the path to answering a question; the Atlas, viewers, scout and authoring
suite load on demand. The application's entry chunk grew 277.94 kB -> 279.83
kB — under 2 kB — while the anatomy data (1,035 kB) and grader (373 kB) sit in
their own lazily-fetched chunks.

The anatomy Node content API is deliberately untouched, per the brief: one
frontend architecture first, no simultaneous backend migration.

tsc clean; 188 tests; build clean; anatomy:verify and questions:validate both
exit 0.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Trim the primary bar: no duplicate trial entry, no wrapping
_2026-08-13_

Found by looking at the running page rather than by testing. Two defects in
the nav that had just been unified:

  * "Free trial" appeared TWICE — once as a nav link and once as the "Start
    free trial" button immediately beside it. The button is louder and belongs
    to the account group, so the duplicate link goes. The trial is still
    reachable from the bar on both branches, and from the master homepage.
  * With eight items plus the brand and two account controls, the links wrapped
    onto a second line at 1280px and read as a cramped mosaic.

Fact bank also leaves the primary bar. It is a physics resource rather than a
peer of the four learner destinations, it is one click from /physics, and the
brief is explicit that it should not compete with the branch architecture. The
route is untouched and still linked.

What is left reads as one line and one hierarchy:

    RadioPass | Anatomy · Physics ‖ Modules · Question bank · Mock exams ·
    Simulator labs | Log in · Start free trial

Verified at 1280x860 (single line, no wrap) and 375x812 (no horizontal
overflow). 188 tests; tsc and build clean; nine routes 200.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Survey what an anatomy merge would take, without starting it
_2026-08-13_

Written while making the two builds behave as one product, so it reflects what
the split actually costs rather than what it looks like from outside.

The verdict: mostly technical debt, with two genuine functional limits. The
first is the one that matters — anatomy cannot see the signed-in account, so
it cannot sync progress to Supabase, cannot show account state and cannot
enforce an anatomy entitlement. Early access hides that today because
everything is granted; it stops being hidden the day anatomy-only or trial
access is sold. The second is that two headers and two token sets will drift
again without shared source.

Recommendation: merge before selling anatomy-only or trial access, and not
before. Learner-facing coherence is already solved without it, so the trigger
should be the entitlement requirement, not tidiness.

Covers routes (and the /dashboard and /admin collisions that make the
/anatomy prefix mandatory, not cosmetic), imports, the content API decision
that is the biggest structural question in the merge, image paths and the
one-line assetUrl change, persistence (which merges for free — same origin,
already namespaced, no learner loses progress), auth and entitlement, build
config, protected data, and tests.

Includes a suggested order where every step is independently revertible and
anatomy:verify stays green throughout, and states plainly that the baseline
must never be re-recorded to make a failing merge pass.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## One navigation language, so the two builds stop reading as two websites
_2026-08-13_

The headers shared nothing. Physics listed six of its own tools — Learn,
Practise, Mock Exams, Fact Bank, Study Plan, Pricing — as if they were the
product's top level, and carried NO link to anatomy at all: a learner inside
physics could not reach the other half of the exam from the header. Anatomy
listed nine of its own and a "Physics ↗" that read like leaving the site.

Both now read the way the product is shaped:

    Anatomy · Physics  |  this branch's tools  |  Free trial

The first group and the trial entry are identical on both sides; only the
middle group differs, which is the honest difference — anatomy's tools are
Atlas, Scout and the regions; physics' are modules, labs and the fact bank.
Dividers carry the hierarchy so eight links do not read as one flat list of
equals, and no second row is needed.

Physics gains its missing Anatomy link and drops Study Plan and Pricing from
the primary bar (both remain routed and reachable; neither is a place a
learner goes mid-session). Anatomy's "Modules" is renamed "Question bank",
which is what it actually opens.

That anatomy is a separate Vite build is now purely an implementation detail:
the cross-branch links are plain <a> elements resolved the same way Crossing
already resolves them — '/anatomy' when both halves share a domain, overridable
for split hosting — so the learner never sees a seam.

Verified in the running anatomy app: Anatomy (marked as current) · Physics ‖
Question bank · Atlas · Scout · X-ray · CT · MRI · Progress · Disputes ‖ Free
trial, with two dividers.

anatomy:verify — every existing mapping unchanged. Both apps tsc clean and
build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## /anatomy becomes a learner home: one next action, four destinations
_2026-08-13_

Built on the /physics precedent architecturally, NOT cloned visually. Anatomy
is image-centred, so the skull hero and the region worklist stay exactly as
they are and carry the page; what was missing was the learner-home spine
around them.

WHAT WAS ALREADY REAL AND IS UNTOUCHED: the scoreband (your score across what
you have answered, questions answered of the bank, bank complete) and the
per-region worklist with attempted/total, score and completion. Those were
already honest and already the reader's own work.

WHAT IS ADDED, all from real data:

  * ONE OBVIOUS NEXT ACTION. Continue names the region and links to the exact
    case — taken from the shared learner timeline, not guessed. The most recent
    answered question gives the region; getLastQuestion gives the case. With no
    history there is NO Continue at all, because "start with the spine" would
    be a recommendation nobody made.
  * THE FOUR DESTINATIONS. Structure Atlas, Question bank (pointing at the
    regions already on the page rather than duplicating them), Mock exams and
    Progress & revision — the last carrying the real flagged count when there
    is one.
  * Mock exams says "Timed anatomy papers are not built yet", because none
    exist. Inventing a paper to fill the row would be worse than the gap.

THE SHARED TIMELINE REACHES ANATOMY. src/lib/learner.ts is mirrored here —
same key, same schema, same version as the physics copy. The two builds cannot
import from each other but share an origin in the packaged deployment, so they
share localStorage: one timeline, two writers, each able to read the other's
events. The schema version is how a mismatch is caught rather than silently
corrupting the log, and this duplication is the clearest thing the eventual
physical merge deletes.

QuestionPlayer now records question.answered alongside its existing save. The
progress store already knew the question was answered and what it scored; what
it could not say is WHEN, or in which branch — which is exactly what Continue
needs. Written alongside, never instead: frcr-anatomy-progress-v1 is untouched.

Verified in the browser: with no history the four destinations render with
real counts (508 labelled cases) and no Continue; after one recorded answer
Continue reads "Spine" and links to #/section/spine/q/spine-p0004.

anatomy:verify — every existing mapping unchanged. tsc clean; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## A learner event log, and mock papers that leave a trace
_2026-08-13_

WHAT WAS MISSING. The existing stores answer "what is the current state?"
well — which questions are answered, what was scored, which labs were opened.
None of them can answer "what happened, and when?", so there was no attempt
history, no module completion, and no way to compare one mock to the next.

Most sharply: a completed mock left NO trace anywhere. The attempt store holds
one in-flight sitting and clears it on submission, so score, date and
breakdown all vanished the moment the learner navigated away from the review
screen. src/lib/learner.ts is the first place a finished paper has ever been
written down.

ADDITIVE, NOT A MIGRATION. Nothing is moved, reset or rewritten. The existing
progress stores remain the source of truth for the state they already hold;
this is an append-only record alongside them, and with an empty log the app
behaves exactly as before. A test asserts that recording an event leaves both
the physics and anatomy progress stores byte-identical.

The model covers what the brief asked for: question viewed / answered /
flagged, structure encountered with its chapter, module started and completed,
lab opened and completed, mock started and completed with per-topic marks —
each carrying a timestamp, a content id and its subject. Anatomy scores 0/1/2
per label and physics one per stem, and `correct`/`outOf` holds both without a
second shape.

Mock submission now records the paper, its score, how much was attempted and
the marks by topic. "Papers you have sat" appears on the mock setup screen —
absent entirely until there is one, and every row a paper this learner really
finished. Attempt-to-attempt comparison is derivable today; the test proves it.

ENTITLEMENT IS NOT INVOLVED. A trial learner, an anatomy-only learner and a
full subscriber all write here identically. Access decides what may be opened,
this records what was done, and keeping them apart is why a learner who
upgrades keeps their history.

SHARED WITH ANATOMY BY KEY, NOT BY IMPORT. Anatomy is still a separate Vite
build and cannot import this module; both halves share an origin in the
packaged deployment, so they share localStorage. The schema version is how a
mismatch is caught — events at another version are kept on disk but ignored on
read, so a rollback cannot lose data. That mirrored copy is the one thing the
eventual merge deletes.

Defensive on every read, because two builds write it: malformed JSON, a
non-array, null entries and foreign schema versions all yield an empty list
rather than throwing inside a render. Bounded at 4000 events so history can
never crowd out the progress stores, which matter more.

Cleared on sign-out with the rest of the learner state.

12 new tests. tsc clean; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## /physics becomes the learner's home; the cinematic page moves to /physics/tour
_2026-08-13_

A candidate who has already chosen physics does not need to be sold physics.
/physics rendered the cinematic landing page — beautiful, and the wrong thing
to meet on your fourth visit. It now answers the three questions a learner
actually arrives with: where was I, how am I doing, what do I open next.

The cinematic page is not destroyed. It keeps its own navigation and canvas
scenes and moves to /physics/tour, linked from the foot of the learner home.

EVERY NUMBER IS REAL. The question total comes from the bank, attempts and
accuracy from the candidate's own submitted answers, the laboratory count from
what they actually opened, and Continue resolves the most recent submittedAt
back to its subject. Verified with a seeded record: 3 of 467 answered, "75% —
9 of 12 statements correct" (4+2+3 of 5+2+5, exact), 1 flagged, 2 laboratories,
and Continue -> Computed Tomography -> /question-bank/ct, which is the subject
of the newest attempt.

With no activity the page says "Nothing recorded yet" and offers one first
step. No fabricated week, no sample task list, no 0% ring dressed as a record.

Two things are deliberately absent rather than faked, and are in the report:
mock performance, because finished papers are still not recorded anywhere; and
any single "exam readiness" figure, which would need a defensible methodology
and has none.

Five destinations as a list rather than a grid of cards — Learning modules,
Question bank, Mock exams, Simulator labs, Progress & revision. Structure and
space carry the hierarchy; there is no card inside a card inside a panel.

Three integration fixes found by looking at the running page:
  * /physics was in hasOwnChrome() because the cinematic page brought its own
    nav. The learner home needs the shared header — a learner home with no way
    out is a dead end. /physics/tour takes its place in that list.
  * both new pages sat under the fixed 78px header. They now clear it using
    the same calc(78px + …) convention .page-hero already uses.
  * the header's "Start free trial" pointed at /pricing. There is a trial now.

tsc clean; 176 tests across 9 files; build clean; /, /free-trial, /physics,
/physics/tour, /question-bank, /question-bank/mock and /visual-lab all 200.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## One entitlement model, and a free trial that is an access mode not a website
_2026-08-13_

THE ACCESS MODEL (src/lib/access.ts). One module answers "who may open what"
for the whole product. Routes ask canAccess(); none invents its own rule, and
there is no `if (trial)` anywhere in a page.

Entitlement is a SET OF GRANTS, not a tier — account, trial, anatomy, physics,
full, admin. A single ladder ('trial' < 'pro' < 'admin') breaks the moment
anatomy-only access exists; grants compose instead, so someone can hold
anatomy and trial, or full alone. Two ideas are kept apart deliberately:
entitlement is what a person has been GRANTED, learner state is what they have
DONE. A trial learner and a subscriber write to the same progress stores; only
what they can open differs. Nothing here knows about any payment provider — an
entitlement is a fact about the user, and where it came from is the granting
layer's business.

src/lib/entitlement.tsx is the one place the account system meets that model,
and the one file a payment provider will later teach to read real grants.
Today a signed-in account carries `full`, which is not an accident: the
pricing page says every lab, the full bank and all three mocks are free in
early access, and this is the honest expression of that promise. It is a
one-line change when that ends.

THE FREE TRIAL. /free-trial exists and renders no trial content of its own —
no duplicate atlas, no second question bank, no trial-only copy of a lab. What
the trial includes is one configuration object, and that object is EMPTY,
because the owner has not chosen and inventing "20 free questions" would
present a guess as a product decision.

So the page has two honest states and flips between them on its own: with
nothing configured it says the selection is being prepared and offers the two
branch homes, which are open to everyone anyway; configured, it lists what the
configuration actually frees. Filling it in later is a change to that one
object — no route, no component, no page.

On the master homepage the trial is deliberately NOT a third plate. It is a
rule-topped line beneath the two branch doors — no figure, no viewport, no
numeral — because the plates ask "which subject?" and the trial asks something
else. It also joins the master navigation, after both branches.

21 access tests cover the brief's six scenarios: anonymous, trial, anatomy-only,
physics-only, full and admin. Two matter most and pull in opposite directions —
a paid resource must not be reachable by typing its URL, and an entitled
learner must never be blocked by trial logic. The second is the one that
quietly loses customers, so it is asserted explicitly.

TWO REAL RESPONSIVE BUGS, found by looking rather than by testing.

  * --fs-hero floored at 40px, set for a 375px screen. At 320px the word
    "RadioPass" alone measured 288px and the document scrolled sideways. The
    display floors now fit the narrowest supported phone; the upper end and
    growth rate are untouched, so nothing at tablet size or above moves.
  * `repeat(auto-fit, minmax(min(100%, 20rem), 1fr))` looks safe and is not:
    the percentage cannot resolve during intrinsic sizing, so the 20rem floor
    wins and forces the page to 320px. Single column below 640px.

Verified at 375x812: no horizontal overflow, both branches render their
pending state, zero invented cards. tsc clean; 176 tests across 9 files; build
clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Remove the hardcoded author passcode from both client bundles
_2026-08-13_

Both apps carried the same author passcode as a literal in source: a fallback
in the anatomy app's admin.ts and a plain constant in the physics Admin.tsx.
That put a production access code in the repository and, more seriously,
inside the JavaScript bundle shipped to every visitor — readable by anyone who
opened devtools on the live site.

A default is worse than no value here. It is a known credential that unlocks
every deployment which forgot to set the real one, and both apps had exactly
that arrangement.

Both now read VITE_ADMIN_PASSCODE with NO fallback. Unset, the local unlock is
unavailable and says so, which is the safe failure. It costs little: this gate
only governs what the INTERFACE offers. The anatomy content API re-checks a
server session for every write — ATLAS_ADMIN_PASSWORD, held in the deployment
environment and never sent to a browser — and no amount of localStorage
produces a valid token.

The FNV-1a "weak hash" and its stored digest are deleted too. They existed
only to keep the default passcode from appearing in the bundle as a readable
string; with no default there is nothing to obfuscate, and keeping a
hand-rolled hash around invites someone to mistake it for a security control.

Verified: the string appears nowhere in either source tree, and nowhere in the
freshly built anatomy dist/. No .env file is tracked in git.

The previously exposed code should be treated as compromised and rotated
before launch — it has been in a client bundle and in git history.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Protect anatomy label-to-answer mappings, and stop re-lettering on deletion
_2026-08-13_

The owner has manually checked every anatomy image against its labels and
declared the mapping correct. It is protected data: question id -> image ->
label letter -> anatomical answer -> laterality. No migration, refactor,
cleanup or inference may alter it as a side effect.

THE INTEGRITY LOCK, added first, before anything else changed.

  npm run anatomy:baseline    record the mapping
  npm run anatomy:verify      fail if any of it moved

Baseline recorded: 510 questions, 2,279 labels. The check compares BY LETTER,
not by position — a positional comparison would find every pair "equal" one
row apart if the answers had shifted up after a deletion, which is the exact
failure being guarded. Image path, letters in order, official answer,
laterality and accepted variants are all in scope. Marker coordinates, badges,
shapes, colours, crops, orientation and teaching text are deliberately NOT:
moving an arrow is allowed, changing what the arrow means is not.

Proven, not assumed. The forbidden change was applied to spine-p0004 — delete
B, slide C,D,E up into B,C,D — and the guard failed with exit 1, naming each
migrated answer individually ("B: was Vertebral body of C6, now Spinous
process of C4"). The file was then restored from git and the guard passes.

THE BEHAVIOUR THAT MADE IT NECESSARY.

reletter() renumbered the whole answer list from A on every change, so
deleting B slid C, D and E up into B, C and D. A candidate previously asked to
name the structure at C was afterwards asked to name it at B. The letters are
not an index into a list — they are printed on the film.

reletter() is replaced by nextFreeLetter(). Deleting a label now filters and
nothing else, so the survivors keep their own letters. Adding one takes the
lowest unused letter, and the record is created with no answer text and cannot
be saved until it is named, so it can never inherit the meaning the letter
used to carry.

Verified in the browser against the brief's own example. Removing B and D from

    A = Anterior arch of the atlas   B = Vertebral body of C6
    C = Spinous process of C4        D = C3-C4 facet joint
    E = Hyoid bone

leaves exactly A, C, E with their answers untouched, and adding a label then
takes B — empty, awaiting a name.

The validator follows the same policy: a gap is no longer reported at all,
because "A, C, E" is now a correct outcome of a deliberate deletion rather
than something to confirm. Letters out of ASCENDING order remain an error,
since that would be a real defect.

tsc clean; questions:validate 508 questions 0 errors 0 warnings;
anatomy:verify every mapping unchanged; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Recover the question provenance that a migration dropped
_2026-08-13_

questions.base.json carries five keys — id, title, topic, source, stems. Its
ancestor in the archive carries nine. Four were lost, and none of them can be
regenerated from anything in the current data:

  year              which FRCR sitting the recall came from
  completeFive      whether all five statements were recovered
  visualTags        the concept binding a question to the visual that teaches it
  sourceQuestionId  the provenance pointer

Nothing else in the app records which paper a candidate was remembering. With
the archive folders gone this would have been permanent.

The join is exact and asserted rather than assumed: current `b<N>` is
historical `<N>`, all 453 rows, with identical stem counts on every one.
scripts/recover-recall-metadata.mjs hard-fails and writes nothing if a single
row cannot be confirmed. Stem TEXT is deliberately allowed to differ, because
the current bank has had genuine corrections applied since the fork — two rows
differ, and one of them is this session's own "1020mGy/min" -> "10-20 mGy/min"
fix.

Recovered: 453/453 questions. Years run 2012 (29), 2015 (15), 2019 (19), 2020
(27), 2022 (25), 2023 (32), 2024 (110), 2025 (36) and Collection (160).
completeFive is true on 201. 263 questions carry 42 distinct visual tags.

The strongest confirmation that the join was sound is in the tests: the
archive's completeFive flag and the stem count computed from TODAY's data
agree on 201 questions and on exactly the same 201 ids. Two independent
sources, one answer.

The year is now shown on the question card beside its collection — "High-yield
recall · 2025" — which is the thing a candidate most wants to know about a
recall. 'Collection' is not printed, since it names a curated set rather than
a sitting. It also makes an exam-year filter possible for the first time.

visualTags are recovered into the data but not yet resolved to routes: mapping
42 tags onto current labs is a separate job, and the point today is that the
mapping survives. Four tests pin every count so this cannot rot again.

155 tests pass across 8 files; tsc and build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Stop shipping a dead lesson manifest to users
_2026-08-13_

public/visuals/assets/site-data.js is a 8 KB manifest of 32 lessons carried
over byte-identical from the old static site. Nothing in src/ imports it, no
HTML file under public/visuals/ loads it, and its hrefs address a directory
layout this app does not have. It was downloaded by every visitor to a lesson
page and read by nothing.

Its two neighbours in the same folder are NOT dead and are kept: chart.umd.js
is loaded by xray-spectrum-simulator.html and site.css by
xray-tube-physics-canvas.html. Both were checked before this deletion rather
than assumed.

Recoverable from git if the lesson catalogue is ever rebuilt from it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Built mock papers deal complete questions only, so the score means something
_2026-08-13_

Found by comparing against the historical practice engine, which carried a
`completeFive` flag and a "Complete five-stem only" filter that the current
bank lost when the data was migrated.

The bank is 453 questions but only 201 are whole. The other 252 are partial
recalls, 166 of them carrying a single statement, because that is genuinely
all the candidate who reported them could remember. Practice is right to serve
all 453.

A paper is not practice. `start()` dealt from the raw pool, so a "40 question"
built paper was roughly 56% fragments and marked out of about 116 statements
instead of 200. It was not exam-shaped, and — worse, given the whole-paper
denominator this file gained in the last pass — two papers both described as
"40 questions" could be marked out of quite different totals depending on the
luck of the shuffle, so their percentages were not comparable to each other,
let alone to a real sitting.

Built papers now draw only from complete five-statement questions. The three
fixed RadioPass papers were already curated five-stem sets and are unchanged.

The setup screen stops rounding up too: it states what will actually be dealt
("20 questions · 100 statements · 35 minutes"), says so when a subject holds
fewer complete questions than the size asked for, and disables the button when
a subject has none rather than dealing an empty paper.

Verified in the browser: a 40-question paper was dealt and every one of the 40
ids resolves to a five-stem question — 200 statements exactly.

Three tests added: the complete pool is large enough to build a full paper
from and the fragments really are present (so the assertion is not vacuous), a
full built paper marks out of exactly 200, and all three fixed papers are 40
questions with no short ones. 151 tests pass across 8 files; tsc and build
clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Recover the missing middle third of the step-diagram set
_2026-08-13_

The X-ray lab shipped diagrams-1-5.html and diagrams-16-24.html from the
original visual set and linked the second as "the remaining step diagrams from
the original visual set". That was wrong: diagrams-6-10.html existed, was
never carried across, and five diagrams were missing.

Recovered from RadioPass-Master/site/physics/visuals/, given exactly the same
treatment its two siblings received when they were brought forward — the only
difference between the shipped and archived copies of BOTH siblings is three
stripped lines referencing the old site's shared shell (favorites.js,
radiopass-system.css, radiopass-system.js under ../../assets/). Nothing else
was re-themed, so nothing else needed re-theming here. Verified: zero
remaining references to ../../assets in the recovered file.

What comes back:

  Diagram 6   Parallel hole collimator (gamma camera)
  Diagram 7   Interaction probability against photon energy
  Diagram 8   CT dose profile and CTDI measurement
  Diagram 9   X-ray room shielding layout
  Diagram 10  Multi-detector CT geometry, with a live pitch slider

Diagram 9 is worth calling out. Primary and secondary barriers, the patient as
the scatter source and the controlled-area boundary existed in this app only
as fact-bank prose and mock-exam stems — grepping src for "primary barrier",
"secondary barrier", "occupancy factor" and "lead equivalent" returns nothing.
It is an examined topic that had no picture anywhere until now.

The diagrams-16-24 blurb is corrected to "the last of the step diagrams", which
is now true.

Verified in the browser: all five diagrams render, five SVGs, Previous Step /
Next Step / Reset on each and the pitch slider present, no console errors.
tsc clean; 148 tests pass; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Let the image editor ADD a label, not only move the ones already there
_2026-08-13_

The owner remembers an interface for adding, deleting, moving and resizing
arrows on anatomy images, repositioning arrowheads and editing labels, and
believed it had been lost. The forensic pass found it was never lost — but it
was split in half, and the more important half could not add anything.

Two admin editors exist. CustomCaseEditor (610 lines, /section/:id/custom)
builds NEW cases and has always been able to click anywhere on a film to drop
an arrow, auto-lettered A-H, with its own tip handle. ReplaceImageEditor
(1,234 lines, /section/:id/q/:qid/replace-image) is the one that touches the
501 SHIPPED questions — crop, rotate, mirror, five pointer shapes, angle, size
and thickness dials, the four permitted colours — and its stageClick began:

    if (!selected) return;

so it could only ever MOVE a label that already existed. On a real question a
label could be removed and never put back, and a replacement film showing a
sixth structure had no way to label it at all.

Nothing beneath the UI needed changing. applyEdit() already rebuilds labels,
answers, markers, badges, shapes, angles, lengths, colours and thicknesses
from whatever array of stable-id records it is handed, so an added record
travels the entire save path unaided.

  * "+ Add label" arms placement rather than adding immediately — the next
    click on the film IS the position, so the label lands where the author is
    looking instead of appearing at a default spot to be dragged afterwards.
    The stage says so, and takes a crosshair.
  * A new record gets an id that cannot collide with the ans_1..ans_n the
    question was loaded with. Identity is the whole point of this model.
  * Only labels added in this sitting get an editable wording field. Every
    answer the question shipped with stays protected, which is the promise
    this page makes at the top of its answers panel — adding a label must
    never become a back door to rewording an existing one.
  * Capped at eight, matching CustomCaseEditor's A-H.
  * Saving refuses a label with no answer text: that is a label the candidate
    can never answer and the marker can never score, and is exactly what
    validateQuestions reports as `missing-official-answer`. Better refused at
    the point of authoring than discovered by the validator later.

Verified end to end in the browser on spine-p0004: labels went A-E to A-F, the
new row was the only editable one, saving unnamed was refused with "Label F
has no answer yet" and wrote nothing, and after naming it the stored edit read

    A = Anterior arch of the atlas      D = C3-C4 facet joint
    B = Vertebral body of C6            E = Hyoid bone
    C = Spinous process of C4           F = Odontoid peg

with F's marker at 29.9%, 40.0% — the point clicked. The five original answers
are byte-identical to what shipped.

tsc clean; questions:validate 508/508 with 0 errors; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Bind questions to laboratories through a guarded registry, not a regex
_2026-08-13_

Recovered principle, not code. Three physics lineages in the archive —
RadioPass-Master, physics/, and the Cloudflare Worker builds — independently
solved the same problem of binding exam questions to the teaching asset that
explains them, and all three solved it the same way: an explicit registry
(visual-concept-registry.js) guarded by an integrity test
(question-visual-registry.test.js) that proves every entry resolves to a file
that really exists. None of them pattern-matched the question text.

The current app pattern-matched the question text. labLinkFor() was three
`if`s and a fallback, and the fallback did most of the work — only ultrasound,
MRI and CT were mapped at all. So:

  Radiography & X-ray Physics   84 questions  ->  /fact-bank
  Nuclear Medicine              70            ->  /fact-bank
  CT                            56            ->  /visual-lab#demo
  Legislation & Radiation Prot. 25            ->  /fact-bank
  Radiation Biology & Dosimetry 24            ->  /fact-bank
  Digital Imaging               21            ->  /fact-bank
  Fluoroscopy                   20            ->  /fact-bank
  Mammography                   11            ->  /fact-bank

while /xray-lab, /nm-lab, /ct-lab, /xray-lab/digital, /xray-lab/fluoroscopy
and /xray-lab/mammography sat built, routed and unmentioned. A candidate who
got a mammography question wrong was offered the fact bank; the mammography
laboratory existed and nothing pointed at it.

TOPIC_LABS now maps every topic to its own laboratory — 311 of 453 questions
gain a real destination — and labLink.test.ts makes it un-rottable:

  * every topic present in the bank has a registry entry, so a topic added to
    the data cannot silently fall through to a generic fallback;
  * every href the registry OR the ultrasound/MRI keyword tables can produce
    resolves to a route App.tsx actually declares, checked by parsing the
    router — so renaming a lab breaks the test, not a candidate's click;
  * the mock papers' own questions are checked the same way;
  * a guard-the-guard case asserts the route parser found routes at all, so
    the other assertions cannot pass vacuously.

Keyed by the topic string as it appears in the data rather than by QbTopic:
questions.base.json carries two placeholder topics the union does not declare
("Other", "Basic Physics"), and although annotations.json currently corrects
every one of them during assembly, a registry that dropped them would
reintroduce exactly the fallback-for-everything problem this replaces.

The ultrasound and MRI keyword tables are untouched and still take precedence,
so a question naming Doppler or FLAIR still lands on that experiment.

Verified in the browser: a gamma-camera question now offers "Explore this in
the Nuclear Medicine lab" pointing at /nm-lab. tsc clean; 148 tests pass
across 8 files (9 new); build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Recover the procedural CT volume engine as a scout you can travel down
_2026-08-13_

src/lib/anatomy.ts (1,767 lines) and src/components/ScanVolume.tsx (443) were
finished and then completely stranded: anatomy.ts was imported by ScanVolume
alone, and ScanVolume was imported by nothing at all. 2,210 lines of
procedural volumetric rendering that no route in the app could reach.

What was stranded is not a sketch. anatomy.ts builds a 28,000-point
radiographic body from scratch — seven regional point clouds carrying real
Hounsfield densities on a linear scale (density = 0.5 + HU/2000, water at
0.5), cortex-over-medulla falloff so bone reads as a bright rim around a
lucent centre, and fbm noise for texture. ScanVolume renders it at 60fps with
an allocation-free counting sort for depth, a key light set where a reading
-room lamp would be, and a DICOM corner overlay laid out the way a
workstation annotates a study.

It was the home-page hero. The home page has since moved to a pre-rendered
frame sequence (SkullHero / AnatomyJourney, with its own build step) and that
replacement works, so this does NOT take the hero back — two heroes competing
would regress a page that is already right.

Instead the engine gets the job it turns out to be built for. Its seven stops
are 'scout' plus SIX SECTION IDS matching the question bank exactly, and each
carries the window a radiologist would really use to read that region: Brain
WL40/WW80, Lung WL−600/WW1500, Bone WL300/WW1500, with table positions from 0
to 1620 mm. So /volume is a scout — travel down the body, watch the window
change with the region, and step into that section's questions from where you
stopped. Windowing stops being described and starts being applied to tissue
with real densities, which is the lesson.

Lazy-loaded (its own 33.8 kB chunk) because the volume builder is the largest
module in the app and must never sit on the first download. Linked from the
nav as "Scout", beside Atlas — the third way in: region first, rather than
question first or structure first.

Found by visual verification and fixed before commit: the copy panel first
carried its own preset/WL/WW/table readout, which contradicted ScanVolume's
corner console mid-travel — the volume interpolates smoothly between stops
while the heading snaps to the nearest, so the panel read "Thorax · Lung ·
−600" while the corner still read "BRAIN · WL 40 WW 80". The duplicate is
gone; the corner console is the single source, and the copy names the preset
in prose instead.

Verified in the browser: the scout paints the whole-body point cloud,
scrolling advances Scout -> Thorax with the heading, the region rail and the
"Open Thorax questions" link all following, and the sticky stage, canvas
sizing and layout are correct. tsc clean; build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Wire up the question-bank validator that was written and never run
_2026-08-13_

src/lib/validateQuestions.ts is a finished 129-line structural integrity
checker for the anatomy bank. Nothing imported it and no script ran it, so it
has never once been executed against the data it was written to protect.

What it checks is precisely the class of defect the bank cannot survive and a
reader cannot see: a label with no answer entry, an answer entry with no
visible label, a duplicate question id, a marker outside the image, labels
that have stopped being sequential letters, laterality flags that disagree
with the answer text. Each of those either leaves a candidate unable to answer
or scores them against the wrong structure — the exact failure the stable-id
answer model elsewhere in this codebase exists to prevent.

Added scripts/questions-validate.ts as its runner, following the same
ts-register pattern as atlas:validate, and exposed it as:

    npm run questions:validate
    npm run questions:validate -- --errors-only
    npm run questions:validate -- --section thorax

It loads the same six section files under the same ids that sections.ts
resolves at runtime, and applies the same excludeFromPlay filter, so what is
validated is what the site actually serves. Issues are grouped by code rather
than by question: a systematic extraction fault then shows up as one heading
with forty entries under it, which is the shape that distinguishes one bad
record from one bad rule. Exit code is 1 on any error so it can gate a
release; warnings never fail the run, because several are legitimate on this
bank (a source image that genuinely skips a letter).

It deliberately does not check whether an answer is anatomically correct.
That is decided by the source material during extraction, and guessing at it
here would risk "correcting" the atlas automatically.

First run: 508 questions across six sections, 0 errors, 0 warnings.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>


## Recover the MRI and ultrasound scroll scenes, stranded with no importer
_2026-08-13_

src/home/scenes/ holds five scroll-driven canvas scenes. Three are subject
chapters built to one pattern — X-ray, MRI, ultrasound. Only the X-ray one
was still rendered anywhere.

MriScene.tsx (292 lines, seven chapters running from "no field" through
alignment, precession, RF excitation, relaxation and signal to contrast) and
UsScene.tsx (290 lines, five chapters in which particles genuinely oscillate
along the direction of travel, with reflection, transmission, refraction and
attenuation all following from the layer speeds and impedances) had no
importer at all. Nothing in the app referenced either symbol.

They were not half-built. Every rule they need was still in home.css,
including their own scroll stages — .hm-stage-mri { height: 560vh } and
.hm-stage-us { height: 520vh } — their reduced-motion fallbacks and their
accent colours. The components survived and the styling survived; the two
lines that rendered them did not.

Given routes of their own at /mri-lab/motion and /ultrasound-lab/motion, and
surfaced through the Visual Lab index's existing "extras" list, which is
already described in that file as the other doors into the same subject so
nothing hides. They join the CT scroll story that sits there already.

Deliberately NOT put back on the home page. Completing the set there is still
a change to the home page, which is the one file in this project with a
history of expensive regressions, and these are worth more reachable than
they are risky. Moving them onto /physics later is one line each.

The wrapper adds nothing but the token scope and a way back: the scenes carry
their own heading, chapter copy and call to action, and every --hm-* variable
they read is declared on .home-page, so without that class the canvases paint
with unresolved colours.

Verified in the browser: both routes mount, the MRI stage measures 2856px
(560vh) with all seven chapters in the DOM, both canvases paint real content,
and there are no console errors. tsc clean, 139 tests pass, build clean.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>



---

# Appendix B — what changed, by file

```
 ANATOMY CLAUDE/frcr-anatomy/.claude/launch.json    |    11 -
 ANATOMY CLAUDE/frcr-anatomy/.oxlintrc.json         |     8 -
 ANATOMY CLAUDE/frcr-anatomy/README.md              |    51 +-
 ANATOMY CLAUDE/frcr-anatomy/deno.lock              |    27 -
 ANATOMY CLAUDE/frcr-anatomy/index.html             |    35 -
 ANATOMY CLAUDE/frcr-anatomy/package-lock.json      |  1423 --
 ANATOMY CLAUDE/frcr-anatomy/package.json           |    33 -
 ANATOMY CLAUDE/frcr-anatomy/public/favicon.svg     |     8 -
 ANATOMY CLAUDE/frcr-anatomy/scripts/dev-server.mjs |    47 -
 ANATOMY CLAUDE/frcr-anatomy/src/App.css            |     1 -
 ANATOMY CLAUDE/frcr-anatomy/src/App.tsx            |   113 -
 .../src/components/atlas/AtlasLightbox.css         |   142 -
 ANATOMY CLAUDE/frcr-anatomy/src/lib/assetUrl.ts    |    20 -
 ANATOMY CLAUDE/frcr-anatomy/src/main.tsx           |    10 -
 .../frcr-anatomy/src/pages/AdminLogin.css          |    17 -
 .../frcr-anatomy/src/pages/ChestXrayAtlas.css      |   364 -
 .../frcr-anatomy/src/pages/Dashboard.css           |    56 -
 ANATOMY CLAUDE/frcr-anatomy/src/pages/Disputes.css |    24 -
 .../frcr-anatomy/src/pages/MriViewer.css           |   359 -
 ANATOMY CLAUDE/frcr-anatomy/tsconfig.app.json      |    27 -
 ANATOMY CLAUDE/frcr-anatomy/tsconfig.json          |     7 -
 ANATOMY CLAUDE/frcr-anatomy/tsconfig.node.json     |    23 -
 ANATOMY CLAUDE/frcr-anatomy/vite.config.ts         |    25 -
 docs/ANATOMY-MERGE-MAP.md                          |   173 +
 radiopass-website/package.json                     |     7 +-
 radiopass-website/public/.htaccess                 |    23 +-
 .../public/anatomy}/ct/head-bone/s000.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s001.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s002.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s003.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s004.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s005.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s006.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s007.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s008.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s009.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s010.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s011.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s012.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s013.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s014.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s015.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s016.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s017.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s018.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s019.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s020.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s021.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s022.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s023.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s024.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s025.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s026.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s027.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s028.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s029.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s030.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s031.webp         |   Bin
 .../public/anatomy}/ct/head-bone/s032.webp         |   Bin
 .../public/anatomy}/cxr/radiograph-1.png           |   Bin
 .../public/anatomy}/cxr/radiograph-2.png           |   Bin
 .../public/anatomy}/icons.svg                      |     0
 .../public/anatomy}/images/abdopelvis/p0004.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0006.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0008.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0010.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0012.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0014.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0016.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0018.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0020.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0022.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0024.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0026.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0028.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0030.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0032.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0034.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0036.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0038.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0040.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0042.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0044.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0046.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0048.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0050.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0052.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0054.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0056.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0061.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0063.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0065.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0067.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0069.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0071.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0073.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0075.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0077.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0079.webp   |   Bin
 .../anatomy}/images/abdopelvis/p0081-clean.png     |   Bin
 .../public/anatomy}/images/abdopelvis/p0081.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0083.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0085.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0087.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0089.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0091.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0093.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0095.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0097.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0099.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0101.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0103.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0105.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0107.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0109.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0111.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0113.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0115.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0117.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0119.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0121.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0123.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0125.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0127.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0129.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0131.webp   |   Bin
 .../public/anatomy}/images/abdopelvis/p0133.webp   |   Bin
 .../public/anatomy}/images/headneck/p0004.webp     |   Bin
 .../public/anatomy}/images/headneck/p0006.webp     |   Bin
 .../public/anatomy}/images/headneck/p0008.webp     |   Bin
 .../public/anatomy}/images/headneck/p0010.webp     |   Bin
 .../public/anatomy}/images/headneck/p0012.webp     |   Bin
 .../public/anatomy}/images/headneck/p0014.webp     |   Bin
 .../public/anatomy}/images/headneck/p0016.webp     |   Bin
 .../public/anatomy}/images/headneck/p0018.webp     |   Bin
 .../public/anatomy}/images/headneck/p0020.webp     |   Bin
 .../public/anatomy}/images/headneck/p0022.webp     |   Bin
 .../public/anatomy}/images/headneck/p0024.webp     |   Bin
 .../public/anatomy}/images/headneck/p0026.webp     |   Bin
 .../public/anatomy}/images/headneck/p0028.webp     |   Bin
 .../public/anatomy}/images/headneck/p0030.webp     |   Bin
 .../public/anatomy}/images/headneck/p0032.webp     |   Bin
 .../public/anatomy}/images/headneck/p0034.webp     |   Bin
 .../public/anatomy}/images/headneck/p0036.webp     |   Bin
 .../public/anatomy}/images/headneck/p0038.webp     |   Bin
 .../public/anatomy}/images/headneck/p0040.webp     |   Bin
 .../public/anatomy}/images/headneck/p0042.webp     |   Bin
 .../public/anatomy}/images/headneck/p0044.webp     |   Bin
 .../public/anatomy}/images/headneck/p0046.webp     |   Bin
 .../public/anatomy}/images/headneck/p0048.webp     |   Bin
 .../public/anatomy}/images/headneck/p0050.webp     |   Bin
 .../public/anatomy}/images/headneck/p0052.webp     |   Bin
 .../public/anatomy}/images/headneck/p0054.webp     |   Bin
 .../public/anatomy}/images/headneck/p0056.webp     |   Bin
 .../public/anatomy}/images/headneck/p0058.webp     |   Bin
 .../public/anatomy}/images/headneck/p0060.webp     |   Bin
 .../public/anatomy}/images/headneck/p0062.webp     |   Bin
 .../public/anatomy}/images/headneck/p0064.webp     |   Bin
 .../public/anatomy}/images/headneck/p0066.webp     |   Bin
 .../public/anatomy}/images/headneck/p0068.webp     |   Bin
 .../public/anatomy}/images/headneck/p0070.webp     |   Bin
 .../public/anatomy}/images/headneck/p0072.webp     |   Bin
 .../public/anatomy}/images/headneck/p0074.webp     |   Bin
 .../public/anatomy}/images/headneck/p0076.webp     |   Bin
 .../public/anatomy}/images/headneck/p0078.webp     |   Bin
 .../public/anatomy}/images/headneck/p0080.webp     |   Bin
 .../public/anatomy}/images/headneck/p0082.webp     |   Bin
 .../public/anatomy}/images/headneck/p0084.webp     |   Bin
 .../public/anatomy}/images/headneck/p0086.webp     |   Bin
 .../public/anatomy}/images/headneck/p0088.webp     |   Bin
 .../public/anatomy}/images/headneck/p0090.webp     |   Bin
 .../public/anatomy}/images/headneck/p0092.webp     |   Bin
 .../public/anatomy}/images/headneck/p0094.webp     |   Bin
 .../public/anatomy}/images/headneck/p0096.webp     |   Bin
 .../public/anatomy}/images/headneck/p0098.webp     |   Bin
 .../public/anatomy}/images/headneck/p0100.webp     |   Bin
 .../public/anatomy}/images/headneck/p0102.webp     |   Bin
 .../public/anatomy}/images/headneck/p0104.webp     |   Bin
 .../public/anatomy}/images/headneck/p0106.webp     |   Bin
 .../public/anatomy}/images/headneck/p0108.webp     |   Bin
 .../public/anatomy}/images/headneck/p0110.webp     |   Bin
 .../public/anatomy}/images/headneck/p0112.webp     |   Bin
 .../public/anatomy}/images/headneck/p0114.webp     |   Bin
 .../public/anatomy}/images/headneck/p0116.webp     |   Bin
 .../public/anatomy}/images/headneck/p0118.webp     |   Bin
 .../public/anatomy}/images/headneck/p0120.webp     |   Bin
 .../public/anatomy}/images/headneck/p0122.webp     |   Bin
 .../public/anatomy}/images/headneck/p0124.webp     |   Bin
 .../public/anatomy}/images/headneck/p0126.webp     |   Bin
 .../public/anatomy}/images/headneck/p0128.webp     |   Bin
 .../public/anatomy}/images/headneck/p0130.webp     |   Bin
 .../public/anatomy}/images/headneck/p0132.webp     |   Bin
 .../public/anatomy}/images/headneck/p0134.webp     |   Bin
 .../public/anatomy}/images/headneck/p0136.webp     |   Bin
 .../public/anatomy}/images/headneck/p0138.webp     |   Bin
 .../public/anatomy}/images/headneck/p0140.webp     |   Bin
 .../public/anatomy}/images/headneck/p0142.webp     |   Bin
 .../public/anatomy}/images/headneck/p0144.webp     |   Bin
 .../public/anatomy}/images/headneck/p0146.webp     |   Bin
 .../public/anatomy}/images/headneck/p0148.webp     |   Bin
 .../public/anatomy}/images/headneck/p0150.webp     |   Bin
 .../public/anatomy}/images/headneck/p0153.webp     |   Bin
 .../public/anatomy}/images/headneck/p0155.webp     |   Bin
 .../public/anatomy}/images/headneck/p0157.webp     |   Bin
 .../public/anatomy}/images/headneck/p0160.webp     |   Bin
 .../public/anatomy}/images/headneck/p0162.webp     |   Bin
 .../public/anatomy}/images/headneck/p0164.webp     |   Bin
 .../public/anatomy}/images/headneck/p0166.webp     |   Bin
 .../public/anatomy}/images/headneck/p0168.webp     |   Bin
 .../public/anatomy}/images/headneck/p0170.webp     |   Bin
 .../public/anatomy}/images/headneck/p0174.webp     |   Bin
 .../public/anatomy}/images/headneck/p0176.webp     |   Bin
 .../public/anatomy}/images/headneck/p0178.webp     |   Bin
 .../public/anatomy}/images/headneck/p0180.webp     |   Bin
 .../public/anatomy}/images/headneck/p0182.webp     |   Bin
 .../public/anatomy}/images/headneck/p0184.webp     |   Bin
 .../public/anatomy}/images/headneck/p0186.webp     |   Bin
 .../public/anatomy}/images/headneck/p0188.webp     |   Bin
 .../public/anatomy}/images/headneck/p0190.webp     |   Bin
 .../public/anatomy}/images/headneck/p0193.webp     |   Bin
 .../public/anatomy}/images/headneck/p0195.webp     |   Bin
 .../public/anatomy}/images/headneck/p0197.webp     |   Bin
 .../public/anatomy}/images/headneck/p0199.webp     |   Bin
 .../public/anatomy}/images/headneck/p0201.webp     |   Bin
 .../public/anatomy}/images/headneck/p0203.webp     |   Bin
 .../public/anatomy}/images/headneck/p0205.webp     |   Bin
 .../public/anatomy}/images/headneck/p0207.webp     |   Bin
 .../public/anatomy}/images/headneck/p0210.webp     |   Bin
 .../public/anatomy}/images/headneck/p0212.webp     |   Bin
 .../public/anatomy}/images/headneck/p0214.webp     |   Bin
 .../public/anatomy}/images/hero/abdo-pelvis.webp   |   Bin
 .../public/anatomy}/images/hero/body-full.webp     |   Bin
 .../public/anatomy}/images/hero/chest.webp         |   Bin
 .../public/anatomy}/images/hero/head-neck.webp     |   Bin
 .../public/anatomy}/images/hero/skull/480/.gitkeep |     0
 .../anatomy}/images/hero/skull/480/skull-0022.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0068.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0135.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0158.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0180.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0202.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0225.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0248.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0292.webp |   Bin
 .../anatomy}/images/hero/skull/480/skull-0338.webp |   Bin
 .../public/anatomy}/images/hero/skull/720/.gitkeep |     0
 .../anatomy}/images/hero/skull/720/skull-0022.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0068.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0135.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0158.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0180.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0202.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0225.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0248.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0292.webp |   Bin
 .../anatomy}/images/hero/skull/720/skull-0338.webp |   Bin
 .../public/anatomy}/images/hero/skull/README.md    |     0
 .../public/anatomy}/images/hero/skull/poster.webp  |   Bin
 .../public/anatomy}/images/hero/spine.webp         |   Bin
 .../public/anatomy}/images/hero/thorax.webp        |   Bin
 .../public/anatomy}/images/hero/upper-limb.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0004.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0006.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0008.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0010.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0012.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0014.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0016.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0018.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0020.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0022.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0024.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0026.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0028.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0030.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0032.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0034.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0035.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0036.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0037.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0038.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0039.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0040.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0041.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0042.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0043.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0044.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0045.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0046.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0047.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0048.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0049.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0050.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0051.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0052.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0053.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0054.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0055.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0056.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0057.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0058.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0059.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0060.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0061.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0062.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0063.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0064.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0065.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0066.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0067.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0068.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0069.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0070.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0071.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0072.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0073.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0074.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0075.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0076.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0077.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0078.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0079.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0080.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0081.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0082.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0083.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0084.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0085.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0086.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0087.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0088.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0089.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0090.webp    |   Bin
 .../anatomy}/images/lowerlimb/p0091-clean.png      |   Bin
 .../public/anatomy}/images/lowerlimb/p0091.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0092.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0093.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0094.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0095.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0096.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0097.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0098.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0099.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0100.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0101.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0102.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0103.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0104.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0105.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0106.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0107.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0108.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0109.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0110.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0111.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0112.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0113.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0114.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0115.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0116.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0117.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0118.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0119.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0120.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0121.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0122.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0123.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0124.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0125.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0126.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0127.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0128.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0129.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0130.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0131.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0132.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0133.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0134.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0135.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0136.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0137.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0138.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0139.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0140.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0141.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0142.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0143.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0144.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0145.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0146.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0147.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0148.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0149.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0150.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0151.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0152.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0153.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0154.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0155.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0158.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0160.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0162.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0164.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0166.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0168.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0170.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0172.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0174.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0176.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0178.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0180.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0182.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0184.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0186.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0188.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0190.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0192.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0194.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0197.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0199.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0200.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0203.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0205.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0207.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0209.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0211.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0213.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0216.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0218.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0220.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0222.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0224.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0226.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0228.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0230.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0232.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0234.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0236.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0238.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0240.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0242.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0244.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0247.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0253.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0255.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0257.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0259.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0261.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0263.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0265.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0267.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0269.webp    |   Bin
 .../public/anatomy}/images/lowerlimb/p0271.webp    |   Bin
 .../public/anatomy}/images/revision/msk-p0065.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0066.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0068.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0069.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0070.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0071.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0072.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0073.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0074.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0075.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0076.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0077.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0078.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0080.webp |   Bin
 .../public/anatomy}/images/revision/msk-p0083.webp |   Bin
 .../public/anatomy}/images/spine/p0004.webp        |   Bin
 .../public/anatomy}/images/spine/p0006.webp        |   Bin
 .../public/anatomy}/images/spine/p0008.webp        |   Bin
 .../public/anatomy}/images/spine/p0010.webp        |   Bin
 .../public/anatomy}/images/spine/p0012.webp        |   Bin
 .../public/anatomy}/images/spine/p0014.webp        |   Bin
 .../public/anatomy}/images/spine/p0016.webp        |   Bin
 .../public/anatomy}/images/spine/p0018.webp        |   Bin
 .../public/anatomy}/images/spine/p0020.webp        |   Bin
 .../public/anatomy}/images/spine/p0022-clean.png   |   Bin
 .../public/anatomy}/images/spine/p0022.webp        |   Bin
 .../public/anatomy}/images/spine/p0024.webp        |   Bin
 .../public/anatomy}/images/spine/p0026.webp        |   Bin
 .../public/anatomy}/images/spine/p0028.webp        |   Bin
 .../public/anatomy}/images/spine/p0030.webp        |   Bin
 .../public/anatomy}/images/spine/p0033.webp        |   Bin
 .../public/anatomy}/images/spine/p0036.webp        |   Bin
 .../public/anatomy}/images/spine/p0038.webp        |   Bin
 .../public/anatomy}/images/spine/p0040.webp        |   Bin
 .../public/anatomy}/images/spine/p0042.webp        |   Bin
 .../public/anatomy}/images/spine/p0044.webp        |   Bin
 .../public/anatomy}/images/spine/p0046.webp        |   Bin
 .../public/anatomy}/images/spine/p0048.webp        |   Bin
 .../public/anatomy}/images/spine/p0050.webp        |   Bin
 .../public/anatomy}/images/spine/p0052.webp        |   Bin
 .../public/anatomy}/images/spine/p0054.webp        |   Bin
 .../public/anatomy}/images/spine/p0056.webp        |   Bin
 .../public/anatomy}/images/spine/p0058.webp        |   Bin
 .../public/anatomy}/images/spine/p0060.webp        |   Bin
 .../public/anatomy}/images/spine/p0062.webp        |   Bin
 .../public/anatomy}/images/spine/p0064.webp        |   Bin
 .../public/anatomy}/images/spine/p0066.webp        |   Bin
 .../public/anatomy}/images/spine/p0068.webp        |   Bin
 .../public/anatomy}/images/spine/p0070.webp        |   Bin
 .../public/anatomy}/images/spine/p0072.webp        |   Bin
 .../public/anatomy}/images/spine/p0074.webp        |   Bin
 .../public/anatomy}/images/spine/p0076.webp        |   Bin
 .../public/anatomy}/images/spine/p0078.webp        |   Bin
 .../public/anatomy}/images/spine/p0080.webp        |   Bin
 .../public/anatomy}/images/spine/p0082.webp        |   Bin
 .../public/anatomy}/images/spine/p0084.webp        |   Bin
 .../public/anatomy}/images/spine/p0086.webp        |   Bin
 .../public/anatomy}/images/spine/p0088.webp        |   Bin
 .../public/anatomy}/images/spine/p0090.webp        |   Bin
 .../public/anatomy}/images/thorax/p0004.webp       |   Bin
 .../public/anatomy}/images/thorax/p0006.webp       |   Bin
 .../public/anatomy}/images/thorax/p0008.webp       |   Bin
 .../public/anatomy}/images/thorax/p0010.webp       |   Bin
 .../public/anatomy}/images/thorax/p0012.webp       |   Bin
 .../public/anatomy}/images/thorax/p0014.webp       |   Bin
 .../public/anatomy}/images/thorax/p0016.webp       |   Bin
 .../public/anatomy}/images/thorax/p0018.webp       |   Bin
 .../public/anatomy}/images/thorax/p0020.webp       |   Bin
 .../public/anatomy}/images/thorax/p0022.webp       |   Bin
 .../public/anatomy}/images/thorax/p0024.webp       |   Bin
 .../public/anatomy}/images/thorax/p0026.webp       |   Bin
 .../public/anatomy}/images/thorax/p0028.webp       |   Bin
 .../public/anatomy}/images/thorax/p0030.webp       |   Bin
 .../public/anatomy}/images/thorax/p0032.webp       |   Bin
 .../public/anatomy}/images/thorax/p0034.webp       |   Bin
 .../public/anatomy}/images/thorax/p0036.webp       |   Bin
 .../public/anatomy}/images/thorax/p0038.webp       |   Bin
 .../public/anatomy}/images/thorax/p0040.webp       |   Bin
 .../public/anatomy}/images/thorax/p0042.webp       |   Bin
 .../public/anatomy}/images/thorax/p0044.webp       |   Bin
 .../public/anatomy}/images/thorax/p0046.webp       |   Bin
 .../public/anatomy}/images/thorax/p0048.webp       |   Bin
 .../public/anatomy}/images/thorax/p0050.webp       |   Bin
 .../public/anatomy}/images/thorax/p0052.webp       |   Bin
 .../public/anatomy}/images/thorax/p0054.webp       |   Bin
 .../public/anatomy}/images/thorax/p0056.webp       |   Bin
 .../public/anatomy}/images/thorax/p0058.webp       |   Bin
 .../public/anatomy}/images/thorax/p0060-clean.png  |   Bin
 .../public/anatomy}/images/thorax/p0060.webp       |   Bin
 .../public/anatomy}/images/thorax/p0062.webp       |   Bin
 .../public/anatomy}/images/thorax/p0064.webp       |   Bin
 .../public/anatomy}/images/thorax/p0066.webp       |   Bin
 .../public/anatomy}/images/thorax/p0068.webp       |   Bin
 .../public/anatomy}/images/thorax/p0070.webp       |   Bin
 .../public/anatomy}/images/thorax/p0072.webp       |   Bin
 .../public/anatomy}/images/thorax/p0074.webp       |   Bin
 .../public/anatomy}/images/thorax/p0076.webp       |   Bin
 .../public/anatomy}/images/thorax/p0078.webp       |   Bin
 .../public/anatomy}/images/thorax/p0080.webp       |   Bin
 .../public/anatomy}/images/thorax/p0082.webp       |   Bin
 .../public/anatomy}/images/thorax/p0084.webp       |   Bin
 .../public/anatomy}/images/thorax/p0086.webp       |   Bin
 .../public/anatomy}/images/thorax/p0088.webp       |   Bin
 .../public/anatomy}/images/thorax/p0090.webp       |   Bin
 .../public/anatomy}/images/thorax/p0092.webp       |   Bin
 .../public/anatomy}/images/thorax/p0094.webp       |   Bin
 .../public/anatomy}/images/thorax/p0096.webp       |   Bin
 .../public/anatomy}/images/thorax/p0098.webp       |   Bin
 .../public/anatomy}/images/thorax/p0100.webp       |   Bin
 .../public/anatomy}/images/thorax/p0102.webp       |   Bin
 .../public/anatomy}/images/thorax/p0104.webp       |   Bin
 .../public/anatomy}/images/thorax/p0106.webp       |   Bin
 .../public/anatomy}/images/thorax/p0108.webp       |   Bin
 .../public/anatomy}/images/thorax/p0110.webp       |   Bin
 .../public/anatomy}/images/thorax/p0112.webp       |   Bin
 .../public/anatomy}/images/thorax/p0114.webp       |   Bin
 .../public/anatomy}/images/thorax/p0116.webp       |   Bin
 .../public/anatomy}/images/thorax/p0118.webp       |   Bin
 .../public/anatomy}/images/thorax/p0120.webp       |   Bin
 .../public/anatomy}/images/thorax/p0122.webp       |   Bin
 .../public/anatomy}/images/thorax/p0124.webp       |   Bin
 .../public/anatomy}/images/thorax/p0126.webp       |   Bin
 .../public/anatomy}/images/thorax/p0128.webp       |   Bin
 .../public/anatomy}/images/thorax/p0130.webp       |   Bin
 .../public/anatomy}/images/thorax/p0132.webp       |   Bin
 .../public/anatomy}/images/thorax/p0134.webp       |   Bin
 .../public/anatomy}/images/thorax/p0136.webp       |   Bin
 .../public/anatomy}/images/thorax/p0138.webp       |   Bin
 .../public/anatomy}/images/thorax/p0140.webp       |   Bin
 .../public/anatomy}/images/thorax/p0142.webp       |   Bin
 .../public/anatomy}/images/thorax/p0144.webp       |   Bin
 .../public/anatomy}/images/thorax/p0146.webp       |   Bin
 .../public/anatomy}/images/upperlimb/p0004.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0006.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0008.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0010.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0012.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0014.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0016.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0018.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0020.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0022.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0024.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0026.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0028.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0030.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0032.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0034.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0036.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0038.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0040.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0042.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0044.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0046.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0048.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0050.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0052.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0054.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0056.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0058.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0060.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0062.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0064.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0066.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0068.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0070.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0072.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0074.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0076.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0078.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0080.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0082.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0084.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0086.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0088.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0090.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0092.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0094.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0096.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0098.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0100.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0102.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0104.webp    |   Bin
 .../anatomy}/images/upperlimb/p0106-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0106.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0108.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0110.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0112.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0114.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0116.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0118.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0120.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0122.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0124.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0126.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0128.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0130.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0132.webp    |   Bin
 .../anatomy}/images/upperlimb/p0134-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0134.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0136.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0138.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0140.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0142.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0144.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0146.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0148.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0150.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0152.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0154.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0156.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0158.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0160.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0162.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0164.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0166.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0169.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0171.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0173.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0175.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0177.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0179.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0181.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0183.webp    |   Bin
 .../anatomy}/images/upperlimb/p0185-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0185.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0189.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0191.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0193.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0195.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0197.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0199.webp    |   Bin
 .../anatomy}/images/upperlimb/p0201-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0201.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0203.webp    |   Bin
 .../anatomy}/images/upperlimb/p0205-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0205.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0207.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0209.webp    |   Bin
 .../anatomy}/images/upperlimb/p0211-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0211.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0213.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0215.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0217.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0219.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0221.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0223.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0225.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0227.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0229.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0231.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0233.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0235.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0237.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0239.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0242.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0244.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0246.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0248.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0250.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0252.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0254.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0256.webp    |   Bin
 .../anatomy}/images/upperlimb/p0258-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0258.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0260.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0262.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0264.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0267.webp    |   Bin
 .../anatomy}/images/upperlimb/p0269-clean.png      |   Bin
 .../public/anatomy}/images/upperlimb/p0269.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0271.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0273.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0275.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0277.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0279.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0281.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0283.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0285.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0287.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0289.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0291.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0293.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0295.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0297.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0299.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0301.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0303.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0305.webp    |   Bin
 .../public/anatomy}/images/upperlimb/p0307.webp    |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s000.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s001.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s002.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s003.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s004.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s005.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s006.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s007.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s008.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s009.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s010.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s011.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s012.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s013.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s014.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s015.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s016.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s017.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s018.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s019.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s020.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s021.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s022.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s023.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s024.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s025.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s026.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s027.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s028.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s029.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s030.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s031.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s032.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s033.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s034.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s035.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s036.webp     |   Bin
 .../public/anatomy}/mri/hip-axial-t1/s037.webp     |   Bin
 .../public/visuals/assets/site-data.js             |    37 -
 .../public/visuals/diagrams-6-10.html              |  1197 ++
 .../scripts/anatomy-mapping-baseline.json          | 20058 +++++++++++++++++++
 radiopass-website/scripts/anatomy-mapping.ts       |   Bin 0 -> 8592 bytes
 .../scripts/atlas-report.ts                        |     6 +-
 .../scripts/atlas-validate.ts                      |     8 +-
 .../scripts/build-hero-frames.mjs                  |     7 +-
 radiopass-website/scripts/package.mjs              |    51 +-
 radiopass-website/scripts/questions-validate.ts    |    97 +
 .../scripts/recover-recall-metadata.mjs            |    90 +
 .../scripts/ts-register.mjs                        |     0
 .../scripts/ts-resolve.mjs                         |     0
 .../scripts/vite-content-api.mjs                   |     0
 .../server/adapters/express.mjs                    |     0
 .../server/adapters/netlify.mjs                    |     0
 .../server/adapters/vercel.mjs                     |     0
 .../server/lib/auth.mjs                            |     0
 .../server/lib/handler.mjs                         |     0
 .../server/lib/overlay.mjs                         |     0
 .../server/lib/store-fs.mjs                        |     0
 .../server/lib/stores.mjs                          |     0
 .../server/server.mjs                              |     0
 radiopass-website/src/App.tsx                      |    75 +-
 radiopass-website/src/anatomy/AnatomyRoutes.tsx    |   179 +
 .../src/anatomy/anatomy.css                        |   174 +-
 .../src/anatomy}/assets/hero.png                   |   Bin
 .../src/anatomy}/assets/react.svg                  |     0
 .../src/anatomy}/assets/vite.svg                   |     0
 .../src/anatomy}/components/AnatomyJourney.css     |   142 +-
 .../src/anatomy}/components/AnatomyJourney.tsx     |     2 +-
 .../src/anatomy}/components/DisputeModal.css       |    23 +-
 .../src/anatomy}/components/DisputeModal.tsx       |     0
 .../src/anatomy}/components/ImageViewer.css        |    68 +-
 .../src/anatomy}/components/ImageViewer.tsx        |     0
 .../src/anatomy}/components/Layout.css             |   153 +-
 .../src/anatomy}/components/Layout.tsx             |   114 +-
 .../src/anatomy}/components/RequireAdmin.tsx       |     2 +-
 .../src/anatomy}/components/ScanVolume.css         |    37 +-
 .../src/anatomy}/components/ScanVolume.tsx         |     0
 .../src/anatomy}/components/SkullHero.css          |    36 +-
 .../src/anatomy}/components/SkullHero.tsx          |     2 +-
 .../anatomy}/components/atlas/AtlasBreadcrumbs.tsx |     0
 .../src/anatomy}/components/atlas/AtlasFilm.css    |    34 +-
 .../src/anatomy}/components/atlas/AtlasFilm.tsx    |     0
 .../src/anatomy/components/atlas/AtlasLightbox.css |   130 +
 .../anatomy}/components/atlas/AtlasLightbox.tsx    |     6 +-
 .../src/anatomy}/components/atlas/AtlasSearch.tsx  |     2 +-
 .../src/anatomy}/components/atlas/FilmLegend.tsx   |     4 +-
 .../anatomy}/components/cxr/AnnotationOverlay.tsx  |     0
 .../src/anatomy}/data/abdoPelvis.json              |     0
 .../src/anatomy}/data/atlas/atlasOverrides.ts      |     0
 .../src/anatomy}/data/atlas/chapters.ts            |     0
 .../src/anatomy}/data/atlas/imageNotes.ts          |     0
 .../src/anatomy}/data/atlas/relationships.ts       |     0
 .../src/anatomy}/data/ct/headBone.json             |     0
 .../src/anatomy}/data/cxr/README.md                |     0
 .../src/anatomy}/data/cxr/chestStructures.ts       |     0
 .../src/anatomy}/data/cxr/radiographs.ts           |     0
 .../src/anatomy}/data/headNeck.json                |     0
 .../src/anatomy}/data/heroFrames.ts                |     0
 .../src/anatomy}/data/lowerLimb.json               |     0
 .../src/anatomy}/data/mri/hipAxialT1.json          |     0
 .../src/anatomy}/data/sections.ts                  |     0
 .../src/anatomy}/data/spine.json                   |     0
 .../src/anatomy}/data/structureCues.json           |     0
 .../src/anatomy}/data/studies.ts                   |     0
 .../src/anatomy}/data/thorax.json                  |     0
 .../src/anatomy}/data/upperLimb.json               |     0
 .../src/anatomy}/lib/account.ts                    |     0
 .../src/anatomy}/lib/admin.ts                      |    58 +-
 .../src/anatomy}/lib/anatomy.ts                    |     0
 radiopass-website/src/anatomy/lib/assetUrl.ts      |    32 +
 .../src/anatomy}/lib/atlas/build.ts                |     0
 .../src/anatomy}/lib/atlas/index.ts                |     0
 .../src/anatomy}/lib/atlas/normalise.ts            |     0
 .../src/anatomy}/lib/atlas/related.ts              |     0
 .../src/anatomy}/lib/atlas/studies.ts              |     4 +-
 .../src/anatomy}/lib/atlas/types.ts                |     0
 .../src/anatomy}/lib/content/api.ts                |     0
 .../src/anatomy}/lib/content/store.ts              |     0
 .../src/anatomy}/lib/content/types.ts              |     0
 .../src/anatomy}/lib/customQuestions.ts            |     0
 .../src/anatomy}/lib/customStore.ts                |     0
 .../src/anatomy}/lib/grading.ts                    |     0
 .../src/anatomy}/lib/mri/types.ts                  |     0
 .../src/anatomy}/lib/progress.ts                   |     0
 .../src/anatomy}/lib/questionEdits.ts              |    51 +-
 .../src/anatomy}/lib/skullFrames.ts                |     0
 .../src/anatomy}/lib/stats.ts                      |    13 +
 .../src/anatomy}/lib/validateQuestions.ts          |    27 +-
 radiopass-website/src/anatomy/pages/AdminLogin.css |    22 +
 .../src/anatomy}/pages/AdminLogin.tsx              |    10 +-
 .../src/anatomy}/pages/Atlas.css                   |   426 +-
 .../src/anatomy}/pages/AtlasChapter.tsx            |    14 +-
 .../src/anatomy}/pages/AtlasHome.tsx               |     4 +-
 .../src/anatomy}/pages/AtlasStructure.tsx          |    26 +-
 .../src/anatomy/pages/ChestXrayAtlas.css           |   316 +
 .../src/anatomy}/pages/ChestXrayAtlas.tsx          |     2 +-
 .../src/anatomy}/pages/CustomCaseEditor.css        |   148 +-
 .../src/anatomy}/pages/CustomCaseEditor.tsx        |     8 +-
 radiopass-website/src/anatomy/pages/Dashboard.css  |    53 +
 .../src/anatomy}/pages/Dashboard.tsx               |     4 +-
 radiopass-website/src/anatomy/pages/Disputes.css   |    22 +
 .../src/anatomy}/pages/Disputes.tsx                |     2 +-
 .../src/anatomy}/pages/Home.css                    |   518 +-
 .../src/anatomy}/pages/Home.tsx                    |    89 +-
 radiopass-website/src/anatomy/pages/MriViewer.css  |   302 +
 .../src/anatomy}/pages/MriViewer.tsx               |    32 +-
 .../src/anatomy}/pages/QuestionPlayer.css          |   166 +-
 .../src/anatomy}/pages/QuestionPlayer.tsx          |    28 +-
 .../src/anatomy}/pages/ReplaceImageEditor.css      |   372 +-
 .../src/anatomy}/pages/ReplaceImageEditor.tsx      |   161 +-
 .../src/anatomy}/pages/SectionHub.css              |   135 +-
 .../src/anatomy}/pages/SectionHub.tsx              |    16 +-
 .../src/anatomy/pages/VolumeExplorer.css           |   174 +
 .../src/anatomy/pages/VolumeExplorer.tsx           |   172 +
 .../src => radiopass-website/src/anatomy}/types.ts |     0
 radiopass-website/src/design/breadcrumb.css        |    48 +
 radiopass-website/src/design/breadcrumb.tsx        |    52 +
 radiopass-website/src/design/tokens.css            |    36 +-
 radiopass-website/src/labs/cinema.tsx              |     2 +-
 radiopass-website/src/labs/labs.css                |    20 +
 radiopass-website/src/labs/lesson.tsx              |    34 +-
 radiopass-website/src/labs/motion.tsx              |    62 +
 radiopass-website/src/labs/mriportal.tsx           |     2 +-
 radiopass-website/src/labs/xray.tsx                |     8 +-
 radiopass-website/src/lib/access.test.ts           |   193 +
 radiopass-website/src/lib/access.ts                |   192 +
 radiopass-website/src/lib/auth.tsx                 |    22 +-
 radiopass-website/src/lib/entitlement.tsx          |    72 +
 radiopass-website/src/lib/learner.test.ts          |   152 +
 radiopass-website/src/lib/learner.ts               |   219 +
 radiopass-website/src/lib/perUserKeys.ts           |    61 +
 radiopass-website/src/lib/syncedStore.test.ts      |    43 +
 radiopass-website/src/main.tsx                     |     7 +-
 radiopass-website/src/mri5/Module.tsx              |     2 +-
 radiopass-website/src/mri5/Section.tsx             |     2 +-
 radiopass-website/src/physics/Home.tsx             |   272 +
 radiopass-website/src/physics/physicshome.css      |   259 +
 radiopass-website/src/portal/Admin.tsx             |    24 +-
 radiopass-website/src/portal/Crossing.tsx          |    59 -
 radiopass-website/src/portal/FreeTrial.tsx         |   144 +
 radiopass-website/src/portal/Portal.tsx            |    52 +-
 radiopass-website/src/portal/freetrial.css         |   168 +
 radiopass-website/src/portal/portal.css            |    64 +-
 radiopass-website/src/qbank/QuestionCard.tsx       |     8 +
 radiopass-website/src/qbank/Shell.tsx              |    25 +-
 radiopass-website/src/qbank/data.test.ts           |    57 +
 radiopass-website/src/qbank/data/index.ts          |    15 +
 radiopass-website/src/qbank/data/recall.json       |  3096 +++
 radiopass-website/src/qbank/labLink.test.ts        |   146 +
 radiopass-website/src/qbank/pages/Mock.test.ts     |    33 +
 radiopass-website/src/qbank/pages/Mock.tsx         |   156 +-
 radiopass-website/src/qbank/pages/Practice.tsx     |     4 +-
 radiopass-website/src/qbank/pages/Review.tsx       |     4 +-
 radiopass-website/src/qbank/qbank.css              |   107 +
 radiopass-website/src/qbank/types.ts               |    68 +-
 radiopass-website/src/styles.css                   |    17 +
 radiopass-website/src/us/components/Layout.tsx     |    16 +-
 radiopass-website/src/us/us.css                    |     8 +
 radiopass-website/vite.config.ts                   |    75 +-
 942 files changed, 30614 insertions(+), 4667 deletions(-)
```
