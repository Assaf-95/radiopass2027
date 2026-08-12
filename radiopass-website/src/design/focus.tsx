/**
 * Focus Mode — optional, never mandatory.
 *
 * A learning screen carries more than the lesson: a global header, a module
 * name, breadcrumbs, drawer buttons, a progress rail. All of it earns its place
 * for someone arriving; none of it earns its place for someone forty minutes
 * into a sequence who knows exactly where they are.
 *
 * So this hides the chrome and gives the room to the diagram and the words,
 * keeping only what a learner still needs mid-sequence: progress, back, next,
 * and the way out. It is a preference, remembered, and it never turns itself
 * on — a reader who has not asked for it must never lose the navigation.
 *
 * Implemented as a class on <html> rather than by unmounting anything. Chrome
 * that is unmounted has to be rebuilt on exit, which loses scroll position and
 * remounts every simulation on the page; a class costs nothing and is
 * reversible in one frame.
 */

import { useCallback, useEffect, useState } from 'react'

import './focus.css'

const KEY = 'radiopass.focus.v1'
const CLASS = 'rp-focus'

function read(): boolean {
  try { return localStorage.getItem(KEY) === 'on' } catch { return false }
}

/**
 * Drives Focus Mode for a learning route.
 *
 * Mount this on any page that is a learning sequence. It cleans up on unmount,
 * so leaving the sequence always restores the chrome even if the reader left
 * focus mode switched on for next time.
 */
export function useFocusMode() {
  const [on, setOn] = useState(read)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle(CLASS, on)
    try { localStorage.setItem(KEY, on ? 'on' : 'off') } catch { /* preference only */ }
    /* Leaving the page must never strand the reader in a stripped shell. */
    return () => root.classList.remove(CLASS)
  }, [on])

  /* Escape is the universal "give me the furniture back". It is deliberately
     not a toggle: a reader pressing Escape wants out, not a coin flip. */
  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOn(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on])

  return { on, toggle: useCallback(() => setOn((v) => !v), []) }
}

/** The control. Small, quiet, and always in the same corner. */
export function FocusToggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="rp-focus-toggle"
      aria-pressed={on}
      onClick={onToggle}
      title={on ? 'Show the full interface (Esc)' : 'Hide everything but the lesson'}
    >
      {on ? 'Exit focus' : 'Focus'}
    </button>
  )
}
