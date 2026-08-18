/**
 * The course chrome. One slim paper header — wordmark, three destinations, one
 * Continue chip — and a quiet footer that owns the account state.
 * Everything else on screen is content.
 *
 * The footer used to end with "Switch to the current site", which was honest
 * while this was an alternative experience running beside the old one. There is
 * no other site now: /physics is the same product's front door, reachable from
 * the wordmark like any other page.
 */

import { useEffect } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { QB_TOTALS } from '../../qbank/data'
import { PHYSICS_HREF } from '../../physics/routes'
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
          <Link to={PHYSICS_HREF.home} className="v2-brand" aria-label="RadioPass Physics home">
            <b>RADIOPASS</b>
            <span>Physics</span>
          </Link>
          <nav className="v2-nav" aria-label="Physics">
            <NavLink to={PHYSICS_HREF.home} end className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Syllabus
            </NavLink>
            <NavLink to={PHYSICS_HREF.questions} className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Question bank
            </NavLink>
            <NavLink to={PHYSICS_HREF.review} className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Review
            </NavLink>
            {/* Was a plain <a>, which left the SPA and reloaded the whole app
                to reach a route React Router already owns. */}
            <NavLink to={PHYSICS_HREF.mock} className={({ isActive }: { isActive: boolean }) => (isActive ? 'is-on' : '')}>
              Mock exam
            </NavLink>
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
          </span>
        </div>
      </footer>
    </div>
  )
}
