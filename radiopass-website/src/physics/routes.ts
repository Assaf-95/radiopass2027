/**
 * Every physics URL, in one place.
 *
 * WHY THIS FILE EXISTS. The course engine shipped as a parallel site at
 * /physics-v2 and hardcoded that prefix 34 times across nine files — nine of
 * them inside `visit={{ path: ... }}`, which does not merely render a link but
 * writes the path into the learner's stored Continue position. Renaming the
 * branch by hand therefore meant editing 34 strings AND leaving every learner
 * who had already been here pointing at a URL that no longer existed.
 *
 * The two surfaces are now one product, RADIOPASS PHYSICS, mounted under
 * /physics. There is no learner-facing "V2". Nothing below hardcodes the
 * prefix a second time, so the next move is one edit here.
 *
 * ROUTE SHAPE. Topics sit flat under the root — /physics/xray, not
 * /physics/topic/xray — because the clean URL is worth more than the risk, and
 * the risk is guarded rather than designed around: RESERVED_SLUGS lists the
 * static segments that share the level, and routes.test.ts fails the build if a
 * topic id ever collides with one. React Router ranks static segments above
 * dynamic ones, so /physics/review reaches Review even though /physics/:topicId
 * would also match it; the test exists for the day someone adds a topic called
 * "review" and cannot work out why its primer never loads.
 *
 * LESSON ROUTES ARE NOT HERE. /xray-lab/*, /ct-lab, /nm-lab, /mri, and
 * /ultrasound-lab/* keep their own addresses and must never move: module
 * completion telemetry is keyed by live pathname (labs/lesson.tsx), those
 * events sync to Supabase, and a rename silently reverts every learner's
 * progress to "not started". The merge joins the navigation, not the URLs.
 */

/** The one prefix. Everything the physics branch serves hangs off this. */
export const PHYSICS_ROOT = '/physics'

/** The branch's fixed surfaces. */
export const PHYSICS_HREF = {
  /** The dashboard: the learner's record, the course, the practice doors. */
  home: PHYSICS_ROOT,
  /** The syllabus. Folded into the dashboard; kept as an address people typed. */
  course: `${PHYSICS_ROOT}/course`,
  questions: `${PHYSICS_ROOT}/questions`,
  review: `${PHYSICS_ROOT}/review`,
  mock: `${PHYSICS_ROOT}/mock`,
  /** The cinematic page. Has its own chrome; unchanged by the merge. */
  tour: `${PHYSICS_ROOT}/tour`,
} as const

/**
 * Static segments that live at the same level as a topic id. A topic whose id
 * appears here would be unreachable — the static route always wins.
 */
export const RESERVED_SLUGS: readonly string[] = [
  'tour',
  'course',
  'questions',
  'review',
  'mock',
]

/** A topic's primer. `section` scrolls to a numbered section on arrival. */
export function topicHref(topicId: string, section?: string): string {
  return `${PHYSICS_ROOT}/${topicId}${section ? `#${section}` : ''}`
}

/**
 * A practice session. Both parameters are read back by the practice page, and
 * the resulting string is what gets stored as the learner's Continue position —
 * so it is built here rather than assembled at each of the eight call sites.
 */
export function practiceHref(
  topicId: string,
  opts: { section?: string; filter?: string } = {},
): string {
  const q = new URLSearchParams()
  if (opts.section) q.set('section', opts.section)
  if (opts.filter) q.set('filter', opts.filter)
  const search = q.toString()
  return `${PHYSICS_ROOT}/${topicId}/practice${search ? `?${search}` : ''}`
}

/**
 * The address this branch used to answer on. Retained ONLY as the source of the
 * redirects in App.tsx: a learner's bookmark, a stored Continue path written
 * before the merge, and the anchors in the static HTML under /public all still
 * arrive here.
 */
export const LEGACY_PHYSICS_ROOT = '/physics-v2'
