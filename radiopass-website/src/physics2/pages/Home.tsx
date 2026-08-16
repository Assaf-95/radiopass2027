/**
 * Physics V2 home — the syllabus.
 *
 * One honest Continue, nine numbered topics with the learner's real standing,
 * and quiet doors to Review and the mock papers. Nothing is sold here; the
 * learner has already chosen physics.
 */

import { Link } from 'react-router-dom'
import { V2Shell } from '../components/Shell'
import { V2_TOPICS } from '../topics'
import { topicStanding } from '../lib/derive'
import { readV2State } from '../lib/store'
import { QB_TOTALS } from '../../qbank/data'

export default function V2Home() {
  const resume = readV2State().lastVisited
  const standings = V2_TOPICS.map((topic) => ({ topic, standing: topicStanding(topic) }))
  const answered = standings.reduce((n, s) => n + s.standing.answered, 0)
  const wrong = standings.reduce((n, s) => n + s.standing.wrong, 0)

  return (
    <V2Shell>
      <header className="v2-masthead">
        <div className="v2-wrap">
          <p className="v2-eyebrow">FRCR Part 1 · Physics</p>
          <h1 className="v2-display">
            Nine topics. Learn each one,
            <br />
            then make it answer questions.
          </h1>
          <p className="v2-lede">
            Every topic is a short primer with the simulations that matter, bound to its own
            questions from the bank. What you get wrong comes back to be re-tested.
          </p>
          {resume ? (
            <Link to={resume.path} className="v2-resume">
              <small>Continue where you left off</small>
              <strong>{resume.label}</strong>
            </Link>
          ) : (
            <Link to={`/physics-v2/${V2_TOPICS[0].id}`} className="v2-resume">
              <small>New here</small>
              <strong>Start with {V2_TOPICS[0].title} →</strong>
            </Link>
          )}
        </div>
      </header>

      <section className="v2-syllabus">
        <div className="v2-wrap">
          <div className="v2-syllabus-head">
            <h2>The syllabus</h2>
            <span>
              {answered} of {QB_TOTALS.questions} questions answered
            </span>
          </div>
          <ol className="v2-topiclist">
            {standings.map(({ topic, standing }) => (
              <li key={topic.id}>
                <Link to={`/physics-v2/${topic.id}`} className="v2-topicrow">
                  <span className="n">{String(topic.num).padStart(2, '0')}</span>
                  <span>
                    <h3>{topic.title}</h3>
                    <p>{topic.tagline}</p>
                  </span>
                  <span className="st">
                    <b>
                      {standing.answered} / {standing.total}
                    </b>
                    {standing.accuracy !== null ? (
                      <small>{Math.round(standing.accuracy * 100)}% accuracy</small>
                    ) : (
                      <small>not started</small>
                    )}
                    <span className="v2-meter" aria-hidden="true">
                      <i style={{ width: `${standing.total ? (standing.answered / standing.total) * 100 : 0}%` }} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ol>

          <div className="v2-doors">
            <Link to="/physics-v2/review" className="v2-door">
              <strong>Review</strong>
              <span>
                {wrong > 0
                  ? `${wrong} question${wrong === 1 ? '' : 's'} answered wrong, ready to re-test.`
                  : 'Your wrong answers gather here for re-testing.'}
              </span>
            </Link>
            <a href="/question-bank/mock" className="v2-door">
              <strong>Mock papers</strong>
              <span>Timed papers in the real format, marked at the end.</span>
            </a>
          </div>
        </div>
      </section>
    </V2Shell>
  )
}
