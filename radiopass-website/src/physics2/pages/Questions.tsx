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

export default function V2Questions() {
  const rows = V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) }))
  const answered = rows.reduce((n, r) => n + r.standing.answered, 0)

  return (
    <V2Shell title="Questions" visit={{ path: '/physics-v2/questions', label: 'Question bank' }}>
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
        <div className="v2-review-grid">
          {rows.map(({ topic, standing }) => (
            <div key={topic.id} className="v2-review-row">
              <span className="n">{String(topic.num).padStart(2, '0')}</span>
              <span>
                <h3>{topic.title}</h3>
              </span>
              <span className="acc">
                {standing.answered}/{standing.total}
                {standing.accuracy !== null && ` · ${Math.round(standing.accuracy * 100)}%`}
              </span>
              <span className="acts">
                {standing.unseen > 0 ? (
                  <Link className="v2-chip" to={`/physics-v2/${topic.id}/practice?filter=unseen`}>
                    Unseen <b style={{ color: 'var(--v2-ink-2)' }}>{standing.unseen}</b>
                  </Link>
                ) : (
                  <Link className="v2-chip" to={`/physics-v2/${topic.id}/practice?filter=again`}>
                    Again
                  </Link>
                )}
                {standing.wrong > 0 && (
                  <Link className="v2-chip" to={`/physics-v2/${topic.id}/practice?filter=wrong`}>
                    Wrong <b>{standing.wrong}</b>
                  </Link>
                )}
                {standing.flagged > 0 && (
                  <Link className="v2-chip" to={`/physics-v2/${topic.id}/practice?filter=flagged`}>
                    Flagged {standing.flagged}
                  </Link>
                )}
                <Link className="v2-chip" to={`/physics-v2/${topic.id}`}>
                  Primer
                </Link>
              </span>
            </div>
          ))}
        </div>

        <div className="v2-doors" style={{ marginTop: 34 }}>
          <a href="/question-bank/mock" className="v2-door">
            <strong>Mock papers</strong>
            <span>Timed papers in the real format — fixed papers or built from the bank.</span>
          </a>
          <Link to="/physics-v2/review" className="v2-door">
            <strong>Review</strong>
            <span>Everything answered wrong, gathered for re-testing.</span>
          </Link>
        </div>
      </main>
    </V2Shell>
  )
}
