/**
 * The question -> laboratory mapping cannot drift.
 *
 * Three RadioPass lineages in the archive independently solved the same
 * problem — binding exam questions to the teaching asset that explains them —
 * and each solved it the same way: an explicit registry, guarded by a test
 * that proves every entry resolves to a file that really exists. None of them
 * pattern-matched the question text and hoped.
 *
 * This is that guarantee, expressed against a router instead of a folder:
 *
 *   1. every topic present in the bank has a registry entry — so a topic added
 *      to the data can never silently fall through to a generic fallback;
 *   2. every href the registry or the keyword tables can produce resolves to a
 *      route App.tsx actually declares — so a lab that is renamed or removed
 *      breaks the build here, not under a candidate who clicks the link.
 *
 * (2) is the one that matters. A dead "Explore this in the …" link is invisible
 * to everyone except the candidate who follows it, and it is the last thing
 * they see after getting a question wrong.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { QB_QUESTIONS } from './data'
import { MOCK_PAPERS } from './data/mocks'
import { labLinkFor, TOPIC_LABS } from './types'

/** Every path App.tsx declares, with the dynamic segments left in place. */
function declaredRoutes(): string[] {
  const src = readFileSync(join(process.cwd(), 'src', 'App.tsx'), 'utf8')
  return [...src.matchAll(/<Route\s+path="([^"]+)"/g)].map((m) => m[1])
}

/** True if `href` — minus any hash or query — matches a declared route. */
function routeExists(href: string, routes: string[]): boolean {
  const path = href.split(/[?#]/)[0]
  return routes.some((route) => {
    if (route === path) return true
    // A declared ":param" segment matches any single non-empty segment.
    if (!route.includes(':')) return false
    const a = route.split('/')
    const b = path.split('/')
    if (a.length !== b.length) return false
    return a.every((seg, i) => (seg.startsWith(':') ? b[i].length > 0 : seg === b[i]))
  })
}

describe('question to laboratory links', () => {
  const routes = declaredRoutes()

  it('finds the routes declared in App.tsx', () => {
    // Guards the guard: if the regex above ever stops matching, every other
    // assertion in this file would pass vacuously.
    expect(routes.length).toBeGreaterThan(50)
    expect(routes).toContain('/xray-lab')
    expect(routes).toContain('/nm-lab')
  })

  it('has a registry entry for every topic in the bank', () => {
    const topics = [...new Set(QB_QUESTIONS.map((q) => q.topic))].sort()
    const missing = topics.filter((t) => !TOPIC_LABS[t])
    expect(missing).toEqual([])
  })

  it('points every registry entry at a route that exists', () => {
    const broken = Object.entries(TOPIC_LABS)
      .filter(([, link]) => !routeExists(link.href, routes))
      .map(([topic, link]) => `${topic} -> ${link.href}`)
    expect(broken).toEqual([])
  })

  it('resolves every question in the bank to a route that exists', () => {
    const broken = QB_QUESTIONS.map((q) => ({ q, link: labLinkFor(q) }))
      .filter(({ link }) => !routeExists(link.href, routes))
      .map(({ q, link }) => `${q.id} (${q.topic}) -> ${link.href}`)
    expect(broken).toEqual([])
  })

  it('resolves every mock paper question too', () => {
    const all = MOCK_PAPERS.flatMap((p) => p.questions)
    const broken = all
      .map((q) => ({ q, link: labLinkFor(q) }))
      .filter(({ link }) => !routeExists(link.href, routes))
      .map(({ q, link }) => `${q.id} -> ${link.href}`)
    expect(broken).toEqual([])
  })

  it('sends each modality to its own laboratory, not to the fact bank', () => {
    // The regression this replaces: mammography, digital imaging, fluoroscopy
    // and nuclear medicine questions all landed on /fact-bank while their labs
    // sat built and unmentioned.
    const cases: [string, string][] = [
      ['Mammography', '/xray-lab/mammography'],
      ['Digital Imaging', '/xray-lab/digital'],
      ['Fluoroscopy', '/xray-lab/fluoroscopy'],
      ['Nuclear Medicine', '/nm-lab'],
      ['CT', '/ct-lab'],
      ['Radiography & X-ray Physics', '/xray-lab'],
    ]
    for (const [topic, href] of cases) {
      expect(TOPIC_LABS[topic]?.href, topic).toBe(href)
    }
  })

  it('still prefers the specific experiment when the wording names one', () => {
    const doppler = labLinkFor({
      topic: 'Ultrasound',
      title: 'Regarding the Doppler effect',
      stems: [{ label: 'A', text: 'Aliasing begins at the Nyquist limit', answer: true }],
    } as never)
    expect(doppler.href).toBe('/ultrasound-lab/doppler')

    const flair = labLinkFor({
      topic: 'MRI',
      title: 'Regarding FLAIR',
      stems: [{ label: 'A', text: 'FLAIR nulls CSF', answer: true }],
    } as never)
    expect(flair.href).toBe('/mri-lab/flair')
  })

  it('sends no question to the generic fact-bank front page', () => {
    /* questions.base.json carries two placeholder topics — "Other" (57) and
       "Basic Physics" (10) — but annotations.json supplies a corrected topic
       that overrides them during assembly, so by the time the bank reaches the
       UI every question has a real modality. That makes the strong assertion
       the right one: nothing should land on the undirected front page.

       TOPIC_LABS still carries entries for both placeholders. They are the
       backstop for a question added without an annotation, and the two tests
       above would catch that appearing. */
    const generic = QB_QUESTIONS.filter((q) => labLinkFor(q).href === '/fact-bank')
    expect(generic.map((q) => `${q.id} (${q.topic})`)).toEqual([])
  })

  it('routes the whole bank to a modality laboratory', () => {
    const byTopic = new Map<string, number>()
    for (const q of QB_QUESTIONS) byTopic.set(q.topic, (byTopic.get(q.topic) ?? 0) + 1)
    // Every topic the bank actually uses is a real modality, not a placeholder.
    expect([...byTopic.keys()].filter((t) => t === 'Other' || t === 'Basic Physics')).toEqual([])
    expect(QB_QUESTIONS.length).toBeGreaterThan(380)
  })
})
