/**
 * The ultrasound focused course — the separate, quiet entrance.
 *
 * The full laboratory stays exactly as it is. This page is where a learner
 * begins: every experiment listed one concept at a time, and each link opens
 * the same laboratory page pre-stripped to focus view (?focus=1) — the
 * concept, the stage and Next, nothing else. The complete instrument is one
 * click away at any moment ("Exit focus view").
 */

import { Link } from 'react-router-dom'
import { US_STAGES, type UsStage } from '../us/components/Layout'
import './labs.css'

export default function UsFocusCourse() {
  const groups: { name: string; stages: UsStage[] }[] = []
  for (const stage of US_STAGES) {
    const g = groups.find(x => x.name === stage.group)
    if (g) g.stages.push(stage)
    else groups.push({ name: stage.group, stages: [stage] })
  }

  return (
    <main className="lx-root" style={{ ['--lx-accent' as string]: '#7BCBC4' }}>
      <header className="lx-bar">
        <Link to="/visual-lab" className="lx-exit">← Visual Lab</Link>
        <span className="lx-bar-title">Ultrasound — focused course</span>
        <span className="lx-bar-count">{US_STAGES.length} experiments</span>
      </header>
      <section className="lx-cover">
        <p className="lx-kicker">Ultrasound physics</p>
        <h1>One concept<br />at a time.</h1>
        <p className="lx-intro">
          The full laboratory, presented for learning: each experiment opens in
          <strong> focus view</strong> — just the concept, the stage and Next — and
          hands you to the following concept when you are done. The complete
          instrument, with every control and readout, is one click away at any time.
        </p>
        <p className="lx-count">Concept → concept → concept · ← → inside each experiment</p>
        <Link className="lx-btn lx-btn-solid" to={`${US_STAGES[0].path}?focus=1`}>Begin the course</Link>
        {groups.map(group => (
          <div key={group.name} className="lx-course-group">
            <h2>{group.name}</h2>
            <ol className="lx-contents">
              {group.stages.map(stage => (
                <li key={stage.path}>
                  <Link to={`${stage.path}?focus=1`}>
                    <span>{String(US_STAGES.indexOf(stage) + 1).padStart(2, '0')}</span>
                    {stage.label}
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
        <p className="lx-course-note">
          Prefer the full instrument? <Link to="/ultrasound-lab">Enter the laboratory directly</Link>.
        </p>
      </section>
    </main>
  )
}
