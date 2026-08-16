/**
 * The V2 syllabus — one array, study order. Each topic lives in its own
 * content file; this registry is the only place that assembles them.
 */

import type { V2Topic } from './types'
import { XRAY } from './content/xray'
import { DIGITAL } from './content/digital'
import { FLUORO } from './content/fluoro'
import { MAMMO } from './content/mammo'
import { CT } from './content/ct'
import { NM } from './content/nm'
import { MRI } from './content/mri'
import { US } from './content/us'
import { SAFETY } from './content/safety'

export const V2_TOPICS: V2Topic[] = [XRAY, DIGITAL, FLUORO, MAMMO, CT, NM, MRI, US, SAFETY].sort(
  (a, b) => a.num - b.num,
)

export function topicById(id: string): V2Topic | undefined {
  return V2_TOPICS.find((t) => t.id === id)
}
