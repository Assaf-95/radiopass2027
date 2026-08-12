/**
 * The live teaching panel that runs across the bottom of every experiment.
 *
 * Six fixed slots, always in the same order, so a learner always knows where to
 * look: what is happening, why, the equation, the direction of change, what it
 * means clinically, and the examination trap. Revision mode strips it back to
 * rule, equation, direction and trap — which is what a candidate wants the week
 * before the exam.
 */

import { useState, type ReactNode } from 'react'

import { UsIcon } from './icons'

export type Delta = {
  label: string
  dir: 'up' | 'down' | 'warn' | 'flat'
}

const ARROW: Record<Delta['dir'], string> = { up: '↑', down: '↓', warn: '!', flat: '=' }

export function DeltaList({ deltas }: { deltas: Delta[] }) {
  if (deltas.length === 0) return null
  return (
    <ul className="us-deltas">
      {deltas.map((delta) => (
        <li key={delta.label} className={`is-${delta.dir}`}>
          <b aria-hidden="true">{ARROW[delta.dir]}</b>
          {delta.label}
        </li>
      ))}
    </ul>
  )
}

export function TeachingPanel({
  now,
  why,
  equation,
  deltas,
  clinical,
  trap,
  revision,
  onRevisionChange,
}: {
  now: ReactNode
  why?: ReactNode
  equation?: ReactNode
  deltas?: Delta[]
  clinical?: ReactNode
  trap?: ReactNode
  revision?: boolean
  onRevisionChange?: (value: boolean) => void
}) {
  const [internalRevision, setInternalRevision] = useState(false)
  const isRevision = revision ?? internalRevision
  const setRevision = onRevisionChange ?? setInternalRevision

  return (
    <div className="us-teach">
      <section className="is-now">
        <h4>
          <UsIcon name="eye" size={12} />
          What is happening now
          <button
            type="button"
            className="us-chip us-teach-mode"
            aria-pressed={isRevision}
            onClick={() => setRevision(!isRevision)}
          >
            {isRevision ? 'Full detail' : 'Revision mode'}
          </button>
        </h4>
        <p>{now}</p>
      </section>

      {!isRevision && why && (
        <section className="is-why">
          <h4>
            <UsIcon name="lightbulb" size={12} />
            Why it happens
          </h4>
          <p className="us-teach-sub">{why}</p>
        </section>
      )}

      {equation && (
        <section className="is-eq">
          <h4>
            <UsIcon name="equation" size={12} />
            Equation
          </h4>
          {typeof equation === 'string' ? <pre className="us-formula">{equation}</pre> : equation}
        </section>
      )}

      {deltas && deltas.length > 0 && (
        <section>
          <h4>
            <UsIcon name="spark" size={12} />
            Direction of change
          </h4>
          <DeltaList deltas={deltas} />
        </section>
      )}

      {!isRevision && clinical && (
        <section className="is-clinical">
          <h4>
            <UsIcon name="target" size={12} />
            Clinical meaning
          </h4>
          <p className="us-teach-sub">{clinical}</p>
        </section>
      )}

      {trap && (
        <section className="is-trap">
          <h4>
            <UsIcon name="trap" size={12} />
            FRCR examination trap
          </h4>
          <p>{trap}</p>
        </section>
      )}
    </div>
  )
}
