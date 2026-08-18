/**
 * The question bank as its own destination.
 *
 * For the candidate who wants questions without the module: every topic's
 * pool with real standing, and direct doors into sessions — unseen, everything
 * again, wrong, flagged. The sessions are the same ones the modules use, so
 * progress is one record wherever the questions are answered from.
 */

import { Link } from 'react-router-dom'
import { V2Shell } from '../components/Shell'
import { V2_TOPICS } from '../topics'
import { topicStanding } from '../lib/derive'
import { QB_TOTALS } from '../../qbank/data'
import { PHYSICS_HREF, practiceHref } from '../../physics/routes'

export default function V2Questions() {
  const rows = V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) }))
  const answered = rows.reduce((n, r) => n + r.standing.answered, 0)

  return (
    <V2Shell title="Questions" visit={{ path: PHYSICS_HREF.questions, label: 'Question bank' }}>
      <header className="v2-masthead">
        <div className="v2-wrap">
          <p className="v2-eyebrow">Question bank</p>
          <h1 className="v2-display">
            {QB_TOTALS.questions} questions.
            <br />
            Start anywhere.
          </h1>
          <p className="v2-lede">
            True-or-false statements in the real exam format, every answer explained. No module
            required — pick a topic and go. Your record is shared with the syllabus: answers count
            once, wherever you answer them.
          </p>
        </div>
      </header>

      <main className="v2-wrap" style={{ paddingBottom: 60 }}>
        <div className="v2-syllabus-head">
          <h2>By topic</h2>
          <span>
            {answered} of {QB_TOTALS.questions} answered
          </span>
        </div>
        {/* One row per topic: the syllabus title at full size, the pool's
            standing in two plain numbers, and a single door in. The row's own
            standing picks what that door opens — the unseen questions while any
            are left, and otherwise the whole pool again as a re-test, so a
            finished topic still starts a session instead of landing the learner
            on "nothing unseen is left". Nobody is asked to choose a filter
            before starting. */}
        <div className="v2-qb-list">
          {rows.map(({ topic, standing }) => {
            const pct = standing.total > 0 ? Math.round((standing.answered / standing.total) * 100) : 0
            return (
              <div key={topic.id} className="v2-qb-row">
                <div className="v2-qb-main">
                  <span className="v2-qb-num">{String(topic.num).padStart(2, '0')}</span>
                  <h3>{topic.title}</h3>
                </div>
                <div className="v2-qb-stats">
                  <b>{standing.total} questions</b>
                  <span className="v2-qb-bar" role="img" aria-label={`${pct}% answered`}>
                    <i style={{ width: `${pct}%` }} />
                  </span>
                  <small>
                    {pct}% done · {standing.total - standing.answered} to go
                  </small>
                </div>
                <Link
                  className="v2-qb-start"
                  to={practiceHref(topic.id, { filter: standing.unseen > 0 ? 'unseen' : 'again' })}
                >
                  {standing.unseen > 0 ? 'Start now' : 'Test again'}
                </Link>
              </div>
            )
          })}
        </div>

        <div className="v2-doors" style={{ marginTop: 34 }}>
          <Link to={PHYSICS_HREF.mock} className="v2-door">
            <strong>Mock papers</strong>
            <span>Timed papers in the real format — fixed papers or built from the bank.</span>
          </Link>
          <Link to={PHYSICS_HREF.review} className="v2-door">
            <strong>Review</strong>
            <span>Everything answered wrong, gathered for re-testing.</span>
          </Link>
        </div>
      </main>
    </V2Shell>
  )
}
