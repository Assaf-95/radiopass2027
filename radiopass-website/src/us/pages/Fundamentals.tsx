/**
 * Module 1 — Sound Fundamentals.
 *
 * The entry point of the laboratory, and the page that establishes the pattern
 * every other experiment follows: a guided walkthrough that meets one idea at a
 * time, controls that announce their consequence the moment they move, and a
 * teaching panel that always answers the same six questions in the same order.
 *
 * Every number on the page is derived from `state` through the engine. Nothing
 * is duplicated, so the diagram, the readouts and the explanation cannot
 * disagree with one another.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
import {
  ChipRow,
  ControlGroup,
  Segmented,
  Slider,
  StageFlash,
  useFlash,
} from '../components/Controls'
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
import { WaveChamber, type WavePhase } from '../scenes/WaveChamber'
import {
  depthFromTimeMm,
  dutyFactor,
  intensity,
  medium,
  periodUs,
  pulseDurationUs,
  pulseRepetitionPeriodUs,
  spatialPulseLengthMm,
  timeFromDepthUs,
  wavelengthMm,
  type MediumId,
} from '../engine'

type State = {
  frequencyMHz: number
  amplitude: number
  mediumId: MediumId
  cycles: number
  prfHz: number
  beamAreaCm2: number
  powerMw: number
}

const DEFAULTS: State = {
  frequencyMHz: 5,
  amplitude: 0.6,
  mediumId: 'softTissue',
  cycles: 3,
  prfHz: 4000,
  beamAreaCm2: 0.4,
  powerMw: 40,
}

const MEDIA_CHOICES: { value: MediumId; label: string; colour: string }[] = [
  { value: 'fat', label: 'Fat', colour: '#f0c674' },
  { value: 'softTissue', label: 'Soft tissue', colour: '#cbd5e1' },
  { value: 'muscle', label: 'Muscle', colour: '#e08585' },
  { value: 'blood', label: 'Blood', colour: '#ef5350' },
  { value: 'bone', label: 'Bone', colour: '#f5f5f5' },
  { value: 'air', label: 'Air', colour: '#8ea3b8' },
]

const STEPS: GuidedStep<State>[] = [
  {
    id: 'medium',
    title: 'A medium at rest',
    phase: 'medium',
    state: { mediumId: 'softTissue', amplitude: 0.6, frequencyMHz: 5 },
    caption: (
      <>
        Before anything is transmitted, the particles of the tissue sit at their rest positions.
        Ultrasound is <b>mechanical energy</b>, so it needs these particles: it cannot cross a
        vacuum, and it is not electromagnetic radiation. How fast the disturbance passes between
        them is <b>c = √(k/ρ)</b> — which is why sound is <b>slowest in air</b> (~330 m/s): air is
        highly compressible, so its stiffness <b>k</b> is tiny.
      </>
    ),
    detail: 'Nothing here is ionising. Everything that follows is the transport of a pressure disturbance through matter.',
  },
  {
    id: 'oscillate',
    title: 'Particles oscillate — they do not travel',
    phase: 'oscillate',
    duration: 1.8,
    caption: (
      <>
        Watch the <b style={{ color: 'var(--us-amber)' }}>amber particle</b>. It moves back and
        forth about a fixed point, <b>parallel to the direction the wave will travel</b>. That is
        what makes this a <b>longitudinal</b> wave. Energy moves through the tissue; the tissue
        itself stays put.
      </>
    ),
  },
  {
    id: 'travel',
    title: 'Compression and rarefaction travel outward',
    phase: 'travel',
    duration: 1.6,
    caption: (
      <>
        Where particles crowd together the local pressure rises — <b>compression</b>. Where they
        separate it falls — <b>rarefaction</b>. These bands sweep through the tissue at a speed set
        entirely by the <b>medium</b>.
      </>
    ),
  },
  {
    id: 'wavelength',
    title: 'Wavelength: c = f λ',
    phase: 'wavelength',
    state: { frequencyMHz: 5, mediumId: 'softTissue' },
    caption: (state) => (
      <>
        One wavelength is the distance between two successive compressions. At{' '}
        <b>{state.frequencyMHz} MHz</b> in {medium(state.mediumId).lower}, λ ={' '}
        <b>{wavelengthMm(medium(state.mediumId).speed, state.frequencyMHz).toFixed(2)} mm</b>.
        Raise the frequency and λ shortens — but the <b>speed does not change</b>.
      </>
    ),
  },
  {
    id: 'amplitude',
    title: 'Amplitude is a separate quantity',
    phase: 'amplitude',
    duration: 1.2,
    caption: (
      <>
        Amplitude is how far the pressure swings from baseline. It sets the <b>intensity</b> —
        which matters for safety — but it changes <b>neither the wavelength nor the speed</b>.
        Frequency and amplitude are independent.
      </>
    ),
  },
  {
    id: 'pulse',
    title: 'Imaging uses short pulses, not a continuous wave',
    phase: 'pulse',
    state: { cycles: 3, prfHz: 4000 },
    duration: 1.6,
    caption: (state) => (
      <>
        The probe emits a burst of <b>{state.cycles} cycles</b>, then listens. Spatial pulse length
        is cycles × λ ={' '}
        <b>
          {spatialPulseLengthMm(
            state.cycles,
            wavelengthMm(medium(state.mediumId).speed, state.frequencyMHz),
          ).toFixed(2)}{' '}
          mm
        </b>
        . The interval between bursts is the pulse repetition period, PRP = 1/PRF.
      </>
    ),
  },
  {
    id: 'duty',
    title: 'The probe listens for over 99% of the time',
    phase: 'pulse',
    caption: (state) => {
      const pd = pulseDurationUs(state.cycles, state.frequencyMHz)
      const prp = pulseRepetitionPeriodUs(state.prfHz)
      return (
        <>
          Duty factor = pulse duration ÷ PRP ={' '}
          <b>{(dutyFactor(pd, prp) * 100).toFixed(2)}%</b>. Almost all of the time the transducer is
          receiving, not transmitting — which is why <b>average intensity is far below peak
          intensity</b>.
        </>
      )
    },
  },
  {
    id: 'ranging',
    title: 'Depth comes from the round trip: depth = c t / 2',
    phase: 'free',
    caption: (state) => {
      const m = medium(state.mediumId)
      return (
        <>
          The machine times the echo. That time covers the journey <b>out and back</b>, so it halves
          it. At 1540 m/s that is about <b>13 µs per centimetre</b> of depth — the number worth
          carrying into the exam. In {m.lower} the true speed is <b>{m.speed} m/s</b>, and the
          machine still assumes 1540.
        </>
      )
    },
  },
]

export default function FundamentalsPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  // While a guided step is being taught the learner sees one idea, stated large.
  // "Show the numbers" reveals the readouts and analysis without leaving the
  // walkthrough; the manual laboratory restores the whole instrument.
  const [detail, setDetail] = useState(false)
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)

  const m = medium(state.mediumId)
  const derived = useMemo(() => {
    const lambda = wavelengthMm(m.speed, state.frequencyMHz)
    const pd = pulseDurationUs(state.cycles, state.frequencyMHz)
    const prp = pulseRepetitionPeriodUs(state.prfHz)
    return {
      lambda,
      period: periodUs(state.frequencyMHz),
      spl: spatialPulseLengthMm(state.cycles, lambda),
      axial: spatialPulseLengthMm(state.cycles, lambda) / 2,
      pd,
      prp,
      duty: dutyFactor(pd, prp),
      intensity: intensity(state.powerMw / 1000, state.beamAreaCm2),
      timeFor5cm: timeFromDepthUs(50, m.speed),
      depthFor65us: depthFromTimeMm(65) / 10,
    }
  }, [m, state])

  /* --- controls announce their consequence immediately ------------------- */

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Wavelength shortens' : 'Wavelength lengthens', dir: up ? 'down' : 'up' },
      { text: up ? 'Axial resolution improves' : 'Axial resolution worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Attenuation rises, penetration falls' : 'Attenuation falls, penetration rises', dir: up ? 'warn' : 'up' },
      { text: 'Speed of sound unchanged', dir: 'flat' },
    ])
  }

  const onAmplitude = (value: number) => {
    const up = value > state.amplitude
    patch({ amplitude: value })
    flash.fire([
      { text: up ? 'Amplitude increased' : 'Amplitude decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Intensity rises' : 'Intensity falls', dir: up ? 'warn' : 'down' },
      { text: 'Wavelength unchanged', dir: 'flat' },
      { text: 'Speed unchanged', dir: 'flat' },
    ])
  }

  const onMedium = (value: MediumId) => {
    const next = medium(value)
    const faster = next.speed > m.speed
    patch({ mediumId: value })
    flash.fire([
      { text: `Medium: ${next.name}`, dir: 'flat' },
      { text: faster ? 'Propagation speed rises' : 'Propagation speed falls', dir: faster ? 'up' : 'down' },
      { text: faster ? 'Wavelength lengthens' : 'Wavelength shortens', dir: faster ? 'up' : 'down' },
      { text: 'Transmitted frequency unchanged', dir: 'flat' },
    ])
  }

  const onCycles = (value: number) => {
    const up = value > state.cycles
    patch({ cycles: value })
    flash.fire([
      { text: up ? 'More cycles per pulse' : 'Fewer cycles per pulse', dir: up ? 'up' : 'down' },
      { text: up ? 'Spatial pulse length rises' : 'Spatial pulse length falls', dir: up ? 'up' : 'down' },
      { text: up ? 'Axial resolution worsens' : 'Axial resolution improves', dir: up ? 'down' : 'up' },
      { text: up ? 'Bandwidth narrows' : 'Bandwidth broadens', dir: up ? 'down' : 'up' },
    ])
  }

  const onPrf = (value: number) => {
    const up = value > state.prfHz
    patch({ prfHz: value })
    flash.fire([
      { text: up ? 'PRF increased' : 'PRF decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'PRP shortens' : 'PRP lengthens', dir: up ? 'down' : 'up' },
      { text: up ? 'Duty factor rises' : 'Duty factor falls', dir: up ? 'up' : 'down' },
      { text: up ? 'Max unambiguous depth falls' : 'Max unambiguous depth rises', dir: up ? 'warn' : 'up' },
    ])
  }

  const onArea = (value: number) => {
    const up = value > state.beamAreaCm2
    patch({ beamAreaCm2: value })
    flash.fire([
      { text: up ? 'Beam area increased' : 'Beam area reduced', dir: up ? 'up' : 'down' },
      { text: up ? 'Intensity falls' : 'Intensity rises', dir: up ? 'down' : 'warn' },
      { text: 'Total power unchanged', dir: 'flat' },
    ])
  }

  /* --- teaching panel content ------------------------------------------- */

  const deltas: Delta[] = [
    { label: `λ = ${derived.lambda.toFixed(2)} mm`, dir: 'flat' },
    { label: 'f ↑ → λ ↓', dir: 'down' },
    { label: 'f ↑ → axial resolution ↑', dir: 'up' },
    { label: 'f ↑ → attenuation ↑', dir: 'up' },
    { label: 'f ↑ → penetration ↓', dir: 'down' },
    { label: 'f ↑ → speed unchanged', dir: 'flat' },
  ]

  const scene: BModeScene = useMemo(
    () => ({
      widthCm: 4,
      depthCm: 6,
      background: 0.32,
      backgroundAttenuation: m.attenuation,
      targets: [
        { x: -0.4, depthCm: 1.6, radiusCm: 0.045, echogenicity: 0.95, scatter: 0.2 },
        { x: -0.4, depthCm: 1.6 + Math.max(0.04, derived.axial / 10), radiusCm: 0.045, echogenicity: 0.95, scatter: 0.2 },
        { x: 0.45, depthCm: 3.6, radiusCm: 0.5, echogenicity: 0.02, attenuation: 0.02, scatter: 0.1 },
      ],
    }),
    [m.attenuation, derived.axial],
  )

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 34,
      dynamicRangeDb: 55,
      focusCm: [2.5],
      apertureMm: 12,
      cycles: state.cycles,
      power: state.amplitude,
    }),
    [state.frequencyMHz, state.cycles, state.amplitude],
  )

  return (
    <UsLab
      path="/ultrasound-lab"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Wave chamber">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="wave" size={14} />
                <b>Stage</b> Longitudinal wave chamber
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Compression
                </span>
                <span>
                  <i style={{ background: 'var(--us-violet)' }} /> Rarefaction
                </span>
                <span>
                  <i className="is-dot" style={{ background: 'var(--us-amber)' }} /> Tracked particle
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                {/* The manual laboratory always draws the free stage. Left on the
                    guided step's phase, entering it from step 1 held the chamber
                    in 'medium', whose particle displacement is zero by design —
                    so the frequency and amplitude sliders drove a wave that was
                    not being drawn. */}
                <WaveChamber
                  medium={m}
                  frequencyMHz={state.frequencyMHz}
                  amplitude={state.amplitude}
                  cycles={state.cycles}
                  prfHz={state.prfHz}
                  time={clock}
                  phase={api.mode === 'manual' ? 'free' : (api.phase as WavePhase)}
                />
              </div>
              <div
                className="us-canvas-wrap"
                style={{ flex: '0 0 168px', maxWidth: 168, minWidth: 120 }}
              >
                <BMode scene={scene} settings={settings} label={`${state.frequencyMHz} MHz`} />
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
              <b>Enter manual lab</b> to drive every control yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Wavelength λ', value: derived.lambda.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'Period T', value: derived.period.toFixed(3), unit: 'µs' },
                { label: 'Speed c', value: m.speed, unit: 'm/s', tone: 'green' },
                { label: 'Pulse length', value: derived.spl.toFixed(2), unit: 'mm' },
                { label: 'Axial res.', value: derived.axial.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'Duty factor', value: (derived.duty * 100).toFixed(2), unit: '%' },
                { label: 'Intensity', value: derived.intensity.toFixed(2), unit: 'W/cm²', tone: 'amber' },
                { label: 'PRP', value: derived.prp.toFixed(0), unit: 'µs' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Wave parameters" icon="wave" defaultOpen>
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={1}
              max={15}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Sets the wavelength through λ = c/f. It does not change the speed of sound."
              markers={[
                { value: 3, label: '3 (abdo)' },
                { value: 7.5, label: '7.5 (vascular)' },
                { value: 12, label: '12 (superficial)' },
              ]}
            />
            <Slider
              label="Pressure amplitude"
              unit="%"
              value={Math.round(state.amplitude * 100)}
              min={15}
              max={100}
              step={5}
              onChange={(v) => onAmplitude(v / 100)}
              hint="Changes intensity — and therefore safety indices. It leaves wavelength and speed untouched."
            />
            <ChipRow label="Medium" value={state.mediumId} options={MEDIA_CHOICES} onChange={onMedium} />
            <p className="us-slider-hint">
              <strong>{m.name}</strong> — {m.speed} m/s. {m.note}
            </p>
          </ControlGroup>

          <ControlGroup title="Pulse parameters" icon="pulse" defaultOpen={api.index >= 5}>
            <Slider
              label="Cycles per pulse"
              value={state.cycles}
              min={1}
              max={10}
              step={1}
              onChange={onCycles}
              hint="Damping removes cycles. Fewer cycles means a shorter pulse and better axial resolution."
            />
            <Slider
              label="Pulse repetition frequency"
              unit="Hz"
              value={state.prfHz}
              min={500}
              max={12000}
              step={250}
              onChange={onPrf}
              hint="How often a pulse is sent. PRP = 1/PRF, and depth caps how high PRF may go."
            />
            <Readout
              items={[
                { label: 'Pulse duration', value: derived.pd.toFixed(3), unit: 'µs' },
                { label: 'Max depth at this PRF', value: (depthFromTimeMm(derived.prp) / 10).toFixed(1), unit: 'cm' },
              ]}
            />
          </ControlGroup>

          <ControlGroup title="Power and intensity" icon="target">
            <Slider
              label="Acoustic power"
              unit="mW"
              value={state.powerMw}
              min={5}
              max={200}
              step={5}
              onChange={(v) => {
                const up = v > state.powerMw
                patch({ powerMw: v })
                flash.fire([
                  { text: up ? 'Power increased' : 'Power decreased', dir: up ? 'warn' : 'down' },
                  { text: up ? 'Intensity rises' : 'Intensity falls', dir: up ? 'warn' : 'down' },
                  { text: up ? 'Patient exposure rises' : 'Patient exposure falls', dir: up ? 'warn' : 'up' },
                ])
              }}
            />
            <Slider
              label="Beam cross-sectional area"
              unit="cm²"
              value={state.beamAreaCm2}
              min={0.05}
              max={2}
              step={0.05}
              decimals={2}
              onChange={onArea}
              hint="Focusing does not create energy — it concentrates it. I = P/A."
            />
          </ControlGroup>

          <ControlGroup title="Display" icon="sliders">
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
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="You switch from soft tissue to fat while keeping the probe at 5 MHz. What happens to the wavelength?"
              options={['It shortens', 'It lengthens', 'It is unchanged']}
              correct={0}
              explanation={
                <>
                  Fat is <b>slower</b> (1450 m/s vs 1540). With λ = c/f and f fixed by the probe, a
                  lower speed means a <b>shorter</b> wavelength. The transmitted frequency does not
                  change — the medium cannot alter it.
                </>
              }
            />
          </div>

          <div className="us-panel">
            <h3>
              <UsIcon name="equation" size={13} />
              Ranging arithmetic
            </h3>
            <Readout
              items={[
                { label: 'Echo time from 5 cm', value: derived.timeFor5cm.toFixed(0), unit: 'µs' },
                { label: 'Depth for a 65 µs echo', value: derived.depthFor65us.toFixed(1), unit: 'cm' },
              ]}
            />
            <p className="us-slider-hint">
              The 65 µs figure uses the machine’s assumed 1540 m/s, not the {m.speed} m/s of the
              selected medium — which is exactly how speed-displacement artefact arises.
            </p>
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
                A {state.frequencyMHz} MHz longitudinal wave is travelling through {m.lower} at{' '}
                <b>{m.speed} m/s</b>, giving a wavelength of <b>{derived.lambda.toFixed(2)} mm</b>{' '}
                and a {state.cycles}-cycle pulse <b>{derived.spl.toFixed(2)} mm</b> long.
              </>
            }
            why={
              <>
                Speed is fixed by the stiffness and density of the medium, so when you change the
                frequency the only thing that can give is the wavelength. Shortening the pulse is
                what improves detail along the beam — and it is also what makes the beam attenuate
                faster.
              </>
            }
            equation={
              showEquation
                ? `c = √(k / ρ)     stiffness over density — the medium alone sets c
c = f λ          λ = c / f = ${m.speed} / ${state.frequencyMHz} MHz = ${derived.lambda.toFixed(2)} mm
T = 1 / f        = ${derived.period.toFixed(3)} µs
SPL = n × λ      = ${state.cycles} × ${derived.lambda.toFixed(2)} = ${derived.spl.toFixed(2)} mm
Duty = PD / PRP  = ${derived.pd.toFixed(3)} / ${derived.prp.toFixed(0)} = ${(derived.duty * 100).toFixed(2)} %
I = P / A        = ${state.powerMw} mW / ${state.beamAreaCm2} cm² = ${derived.intensity.toFixed(2)} W/cm²
depth = c t / 2  ≈ 13 µs per cm`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                This is the whole probe-selection decision in miniature: a higher frequency gives
                finer detail and less penetration. Choose the <b>highest frequency that still
                reaches the target</b>.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “The velocity of ultrasound is dependent on frequency” is <b>FALSE</b> — and it is
                  the most repeated ultrasound trap in the recall bank (and it also appears in the
                  collection). Speed belongs to the medium.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the quantities, and what changes what">
            <p>
              <strong>Frequency</strong> is set by the transducer. <strong>Speed</strong> is set by
              the medium. <strong>Wavelength</strong> is the one that has to accommodate both, which
              is why λ = c/f is the equation everything else hangs off.
            </p>
            <p>
              <strong>Amplitude</strong> and <strong>intensity</strong> live on a separate axis
              entirely. They matter for safety and for how far a detectable echo can come from — but
              they do not change the geometry of the wave.
            </p>
            <p>
              <strong>Pulse quantities</strong> follow from the number of cycles: pulse duration is
              cycles × period, spatial pulse length is cycles × wavelength, and axial resolution is
              half the spatial pulse length. Damping is the control that removes cycles, and the{' '}
              <Link to="/ultrasound-lab/transducer">Transducer Laboratory</Link> follows that chain
              through to bandwidth and sensitivity.
            </p>
            <p>
              <strong>The division by two</strong> in depth = ct/2 is not a fudge factor. The
              measured time is the round trip: out to the reflector and back to the probe. Forgetting
              it doubles every depth on the image.
            </p>

            <TrapNote>
              A second, quieter trap in the same area: changing the <em>medium</em> changes the speed
              and therefore the wavelength, but it never changes the <em>transmitted frequency</em>.
              The probe decides that, and the tissue has no say.
            </TrapNote>

            <SourceNote>
              QBank Q238 — high-yield recall — marks “speed of sound is inversely proportional to
              compressibility” <b>FALSE</b>: the relationship is c = 1/√(κρ), a square root, and
              compressibility and density are independent properties. The same question also
              confirms that speed is higher in bone than soft tissue — bone is fast <em>and</em>{' '}
              highly attenuating, which are two separate facts.
            </SourceNote>
          </MoreDetail>

          <ModelNote />
        </>
      }
    />
  )
}
