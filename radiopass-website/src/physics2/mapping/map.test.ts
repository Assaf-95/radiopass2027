/**
 * The mapping layer's own invariants.
 *
 * npm run physics:map is the full audit and gates the release; these are the
 * handful of structural facts the unit suite should catch the moment they
 * break, without anyone remembering to run the script.
 */

/* FIRST — the topic registry pulls in all nine content files and every
   mounted simulation, one of which reads window.matchMedia at module scope;
   jsdom needs the shim in place before that import evaluates. Same pattern,
   same reason, as physics/routes.test.ts. */
import '../../mri/test/setup'

import { describe, expect, it } from 'vitest'

import { QB_QUESTIONS_FULL as QB_QUESTIONS } from '../../qbank/data/full'
import { V2_TOPICS } from '../topics'
import { SECTIONS, TOPIC_POOLS, sectionList } from './sections'
import { CONCEPTS } from './concepts'
import { QUESTION_MAP, ALLOW_EMPTY } from './questionMap'
import { assignments } from '../lib/assign'

describe('the lifted section metadata', () => {
  it('matches the content files, in order', () => {
    /* The lift left the primer in the .tsx and moved the matching rules here,
       with the CONTRACT that both list sections in the same order. The topic
       page numbers sections by array position (§5.2), so a divergence would
       renumber a primer's sections against their own anchors. */
    for (const topic of V2_TOPICS) {
      expect(
        topic.sections.map((s) => s.id),
        topic.id,
      ).toEqual(sectionList(topic.id).map((s) => s.id))
    }
  })

  it('covers exactly the nine topics', () => {
    expect(Object.keys(SECTIONS).sort()).toEqual(V2_TOPICS.map((t) => t.id).sort())
  })

  it('binds every topic to at least one bank topic', () => {
    for (const topic of V2_TOPICS) {
      expect(TOPIC_POOLS[topic.id]?.length, topic.id).toBeGreaterThan(0)
    }
  })

  it('keeps every concept id unique within its topic', () => {
    for (const [topicId, list] of Object.entries(CONCEPTS)) {
      const ids = list.map((c) => c.id)
      expect(new Set(ids).size, topicId).toBe(ids.length)
    }
  })
})

describe('the question map', () => {
  it('maps every bank question exactly once', () => {
    const seen = new Map<string, number>()
    for (const row of QUESTION_MAP) seen.set(row.q, (seen.get(row.q) ?? 0) + 1)
    const missing = QB_QUESTIONS.filter((q) => !seen.has(q.id)).map((q) => q.id)
    const dupes = [...seen.entries()].filter(([, n]) => n > 1).map(([q]) => q)
    expect(missing).toEqual([])
    expect(dupes).toEqual([])
  })

  it('points every row at a section that exists', () => {
    const bad = QUESTION_MAP.filter(
      (r) => !sectionList(r.topic).some((s) => s.id === r.section),
    ).map((r) => `${r.q} -> ${r.topic}/${r.section}`)
    expect(bad).toEqual([])
  })

  it('explains every manual decision and every topic override', () => {
    const silent = QUESTION_MAP.filter(
      (r) => (r.by === 'manual' || r.overrideTopic) && !r.note,
    ).map((r) => r.q)
    expect(silent).toEqual([])
  })

  it('leaves no section both empty and unwaived', () => {
    const counts = new Map<string, number>()
    for (const r of QUESTION_MAP) {
      const key = `${r.topic}/${r.section}`
      counts.set(key, (counts.get(key) ?? 0) + 1)
    }
    const emptyUnwaived: string[] = []
    for (const topic of V2_TOPICS) {
      for (const s of sectionList(topic.id)) {
        const key = `${topic.id}/${s.id}`
        if ((counts.get(key) ?? 0) === 0 && !ALLOW_EMPTY.includes(key)) emptyUnwaived.push(key)
      }
    }
    expect(emptyUnwaived).toEqual([])
  })
})

describe('the runtime lookup', () => {
  it('serves every topic its mapped pool, fully sectioned', () => {
    let pooled = 0
    for (const topic of V2_TOPICS) {
      const a = assignments(topic)
      pooled += a.pool.length
      // Every pooled question lands in exactly one of the topic's sections.
      for (const q of a.pool) {
        expect(a.bySection.get(q.id), `${topic.id}/${q.id}`).toBeDefined()
      }
      const sectioned = [...a.sections.values()].reduce((n, list) => n + list.length, 0)
      expect(sectioned, topic.id).toBe(a.pool.length)
    }
    // The re-homed questions moved topics; nothing fell out of the product.
    expect(pooled).toBe(QB_QUESTIONS.length)
  })

  it('re-homes the three misfiled questions', () => {
    /* The bank files these under Nuclear Medicine; the map moves two to
       Safety and keeps one, each with a note. The point of the assertion is
       that a regenerated map would silently lose these decisions — this is
       the tripwire that says the bootstrap ran with --force. */
    const b443 = QUESTION_MAP.find((r) => r.q === 'b443')
    const b35 = QUESTION_MAP.find((r) => r.q === 'b35')
    expect(b443?.topic).toBe('safety')
    expect(b443?.overrideTopic).toBe(true)
    expect(b35?.topic).toBe('safety')
    const safetyPool = assignments(V2_TOPICS.find((t) => t.id === 'safety')!).pool
    expect(safetyPool.some((q) => q.id === 'b443')).toBe(true)
  })
})
