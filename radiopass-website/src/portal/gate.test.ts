/**
 * Which routes are gated, asserted against the route table itself.
 *
 * The gate decides who can see the product, and the failure modes are
 * opposite and both silent. Forget to wrap a route and the paid course is
 * free to anyone who guesses the URL — the sample's whole funnel leaks.
 * Wrap the wrong one and a shop window becomes a wall: gate `/physics` and
 * the dashboard that is meant to sell the course asks people to sign up
 * before they can see what they would be signing up for.
 *
 * So both lists are pinned. Adding a route means deciding which side it is
 * on, deliberately, here.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')

/**
 * Every declared route, with whether its element is wrapped in RequireAccess.
 *
 * Read by slicing from each `<Route` to the next one rather than by matching
 * the element expression: a resource prop is `{{ ... }}`, and any regex that
 * tries to balance those braces is one bracket-class typo away from matching
 * nothing and passing this whole file vacuously.
 */
function routes(): { path: string; gated: boolean }[] {
  const starts = [...SRC.matchAll(/<Route\s+path="([^"]+)"/g)]
  return starts.map((m, i) => {
    const from = m.index ?? 0
    const to = i + 1 < starts.length ? (starts[i + 1].index ?? SRC.length) : SRC.length
    return { path: m[1], gated: SRC.slice(from, to).includes('RequireAccess') }
  })
}

/** Open to everyone: the shop windows, the sample, and the account plumbing. */
const MUST_BE_OPEN = [
  '/',
  '/physics',
  '/physics/tour',
  '/physics/course',
  '/free-trial',
  '/pricing',
  '/login',
  '/reset-password',
  '/study-plan',
  '/about',
  '/privacy',
  '/terms',
  '/adrenal-adenoma',
  '/admin',
  '/anatomy/*',
  '*',
]

/** The course itself. Every one of these must ask for an account. */
const MUST_BE_GATED = [
  '/physics/questions',
  '/physics/review',
  '/physics/mock',
  '/physics/:topicId',
  '/physics/:topicId/practice',
  '/question-bank',
  '/question-bank/mock',
  '/question-bank/review/:filterId',
  '/question-bank/:subjectId',
  '/fact-bank',
  '/fact-bank/:topicId',
  '/xray-lab',
  '/xray-lab/production',
  '/xray-lab/spectrum',
  '/xray-lab/geometry',
  '/xray-lab/interactions',
  '/xray-lab/mammography',
  '/xray-lab/fluoroscopy',
  '/xray-lab/digital',
  '/ct-lab',
  '/nm-lab',
  '/visual-lab',
  '/mri',
  '/mri-lab',
  '/mri-lab/course',
  '/mri-lab/flair',
  '/mri-lab/learn/flair',
  '/ultrasound-lab',
  '/ultrasound-lab/doppler',
  '/ultrasound-lab/artefacts',
  '/ultrasound-lab/facts',
]

describe('the access gate', () => {
  const all = routes()
  const byPath = new Map(all.map((r) => [r.path, r.gated]))

  it('reads the route table', () => {
    // Guards the guard: a regex that stops matching passes everything below.
    expect(all.length).toBeGreaterThan(40)
    expect(byPath.has('/physics')).toBe(true)
  })

  it('leaves the shop windows open', () => {
    const wronglyGated = MUST_BE_OPEN.filter((p) => byPath.get(p) === true)
    expect(wronglyGated).toEqual([])
  })

  it('gates the course', () => {
    const wronglyOpen = MUST_BE_GATED.filter((p) => byPath.get(p) !== true)
    expect(wronglyOpen).toEqual([])
  })

  it('keeps the dashboard open, because it is what sells the course', () => {
    /* Called out on its own: /physics is the front door and shows the
       learner's own record. canAccess() treats kind 'home' and 'progress' as
       public for the same reason, and this asserts the routing agrees. */
    expect(byPath.get('/physics')).toBe(false)
    expect(byPath.get('/free-trial')).toBe(false)
  })

  it('sends every gate to a resource with a branch and a kind', () => {
    const bad = [...SRC.matchAll(/<RequireAccess resource=\{\{([^}]*)\}\}/g)]
      .map((m) => m[1])
      .filter((r) => !/branch:\s*'(physics|anatomy)'/.test(r) || !/kind:\s*'\w+'/.test(r))
    expect(bad).toEqual([])
  })
})
