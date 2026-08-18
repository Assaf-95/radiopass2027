/**
 * The physics route tree cannot drift from the constants that address it.
 *
 * Three separate things now have to agree about where a physics page lives:
 * the <Route> table in App.tsx, which decides what actually resolves; the
 * PHYSICS_HREF constants, which every link and every STORED Continue position
 * is built from; and the nine topic ids, which occupy the same URL level as
 * five static siblings. Any two of them agreeing is not enough.
 *
 * The failure this exists to prevent is silent in all three directions. A
 * constant that no longer matches a route renders a link straight to the 404
 * page. A topic named after a reserved word simply never loads its primer,
 * because React Router ranks the static segment above the dynamic one and
 * nothing anywhere reports a conflict. And a missing emblem case just draws
 * nothing where a part's instrument mark should be.
 *
 * Reading App.tsx as text is the same technique labLink.test.ts uses, for the
 * same reason: the route table is a JSX literal, and parsing it is the only way
 * to assert against what the router will really do rather than against a second
 * copy of the answer.
 */

/* FIRST, and it has to be. Importing the syllabus registry pulls in all nine
   content files and every simulation mounted in them, and one of those reads
   window.matchMedia at module scope (sims/CtScenes.tsx) — which jsdom does not
   implement. Module evaluation follows import order, so the shim has to be
   declared above the registry rather than set up in a hook. */
import '../mri/test/setup'

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { COURSE_PARTS, COURSE_MODULES } from './course'
import { TOPIC_OUTCOMES, outcomesForModule } from './outcomes'
import {
  LEGACY_PHYSICS_ROOT,
  PHYSICS_HREF,
  PHYSICS_ROOT,
  RESERVED_SLUGS,
  practiceHref,
  topicHref,
} from './routes'
import { V2_TOPICS } from '../physics2/topics'

function source(...parts: string[]): string {
  return readFileSync(join(process.cwd(), 'src', ...parts), 'utf8')
}

/** Every path App.tsx declares, dynamic segments left in place. */
function declaredRoutes(): string[] {
  return [...source('App.tsx').matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
}

describe('the physics route tree', () => {
  const routes = declaredRoutes()

  it('reads the route table', () => {
    // Guards the guard: a regex that stops matching would pass everything below.
    expect(routes.length).toBeGreaterThan(50)
    expect(routes).toContain(PHYSICS_ROOT)
  })

  it('declares a route for every address PHYSICS_HREF can produce', () => {
    const missing = Object.entries(PHYSICS_HREF).filter(([, href]) => !routes.includes(href))
    expect(missing).toEqual([])
  })

  it('declares the topic and practice routes the helpers build', () => {
    expect(routes).toContain(`${PHYSICS_ROOT}/:topicId`)
    expect(routes).toContain(`${PHYSICS_ROOT}/:topicId/practice`)
  })

  it('still forwards the address the course engine used to answer on', () => {
    expect(routes).toContain(`${LEGACY_PHYSICS_ROOT}/*`)
  })

  it('has no learner-facing "V2" left in the physics surfaces', () => {
    /* The merge's whole point. Comments explaining the history are fine; a
       link, a label or a stored path is not. */
    const files = [
      ['physics', 'Home.tsx'],
      ['physics2', 'components', 'Shell.tsx'],
      ['physics2', 'pages', 'Topic.tsx'],
      ['physics2', 'pages', 'Practice.tsx'],
      ['physics2', 'pages', 'Review.tsx'],
      ['physics2', 'pages', 'Questions.tsx'],
    ]
    const offenders: string[] = []
    for (const parts of files) {
      for (const line of source(...parts).split('\n')) {
        const code = line.replace(/^\s*(\/\*|\*|\/\/).*/, '')
        if (code.includes(LEGACY_PHYSICS_ROOT)) offenders.push(`${parts.join('/')}: ${line.trim()}`)
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('topic slugs', () => {
  const ids = V2_TOPICS.map((t) => t.id)

  it('never collides with a reserved segment', () => {
    /* /physics/:topicId is a catch-all one segment under /physics, so a topic
       called "review" would be shadowed by the Review page for ever. */
    expect(ids.filter((id) => RESERVED_SLUGS.includes(id))).toEqual([])
  })

  it('covers every static sibling the route table declares', () => {
    // The other direction: a new static page under /physics that nobody added
    // to RESERVED_SLUGS would shadow a future topic without warning.
    const siblings = declaredRoutes()
      .filter((r) => r.startsWith(`${PHYSICS_ROOT}/`))
      .map((r) => r.slice(PHYSICS_ROOT.length + 1))
      .filter((seg) => !seg.includes('/') && !seg.startsWith(':'))
    expect([...new Set(siblings)].sort()).toEqual([...RESERVED_SLUGS].sort())
  })

  it('is unique', () => {
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('builds addresses that keep their query and hash', () => {
    expect(topicHref('xray')).toBe('/physics/xray')
    expect(topicHref('xray', 'tube')).toBe('/physics/xray#tube')
    expect(practiceHref('ct')).toBe('/physics/ct/practice')
    expect(practiceHref('ct', { section: 'dose', filter: 'wrong' })).toBe(
      '/physics/ct/practice?section=dose&filter=wrong',
    )
  })
})

describe('the merged syllabus registry', () => {
  it('joins every topic to a course module', () => {
    /* part and lessons come from course.ts. A topic that failed to join gets
       part 0 and no lessons, which shows as a row in the wrong part of the
       dashboard with a tick that can never be earned. */
    const orphans = V2_TOPICS.filter((t) => t.lessons.length === 0).map((t) => t.id)
    expect(orphans).toEqual([])
  })

  it('gives every topic a part that exists', () => {
    const bad = V2_TOPICS.filter((t) => !COURSE_PARTS[t.part]).map((t) => `${t.id} -> ${t.part}`)
    expect(bad).toEqual([])
  })

  it('accounts for every course module exactly once', () => {
    // Nine subjects, nine modules, nine topics. Any mismatch means a lesson's
    // completion has nowhere to be shown.
    const claimed = V2_TOPICS.flatMap((t) => t.lessons.map((l) => l.path)).sort()
    const declared = COURSE_MODULES.flatMap((m) => m.lessons.map((l) => l.path)).sort()
    expect(claimed).toEqual(declared)
  })

  it('draws an instrument mark for every part', () => {
    /* PartMark switches on the part id and returns null for anything it does
       not recognise, so a new or renamed part loses its emblem in silence. */
    const marks = [...source('physics', 'Home.tsx').matchAll(/case '([a-z-]+)':/g)].map((m) => m[1])
    const unmarked = COURSE_PARTS.map((p) => p.id).filter((id) => !marks.includes(id))
    expect(unmarked).toEqual([])
  })
})

describe('the topic outcomes', () => {
  it('has one list per topic', () => {
    const missing = V2_TOPICS.filter((t) => (TOPIC_OUTCOMES[t.id] ?? []).length === 0).map(
      (t) => t.id,
    )
    expect(missing).toEqual([])
  })

  it('reaches the same list from the course side', () => {
    /* The two id vocabularies disagree on exactly one module. This is the
       assertion that catches a second disagreement appearing. */
    for (const module of COURSE_MODULES) {
      expect(outcomesForModule(module.id), module.id).not.toEqual([])
    }
    expect(outcomesForModule('xray-core')).toBe(TOPIC_OUTCOMES.xray)
  })

  it('is the same text the topic page shows', () => {
    for (const topic of V2_TOPICS) {
      expect(topic.outcomes, topic.id).toBe(TOPIC_OUTCOMES[topic.id])
    }
  })
})
