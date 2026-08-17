/**
 * The V2 chrome. One slim paper header — wordmark, three destinations, one
 * Continue chip — and a quiet footer that owns the account state and the door
 * back to the current site. Everything else on screen is content.
 */

import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { QB_TOTALS } from '../../qbank/data'
import { readV2State, noteVisit } from '../lib/store'
import '../v2.css'

export function V2Shell({
  title,
  /** What Continue should say if the learner leaves from this page; null = don't record. */
  visit,
  children,
}: {
  title?: string
  visit?: { path: string; label: string } | null
  children: React.ReactNode
}) {
  const { user } = useAuth()
  const location = useLocation()
  const resume = readV2State().lastVisited

  useEffect(() => {
    document.title = title ? `${title} · RadioPass Physics` : 'RadioPass Physics'
    return () => {
      document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics'
    }
  }, [title])

  useEffect(() => {
    if (visit) noteVisit(visit.path, visit.label)
  }, [visit?.path, visit?.label])

  const showContinue = resume && resume.path !== location.pathname

  return (
    <div className="v2-root">
      <header className="v2-header">
        <div className="v2-wrap v2-header-inner">
          <Link to="/physics-v2" className="v2-brand" aria-label="RadioPass Physics home">
            <b>RADIOPASS</b>
            <span>Physics</span>
          </Link>
          <nav className="v2-nav" aria-label="Physics">
            <NavLink to="/physics-v2" end className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Syllabus
            </NavLink>
            <NavLink to="/physics-v2/questions" className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Question bank
            </NavLink>
            <NavLink to="/physics-v2/review" className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Review
            </NavLink>
            <a href="/question-bank/mock">Mock exam</a>
          </nav>
          {showContinue && (
            <Link to={resume.path} className="v2-continue" title={`Continue: ${resume.label}`}>
              <i aria-hidden="true" />
              {resume.label}
            </Link>
          )}
        </div>
      </header>

      {children}

      <footer className="v2-foot">
        <div className="v2-wrap v2-foot-inner">
          <span>
            {QB_TOTALS.questions} questions · {QB_TOTALS.stems} statements · FRCR Part 1 Physics
          </span>
          <span>
            {user ? (
              <>Signed in as {user.email} — progress syncs</>
            ) : (
              <>
                <Link to="/login">Log in</Link> to keep progress across devices
              </>
            )}
            {' · '}
            <Link to="/physics">Switch to the current site</Link>
          </span>
        </div>
      </footer>
    </div>
  )
}
