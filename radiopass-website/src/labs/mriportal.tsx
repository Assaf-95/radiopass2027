/**
 * The MRI module's front door.
 *
 * The old version of this page was a list of links, which is exactly the
 * problem it was meant to solve: a learner arriving at MRI could see the names
 * of eleven stages and had no idea which one was the beginning, which were
 * lessons and which were instruments.
 *
 * So the page states the path instead of listing it. One route runs through
 * it, in physical order — the signal has to exist before it can be located,
 * and it has to be locatable before a sequence can weight it — and the
 * instrument you drive yourself sits at the end, where it belongs.
 *
 * The cover is the module's own magnetisation chamber, running the sequence it
 * teaches first. It is the same component the lessons are taught on, so the
 * front door is a genuine preview of the instrument rather than an
 * illustration of one.
 */

import { Link } from 'react-router-dom'

import { MagnetisationChamber } from '../mri/components/MagnetisationChamber'
import { PRESETS } from '../mri/engine'
import { MriProvider, useMri } from '../mri/state/context'
import { useEffect } from 'react'
import './labs.css'

type Entry = {
  path: string
  label: string
  blurb: string
  /** A lesson is read; an instrument is driven. The distinction the old list lost. */
  kind: 'lesson' | 'instrument'
}

type Chapter = { name: string; premise: string; entries: Entry[] }

const CHAPTERS: Chapter[] = [
  {
    name: 'Where the signal comes from',
    premise: 'Before any sequence exists there has to be something to measure.',
    entries: [
      {
        path: '/mri-lab/core',
        label: 'Core physics',
        blurb: 'Hydrogen and spin, precession and the Larmor frequency, the net magnetisation vector, resonance, the two relaxations, and the magnet that makes the field.',
        kind: 'lesson',
      },
      {
        path: '/mri-lab',
        label: 'Foundations in the laboratory',
        blurb: 'The same physics with every control live — excitation, relaxation and the chamber to turn.',
        kind: 'instrument',
      },
    ],
  },
  {
    name: 'Where the signal comes from in space',
    premise: 'One coil returns one summed number. Everything else is working out where each part of it came from.',
    entries: [
      {
        path: '/mri-lab/encoding',
        label: 'Spatial encoding',
        blurb: 'Slice selection, frequency and phase encoding, k-space — and where aliasing and chemical shift come from.',
        kind: 'lesson',
      },
    ],
  },
  {
    name: 'Making one difference visible',
    premise: 'Every weighted sequence is the same instrument, timed to report one tissue property and suppress the others.',
    entries: [
      {
        path: '/mri-lab/learn/t1-spin-echo',
        label: 'T1-weighted spin echo',
        blurb: 'Short TR, short TE. Contrast from how fast longitudinal magnetisation recovers.',
        kind: 'lesson',
      },
      {
        path: '/mri-lab/learn/t2-spin-echo',
        label: 'T2-weighted spin echo',
        blurb: 'Long TR, long TE. Contrast from how fast transverse magnetisation decays.',
        kind: 'lesson',
      },
      {
        path: '/mri-lab/learn/proton-density',
        label: 'Proton density',
        blurb: 'Long TR, short TE. Both other mechanisms removed on purpose — what is left is how much hydrogen is there.',
        kind: 'lesson',
      },
    ],
  },
  {
    name: 'Removing a tissue on purpose',
    premise: 'Invert everything, then wait for the tissue you want gone to pass through zero.',
    entries: [
      {
        path: '/mri-lab/learn/flair',
        label: 'FLAIR',
        blurb: 'A long inversion time timed to null CSF, so periventricular disease stops being drowned by bright fluid.',
        kind: 'lesson',
      },
      {
        path: '/mri-lab/learn/stir',
        label: 'STIR',
        blurb: 'The same trick aimed at the shortest T1 instead of the longest — and why it must not follow gadolinium.',
        kind: 'lesson',
      },
    ],
  },
  {
    name: 'Doing without the refocusing pulse',
    premise: 'Drop the 180° and you get speed, susceptibility sensitivity, and T2* instead of T2.',
    entries: [
      {
        path: '/mri-lab/learn/gradient-echo',
        label: 'Gradient echo',
        blurb: 'Flip angles below 90°, the Ernst angle, and why blood and calcium bloom into voids.',
        kind: 'lesson',
      },
    ],
  },
  {
    name: 'Testing it',
    premise: 'Prediction is the only proof that the mechanism went in.',
    entries: [
      {
        path: '/mri-lab/comparison',
        label: 'Comparison matrix',
        blurb: 'Every tissue against every sequence, computed live from the same engine.',
        kind: 'instrument',
      },
      {
        path: '/mri-lab/challenge',
        label: 'Challenge mode',
        blurb: 'Identify the weighting, adjust the parameter, predict the result, debug the sequence.',
        kind: 'instrument',
      },
    ],
  },
  {
    name: 'The whole instrument',
    premise: 'Now that every control means something, here is all of it with nothing held back.',
    entries: [
      {
        path: '/mri-lab/laboratory',
        label: 'Free sequence laboratory',
        blurb: 'Build any sequence you like and have its contrast classified against the engine.',
        kind: 'instrument',
      },
    ],
  },
]

const LESSON_COUNT = CHAPTERS.reduce(
  (n, chapter) => n + chapter.entries.filter((entry) => entry.kind === 'lesson').length,
  0,
)

/** The cover runs continuously — it is scenery, not a step to be completed. */
function CoverLoop() {
  const { simulation } = useMri()
  useEffect(() => {
    simulation.setLoop(true)
    simulation.setSpeed(0.6)
    simulation.play()
  }, [simulation])
  return null
}

export default function MriPortal() {
  useEffect(() => {
    document.title = 'MRI — the course · RadioPass'
    return () => { document.title = 'RadioPass — FRCR Part 1, Anatomy & Physics' }
  }, [])

  let n = 0

  return (
    <main className="lx-root mrp" style={{ ['--lx-accent' as string]: '#A99EDB' }}>
      <header className="lx-bar">
        <Link to="/visual-lab" className="lx-exit">← Visual Lab</Link>
        <span className="lx-bar-title">MRI — the course</span>
        <span className="lx-bar-count">{LESSON_COUNT} concepts</span>
      </header>

      <section className="mrp-hero">
        <div className="mrp-hero-copy">
          <p className="lx-kicker">Magnetic resonance imaging</p>
          <h1>
            Start at the
            <br />
            hydrogen atom.
          </h1>
          <p className="mrp-intro">
            Everything in MRI follows from one thing: a proton in a magnetic field precesses,
            and you can talk to it at its own frequency. This course takes that from the single
            nucleus to a weighted clinical image, one concept at a time, and teaches every one
            of them <strong>on the instrument beside you</strong> — the same three-dimensional
            chamber the laboratory runs on, configured for the one idea on screen.
          </p>
          <p className="mrp-order">
            The signal has to exist before it can be located, and it has to be locatable before
            a sequence can weight it. That is the order. The instrument you drive yourself is
            last, once every control means something.
          </p>
          <div className="mrp-actions">
            <Link className="lx-btn lx-btn-solid" to="/mri-lab/core">Begin the module</Link>
            <Link className="lx-btn lx-btn-ghost" to="/mri-lab/laboratory">Skip to the free laboratory</Link>
          </div>
          <p className="mrp-elsewhere">
            Looking for the full syllabus instead — the machine, artefacts, safety, spectroscopy?
            That is <Link to="/mri">the MRI module</Link>, all twenty-one sections. This page is the
            sequence course that sits inside it.
          </p>
        </div>

        {/* Not a picture of the instrument — the instrument. Drag it. Whatever
            a learner does here is exactly what the lessons will ask of them. */}
        <div className="mrp-cover">
          <MriProvider
            initialConfig={PRESETS['t1-se']}
            initialTissues={['fat', 'whiteMatter', 'greyMatter', 'csf']}
            initialFocus="fat"
            autoPlay={false}
          >
            <CoverLoop />
            <div className="mri-stage-canvas mri-vars mrp-cover-stage">
              <MagnetisationChamber initialOptions={{ showSpins: true }} />
            </div>
          </MriProvider>
          <p className="mrp-cover-cap">
            The magnetisation chamber, running a T1 spin echo — live, and yours to turn.
            Every vector is computed from the signal equations; nothing here is drawn by hand.
          </p>
        </div>
      </section>

      <section className="mrp-path" aria-label="The course">
        {CHAPTERS.map((chapter) => (
          <article key={chapter.name} className="mrp-chapter">
            <div className="mrp-chapter-head">
              <h2>{chapter.name}</h2>
              <p>{chapter.premise}</p>
            </div>
            <ol className="mrp-entries">
              {chapter.entries.map((entry) => {
                n += 1
                return (
                  <li key={entry.path}>
                    <Link to={entry.path} className={`mrp-entry is-${entry.kind}`}>
                      <span className="mrp-n">{String(n).padStart(2, '0')}</span>
                      <span className="mrp-entry-body">
                        <strong>{entry.label}</strong>
                        <span>{entry.blurb}</span>
                      </span>
                      <span className="mrp-kind">{entry.kind === 'lesson' ? 'Lesson' : 'Instrument'}</span>
                    </Link>
                  </li>
                )
              })}
            </ol>
          </article>
        ))}
      </section>

      <footer className="mrp-foot">
        <p>
          Every MRI topic here is also taught section by section in{' '}
          <Link to="/mri">the MRI module</Link> — the syllabus in order, one
          concept at a time.
        </p>
      </footer>
    </main>
  )
}
