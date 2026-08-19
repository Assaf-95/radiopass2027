/**
 * Review — the revision surface.
 *
 * Reads the shared record and turns it into work: per-topic accuracy, the
 * wrong answers ready to re-test, flagged questions, and the key points from
 * recently missed questions. Nothing here is a report for its own sake —
 * every row is a door back into practice.
 */

import { Link } from 'react-router-dom'
import { V2Shell } from '../components/Shell'
import { V2_TOPICS } from '../topics'
import { topicStanding, wrongQuestions } from '../lib/derive'
import { readQbProgress } from '../../qbank/Shell'
import { PHYSICS_HREF, practiceHref, topicHref } from '../../physics/routes'

export default function V2Review() {
  const progress = readQbProgress()
  const rows = V2_TOPICS.map((topic) => ({
    topic,
    standing: topicStanding(topic),
    wrong: wrongQuestions(topic, progress),
  }))

  const totals = rows.reduce(
    (acc, r) => ({
      answered: acc.answered + r.standing.answered,
      wrong: acc.wrong + r.standing.wrong,
      flagged: acc.flagged + r.standing.flagged,
    }),
    { answered: 0, wrong: 0, flagged: 0 },
  )
  const anyActivity = totals.answered > 0

  /** Key points from the most recently missed questions, newest first. */
  const missedPoints = rows
    .flatMap((r) => r.wrong.map((q) => ({ q, at: progress[q.id]?.submittedAt ?? '' })))
    .sort((a, b) => (a.at < b.at ? 1 : -1))
    .map((entry) => entry.q.keyPoint)
    .filter(Boolean)
    .slice(0, 10)

  return (
    <V2Shell title="Review" visit={{ path: PHYSICS_HREF.review, label: 'Review' }}>
      <header className="v2-masthead">
        <div className="v2-wrap">
          <p className="v2-eyebrow">Review</p>
          <h1 className="v2-display">What you got wrong,
            <br />
            ready to be got right.</h1>
          {anyActivity ? (
            <div className="v2-statrow">
              <span className="v2-stat">
                <b>{totals.answered}</b>
                <span>answered</span>
              </span>
              <span className="v2-stat">
                <b>{totals.wrong}</b>
                <span>to fix</span>
              </span>
              <span className="v2-stat">
                <b>{totals.flagged}</b>
                <span>flagged</span>
              </span>
            </div>
          ) : (
            <p className="v2-lede">
              Nothing answered yet. Once you practise, your wrong answers and flagged questions
              gather here for re-testing — your first, cold score is never overwritten.
            </p>
          )}
        </div>
      </header>

      <main className="v2-wrap" style={{ paddingBottom: 60 }}>
        <div className="v2-review-grid">
          {rows.map(({ topic, standing }) => (
            <div key={topic.id} className="v2-review-row">
              <span className="n">{String(topic.num).padStart(2, '0')}</span>
              <span>
                <h3>
                  <Link to={topicHref(topic.id)}>{topic.title}</Link>
                </h3>
              </span>
              <span className="acc">
                {standing.latestAccuracy !== null
                  ? `${standing.answered}/${standing.total} · ${Math.round(standing.latestAccuracy * 100)}% now`
                  : 'not started'}
              </span>
              <span className="acts">
                {standing.wrong > 0 ? (
                  <Link className="v2-chip" to={practiceHref(topic.id, { filter: 'wrong' })}>
                    Re-test <b>{standing.wrong}</b>
                  </Link>
                ) : (
                  <span className="v2-chip is-empty">Nothing to fix</span>
                )}
                {standing.flagged > 0 && (
                  <Link className="v2-chip" to={practiceHref(topic.id, { filter: 'flagged' })}>
                    Flagged {standing.flagged}
                  </Link>
                )}
                <Link
                  className="v2-chip"
                  to={topicHref(topic.id, 'essentials')}
                >
                  Essentials
                </Link>
              </span>
            </div>
          ))}
        </div>

        {missedPoints.length > 0 && (
          <div className="v2-missed" style={{ maxWidth: 720, marginTop: 38 }}>
            <h2>From your recent misses — carry these</h2>
            <ul>
              {missedPoints.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        )}
      </main>
    </V2Shell>
  )
}
