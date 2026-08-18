/**
 * The syllabus — one array, study order.
 *
 * Each topic is authored in its own content file; this registry is the only
 * place that assembles them, and the only place the two halves of the merged
 * product are joined: the topic (primer, question pool, essentials) to its
 * position in the course spine (which part it belongs to, which bespoke
 * lessons carry its completion telemetry).
 *
 * The join runs one way — this file imports physics/course.ts, never the
 * reverse. course.ts is imported by the lesson player and every laboratory
 * hub; if it reached back into these content files, opening /ct-lab would pull
 * all nine primers and every embedded simulation into the chunk.
 */

import type { CourseTopic } from './types'
import { COURSE_MODULES } from '../physics/course'
import { XRAY } from './content/xray'
import { DIGITAL } from './content/digital'
import { FLUORO } from './content/fluoro'
import { MAMMO } from './content/mammo'
import { CT } from './content/ct'
import { NM } from './content/nm'
import { MRI } from './content/mri'
import { US } from './content/us'
import { SAFETY } from './content/safety'

/**
 * Topic id → course module id, where the two vocabularies disagree.
 *
 * Exactly one disagrees. The topic id is the public URL slug (/physics/xray),
 * so it is the one that must not move; the module id is internal, but
 * labs/xray.tsx looks the module up by name, so that must not move either.
 * The mismatch is therefore resolved here, once, instead of by renaming either
 * side. The other eight ids already match.
 */
const MODULE_ID: Record<string, string> = { xray: 'xray-core' }

function joinToCourse(topic: (typeof XRAY)[]): CourseTopic[] {
  return topic.map((t) => {
    const module = COURSE_MODULES.find((m) => m.id === (MODULE_ID[t.id] ?? t.id))
    /* A topic with no module has no part and no lessons — it still teaches and
       still tests, it simply shows no completion tick. Failing here instead
       would take the whole branch down over a missing row. */
    return { ...t, part: module?.part ?? 0, lessons: module?.lessons ?? [] }
  })
}

export const V2_TOPICS: CourseTopic[] = joinToCourse([
  XRAY,
  DIGITAL,
  FLUORO,
  MAMMO,
  CT,
  NM,
  MRI,
  US,
  SAFETY,
]).sort((a, b) => a.num - b.num)

export function topicById(id: string): CourseTopic | undefined {
  return V2_TOPICS.find((t) => t.id === id)
}

/** The topics of one course part, in study order. Empty parts render nothing. */
export function topicsInPart(part: number): CourseTopic[] {
  return V2_TOPICS.filter((t) => t.part === part)
}
