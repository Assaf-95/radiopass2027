/**
 * The topic registry must stay importable outside a browser.
 *
 * This is not a formality. `src/physics2/topics.ts` pulls in all nine content
 * files, which pull in their sims — and a sim that touches a browser global at
 * MODULE scope takes the whole registry down on import. That already happened
 * once: CtScenes.tsx called `window.matchMedia(...)` behind a `typeof window`
 * check alone, which passes under jsdom (there is a window) and then throws
 * (jsdom's window has no matchMedia). Every test that reads a topic died on
 * import, and the merge audit's proposed mapping validator could not have been
 * written at all.
 *
 * The failure is invisible in the browser and invisible to `tsc`, so only a
 * test that actually imports the registry outside a browser can catch it.
 * Keeping this file free of jsdom shims is the point — do not add them.
 */

import { describe, expect, test } from 'vitest'
import { V2_TOPICS, topicById } from './topics'

describe('the V2 topic registry', () => {
  test('imports without a browser and yields all nine topics', () => {
    expect(V2_TOPICS).toHaveLength(9)
  })

  test('ids are unique — assignment caches and routes key off them', () => {
    const ids = V2_TOPICS.map((t) => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('num runs 1..9 in study order, because Home renders in array order', () => {
    expect(V2_TOPICS.map((t) => t.num)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9])
  })

  test('every topic resolves by id, and an unknown id resolves to undefined', () => {
    for (const topic of V2_TOPICS) expect(topicById(topic.id)?.id).toBe(topic.id)
    expect(topicById('no-such-topic')).toBeUndefined()
  })

  test('every section id is unique within its topic — question feedback anchors to it', () => {
    for (const topic of V2_TOPICS) {
      const ids = topic.sections.map((s) => s.id)
      expect(new Set(ids).size, `duplicate section id in ${topic.id}`).toBe(ids.length)
    }
  })
})
