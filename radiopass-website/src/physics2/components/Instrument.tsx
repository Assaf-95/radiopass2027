/**
 * One simulation, mounted under a question, only once asked for.
 *
 * Lazily imported by QuestionAfterword so that neither this file nor anything
 * it reaches is in the question bank's chunk until a candidate presses the
 * button. That matters more than it sounds: a 40-question mock review renders
 * every card at once, and the average question's section carries 2.3
 * simulations. Mounting them eagerly would put ~92 animation loops on one page,
 * about a quarter of them canvases whose requestAnimationFrame loop has no
 * visibility gate at all.
 *
 * So: ONE instrument mounted at a time, even when a section has seven. The
 * pager moves between them, and moving unmounts the previous one. A candidate
 * reading about the MR signal gets the precession simulator or the FID, never
 * both at once — which is also the teaching rule the owner has asked for
 * repeatedly: one idea on screen, with its picture, without scrolling.
 */

import { useEffect, useRef, useState } from 'react'

import { FilmPlate } from './Primer'
import { simsFor } from '../mapping/simsFor'
import type { V2Sim } from '../types'
import '../v2.css'

export default function Instrument({
  topicId,
  sectionId,
  onEmpty,
}: {
  topicId: string
  sectionId: string
  /** Told when the section turns out to teach with prose alone. */
  onEmpty?: () => void
}) {
  const [sims, setSims] = useState<V2Sim[] | null>(null)
  const [index, setIndex] = useState(0)
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let live = true
    /* Clear FIRST. The question pagers render <QuestionCard> without a key, so
       moving to the next question re-renders this same instance rather than
       remounting it — and without this the candidate saw the previous
       section's simulation, at the previous pager position, sitting under the
       new question's "this question comes from §N.M". */
    setSims(null)
    setIndex(0)
    void simsFor(topicId, sectionId).then((found) => {
      if (!live) return
      setSims(found)
      if (found.length === 0) onEmpty?.()
    })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topicId, sectionId])

  /* Bring the instrument and its caption onto one screen. Opening something
     below the fold and leaving the reader to find it is the scrolling problem
     this product keeps being told to avoid. */
  useEffect(() => {
    if (sims && sims.length > 0) host.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
  }, [sims])

  if (sims === null) {
    return (
      <p className="v2-aw-loading" role="status">
        Loading the instrument…
      </p>
    )
  }
  if (sims.length === 0) return null

  const sim = sims[Math.min(index, sims.length - 1)]
  return (
    <div className="v2-aw-instrument" ref={host}>
      <FilmPlate key={`${topicId}/${sectionId}/${index}`} sim={sim} />
      {sims.length > 1 && (
        <div className="v2-aw-pager">
          <button
            type="button"
            className="v2-btn v2-btn-quiet"
            disabled={index === 0}
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
          >
            &larr; Previous
          </button>
          <span>
            Instrument {index + 1} of {sims.length}
          </span>
          <button
            type="button"
            className="v2-btn v2-btn-quiet"
            disabled={index >= sims.length - 1}
            onClick={() => setIndex((i) => Math.min(sims.length - 1, i + 1))}
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  )
}
