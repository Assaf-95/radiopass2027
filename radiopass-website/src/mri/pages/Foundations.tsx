/**
 * MRI Foundations — the entry point of the module.
 *
 * Five stages, in the order the physics happens. This page deliberately does
 * not use the pulse-sequence workbench: a learner meeting net magnetisation for
 * the first time should not be looking at a TR slider. It shares the engine's
 * relaxation functions and the same projection and palette, so nothing has to
 * be unlearned when they reach the sequence pages.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'

import { Slider } from '../components/Controls'
import {
  FOUNDATION_STAGES,
  FoundationsScene,
  type FoundationStage,
} from '../components/FoundationsScene'
import { GuidedLab, type GuideStep } from '../components/GuidedLab'
import { AdvancedPanel, ModelNote, MriPage } from '../components/Layout'
import { RelaxationGraph } from '../components/RelaxationGraph'
import { larmorFrequencyMHz } from '../engine'
import { MriProvider } from '../state/context'

/* Guided Mode: the same five-stage scene, one concept at a time. This page's
   stage, field and relaxation controls are local component state rather than
   the shared sequence clock, so no step uses a cue — the learner drives the
   stage transport, and every claim is executed by the scene beside it. */
const GUIDE: GuideStep[] = [
  {
    id: 'net-magnetisation',
    title: 'What is net magnetisation, M₀?',
    claim: 'Outside the scanner each proton is a tiny magnet, but the moments point in every direction and sum to nothing. Inside B₀ a small surplus — a few per million — settles into the lower-energy state aligned with the field, and there are so many protons that the surplus adds up to a real vector along z. That vector is the net magnetisation M₀, the only thing the scanner ever measures.',
    tryIt: 'Use the › button to step from stage 1 to stage 2 and watch the random cloud acquire its small aligned surplus.',
    keyPoint: 'M₀ is the tiny population surplus aligned with B₀ — every MR image begins as this single longitudinal vector.',
    focus: 'all',
  },
  {
    id: 'precession',
    title: 'Why do the moments precess?',
    claim: 'The moments do not sit still along z — they wobble around the field direction like spinning tops, at the Larmor frequency of 42.58 MHz per tesla, which is about 63.9 MHz at 1.5 T. The net vector still points steadily along z, because the moments are spread evenly around the cone and their transverse parts cancel.',
    tryIt: 'On stage 3, Precession, drag the B₀ slider from 0.2 T up towards 7 T and watch the wobble speed up as the quoted frequency climbs.',
    keyPoint: 'Precession frequency is directly proportional to B₀ — that proportionality is what makes resonance, and later slice selection, possible.',
    focus: 'field',
  },
  {
    id: 'ninety-pulse',
    title: 'What does the 90° pulse do?',
    claim: 'An RF pulse can only move the magnetisation if its frequency matches the precession — that matching is the resonance in magnetic resonance. A 90° pulse tips the whole of M₀ into the transverse plane and pulls the moments into phase with each other, and only that rotating transverse magnetisation induces a signal in the receive coil.',
    tryIt: 'On stage 4, Radiofrequency excitation, drag the flip angle from 90° down towards 5° and back, watching how much of the vector reaches the transverse plane.',
    keyPoint: 'A 90° pulse converts all longitudinal magnetisation into transverse magnetisation — and only transverse magnetisation makes signal.',
    focus: 'flip',
  },
  {
    id: 'rotating-frame',
    title: 'What is the rotating frame?',
    claim: 'Watched from the laboratory, the vector keeps precessing while the pulse tips it, so excitation is really a tight spiral down towards the transverse plane. Physicists describe it instead from a frame that rotates with the precession at the Larmor frequency; in that rotating frame the spiral flattens into one clean arc through the flip angle.',
    tryIt: 'On stage 4, drag B₀ down to 0.2 T — with the precession slowed you can see the spiral that the rotating frame would straighten into a simple tip.',
    keyPoint: 'The rotating frame turns with the precession, so excitation appears as a simple tip through the flip angle — sequence diagrams are drawn in this frame.',
    focus: 'field',
  },
  {
    id: 't1-recovery',
    title: 'What does T1 recovery describe?',
    claim: 'After the pulse, longitudinal magnetisation regrows along z as the protons hand their excess energy back to the surrounding molecular lattice. T1 is the time constant of that regrowth — about 63% recovered after one T1 — and it differs enormously between tissues: at 1.5 T fat is about 260 ms while CSF is about 4000 ms.',
    tryIt: 'On stage 5, Relaxation, drag T1 down to 250 ms — close to fat — then out to 3000 ms, and watch how much longer the recovery curve takes to climb.',
    keyPoint: 'T1 is the time to recover about 63% of longitudinal magnetisation — short-T1 tissues like fat rebuild it fastest.',
    focus: 'all',
  },
  {
    id: 't2-decay',
    title: 'Why does the signal die before recovery finishes?',
    claim: 'T2 decay is a separate process: neighbouring spins see slightly different local fields, precess at slightly different rates, and drift out of phase, so the transverse magnetisation cancels itself without any energy leaving the system. Losing coherence is easier than shedding energy, so T2 is always shorter than T1 — muscle has a T2 of about 45 ms, and even free CSF only about 2000 ms against its 4000 ms T1.',
    tryIt: 'On stage 5, drag T2 down towards 40 ms and then up to 400 ms, and compare how fast the transverse curve dies while the longitudinal curve is still climbing.',
    keyPoint: 'T2 decay is loss of phase coherence and always runs ahead of T1 recovery — the signal is gone long before the magnetisation is back.',
    focus: 'all',
  },
]

function Foundations() {
  const [stage, setStage] = useState<FoundationStage>(0)
  const [playing, setPlaying] = useState(true)
  const [fieldT, setFieldT] = useState(1.5)
  const [flipAngle, setFlipAngle] = useState(90)
  const [amplitude, setAmplitude] = useState(0.6)
  const [t1, setT1] = useState(600)
  const [t2, setT2] = useState(80)

  const current = FOUNDATION_STAGES[stage]

  return (
    <>
      <div className="mri-foundations">
        <div className="mri-foundations-stage">
          <div className="mri-chamber-stage" style={{ height: 'clamp(320px, 48vh, 520px)' }}>
            <FoundationsScene
              stage={stage}
              fieldT={fieldT}
              flipAngle={flipAngle}
              pulseAmplitude={amplitude}
              t1={t1}
              t2={t2}
              playing={playing}
            />
          </div>

          <div className="mri-transport" style={{ borderTop: 'none', paddingTop: 12 }}>
            <div className="mri-transport-buttons">
              <button
                type="button"
                className="mri-icon-button"
                onClick={() => setStage((value) => Math.max(0, value - 1) as FoundationStage)}
                disabled={stage === 0}
                aria-label="Previous stage"
              >
                ‹
              </button>
              <button
                type="button"
                className="mri-icon-button is-primary"
                onClick={() => setPlaying((value) => !value)}
                aria-label={playing ? 'Pause the animation' : 'Play the animation'}
              >
                {playing ? '❚❚' : '▶'}
              </button>
              <button
                type="button"
                className="mri-icon-button"
                onClick={() => setStage((value) => Math.min(4, value + 1) as FoundationStage)}
                disabled={stage === 4}
                aria-label="Next stage"
              >
                ›
              </button>
            </div>
            <p className="mri-next-event" style={{ flex: 1 }}>
              Stage {stage + 1} of 5 — <strong>{current.title}</strong>
            </p>
          </div>

          <p className="mri-stage-caption" aria-live="polite">
            {current.caption}
          </p>
        </div>

        <div className="mri-foundations-side">
          <section className="mri-panel">
            <h3>The five stages</h3>
            <ol className="mri-steps">
              {FOUNDATION_STAGES.map((item, index) => (
                <li key={item.title} className={index === stage ? 'is-active' : ''}>
                  <button
                    type="button"
                    onClick={() => setStage(index as FoundationStage)}
                    aria-current={index === stage ? 'step' : undefined}
                  >
                    <span className="mri-step-index">{index + 1}</span>
                    <span className="mri-step-body">
                      <strong>{item.title}</strong>
                    </span>
                    <span className="mri-step-time" />
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section className="mri-panel">
            <h3>What is happening</h3>
            <p style={{ fontSize: 13, lineHeight: 1.7, color: 'var(--mri-muted)', margin: 0 }}>
              {current.detail}
            </p>
          </section>

          {stage >= 2 && (
            <section className="mri-panel">
              <h3>Controls</h3>
              <div className="mri-controls">
                {stage >= 2 && (
                  <Slider
                    param="field"
                    label="B₀"
                    unit="T"
                    value={fieldT}
                    min={0.2}
                    max={7}
                    step={0.1}
                    onChange={setFieldT}
                    hint={`Larmor frequency ω₀/2π = ${larmorFrequencyMHz(fieldT).toFixed(1)} MHz. Raise the field and the moments precess faster.`}
                  />
                )}
                {stage === 3 && (
                  <>
                    <Slider
                      param="flip"
                      label="Flip angle"
                      unit="°"
                      value={flipAngle}
                      min={5}
                      max={180}
                      step={5}
                      onChange={setFlipAngle}
                      hint="How far the pulse tips the net vector away from z. At 90° all of the magnetisation ends up in the transverse plane."
                    />
                    <Slider
                      param="rf"
                      label="RF amplitude"
                      value={Math.round(amplitude * 100)}
                      min={15}
                      max={100}
                      step={5}
                      unit="%"
                      onChange={(value) => setAmplitude(value / 100)}
                      hint="A stronger pulse reaches the same flip angle in less time. Amplitude and duration together determine the flip angle."
                    />
                  </>
                )}
                {stage === 4 && (
                  <>
                    <Slider
                      param="t1"
                      label="T1"
                      unit="ms"
                      value={t1}
                      min={100}
                      max={3000}
                      step={50}
                      onChange={setT1}
                      hint="How quickly longitudinal magnetisation returns along z."
                    />
                    <Slider
                      param="t2"
                      label="T2"
                      unit="ms"
                      value={t2}
                      min={20}
                      max={400}
                      step={10}
                      onChange={setT2}
                      hint="How quickly transverse magnetisation is lost. T2 is always shorter than T1."
                    />
                  </>
                )}
              </div>
            </section>
          )}
        </div>
      </div>

      {stage === 4 && (
        <section className="mri-zone" style={{ marginTop: 16 }}>
          <h3 className="mri-zone-title">
            <span>Both at once</span> T1 recovery and T2 decay are separate processes
          </h3>
          <RelaxationGraph t1={t1} t2={t2} flipAngle={flipAngle} />
        </section>
      )}

      {stage >= 2 && (
        <AdvancedPanel title="The Larmor equation">
          <p className="mri-formula">{`ω₀ = γ · B₀

γ / 2π  = 42.58 MHz per tesla   (hydrogen proton)
B₀      = ${fieldT.toFixed(1)} T
ω₀ / 2π = ${larmorFrequencyMHz(fieldT).toFixed(2)} MHz`}</p>
          <p>
            The precession frequency is directly proportional to field strength. At 1.5 T hydrogen
            precesses at about 63.9 MHz; at 3 T, about 127.7 MHz. An RF pulse only excites protons
            whose precession frequency it matches, which is what the word{' '}
            <strong>resonance</strong> refers to — and it is also what makes slice selection
            possible, because a gradient makes the resonant frequency vary with position.
          </p>
          <p>
            <strong>Note on the animation.</strong> Real precession at 63.9 million cycles per second
            cannot be drawn. The rate on screen is slowed by a large constant factor; only the{' '}
            <em>proportionality</em> to B₀ is faithful. The quoted MHz value is the true one.
          </p>
        </AdvancedPanel>
      )}

      {stage === 4 && (
        <AdvancedPanel title="Why T1 and T2 are not the same process">
          <p>
            <strong>T1 (spin–lattice) recovery</strong> is about energy. Excited protons hand energy
            back to the surrounding molecular lattice and return to alignment with B₀. It restores
            the z component.
          </p>
          <p>
            <strong>T2 (spin–spin) decay</strong> is about phase. Neighbouring protons see slightly
            different local magnetic fields from each other, so they precess at slightly different
            rates and lose phase coherence. No energy needs to leave the system. It destroys the
            transverse component.
          </p>
          <p>
            Because losing coherence is easier than shedding energy to the lattice, T2 is always
            shorter than or equal to T1 — usually much shorter. Set T1 to 600 ms and T2 to 80 ms on
            the graph above and watch how completely the transverse signal has gone before the
            longitudinal curve is even halfway back.
          </p>
          <p>
            This is why a sequence has to make a choice about <em>when</em> to look. That choice is
            what the next five pages are about.
          </p>
        </AdvancedPanel>
      )}

      <div className="mri-lesson-card" style={{ marginTop: 16 }}>
        <h3>Where to go next</h3>
        <p>
          You now have the four ingredients every sequence works with: longitudinal magnetisation,
          transverse magnetisation, T1 recovery and T2 decay. The{' '}
          <Link to="/mri-lab/t1-spin-echo" style={{ color: 'var(--mri-accent)' }}>
            T1-weighted spin echo
          </Link>{' '}
          page shows how choosing <em>when</em> to excite and <em>when</em> to measure turns those
          into image contrast.
        </p>
      </div>

      <ModelNote />
    </>
  )
}

export default function FoundationsPage() {
  return (
    <MriPage
      path="/mri-lab"
      eyebrow="Foundations"
      title={
        <>
          Where the signal
          <br />
          <span>comes from.</span>
        </>
      }
      intro="Five stages, in the order they happen: randomly oriented protons, alignment in the main field, precession, excitation and relaxation. Rotate the scene with a drag or the arrow keys."
      showModeSwitch={false}
    >
      {/* GuidedLab reads the MRI context; this page has no sequence workbench,
          so the provider is inert (autoPlay off, nothing consumes the clock). */}
      <MriProvider autoPlay={false}>
        {/* No primer or stage summary on this page, so only the Exam detail
            drawer (the Larmor / relaxation AdvancedPanels) is offered. */}
        <GuidedLab steps={GUIDE} drawers={['exam']}>
          <Foundations />
        </GuidedLab>
      </MriProvider>
    </MriPage>
  )
}
