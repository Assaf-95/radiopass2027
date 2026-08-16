/**
 * The X-ray family's front door — the ORIENT stage of Part I.
 *
 * WHAT THIS PAGE STOPPED BEING. It used to be a pile of cards: the four core
 * lessons and the three machine modules rendered as the same undifferentiated
 * grid, in an order that existed only as array position, above nine more
 * cards duplicating the same content as raw diagrams. Fourteen look-alike
 * doors and one sentence of guidance. A learner could not tell the course
 * from the appendix.
 *
 * WHAT IT IS NOW, in the order a learner meets it:
 *
 *   THE PROMISE     the mental map from the course spine — what you will
 *                   understand by the end of the core four.
 *   THE JOURNEY     the core sequence, numbered, with the learner's own
 *                   completion state against each step. This is the module
 *                   navigation the site never had: where am I, what is done,
 *                   what is next.
 *   THE MACHINES    Part II, visibly separate: each machine is its own module
 *                   with its own practice, taken AFTER the core.
 *   THE INSTRUMENTS the raw simulators, demoted to free exploration and
 *                   labelled as such — the same instruments the lessons
 *                   drive, without the guidance. Explore is a mode, not a
 *                   rival curriculum.
 *
 * The completion ticks read the same learner event log the physics home
 * reads (module.completed, keyed by pathname) — one record, no second store.
 */

import { Link } from 'react-router-dom'
import { completedModules } from '../lib/learner'
import { moduleById, practiceHref } from '../physics/course'
import './labs.css'

/* The existing visual-lab designs, brought under X-ray rather than rebuilt.
   They are self-contained HTML pages served from /visuals, so they open as
   they were authored — no redraw, no reinterpretation. */
const DESIGNS: { href: string; name: string; blurb: string }[] = [
  { href: '/visuals/xray-tube-physics-canvas.html', name: 'The X-ray tube',
    blurb: 'Cathode, anode, filament and the tube current — the machine itself, drawn live.' },
  { href: '/visuals/xray-focal-spot-unsharpness.html', name: 'Anode angle & focal spot',
    blurb: 'The line-focus principle, effective focal spot and geometric unsharpness.' },
  { href: '/visuals/xray-guided-interactions.html', name: 'Interactions — guided tour',
    blurb: 'A walk through what the beam does inside tissue, one step at a time.' },
  { href: '/visuals/diagrams-1-5.html', name: 'Atoms & X-ray production',
    blurb: 'Atomic structure, characteristic radiation and bremsstrahlung.' },
  { href: '/visuals/xray-spectrum-simulator.html', name: 'The emission spectrum, live',
    blurb: 'Tungsten against molybdenum: kVp, mA, filtration and generator, each with a note on what it just changed.' },
  { href: '/visuals/xray-beam-quality.html', name: 'Beam quality & filtration',
    blurb: 'kVp, HVL and filtration — what hardens the beam and what it costs.' },
  { href: '/visuals/radiographic-magnification.html', name: 'Magnification & geometry',
    blurb: 'Object–film distance, penumbra and the geometry of the projection.' },
  /* Recovered. Diagrams 6-10 were part of the same step-diagram set as 1-5 and
     16-24 but were never carried across from the original site, so this lab
     shipped two thirds of a family and the entry below claimed to be "the
     remaining" diagrams while five were missing. */
  { href: '/visuals/diagrams-6-10.html', name: 'Collimation, dose & detector geometry',
    blurb: 'Five step diagrams: the parallel-hole collimator, interaction probability against photon energy, the CT dose profile and CTDI, X-ray room shielding, and multi-detector geometry with a live pitch slider.' },
  { href: '/visuals/diagrams-16-24.html', name: 'More tube & image diagrams',
    blurb: 'The last of the step diagrams from the original visual set.' },
]

/* Magnetisation is MRI physics, not X-ray. It is listed here because it was
   part of the same design set and you asked for it, but it is labelled so a
   reader is not taught it belongs to the projection family. */
const CROSS: { href: string; name: string; blurb: string } = {
  href: '/visuals/mri-magnetisation-recovery.html',
  name: 'Magnetisation & proton behaviour',
  blurb: 'From the same design set — this one is MRI physics, kept here for reference.',
}

/* The core four, in the course's order. Blurbs are the promise of each step;
   the ORDER comes from the same spine every other surface reads. */
const CORE = [
  { to: '/xray-lab/production', name: 'X-ray Production', count: '12 concepts',
    blurb: 'One electron from the filament to the anode: thermionic emission, mA and kVp, bremsstrahlung, characteristic lines and the heat nobody wants.' },
  { to: '/xray-lab/spectrum', name: 'The X-ray Spectrum', count: '8 concepts',
    blurb: 'What the curve means — the kVp endpoint, mean energy, and what mAs, filtration and target Z each do to its shape.' },
  { to: '/xray-lab/geometry', name: 'Projection Geometry', count: '10 concepts',
    blurb: 'SOD, SDD and ODD; magnification M = SDD/SOD; focal-spot blur Ug = f × ODD/SOD.' },
  { to: '/xray-lab/interactions', name: 'Interactions in Tissue', count: '10 concepts',
    blurb: 'Attenuation, μ and HVL; the photoelectric journey and Compton scatter — where contrast, fog and dose are born.' },
]

const MACHINES = [
  { to: '/xray-lab/digital', accent: '#8FB8C9', name: 'CR & Digital Radiography', blurb: 'The photostimulable plate, direct and indirect panels, MTF and dose creep.', count: '8 concepts' },
  { to: '/xray-lab/fluoroscopy', accent: '#E0955A', name: 'Fluoroscopy', blurb: 'The image intensifier, flat panels, brightness control, skin dose and DSA.', count: '7 concepts' },
  { to: '/xray-lab/mammography', accent: '#D9909F', name: 'Mammography', blurb: 'Low-energy contrast, compression, magnification views and tomosynthesis.', count: '10 concepts' },
]

export default function XrayHub() {
  const xrayCore = moduleById('xray-core')!
  /* The learner's own record: module.completed events carry the pathname. */
  const done = new Set(completedModules('physics'))
  const nextUp = CORE.find((c) => !done.has(c.to)) ?? null

  return (
    <main className="lx-root" style={{ ['--lx-accent' as string]: '#A8CBEA' }}>
      <header className="lx-bar">
        <span className="lx-bar-exits">
          <Link to="/physics" className="lx-home" title="Back to RadioPass">RadioPass</Link>
          <Link to="/physics" className="lx-exit">← Physics course</Link>
        </span>
        <span className="lx-bar-title">X-ray physics</span>
        <span className="lx-bar-count">
          {done.size ? `${CORE.filter((c) => done.has(c.to)).length} of ${CORE.length} done` : `${CORE.length} lessons`}
        </span>
      </header>

      <section className="lx-cover">
        <p className="lx-course-line">
          <span>The beam</span>
          <span aria-hidden="true">·</span>
          <span>Part I of the physics course</span>
        </p>
        <p className="lx-kicker">X-ray physics</p>
        <h1>Three machines,<br />one family of physics.</h1>
        <p className="lx-intro">
          Four lessons build the core in order — make the beam, describe it, project it, then
          follow it into the patient. The machines come after, each as its own module.
        </p>

        <div className="lx-outcomes">
          <p className="lx-outcomes-title">By the end of the core you should understand</p>
          <ol>
            {xrayCore.outcomes.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ol>
        </div>

        {/* The journey, numbered, with the learner's own record against it.
            An <ol>, not a card grid: order is the content here. */}
        <ol className="lx-plan" aria-label="The core sequence">
          {CORE.map((c, i) => {
            const isDone = done.has(c.to)
            const isNext = nextUp?.to === c.to
            return (
              <li key={c.to} className={isDone ? 'is-done' : isNext ? 'is-next' : ''}>
                <Link to={c.to}>
                  <span className="lx-plan-no" aria-hidden="true">
                    {isDone ? '✓' : i + 1}
                  </span>
                  <span className="lx-plan-body">
                    <span className="lx-plan-name">
                      {c.name}
                      <em>{c.count}</em>
                    </span>
                    <span className="lx-plan-blurb">{c.blurb}</span>
                  </span>
                  <span className="lx-plan-go">{isDone ? 'Revisit' : isNext ? 'Continue →' : 'Begin →'}</span>
                </Link>
              </li>
            )
          })}
        </ol>

        <div className="lx-next" style={{ marginTop: 'var(--sp-5)' }}>
          <Link className="lx-btn lx-btn-ghost" to={practiceHref(xrayCore.practice)}>
            Practise the core
          </Link>
          <Link className="lx-btn lx-btn-ghost" to="/fact-bank/xray">
            The facts, condensed
          </Link>
        </div>
      </section>

      <section className="lx-cover lx-designs">
        <p className="lx-kicker">Part II · The machines</p>
        <h2>Then the machines that use it.</h2>
        <p className="lx-intro">
          Each is its own module with its own practice — digital radiography, then real-time
          imaging, then the machine that pushes contrast and resolution hardest.
        </p>
        <div className="lx-hub">
          {MACHINES.map(m => (
            <Link key={m.to} to={m.to} className="lx-hub-card" style={{ ['--lx-accent' as string]: m.accent }}>
              <span className="lx-hub-count">{done.has(m.to) ? '✓ Completed' : m.count}</span>
              <h2>{m.name}</h2>
              <p>{m.blurb}</p>
              <span className="lx-hub-go">{done.has(m.to) ? 'Revisit →' : 'Begin →'}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lx-cover lx-designs">
        <p className="lx-kicker">Explore freely</p>
        <h2>The instruments, unguided.</h2>
        <p className="lx-intro">
          The same simulators the lessons drive, opened raw — every control unlocked, nothing
          gated. Best after a lesson, when you know what to watch.
        </p>
        <div className="lx-hub">
          {DESIGNS.map(d => (
            <a key={d.href} href={d.href} className="lx-hub-card" style={{ ['--lx-accent' as string]: '#A8CBEA' }}>
              <span className="lx-hub-count">Instrument</span>
              <h2>{d.name}</h2>
              <p>{d.blurb}</p>
              <span className="lx-hub-go">Open →</span>
            </a>
          ))}
          <a href={CROSS.href} className="lx-hub-card lx-hub-cross" style={{ ['--lx-accent' as string]: '#C6A6E8' }}>
            <span className="lx-hub-count">MRI physics</span>
            <h2>{CROSS.name}</h2>
            <p>{CROSS.blurb}</p>
            <span className="lx-hub-go">Open →</span>
          </a>
        </div>
      </section>
    </main>
  )
}
