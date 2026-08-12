/**
 * One instruction at a time.
 *
 * The pattern the whole guided course is built on: tell the learner to change
 * ONE thing, let them change it, say what just happened, and only then move
 * on. Nothing else on the instrument is live while a task is open — a learner
 * who is asked to drag SOD and instead drags three sliders has learned
 * nothing, so the other controls are held until the asked-for change lands.
 *
 * Two halves:
 *
 *   TaskCue     the visible instruction, which becomes the answer once the
 *               change is made. Before: "Your turn — drag SOD longer." After:
 *               "Notice — the shadow shrank toward the object's true size."
 *   TaskGate    a context the instrument reports through, so the page holding
 *               it can keep Next closed until the task is done.
 *
 * The gate always offers a way past. Detection watches a real control, and a
 * learner on a phone, on a keyboard, or on a browser where something did not
 * fire must never be trapped behind an animation.
 */

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

import './task.css'

export type TaskStatus = { active: boolean; done: boolean }

const TaskChannel = createContext<((status: TaskStatus) => void) | null>(null)

/**
 * Wrap the part of the page that holds instruments. Whatever task they carry
 * is reported here, so the page can gate its own Next button.
 */
export function TaskGate({ onStatus, children }: { onStatus: (s: TaskStatus) => void; children: ReactNode }) {
  /* Identity-stable so an instrument's report effect does not re-fire on every
     parent render — which, with a parent that stores the report, would loop. */
  const report = useCallback((s: TaskStatus) => onStatus(s), [onStatus])
  return <TaskChannel.Provider value={report}>{children}</TaskChannel.Provider>
}

/** For instruments: report whether a task is open and whether it is satisfied. */
export function useTaskReport(active: boolean, done: boolean) {
  const report = useContext(TaskChannel)
  useEffect(() => {
    report?.({ active, done })
    // Leaving the step must not leave a stale "still waiting" behind it.
    return () => report?.({ active: false, done: true })
  }, [report, active, done])
}

export function TaskCue({
  ask,
  notice,
  done,
  onSkip,
  skipLabel,
}: {
  /** The single instruction, in the imperative: "Drag the focal spot wider." */
  ask: string
  /** What just happened, revealed only once they have done it. */
  notice: string
  done: boolean
  /** Marks the task done without the change. Never omit it on a gated step. */
  onSkip?: () => void
  /**
   * What the escape button says. Where a detector is watching the control it
   * is a quiet way out ("Show me instead"); where the reader is the only one
   * who knows they tried, it is the primary action and should say so.
   */
  skipLabel?: string
}) {
  return (
    <p className={done ? 'rp-task is-done' : 'rp-task'} aria-live="polite">
      <span className="rp-task-tag">{done ? 'Notice' : 'Your turn'}</span>
      <span className="rp-task-copy">{done ? notice : ask}</span>
      {!done && onSkip && (
        <button type="button" className="rp-task-skip" onClick={onSkip}>
          {skipLabel ?? 'Show me instead'}
        </button>
      )}
    </p>
  )
}

/**
 * The task state for one concept, reset whenever the concept changes.
 *
 * `key` is whatever identifies the concept — a step id. Changing it re-arms
 * the task, so going back and forward again asks again rather than showing a
 * stale tick.
 */
export function useTask(key: string, active: boolean) {
  const [done, setDone] = useState(false)
  useEffect(() => { setDone(false) }, [key])
  useTaskReport(active, done || !active)
  return { done, finish: useCallback(() => setDone(true), []) }
}
