/**
 * The route map: what every page IS, so the shell can stop guessing.
 *
 * WHY THIS EXISTS. RadioPass has one approved visual system and a hundred and
 * three routes, and until now each route decided for itself what chrome it
 * wore. That is why the same product could feel like three products: a lesson
 * suppressed the site header and drew its own, a laboratory exited "up" to
 * /visual-lab while its sibling exited to /physics, and a global page like the
 * question-bank selector inherited whichever subject's styling it happened to
 * sit next to.
 *
 * Two questions decide a page's treatment, and they are INDEPENDENT — that
 * separation is the whole point:
 *
 *   CONTEXT    which environment the page belongs to: global, anatomy or
 *              physics. Global is not a third subject; it is the platform
 *              itself — the homepage, progress, settings, the selector that
 *              offers the two subjects as equals.
 *
 *   ARCHETYPE  what cognitive job the page does, and therefore how dense it
 *              is allowed to be. A gateway and a question paper share a
 *              typeface and share nothing else about their composition.
 *
 * Visual consistency is not layout uniformity. A gateway that looks like an
 * index is a gateway that failed; an index padded out with a gateway's
 * whitespace is an index that wastes the reader's scrolling.
 *
 * ANATOMY AND PHYSICS ARE SIBLINGS. Nothing in this file may rank them. There
 * is no default subject, no "primary" branch, and a global page takes neither
 * side — `contextFor('/question-bank')` is 'global' precisely because the
 * selector must offer both at equal weight.
 */

export type Context = 'global' | 'anatomy' | 'physics'

export type Archetype =
  /** Editorial, spacious, low density. Equal-choice selectors and the
   *  low-density utility pages that share their composition. */
  | 'gateway'
  /** A subject's own front door — establishes that subject's environment. */
  | 'subject'
  /** Dense on purpose: lists, filters, search, progress, status. */
  | 'library'
  /** Long-form reading, with figures and interactives inside the article. */
  | 'content'
  /** Answering questions. Decoration steps back; concentration wins. */
  | 'practice'
  /** The interactive dominates the viewport; controls and teaching support it. */
  | 'simulator'
  /** Admin-only authoring. Deliberately outside the learner archetypes —
   *  see the note on AUTHORING below. */
  | 'authoring'

export type RouteSpec = {
  /** Route pattern as declared in the router. `:param` matches one segment,
   *  a trailing `/*` matches everything beneath. */
  pattern: string
  context: Context
  archetype: Archetype
  /** What the page is, in the product's own words. */
  note: string
}

/* ------------------------------------------------------------------ *
 * AUTHORING — why it is its own archetype
 *
 * The brief names six learner archetypes. The site also carries editors:
 * question wording, image replacement, structure folders, the physics wording
 * console. Forcing those into "library" or "practice" would put a learner's
 * composition around a tool only the owner ever opens, and forcing them out
 * would mean deleting working functionality — which the brief explicitly
 * forbids. They keep the RadioPass shell and take a utility treatment: denser
 * than any learner page, no editorial furniture, no decorative line work.
 * ------------------------------------------------------------------ */

/**
 * Every route the router declares, in the order a maintainer would look for
 * them. ORDER MATTERS: `match()` takes the first pattern that fits, so a
 * literal route is always listed above the `:param` route that would also
 * swallow it.
 */
export const ROUTES: RouteSpec[] = [
  /* ---------------- GLOBAL — the platform itself ---------------- */
  { pattern: '/', context: 'global', archetype: 'gateway',
    note: 'The front door. Offers anatomy and physics at equal weight.' },
  { pattern: '/question-bank', context: 'global', archetype: 'gateway',
    note: 'Subject selector. Global because it must not take a side.' },
  { pattern: '/study-plan', context: 'global', archetype: 'library',
    note: 'The six-week plan across both subjects.' },
  { pattern: '/free-trial', context: 'global', archetype: 'gateway',
    note: 'What the free sample opens, and what it does not.' },
  { pattern: '/pricing', context: 'global', archetype: 'gateway',
    note: 'Utility page on the gateway composition — editorial, low density.' },
  { pattern: '/about', context: 'global', archetype: 'gateway', note: 'Utility.' },
  { pattern: '/privacy', context: 'global', archetype: 'gateway', note: 'Utility.' },
  { pattern: '/terms', context: 'global', archetype: 'gateway', note: 'Utility.' },
  { pattern: '/login', context: 'global', archetype: 'gateway', note: 'Utility.' },
  { pattern: '/reset-password', context: 'global', archetype: 'gateway', note: 'Utility.' },
  { pattern: '/adrenal-adenoma', context: 'global', archetype: 'simulator',
    note: 'A clinical washout calculator. Belongs to neither subject, so it takes the global shell.' },
  { pattern: '/admin/questions', context: 'global', archetype: 'authoring',
    note: 'Physics question wording console.' },
  { pattern: '/admin', context: 'global', archetype: 'authoring',
    note: 'Author console — the index of every editing surface.' },

  /* ---------------- ANATOMY ---------------- */
  { pattern: '/anatomy/admin/structures', context: 'anatomy', archetype: 'authoring',
    note: 'Structure folders and the question-bank scan.' },
  { pattern: '/anatomy/admin', context: 'anatomy', archetype: 'authoring',
    note: 'Anatomy authoring hub.' },
  { pattern: '/anatomy/section/:sectionId/q/:questionId/replace-image', context: 'anatomy', archetype: 'authoring',
    note: 'Film replacement and marker geometry.' },
  { pattern: '/anatomy/section/:sectionId/q/:questionId/wording', context: 'anatomy', archetype: 'authoring',
    note: 'Stem, official answer, accepted variants, laterality.' },
  { pattern: '/anatomy/section/:sectionId/images', context: 'anatomy', archetype: 'authoring',
    note: 'Every film in a section: remove, restore, rename, replace.' },
  { pattern: '/anatomy/section/:sectionId/custom', context: 'anatomy', archetype: 'authoring',
    note: 'Custom case builder.' },
  { pattern: '/anatomy/section/:sectionId/q/:questionId', context: 'anatomy', archetype: 'practice',
    note: 'Answering one labelled film. The practice environment.' },
  { pattern: '/anatomy/section/:sectionId', context: 'anatomy', archetype: 'library',
    note: 'A region’s cases, with progress and filters.' },
  { pattern: '/anatomy/atlas/:chapterId/:structureId', context: 'anatomy', archetype: 'content',
    note: 'One structure: where it is seen, and every case that names it.' },
  { pattern: '/anatomy/atlas/:chapterId', context: 'anatomy', archetype: 'library',
    note: 'A chapter of the structure atlas.' },
  { pattern: '/anatomy/atlas', context: 'anatomy', archetype: 'library',
    note: 'The structure atlas index.' },
  { pattern: '/anatomy/mri/:studyId', context: 'anatomy', archetype: 'simulator',
    note: 'Stack viewer — scroll the study, the image dominates.' },
  { pattern: '/anatomy/cxr', context: 'anatomy', archetype: 'simulator',
    note: 'Chest film annotation surface.' },
  { pattern: '/anatomy/disputes', context: 'anatomy', archetype: 'library',
    note: 'Marking a candidate has challenged.' },
  { pattern: '/anatomy/dashboard', context: 'anatomy', archetype: 'library',
    note: 'Anatomy progress across the six regions.' },
  { pattern: '/anatomy', context: 'anatomy', archetype: 'subject',
    note: 'Anatomy’s front door. Approved — establishes the subject environment.' },

  /* ---------------- PHYSICS — the course ---------------- */
  { pattern: '/physics/tour', context: 'physics', archetype: 'gateway',
    note: 'The cinematic tour. Marketing register, deliberately low density.' },
  { pattern: '/physics/course', context: 'physics', archetype: 'library',
    note: 'The syllabus: parts, modules, standing.' },
  { pattern: '/physics/questions', context: 'physics', archetype: 'library',
    note: 'Question browser across the physics bank.' },
  { pattern: '/physics/review', context: 'physics', archetype: 'library',
    note: 'Wrong, flagged and unseen — the revision lists.' },
  { pattern: '/physics/mock', context: 'physics', archetype: 'practice',
    note: 'Timed papers.' },
  { pattern: '/physics/:topicId/practice', context: 'physics', archetype: 'practice',
    note: 'A topic’s own question set.' },
  { pattern: '/physics/:topicId', context: 'physics', archetype: 'content',
    note: 'The topic primer — long-form, with simulations inside the article.' },
  { pattern: '/physics', context: 'physics', archetype: 'subject',
    note: 'Physics’ front door. Approved — establishes the subject environment.' },

  /* ---------------- PHYSICS — the question bank ---------------- */
  { pattern: '/question-bank/mock', context: 'physics', archetype: 'practice',
    note: 'Timed mock papers.' },
  { pattern: '/question-bank/review/:filterId', context: 'physics', archetype: 'library',
    note: 'Cross-subject revision lists.' },
  { pattern: '/question-bank/:subjectId', context: 'physics', archetype: 'practice',
    note: 'Subject practice. Physics context: every bank subject is a physics subject today.' },

  /* ---------------- PHYSICS — reference ---------------- */
  { pattern: '/fact-bank/:topicId', context: 'physics', archetype: 'content',
    note: 'One fact at a time, with the browse sweep behind a switch.' },
  { pattern: '/fact-bank', context: 'physics', archetype: 'library',
    note: 'The eight fact topics, with search.' },
  { pattern: '/visual-lab', context: 'physics', archetype: 'library',
    note: 'Every simulation, for deliberate browsing.' },

  /* ---------------- PHYSICS — laboratories and lessons ---------------- */
  { pattern: '/xray-lab/production', context: 'physics', archetype: 'simulator', note: 'Guided lesson on the live tube.' },
  { pattern: '/xray-lab/spectrum', context: 'physics', archetype: 'simulator', note: 'Guided lesson on the spectrum instrument.' },
  { pattern: '/xray-lab/geometry', context: 'physics', archetype: 'simulator', note: 'Guided lesson on the magnification rig.' },
  { pattern: '/xray-lab/interactions', context: 'physics', archetype: 'simulator', note: 'Guided lesson, canvas and tour frames.' },
  { pattern: '/xray-lab/mammography', context: 'physics', archetype: 'simulator', note: 'Mammography module.' },
  { pattern: '/xray-lab/fluoroscopy', context: 'physics', archetype: 'simulator', note: 'Fluoroscopy module.' },
  { pattern: '/xray-lab/digital', context: 'physics', archetype: 'simulator', note: 'CR and digital radiography module.' },
  { pattern: '/xray-lab', context: 'physics', archetype: 'library', note: 'The X-ray family hub — the journey, the machines, the instruments.' },
  { pattern: '/ct-lab/film', context: 'physics', archetype: 'simulator', note: 'The CT film — continuous, no controls.' },
  { pattern: '/ct-lab', context: 'physics', archetype: 'simulator', note: 'CT physics, sixteen drawn concepts.' },
  { pattern: '/nm-lab/film', context: 'physics', archetype: 'simulator', note: 'The nuclear medicine film.' },
  { pattern: '/nm-lab', context: 'physics', archetype: 'simulator', note: 'Nuclear medicine, fourteen drawn concepts.' },
  { pattern: '/mri-lab/motion', context: 'physics', archetype: 'gateway', note: 'Scroll cinematic. Passive preview, marketing register.' },
  { pattern: '/mri-lab/course', context: 'physics', archetype: 'library', note: 'Sequence laboratory index.' },
  { pattern: '/mri-lab/learn/*', context: 'physics', archetype: 'simulator', note: 'Sequence teaching pages.' },
  { pattern: '/mri-lab/*', context: 'physics', archetype: 'simulator', note: 'The MRI sequence laboratory and its experiments.' },
  { pattern: '/mri/:slug', context: 'physics', archetype: 'simulator', note: 'One of twenty-one MRI sections — concept, sim, checkpoint.' },
  { pattern: '/mri', context: 'physics', archetype: 'library', note: 'The MRI module: contents and the causal map.' },
  { pattern: '/ultrasound-lab/motion', context: 'physics', archetype: 'gateway', note: 'Scroll cinematic. Passive preview.' },
  { pattern: '/ultrasound-lab/focus', context: 'physics', archetype: 'library', note: 'The focused course index.' },
  { pattern: '/ultrasound-lab/exam', context: 'physics', archetype: 'practice', note: 'The ultrasound exam lab, ten drill modes.' },
  { pattern: '/ultrasound-lab/facts', context: 'physics', archetype: 'content', note: 'One concept at a time, browse behind a switch.' },
  { pattern: '/ultrasound-lab/*', context: 'physics', archetype: 'simulator', note: 'Nineteen ultrasound experiments.' },
  { pattern: '/ultrasound-lab', context: 'physics', archetype: 'simulator', note: 'Sound fundamentals — the first experiment.' },

  /* ---------------- Legacy ---------------- */
  { pattern: '/physics-v2/*', context: 'physics', archetype: 'library',
    note: 'Redirects into /physics. Kept so old links resolve.' },
]

/* ------------------------------------------------------------------ *
 * Resolution
 * ------------------------------------------------------------------ */

/** One pattern against one pathname. `:x` matches a segment, `*` the rest. */
function matches(pattern: string, path: string): boolean {
  if (pattern === '/') return path === '/'
  const wild = pattern.endsWith('/*')
  const p = (wild ? pattern.slice(0, -2) : pattern).split('/').filter(Boolean)
  const s = path.split('/').filter(Boolean)
  if (wild ? s.length < p.length : s.length !== p.length) return false
  return p.every((seg, i) => seg.startsWith(':') || seg === s[i])
}

/**
 * What a pathname is. Returns null for anything undeclared — a caller then
 * renders the plain global shell rather than guessing at a context, which is
 * the failure this file exists to prevent.
 */
export function specFor(pathname: string): RouteSpec | null {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return ROUTES.find((r) => matches(r.pattern, clean)) ?? null
}

export function contextFor(pathname: string): Context {
  return specFor(pathname)?.context ?? 'global'
}

export function archetypeFor(pathname: string): Archetype | null {
  return specFor(pathname)?.archetype ?? null
}

/**
 * The breadcrumb trail a route earns, derived rather than hand-written.
 *
 * A global page reads "RadioPass / Progress" and NEVER "RadioPass / Anatomy /
 * Progress" — assigning a global destination to a subject is exactly the
 * false hierarchy the system forbids. The deeper segments stay the caller's
 * job: only the page knows a chapter's name.
 */
export function trailFor(pathname: string): { label: string; to: string }[] {
  const ctx = contextFor(pathname)
  const root = { label: 'RadioPass', to: '/' }
  if (ctx === 'anatomy') return [root, { label: 'Anatomy', to: '/anatomy' }]
  if (ctx === 'physics') return [root, { label: 'Physics', to: '/physics' }]
  return [root]
}

/* ------------------------------------------------------------------ *
 * Migration state
 * ------------------------------------------------------------------ */

/**
 * Routes already rendering inside the new <Shell>.
 *
 * During the migration two chromes exist: App.tsx's original Header/Footer,
 * and the shell. A page must never show both, so this list is what App's
 * `hasOwnChrome` consults — one explicit register rather than a predicate
 * that has to be kept in step by hand in two files.
 *
 * It grows as archetypes are migrated and is DELETED once it covers
 * everything: at that point the old Header comes out and every route is
 * simply inside the shell. A route in here is a promise that the page
 * renders <Shell> itself.
 */
export const MIGRATED: string[] = [
  '/_shell',
]

/** True when this pathname already brings the new shell with it. */
export function isMigrated(pathname: string): boolean {
  const clean = pathname.replace(/\/+$/, '') || '/'
  return MIGRATED.some((p) => matches(p, clean))
}
