/**
 * Question id → the teaching that explains it.
 *
 * WHY THIS IS ITS OWN LEAF, AND WHY IT IMPORTS ALMOST NOTHING. The question
 * bank is the surface candidates actually live in, and until now none of the
 * teaching built for the course reached it: a candidate got a question wrong,
 * read one line of stem explanation, and had no way back to the mechanism.
 * This is the join that fixes that.
 *
 * The join has to be affordable. The question-bank chunk is currently ~1.1 MB
 * and contains no three.js at all; the course content chunk pulls 116
 * simulations and an 850 kB WebGL runtime behind it. So this module touches
 * ONLY the three JSX-free mapping files — questionMap, sections, concepts —
 * and never a content file. Reaching an actual simulation is a separate,
 * dynamically imported step (simsFor.ts), taken only when a candidate asks
 * for one.
 *
 * IT IS ALSO CAREFUL WHAT IT CLAIMS. The map is checked in and auditable, but
 * `npm run physics:map` reports 455 of its 467 rows as still machine-assigned
 * and 113 as drifted against their own keywords. So the answer this returns is
 * "the section this question was filed under", and the UI says exactly that —
 * never "this question is about X". A modest claim can be wrong without
 * embarrassing itself at the worst possible moment, which is the moment
 * somebody has just got the question wrong.
 */

import { CONCEPTS, type ConceptMeta } from './concepts'
import { QUESTION_MAP } from './questionMap'
import { SECTIONS_WITHOUT_SIM, TOPIC_META, sectionList } from './sections'

export type Teaching = {
  topicId: string
  topicNum: number
  topicTitle: string
  sectionId: string
  sectionTitle: string
  sectionBlurb?: string
  /** 1-based position within the topic — the ".2" of "§1.2". */
  sectionIndex: number
  /** The governing principle, when the map names one. 106 rows do not. */
  concept: ConceptMeta | null
  /**
   * False for the six sections that teach with prose alone, and for any
   * question whose concept declares that nothing in the course simulates it.
   */
  hasSim: boolean
  /** Anchor into the course: '/physics/xray#tube'. */
  href: string
}

/** Built once. The map is static checked-in data, so this never invalidates. */
const BY_QUESTION = new Map(QUESTION_MAP.map((row) => [row.q, row]))

/**
 * What teaches this question, or null.
 *
 * Null is a real and common answer, not a failure: the three fixed mock papers
 * carry 120 questions of their own that are not in the bank and so have no map
 * row. Callers render nothing extra rather than guessing, which keeps a mock
 * review identical to what it shows today instead of half-filled.
 */
export function teachingFor(questionId: string): Teaching | null {
  const row = BY_QUESTION.get(questionId)
  if (!row) return null

  const sections = sectionList(row.topic)
  const index = sections.findIndex((s) => s.id === row.section)
  const section = sections[index]
  const topic = TOPIC_META[row.topic]
  if (!section || !topic) return null

  const concept = row.concept
    ? (CONCEPTS[row.topic] ?? []).find((c) => c.id === row.concept) ?? null
    : null

  return {
    topicId: row.topic,
    topicNum: topic.num,
    topicTitle: topic.title,
    sectionId: section.id,
    sectionTitle: section.title,
    sectionBlurb: section.blurb,
    sectionIndex: index + 1,
    concept,
    /* A section having a simulation is not the same as this question having
       one. Where the concept says its principle is simulated nowhere, the
       button goes rather than opening something unrelated to the mark just
       dropped. */
    hasSim: !SECTIONS_WITHOUT_SIM.includes(`${row.topic}/${row.section}`) && !concept?.noInstrument,
    href: `/physics/${row.topic}#${section.id}`,
  }
}

/** How many bank questions the map can currently teach. Used by the test. */
export function teachingCoverage(): { mapped: number; withSim: number } {
  let withSim = 0
  for (const row of QUESTION_MAP) {
    if (!SECTIONS_WITHOUT_SIM.includes(`${row.topic}/${row.section}`)) withSim += 1
  }
  return { mapped: QUESTION_MAP.length, withSim }
}
