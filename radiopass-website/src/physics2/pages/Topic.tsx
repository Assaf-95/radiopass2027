/**
 * The topic page — the module experience.
 *
 * Orientation (what matters, your standing), then the numbered primer
 * sections, each closing with its own practice gate showing real counts.
 * The essentials list and the deep-laboratory doors end the page. Question
 * feedback links back here by section anchor.
 */

import { useEffect } from 'react'
import { Link, Navigate, useLocation, useParams } from 'react-router-dom'
import { V2Shell } from '../components/Shell'
import { PrimerBlocks } from '../components/Primer'
import { topicById, V2_TOPICS } from '../topics'
import { assignments } from '../lib/assign'
import { sectionStanding, topicStanding } from '../lib/derive'

export default function V2TopicPage() {
  const { topicId } = useParams()
  const topic = topicId ? topicById(topicId) : undefined
  const { hash } = useLocation()

  // Anchor navigation after lazy content mounts.
  useEffect(() => {
    if (!hash) return
    const el = document.getElementById(hash.slice(1))
    if (el) el.scrollIntoView({ block: 'start' })
  }, [hash, topic?.id])

  if (!topic) return <Navigate to="/physics-v2" replace />

  const standing = topicStanding(topic)
  const assigned = assignments(topic)

  return (
    <V2Shell
      title={topic.title}
      visit={{ path: `/physics-v2/${topic.id}`, label: `${topic.short} — primer` }}
    >
      <header className="v2-topichead">
        <div className="v2-wrap">
          <div className="v2-topichead-row">
            <div>
              <p className="v2-eyebrow">
                Topic {String(topic.num).padStart(2, '0')} · <Link to="/physics-v2">Syllabus</Link>
              </p>
              <h1 className="v2-display">{topic.title}</h1>
              <p className="v2-lede">{topic.tagline}</p>
            </div>
            <div className="v2-standing">
              <b>
                {standing.answered} / {standing.total} answered
              </b>
              {standing.accuracy !== null && <small>{Math.round(standing.accuracy * 100)}% accuracy so far</small>}
              <span className="v2-meter" aria-hidden="true">
                <i style={{ width: `${standing.total ? (standing.answered / standing.total) * 100 : 0}%` }} />
              </span>
            </div>
          </div>
          <ul className="v2-outcomes">
            {topic.outcomes.map((outcome) => (
              <li key={outcome}>{outcome}</li>
            ))}
          </ul>
        </div>
      </header>

      <nav className="v2-wrap v2-contents" aria-label="Sections">
        {topic.sections.map((section, i) => {
          const st = sectionStanding(topic, section.id)
          const done = st.total > 0 && st.unseen === 0
          return (
            <a key={section.id} href={`#${section.id}`} className={done ? 'done' : ''}>
              <i>
                {topic.num}.{i + 1}
              </i>
              {section.title}
            </a>
          )
        })}
      </nav>

      <main className="v2-wrap">
        {topic.sections.map((section, i) => {
          const st = sectionStanding(topic, section.id)
          const pooled = assigned.sections.get(section.id)?.length ?? 0
          const filter = st.unseen > 0 ? 'unseen' : 'again'
          return (
            <section key={section.id} id={section.id} className="v2-section">
              <div className="v2-section-head">
                <i>
                  {topic.num}.{i + 1}
                </i>
                <h2>{section.title}</h2>
              </div>
              {section.blurb && <p className="v2-section-blurb">{section.blurb}</p>}
              <PrimerBlocks blocks={section.primer} />
              {pooled > 0 && (
                <div className="v2-gate">
                  <Link
                    className="v2-btn"
                    to={`/physics-v2/${topic.id}/practice?section=${section.id}&filter=${filter}`}
                  >
                    {st.unseen > 0 ? `Test this section — ${st.unseen} unseen` : 'Practise this section again'}
                  </Link>
                  <small>
                    {pooled} question{pooled === 1 ? '' : 's'}
                    {st.answered > 0 && ` · ${st.answered} answered`}
                    {st.wrong > 0 && ` · ${st.wrong} to fix`}
                  </small>
                  {st.wrong > 0 && (
                    <Link
                      className="v2-link"
                      to={`/physics-v2/${topic.id}/practice?section=${section.id}&filter=wrong`}
                    >
                      Re-test the {st.wrong} you missed →
                    </Link>
                  )}
                </div>
              )}
            </section>
          )
        })}

        <section className="v2-essentials" id="essentials">
          <h2>The essentials</h2>
          <p>The topic in {topic.essentials.length} lines — the night-before list.</p>
          <ol>
            {topic.essentials.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
        </section>

        {/* The end of a chapter is two steps in order, not a menu: test what
            you just read, then go to the next chapter. Everything else that
            used to live here — re-test chips, laboratory doors, a previous
            link competing with the next one — is either quiet or gone, because
            offering six exits at the finish line is how a course stops feeling
            like a course. */}
        <section className="v2-finish" aria-label="Finish this topic">
          <ol className="v2-finish-steps">
            <li>
              <span className="v2-finish-n">1</span>
              <div>
                <strong>Test it</strong>
                <small>{standing.total} questions on this topic, marked and explained.</small>
              </div>
              <Link
                className="v2-btn v2-btn-solid"
                to={`/physics-v2/${topic.id}/practice?filter=${standing.unseen > 0 ? 'unseen' : 'again'}`}
              >
                Practise now
              </Link>
            </li>
            {topic.num < V2_TOPICS.length ? (
              <li>
                <span className="v2-finish-n">2</span>
                <div>
                  <strong>
                    Then: {String(topic.num + 1).padStart(2, '0')} · {V2_TOPICS[topic.num].title}
                  </strong>
                  <small>{V2_TOPICS[topic.num].tagline}</small>
                </div>
                <Link className="v2-btn v2-btn-solid" to={`/physics-v2/${V2_TOPICS[topic.num].id}`}>
                  Next topic →
                </Link>
              </li>
            ) : (
              <li>
                <span className="v2-finish-n">2</span>
                <div>
                  <strong>That is the whole syllabus</strong>
                  <small>Everything answered wrong, gathered for one last pass.</small>
                </div>
                <Link className="v2-btn v2-btn-solid" to="/physics-v2/review">
                  Open review →
                </Link>
              </li>
            )}
          </ol>

          <p className="v2-finish-aside">
            {topic.num > 1 && (
              <Link to={`/physics-v2/${V2_TOPICS[topic.num - 2].id}`}>
                ← Back to {V2_TOPICS[topic.num - 2].title}
              </Link>
            )}
            {topic.labs?.map((lab) =>
              lab.to.endsWith('.html') ? (
                <a key={lab.to} href={lab.to} target="_blank" rel="noreferrer">
                  {lab.label}
                </a>
              ) : (
                <a key={lab.to} href={lab.to}>
                  {lab.label}
                </a>
              ),
            )}
          </p>
        </section>
      </main>
    </V2Shell>
  )
}
