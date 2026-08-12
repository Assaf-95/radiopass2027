/**
 * Module 19 — Quality Assurance.
 *
 * A virtual tissue-mimicking test phantom and a fault injector. The point of
 * the page is a skill rather than a fact: look at the phantom image, recognise
 * the signature, and name the fault. Blind mode hides which fault is running
 * and keeps a score.
 *
 * Every appearance is produced by the physics of the render — penetration is
 * lost because echoes really do fall below the noise floor, and a speed
 * calibration error changes no pixel at all, only the measurements. That is
 * exactly the distinction the learner has to make.
 */

import { useCallback, useMemo, useState } from 'react'

import { ChipRow, ControlGroup, Segmented, Slider, StageFlash, Toggle, useFlash } from '../components/Controls'
import {
  GuidedCaption,
  GuidedTransport,
  Predict,
  useClock,
  useGuided,
  type GuidedStep,
} from '../components/Guided'
import { UsIcon } from '../components/icons'
import {
  FocusHide,
  ModelNote,
  MoreDetail,
  Readout,
  SourceNote,
  TrapNote,
  UsLab,
} from '../components/Layout'
import { TeachingPanel, type Delta } from '../components/Teaching'
import {
  QA_FAULTS,
  QaStage,
  WIRE_SPACING_MM,
  measuredSpacingMm,
  type QaFault,
  type QaPhase,
} from '../scenes/QaStage'

type State = {
  fault: QaFault
  frequencyMHz: number
  blind: boolean
  /** Position in the blind sequence, so the exercise is repeatable. */
  blindIndex: number
}

const DEFAULTS: State = {
  fault: 'none',
  frequencyMHz: 5,
  blind: false,
  blindIndex: 0,
}

/** A fixed sequence, so a learner can work through the same set twice. */
const BLIND_SEQUENCE: QaFault[] = ['element', 'sensitivity', 'speed', 'cable', 'matching', 'noise']

const FAULT_CHOICES = QA_FAULTS.map((f) => ({ value: f.id, label: f.short }))

const FAULT_EXPLANATION: Record<QaFault, { appearance: string; why: string }> = {
  none: {
    appearance: 'All targets visible, uniform background, penetration to the expected depth.',
    why: 'This is the baseline. QA matters because degradation is gradual and silent — without a baseline there is nothing to compare against.',
  },
  element: {
    appearance: 'A dark vertical band running the full depth, always at the same lateral position.',
    why: 'Each element contributes to a fixed set of scan lines, so a dead element removes the same lines whatever is being scanned. A shadow moves with the anatomy; this does not.',
  },
  speed: {
    appearance: 'The image looks normal — but every measured distance is wrong by the same fraction.',
    why: 'The machine converts time to depth with an assumed speed. If that assumption is wrong, every distance is scaled by the same factor, at every depth. Reading it needs the calipers, not the picture.',
  },
  sensitivity: {
    appearance: 'The deep targets have disappeared into noise; penetration is visibly shorter.',
    why: 'Weaker transmission and a raised noise floor mean deep echoes drop below the floor sooner. The near field still looks reasonable, which is what separates this from a matching-layer fault.',
  },
  noise: {
    appearance: 'Snow across the whole image at every depth, including the near field.',
    why: 'Electronic noise is added after the echo, so it is independent of depth and is amplified along with the signal. Turning up the gain makes it worse, not better.',
  },
  matching: {
    appearance: 'Everything is dim, and the near field in particular is poor.',
    why: 'A damaged matching layer means far less energy gets out of and back into the crystal, so the whole image loses amplitude — not just the far field.',
  },
  cable: {
    appearance: 'Noise bands that come and go, rather than a fixed defect.',
    why: 'Intermittent electrical contact produces an intermittent fault. Anything that changes between frames without the probe moving points at the cable or the connector rather than at an element.',
  },
}

const QA_TABLE: { test: string; detects: string; how: string }[] = [
  {
    test: 'Uniformity',
    detects: 'Element dropout, cable and connector faults, probe-face damage',
    how: 'Every routine check, and whenever the image looks wrong',
  },
  {
    test: 'Dead zone',
    detects: 'How close to the face imaging is possible; matching-layer and face damage',
    how: 'Routine periodic testing',
  },
  {
    test: 'Vertical distance accuracy',
    detects: 'Calibration of the assumed propagation speed in depth',
    how: 'Routine periodic testing',
  },
  {
    test: 'Horizontal distance accuracy',
    detects: 'Scan-conversion and lateral calibration errors',
    how: 'Routine periodic testing',
  },
  {
    test: 'Axial and lateral resolution',
    detects: 'Pulse-length and beam-width degradation',
    how: 'Routine periodic testing',
  },
  {
    test: 'Anechoic (cyst) fill-in',
    detects: 'Poor lateral resolution, clutter and side-lobe artefact',
    how: 'Routine periodic testing',
  },
  {
    test: 'Grey-scale / contrast targets',
    detects: 'Loss of contrast resolution, display and processing faults',
    how: 'Routine periodic testing',
  },
  {
    test: 'Depth of penetration',
    detects: 'Loss of sensitivity, matching-layer damage, transmitter faults',
    how: 'Routine periodic testing, and after any suspected fault',
  },
  {
    test: 'Probe-face and cable inspection',
    detects: 'Cracks, delamination, lens damage, connector and cable damage',
    how: 'Visually, before use',
  },
  {
    test: 'Electrical safety check',
    detects: 'Insulation and leakage-current faults',
    how: 'By the medical physics or clinical engineering service',
  },
]

const STEPS: GuidedStep<State>[] = [
  {
    id: 'why',
    title: 'Why QA exists: drift happens silently',
    phase: 'why',
    state: { fault: 'none', frequencyMHz: 5, blind: false },
    caption: (
      <>
        A scanner rarely fails outright. Elements die one at a time, sensitivity falls, calibration
        drifts — and the images still <em>look</em> like images. Scanning a{' '}
        <b>tissue-mimicking test phantom</b> gives you a fixed object with known targets, so you can
        compare against a baseline instead of against your memory.
      </>
    ),
    detail:
      'The phantom never changes. That is the entire value of it: any change in the picture is a change in the machine.',
  },
  {
    id: 'tour',
    title: 'The phantom tour — what each target tests',
    phase: 'tour',
    state: { fault: 'none', frequencyMHz: 5, blind: false },
    duration: 1.6,
    caption: (
      <>
        The <b>vertical wires</b> test depth (vertical distance) accuracy, the <b>horizontal row</b>{' '}
        lateral accuracy, the <b>ladder</b> of closing pairs axial resolution, the{' '}
        <b>anechoic cysts</b> lateral resolution and fill-in, the <b>grey-scale blocks</b> contrast
        resolution, the band at the top the <b>dead zone</b>, and how deep the background stays
        visible is the <b>depth of penetration</b>. Uniformity is read across the whole image.
      </>
    ),
  },
  {
    id: 'dropout',
    title: 'Element dropout — a band that never moves',
    phase: 'dropout',
    state: { fault: 'element', frequencyMHz: 5, blind: false },
    duration: 1.4,
    caption: (
      <>
        A <b>dead element</b> removes the scan lines it contributes to, so a dark band runs the full
        depth at the <b>same lateral position whatever you scan</b>. That is what separates it from a
        shadow: a shadow belongs to the anatomy and moves when the probe moves.
      </>
    ),
  },
  {
    id: 'speed',
    title: 'Speed calibration — the picture is fine, the numbers are not',
    phase: 'speed',
    state: { fault: 'speed', frequencyMHz: 5, blind: false },
    duration: 1.4,
    caption: () => (
      <>
        Nothing looks wrong. But the wires are exactly <b>{WIRE_SPACING_MM.toFixed(1)} mm</b> apart
        and the machine measures <b>{measuredSpacingMm().toFixed(1)} mm</b> — and it is wrong by the
        <b> same fraction at every depth</b>. Systematic, proportional error is the signature of a{' '}
        <b>calibration</b> problem, not of a local speed artefact.
      </>
    ),
  },
  {
    id: 'sensitivity',
    title: 'Loss of sensitivity — the far field goes first',
    phase: 'sensitivity',
    state: { fault: 'sensitivity', frequencyMHz: 5, blind: false },
    duration: 1.4,
    caption: (
      <>
        With weaker transmission and a higher noise floor, the deep targets fall below the floor and
        the <b>depth of penetration visibly shrinks</b>. The near field still reads reasonably —
        which is what distinguishes this from a <b>damaged matching layer</b>, where the whole image
        including the near field is dim.
      </>
    ),
  },
  {
    id: 'diagnose',
    hands: true,
    title: 'Now inject faults yourself and diagnose them',
    phase: 'diagnose',
    state: { fault: 'none', frequencyMHz: 5, blind: false },
    caption: (
      <>
        Use the <b>fault injector</b> below, or switch on <b>blind mode</b> and work through the
        sequence: look at the image, name the fault, and check your answer. Your score is kept as you
        go.
      </>
    ),
  },
]

export default function QaPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  const [choice, setChoice] = useState<QaFault | null>(null)
  const [score, setScore] = useState({ attempts: 0, correct: 0 })
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    setChoice(null)
    setScore({ attempts: 0, correct: 0 })
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)

  const measured = useMemo(() => measuredSpacingMm(), [])
  const errorPercent = ((measured - WIRE_SPACING_MM) / WIRE_SPACING_MM) * 100
  const current = QA_FAULTS.find((f) => f.id === state.fault) ?? QA_FAULTS[0]
  const explanation = FAULT_EXPLANATION[state.fault]

  /* --- controls announce their consequence immediately -------------------- */

  const onFault = (value: QaFault) => {
    setChoice(null)
    patch({ fault: value, blind: false })
    const info = FAULT_EXPLANATION[value]
    flash.fire([
      { text: `Fault injected: ${QA_FAULTS.find((f) => f.id === value)?.short}`, dir: value === 'none' ? 'flat' : 'warn' },
      { text: info.appearance, dir: value === 'none' ? 'up' : 'warn' },
      { text: 'Fault labels visible — blind mode is off', dir: 'flat' },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Axial resolution improves' : 'Axial resolution worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Penetration into the phantom falls' : 'Penetration rises', dir: up ? 'down' : 'up' },
      { text: 'Distance accuracy unaffected — that is calibration', dir: 'flat' },
    ])
  }

  const onBlind = (value: boolean) => {
    setChoice(null)
    if (value) {
      const next = BLIND_SEQUENCE[state.blindIndex % BLIND_SEQUENCE.length]
      patch({ blind: true, fault: next })
      flash.fire([
        { text: 'Blind mode on', dir: 'flat' },
        { text: 'A fault has been injected — it is not named', dir: 'warn' },
        { text: 'Read the image, then diagnose it below', dir: 'flat' },
      ])
    } else {
      patch({ blind: false })
      flash.fire([
        { text: 'Blind mode off', dir: 'flat' },
        { text: `The fault was: ${current.label}`, dir: 'flat' },
      ])
    }
  }

  const nextBlind = () => {
    const index = state.blindIndex + 1
    setChoice(null)
    patch({ blindIndex: index, blind: true, fault: BLIND_SEQUENCE[index % BLIND_SEQUENCE.length] })
    flash.fire([
      { text: 'New blind fault injected', dir: 'warn' },
      { text: 'Nothing else on the machine was touched', dir: 'flat' },
    ])
  }

  const answer = (value: QaFault) => {
    if (choice !== null) return
    setChoice(value)
    setScore((s) => ({ attempts: s.attempts + 1, correct: s.correct + (value === state.fault ? 1 : 0) }))
  }

  const deltas: Delta[] = [
    { label: 'dead element → fixed vertical band', dir: 'warn' },
    { label: 'wrong assumed speed → all distances wrong', dir: 'warn' },
    { label: 'sensitivity ↓ → penetration ↓', dir: 'down' },
    { label: 'noise ↑ → whole image degraded', dir: 'warn' },
    { label: 'matching layer damaged → everything dim', dir: 'warn' },
    { label: 'cable damage → intermittent, not fixed', dir: 'warn' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/qa"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Quality assurance test phantom">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="phantom" size={14} />
                <b>Stage</b> Tissue-mimicking test phantom
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Resolution targets
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Contrast targets
                </span>
                <span>
                  <i className="is-dot" style={{ background: 'var(--us-red)' }} /> Fault signature
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <QaStage
                  fault={state.fault}
                  frequencyMHz={state.frequencyMHz}
                  phase={api.phase as QaPhase}
                  time={clock}
                  showAnnotations={!state.blind}
                />
              </div>
            </div>

            <GuidedCaption api={api} state={state} />
            <GuidedTransport
              api={api}
              onShowEquation={() => setShowEquation((v) => !v)}
              onShowTrap={() => setShowTrap((v) => !v)}
              showingEquation={showEquation}
              showingTrap={showTrap}
              onToggleDetail={() => setDetail((v) => !v)}
              detailShown={detail}
            />
            <p className="us-focus-hint">
              One idea at a time. <b>Show the numbers</b> for the readouts and full analysis, or{' '}
              <b>Enter manual lab</b> to inject faults and diagnose them yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Injected fault', value: state.blind ? 'Hidden' : current.short, tone: state.fault === 'none' ? 'green' : 'amber' },
                { label: 'True wire spacing', value: WIRE_SPACING_MM.toFixed(1), unit: 'mm' },
                {
                  label: 'Machine reads',
                  value: state.fault === 'speed' ? measured.toFixed(1) : WIRE_SPACING_MM.toFixed(1),
                  unit: 'mm',
                  tone: state.fault === 'speed' ? 'red' : 'green',
                },
                {
                  label: 'Distance error',
                  value: state.fault === 'speed' ? `+${errorPercent.toFixed(1)}` : '0.0',
                  unit: '%',
                  tone: state.fault === 'speed' ? 'red' : 'green',
                },
                { label: 'Diagnoses attempted', value: score.attempts },
                {
                  label: 'Correct',
                  value: score.correct,
                  tone: score.attempts > 0 && score.correct === score.attempts ? 'green' : 'cyan',
                },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Fault injector" icon="trap" defaultOpen>
            <ChipRow label="Inject a fault" value={state.fault} options={FAULT_CHOICES} onChange={onFault} />
            <p className="us-slider-hint">
              {state.blind ? (
                <>
                  <strong>Blind mode is on.</strong> The injected fault is not named. Read the image,
                  then diagnose it below.
                </>
              ) : (
                <>
                  <strong>{current.label}.</strong> {explanation.appearance}
                </>
              )}
            </p>
            <Toggle
              label="Blind mode — hide which fault is injected"
              checked={state.blind}
              onChange={onBlind}
              hint="Turns off the on-image annotations too, so nothing gives the answer away."
            />
            <button type="button" className="us-btn" onClick={nextBlind}>
              <UsIcon name="replay" size={13} />
              Inject the next blind fault
            </button>
          </ControlGroup>

          <ControlGroup title="Scanner settings" icon="sliders" defaultOpen={false}>
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={2}
              max={12}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Changes resolution and penetration, exactly as it would in a patient. It does NOT change distance accuracy — that is a calibration property."
            />
            <Segmented
              label="Teaching panel"
              value={revision ? 'revision' : 'full'}
              options={[
                { value: 'full', label: 'Full detail' },
                { value: 'revision', label: 'Revision' },
              ]}
              onChange={(v) => setRevision(v === 'revision')}
            />
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="search" size={13} />
              Diagnose the fault
            </h3>
            <p className="us-slider-hint" style={{ marginTop: 0 }}>
              Read the phantom image, then name the fault. Score:{' '}
              <strong>
                {score.correct} / {score.attempts}
              </strong>
              .
            </p>
            <div className="us-predict-options" role="group" aria-label="Diagnose the injected fault">
              {QA_FAULTS.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={`us-btn us-btn-small${
                    choice === null
                      ? ''
                      : f.id === state.fault
                        ? ' is-right'
                        : f.id === choice
                          ? ' is-wrong'
                          : ''
                  }`}
                  disabled={choice !== null}
                  onClick={() => answer(f.id)}
                >
                  {f.short}
                </button>
              ))}
            </div>
            {choice !== null && (
              <p className="us-predict-verdict">
                <strong>{choice === state.fault ? 'Correct. ' : 'Not quite. '}</strong>
                The fault is <strong>{current.label.toLowerCase()}</strong>. {explanation.appearance}{' '}
                {explanation.why}
              </p>
            )}
            {choice !== null && (
              <button type="button" className="us-btn us-btn-small" onClick={nextBlind}>
                <UsIcon name="next" size={13} />
                Next blind fault
              </button>
            )}
          </div>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="A dark band runs down the same lateral position whatever you scan. Cause?"
              options={['Acoustic shadowing', 'Dead transducer element', 'Wrong assumed speed']}
              correct={1}
              explanation={
                <>
                  A <b>dead transducer element</b>. Each element feeds a fixed set of scan lines, so
                  the dropout stays in the <b>same lateral position</b> no matter what is in front of
                  the probe. A shadow belongs to the anatomy and moves with it; a speed error changes
                  the measurements, not the brightness.
                </>
              }
            />
          </div>
        </>
      }
      teaching={
        <>
          <TeachingPanel
            revision={revision}
            onRevisionChange={setRevision}
            now={
              <>
                {state.blind ? (
                  <>
                    A fault has been injected and <b>not named</b>. Read the phantom: is the defect{' '}
                    <b>fixed or intermittent</b>, does it affect the <b>whole image or just the far
                    field</b>, and are the <b>measurements</b> right?
                  </>
                ) : state.fault === 'none' ? (
                  <>
                    The phantom is imaging normally at <b>{state.frequencyMHz.toFixed(1)} MHz</b>:
                    all targets visible, background uniform, wires reading{' '}
                    <b>{WIRE_SPACING_MM.toFixed(1)} mm</b> apart. This is the baseline.
                  </>
                ) : (
                  <>
                    <b>{current.label}</b> is injected. {explanation.appearance}
                  </>
                )}
              </>
            }
            why={
              <>
                Every fault has a signature because every fault sits at a different point in the
                chain. Element and cable problems affect <b>particular scan lines or particular
                moments</b>. Transmission problems affect <b>amplitude</b>, and therefore depth.
                Calibration problems affect the <b>time-to-depth conversion</b>, and therefore only
                the numbers.
              </>
            }
            equation={
              showEquation
                ? `depth = c t / 2   — the machine's assumed c is what calibration sets

True wire spacing      = ${WIRE_SPACING_MM.toFixed(1)} mm
Machine reads          = ${measured.toFixed(1)} mm   (speed-calibration fault)
Error                  = +${errorPercent.toFixed(1)} %  at EVERY depth

Same fraction at every depth → calibration
Different at one depth only  → a local speed artefact, not a fault`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                {state.fault === 'none'
                  ? 'A documented baseline is what makes everything else on this page possible. Without it, gradual degradation is invisible.'
                  : state.fault === 'speed'
                    ? 'The images remain diagnostic to look at, but no measurement from this machine can be trusted until it is recalibrated.'
                    : state.fault === 'element' || state.fault === 'cable'
                      ? 'Take the probe out of service and have it checked. A dropout band can hide pathology exactly where you are not looking for it.'
                      : 'Sensitivity problems cost you the deep field first — which is where the diagnosis often is. Report it rather than compensating with gain.'}
              </>
            }
            trap={
              showTrap ? (
                <>
                  Do not call a <b>dropout band</b> a shadow. A shadow arises from the anatomy and
                  moves as the probe moves; element dropout stays in the <b>same lateral
                  position</b>. And <b>cable damage</b> tends to be intermittent, where a dead
                  element is relentlessly persistent.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the tests, and what each one detects">
            <p>
              A standard <strong>tissue-mimicking phantom</strong> contains wire targets at known
              separations plus anechoic and contrast objects. It is used to detect{' '}
              <strong>element dropout</strong>, calibration error, loss of sensitivity and probe
              damage — the four things that degrade quietly.
            </p>
            <p>
              <strong>Element dropout.</strong> Because each element contributes to a fixed set of
              scan lines, the fault appears in the <strong>same lateral position</strong> whatever is
              being scanned. Cable damage tends to produce noise or <em>intermittent</em> dropout
              instead, which is the discriminator between the two.
            </p>
            <p>
              <strong>Calibration error.</strong> A wrong assumed propagation speed produces
              systematic distance errors: measured distances come out proportionally wrong, and the
              error is <strong>the same fraction at every depth</strong>. That signature is what
              separates a calibration problem from a local speed artefact caused by an unusual
              tissue.
            </p>
            <p>
              <strong>Sensitivity and penetration.</strong> Depth of penetration on the phantom is
              the most sensitive single indicator of a failing transmit or receive chain, because it
              depends on the whole signal path. Compare against the recorded baseline, not against
              what looks acceptable today.
            </p>
            <p>
              <strong>Inspect the probe face.</strong> Before every use, look at the lens and the
              housing for <strong>cracks, delamination and wear</strong>, and check the cable and
              connector. A cracked face is both an image-quality problem and an infection-control and{' '}
              <strong>electrical safety</strong> one — leakage current and insulation testing belong
              to the medical physics or clinical engineering service, and any probe suspected of
              damage should be taken out of use rather than worked around.
            </p>

            <div className="us-table-wrap">
              <table className="us-table">
                <thead>
                  <tr>
                    <th scope="col">Test</th>
                    <th scope="col">What it detects</th>
                    <th scope="col">How often</th>
                  </tr>
                </thead>
                <tbody>
                  {QA_TABLE.map((row) => (
                    <tr key={row.test}>
                      <th scope="row">{row.test}</th>
                      <td>{row.detects}</td>
                      <td>{row.how}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <TrapNote>
              “Turn the gain up” is not a fix for lost sensitivity. Gain amplifies the electronic
              noise along with the signal, so the signal-to-noise ratio is unchanged — the echoes
              that have fallen below the noise floor do not come back.
            </TrapNote>

            <SourceNote>
              The phantom tests and the two fault signatures follow the standard QA description used
              in the fact bank (facts <em>us-qa-tests</em>, <em>us-element-dropout</em> and{' '}
              <em>us-calibration-error</em>). Testing frequency is written here as typical practice —
              local schedules are set by the department and its medical physics service, so no
              mandated interval is claimed.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The phantom image is computed by the same B-mode renderer used throughout the laboratory,
            so shadowing, fill-in and the loss of penetration are <em>emergent</em> rather than
            painted on. The dropout band is drawn onto the image because a single simulated element
            is not modelled individually; everything else about that fault — its fixed lateral
            position and its full-depth extent — is the real behaviour. Target sizes and spacings are
            representative of a commercial phantom rather than any particular model.
          </ModelNote>
        </>
      }
    />
  )
}
