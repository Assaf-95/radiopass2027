/**
 * The one place a question surface may reach a real simulation.
 *
 * Every import here is DYNAMIC, and that is the whole point. A content module
 * carries its topic's primer plus every simulation mounted in it; between them
 * the nine of them pull ~2 MB of JavaScript and the 850 kB three.js runtime.
 * The question bank must not pay that to render a question — it pays only when
 * a candidate presses "Show me it working", and then only for the one topic
 * they asked about.
 *
 * NOTHING IS COPIED. The V2Sim objects returned are the very objects the course
 * renders — same title, same annotation, same caption, same element. A
 * simulation improved in its content file is improved here on the next load,
 * because there is no second copy to forget to update.
 */

import type { V2Sim, V2Topic } from '../types'

/** Static keys, dynamic bodies: Vite can only split what it can see named. */
const CONTENT: Record<string, () => Promise<V2Topic>> = {
  xray: () => import('../content/xray').then((m) => m.XRAY),
  digital: () => import('../content/digital').then((m) => m.DIGITAL),
  fluoro: () => import('../content/fluoro').then((m) => m.FLUORO),
  mammo: () => import('../content/mammo').then((m) => m.MAMMO),
  ct: () => import('../content/ct').then((m) => m.CT),
  nm: () => import('../content/nm').then((m) => m.NM),
  mri: () => import('../content/mri').then((m) => m.MRI),
  us: () => import('../content/us').then((m) => m.US),
  safety: () => import('../content/safety').then((m) => m.SAFETY),
}

/**
 * The simulations a section teaches with, in the order the section teaches
 * them. Empty for the six prose-only sections, and empty rather than throwing
 * if a section id ever stops existing — a question sheet must not fail because
 * a primer was reorganised.
 */
export async function simsFor(topicId: string, sectionId: string): Promise<V2Sim[]> {
  const load = CONTENT[topicId]
  if (!load) return []
  try {
    const topic = await load()
    const section = topic.sections.find((s) => s.id === sectionId)
    if (!section) return []
    return section.primer.flatMap((block) => (block.kind === 'sim' ? [block.sim] : []))
  } catch {
    /* A chunk that will not load leaves the strip's text intact; the candidate
       keeps the principle and the section link, and loses only the animation. */
    return []
  }
}
