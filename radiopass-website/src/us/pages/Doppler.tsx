/**
 * Module 11 — the Doppler Laboratory.
 *
 * The flagship Doppler experiment: geometry first (a vessel, a beam, an
 * angle), then the shift, then the cosine that governs it, then direction,
 * spectral analysis and the three display modes. Every number on the page is
 * one call into `engine/acoustics.ts` — the spectral trace, the colour box and
 * the readouts cannot disagree because they share the same Δf.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import {
  ChipRow,
  ControlGroup,
  Slider,
  StageFlash,
  Toggle,
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
import { DopplerStage, type DopplerMode, type DopplerPhase } from '../scenes/DopplerStage'
import { ASSUMED_SPEED, dopplerShiftHz, velocityFromShiftMs } from '../engine'

type State = {
  velocityMs: number
  frequencyMHz: number
  angleDeg: number
  towards: boolean
  depthCm: number
  gateDepthCm: number
  sampleVolMm: number
  wallFilterHz: number
  baselineShift: number
  spectralGain: number
  mode: DopplerMode
}

const DEFAULTS: State = {
  velocityMs: 0.6,
  frequencyMHz: 5,
  angleDeg: 60,
  towards: true,
  depthCm: 4,
  gateDepthCm: 4,
  sampleVolMm: 3,
  wallFilterHz: 100,
  baselineShift: 0,
  spectralGain: 0.55,
  mode: 'pw',
}

const MODE_CHOICES: { value: DopplerMode; label: string }[] = [
  { value: 'pw', label: 'PW spectral' },
  { value: 'colour', label: 'Colour' },
  { value: 'power', label: 'Power' },
  { value: 'cw', label: 'CW' },
]

const STEPS: GuidedStep<State>[] = [
  {
    id: 'geometry',
    title: 'The geometry: a beam, a vessel, an angle',
    phase: 'geometry',
    state: { ...DEFAULTS },
    caption: (state) => (
      <>
        The probe fires down into the tissue and the vessel crosses the field at an incline. The
        angle between the <b>beam</b> and the <b>flow</b> — here <b>{state.angleDeg}°</b> — is the
        single geometric fact the whole measurement depends on. The dashed amber line is the{' '}
        <b>angle-correct cursor</b>, which you align along the true flow direction.
      </>
    ),
  },
  {
    id: 'shift',
    title: 'Moving blood shifts the received frequency',
    phase: 'shift',
    duration: 1.6,
    state: { towards: true, mode: 'pw' },
    caption: (state) => (
      <>
        The lower strip compares the <b style={{ color: 'var(--us-cyan)' }}>transmitted</b> and{' '}
        <b style={{ color: 'var(--us-amber)' }}>received</b> waveforms. The scatterers are moving,
        so the received frequency is shifted — by only{' '}
        <b>
          {Math.abs(
            dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg),
          ).toFixed(0)}{' '}
          Hz
        </b>{' '}
        against a carrier of millions, which is why the drawing exaggerates it. The shift happens{' '}
        <b>twice</b>: the cell receives a shifted wave, then re-radiates it.
      </>
    ),
  },
  {
    id: 'cosine',
    title: 'The shift follows cos θ — and dies at 90°',
    phase: 'cosine',
    duration: 1.8,
    state: { angleDeg: 60, mode: 'pw', towards: true },
    caption: (
      <>
        Watch the dial as the geometry sweeps from 0° to 90°. The shift follows the{' '}
        <b>cosine</b> of the angle, not the angle itself: maximal when the beam runs along the flow,
        halved at 60°, and <b>exactly ZERO at 90°</b> — a vessel crossed at right angles appears to
        contain no flow at all.
      </>
    ),
  },
  {
    id: 'direction',
    title: 'Reverse the flow and the sign flips',
    phase: 'direction',
    duration: 1.4,
    state: { towards: false, mode: 'colour' },
    caption: (
      <>
        Flow <b>towards</b> the probe raises the received frequency — a positive shift, spectrum
        above the baseline, red on the default map. Flow <b>away</b> lowers it: the spectrum drops{' '}
        <b>below the baseline</b> and the colour flips to blue. The sign of Δf carries the
        direction.
      </>
    ),
  },
  {
    id: 'spectral',
    title: 'The spectrum is a velocity histogram in time',
    phase: 'spectral',
    duration: 1.6,
    state: { mode: 'pw', towards: true, sampleVolMm: 10, spectralGain: 0.85 },
    caption: (
      <>
        A clean laminar trace keeps a clear <b>spectral window</b> under the systolic peak. Here the
        sample volume has been enlarged and the gain pushed too high, so the trace fills in —{' '}
        <b>spectral broadening</b>. Genuine turbulence broadens the spectrum too; so do these
        artefactual causes, which is the trap.
      </>
    ),
  },
  {
    id: 'colour',
    title: 'Colour is direction-relative, not anatomical',
    phase: 'colour',
    duration: 1.4,
    state: { mode: 'colour', towards: true },
    caption: (
      <>
        Every pixel in the box gets a hue from the <b>local mean shift</b>: red towards the probe,
        blue away, on the default map. <b>Red is not artery and blue is not vein</b> — tilt the
        probe or invert the map and the colours swap while the blood does nothing different.
      </>
    ),
  },
  {
    id: 'power',
    title: 'Power Doppler: sensitivity without direction',
    phase: 'power',
    duration: 1.6,
    state: { mode: 'power' },
    caption: (
      <>
        Power Doppler displays the <b>integrated power</b> of the Doppler signal, not the mean
        shift. One uniform orange, <b>no direction, no velocity</b> — but more sensitive to slow
        flow and nearly angle-independent. The price: it is prone to <b>flash artefact</b> whenever
        the tissue itself moves.
      </>
    ),
  },
  {
    id: 'cw-pw',
    title: 'Continuous wave against pulsed wave',
    phase: 'cw-pw',
    duration: 1.5,
    state: { mode: 'cw' },
    caption: (
      <>
        A <b>CW</b> pencil probe uses two elements — one transmitting continuously, one always
        listening. It samples continuously so it <b>cannot alias</b> and measures very high
        velocities, but it hears the <b>whole line</b> and cannot say what depth a signal came
        from. <b>PW</b> gates a sample volume at a chosen depth — range resolution, at the price of
        a sampling limit.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'The laboratory is yours',
    phase: 'free',
    state: { mode: 'pw' },
    caption: (
      <>
        Drive everything: sweep the angle and watch cos θ do the work, drag the gate out of the
        vessel and lose the signal, raise the wall filter until diastole disappears. The equation
        panel below recomputes with every move.
      </>
    ),
  },
]

export default function DopplerPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)

  const derived = useMemo(() => {
    const cos = Math.cos((state.angleDeg * Math.PI) / 180)
    const shift = dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg) *
      (state.towards ? 1 : -1)
    const vEst = velocityFromShiftMs(Math.abs(shift), state.frequencyMHz, state.angleDeg)
    return { cos, shift, vEst }
  }, [state.angleDeg, state.frequencyMHz, state.velocityMs, state.towards])

  /* --- controls announce their consequence immediately ------------------- */

  const onVelocity = (v: number) => {
    const up = v > state.velocityMs
    patch({ velocityMs: v })
    flash.fire([
      { text: up ? 'Flow velocity increased' : 'Flow velocity decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Doppler shift rises' : 'Doppler shift falls', dir: up ? 'up' : 'down' },
      { text: 'Transmitted frequency unchanged', dir: 'flat' },
    ])
  }

  const onFrequency = (v: number) => {
    const up = v > state.frequencyMHz
    patch({ frequencyMHz: v })
    flash.fire([
      { text: up ? 'Transmit frequency increased' : 'Transmit frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Shift rises for the same velocity' : 'Shift falls for the same velocity', dir: up ? 'up' : 'down' },
      { text: up ? 'Aliasing more likely at depth' : 'Aliasing less likely', dir: up ? 'warn' : 'up' },
      { text: 'Velocity itself unchanged', dir: 'flat' },
    ])
  }

  const onAngle = (v: number) => {
    const up = v > state.angleDeg
    const newCos = Math.cos((v * Math.PI) / 180)
    patch({ angleDeg: v })
    flash.fire([
      { text: `Angle ${v}° — cos θ = ${newCos.toFixed(2)}`, dir: 'flat' },
      { text: up ? 'cos θ falls, shift falls' : 'cos θ rises, shift rises', dir: up ? 'down' : 'up' },
      v > 60
        ? { text: 'Beyond 60° — velocity error grows steeply', dir: 'warn' }
        : { text: 'At or below the 60° working limit', dir: 'up' },
    ])
  }

  const onTowards = (v: boolean) => {
    patch({ towards: v })
    flash.fire([
      { text: v ? 'Flow now towards the probe' : 'Flow now away from the probe', dir: 'flat' },
      { text: v ? 'Received frequency rises — positive shift' : 'Received frequency falls — negative shift', dir: v ? 'up' : 'down' },
      { text: v ? 'Spectrum above baseline, red on default map' : 'Spectrum below baseline, blue on default map', dir: 'flat' },
    ])
  }

  const onDepth = (v: number) => {
    const up = v > state.depthCm
    patch({ depthCm: v })
    flash.fire([
      { text: up ? 'Vessel deeper' : 'Vessel shallower', dir: up ? 'down' : 'up' },
      { text: 'Reposition the sample volume to follow it', dir: 'warn' },
      { text: up ? 'Deeper vessel → lower usable PRF' : 'Shallower vessel → higher usable PRF', dir: up ? 'down' : 'up' },
    ])
  }

  const onGateDepth = (v: number) => {
    patch({ gateDepthCm: v })
    const inVessel = Math.abs(v - state.depthCm) <= 0.7 + state.sampleVolMm / 20
    flash.fire([
      { text: `Sample volume at ${v.toFixed(1)} cm`, dir: 'flat' },
      inVessel
        ? { text: 'Gate inside the vessel — signal present', dir: 'up' }
        : { text: 'Gate outside the vessel — no signal', dir: 'warn' },
    ])
  }

  const onSampleVol = (v: number) => {
    const up = v > state.sampleVolMm
    patch({ sampleVolMm: v })
    flash.fire([
      { text: up ? 'Sample volume enlarged' : 'Sample volume reduced', dir: up ? 'up' : 'down' },
      { text: up ? 'More velocities included → spectral broadening' : 'Cleaner spectrum, clearer window', dir: up ? 'warn' : 'up' },
    ])
  }

  const onWallFilter = (v: number) => {
    const up = v > state.wallFilterHz
    patch({ wallFilterHz: v })
    const diastolicShift = Math.abs(
      dopplerShiftHz(state.frequencyMHz, state.velocityMs * 0.28, state.angleDeg),
    )
    const items = [
      { text: up ? 'Wall filter raised' : 'Wall filter lowered', dir: up ? 'up' : 'down' } as const,
      { text: up ? 'Wall thump and clutter suppressed' : 'More low-frequency clutter admitted', dir: up ? 'up' : 'warn' } as const,
    ]
    flash.fire(
      v > diastolicShift
        ? [...items, { text: 'Too high — slow diastolic flow erased!', dir: 'warn' }]
        : [...items],
    )
  }

  const onBaseline = (v: number) => {
    patch({ baselineShift: v })
    flash.fire([
      { text: 'Baseline shifted', dir: 'flat' },
      { text: 'Display range re-allocated only', dir: 'flat' },
      { text: 'Nyquist limit unchanged', dir: 'flat' },
    ])
  }

  const onGain = (v: number) => {
    const up = v > state.spectralGain
    patch({ spectralGain: v })
    const items = [
      { text: up ? 'Spectral gain increased' : 'Spectral gain decreased', dir: up ? 'up' : 'down' } as const,
      { text: 'Patient exposure unchanged — receive side only', dir: 'flat' } as const,
    ]
    flash.fire(
      v > 0.75
        ? [...items, { text: 'Excessive gain — artefactual spectral broadening', dir: 'warn' }]
        : [...items],
    )
  }

  const onMode = (v: DopplerMode) => {
    patch({ mode: v })
    const messages: Record<DopplerMode, { text: string; dir: 'up' | 'down' | 'warn' | 'flat' }[]> = {
      pw: [
        { text: 'Pulsed-wave spectral Doppler', dir: 'flat' },
        { text: 'Range resolution from the gate', dir: 'up' },
        { text: 'Aliasing possible above PRF/2', dir: 'warn' },
      ],
      colour: [
        { text: 'Colour Doppler', dir: 'flat' },
        { text: 'Mean shift mapped to hue — direction shown', dir: 'up' },
        { text: 'Red/blue is the map, not artery/vein', dir: 'warn' },
      ],
      power: [
        { text: 'Power Doppler', dir: 'flat' },
        { text: 'More sensitive to slow flow', dir: 'up' },
        { text: 'No direction or velocity information', dir: 'warn' },
        { text: 'Prone to flash artefact', dir: 'warn' },
      ],
      cw: [
        { text: 'Continuous-wave Doppler', dir: 'flat' },
        { text: 'Cannot alias — any velocity', dir: 'up' },
        { text: 'No range resolution — whole line heard', dir: 'warn' },
      ],
    }
    flash.fire(messages[v])
  }

  /* --- teaching content --------------------------------------------------- */

  const deltas: Delta[] = [
    { label: 'f₀ ↑ → Δf ↑', dir: 'up' },
    { label: 'v ↑ → Δf ↑', dir: 'up' },
    { label: 'θ → 90° → Δf → 0', dir: 'down' },
    { label: 'Δf ∝ cos θ, NOT θ', dir: 'warn' },
    { label: 'flow towards → Δf positive', dir: 'up' },
    { label: 'power Doppler → no direction', dir: 'flat' },
  ]

  const shiftKHz = derived.shift / 1000

  return (
    <UsLab
      path="/ultrasound-lab/doppler"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Doppler laboratory stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="flow" size={14} />
                <b>Stage</b> Doppler laboratory
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: '#ff5d55' }} /> Towards
                </span>
                <span>
                  <i style={{ background: '#4f9dff' }} /> Away
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Angle cursor
                </span>
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Beam / spectrum
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <DopplerStage
                  velocityMs={state.velocityMs}
                  frequencyMHz={state.frequencyMHz}
                  angleDeg={state.angleDeg}
                  towards={state.towards}
                  depthCm={state.depthCm}
                  gateDepthCm={state.gateDepthCm}
                  sampleVolMm={state.sampleVolMm}
                  wallFilterHz={state.wallFilterHz}
                  baselineShift={state.baselineShift}
                  spectralGain={state.spectralGain}
                  mode={state.mode}
                  time={clock}
                  phase={api.phase as DopplerPhase}
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
              <b>Enter manual lab</b> to drive the angle, gate and modes yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                {
                  label: 'Doppler shift Δf',
                  value: Math.abs(shiftKHz) < 0.001 ? '0.000' : shiftKHz.toFixed(3),
                  unit: 'kHz',
                  tone: 'cyan',
                },
                {
                  label: 'Estimated velocity',
                  value: Number.isFinite(derived.vEst) ? derived.vEst.toFixed(2) : '—',
                  unit: 'm/s',
                  tone: 'green',
                },
                { label: 'cos θ', value: derived.cos.toFixed(3), tone: 'amber' },
                { label: 'Beam–flow angle', value: state.angleDeg, unit: '°' },
                { label: 'Sample volume', value: state.sampleVolMm.toFixed(0), unit: 'mm' },
                { label: 'Wall filter', value: state.wallFilterHz, unit: 'Hz' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Flow and geometry" icon="flow" defaultOpen>
            <Slider
              label="Flow velocity"
              unit="m/s"
              value={state.velocityMs}
              min={0}
              max={2}
              step={0.05}
              decimals={2}
              onChange={onVelocity}
              hint="Peak velocity of the blood. The shift is directly proportional to it."
            />
            <Slider
              label="Beam–flow angle θ"
              unit="°"
              value={state.angleDeg}
              min={0}
              max={90}
              step={1}
              onChange={onAngle}
              hint="The shift follows cos θ. Keep quantitative measurements at or below 60°."
              markers={[
                { value: 0, label: '0° (max)' },
                { value: 60, label: '60° (limit)' },
                { value: 90, label: '90° (zero)' },
              ]}
            />
            <Toggle
              label="Flow towards the probe"
              checked={state.towards}
              onChange={onTowards}
              hint="Towards raises the received frequency; away lowers it. The sign carries the direction."
            />
            <Slider
              label="Vessel depth"
              unit="cm"
              value={state.depthCm}
              min={1}
              max={9}
              step={0.5}
              decimals={1}
              onChange={onDepth}
            />
          </ControlGroup>

          <ControlGroup title="Doppler settings" icon="sliders" defaultOpen>
            <ChipRow label="Mode" value={state.mode} options={MODE_CHOICES} onChange={onMode} />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={2}
              max={10}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Doppler does not need a higher frequency than B-mode — a lower one is often chosen to keep the shift below the sampling limit."
            />
            <Slider
              label="Sample volume depth"
              unit="cm"
              value={state.gateDepthCm}
              min={1}
              max={9}
              step={0.5}
              decimals={1}
              onChange={onGateDepth}
              hint="PW only hears what lies inside the gate. Move it out of the vessel and the trace goes silent."
            />
            <Slider
              label="Sample volume size"
              unit="mm"
              value={state.sampleVolMm}
              min={1}
              max={15}
              step={1}
              onChange={onSampleVol}
              hint="Too large a gate spans many velocities at once and broadens the spectrum artefactually."
            />
          </ControlGroup>

          <ControlGroup title="Spectral display" icon="pulse">
            <Slider
              label="Wall filter"
              unit="Hz"
              value={state.wallFilterHz}
              min={0}
              max={800}
              step={25}
              onChange={onWallFilter}
              hint="Removes the low-frequency band near the baseline (wall thump). Too high and genuine slow diastolic flow is erased."
            />
            <Slider
              label="Baseline shift"
              value={state.baselineShift}
              min={-0.6}
              max={0.6}
              step={0.05}
              decimals={2}
              onChange={onBaseline}
              hint="Re-allocates the display range between forward and reverse flow. It does not change any physical limit."
            />
            <Slider
              label="Spectral gain"
              unit="%"
              value={Math.round(state.spectralGain * 100)}
              min={10}
              max={100}
              step={5}
              onChange={(v) => onGain(v / 100)}
              hint="Receive-side amplification. Excess gain fills the spectral window and mimics broadening."
            />
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="The beam is exactly perpendicular to brisk flow in a large vessel. The colour box shows…?"
              options={['No signal in the vessel', 'Maximum-brightness red', 'Uniform orange fill']}
              correct={0}
              explanation={
                <>
                  cos 90° = 0, so the Doppler shift is <b>zero</b> however fast the blood moves. The
                  vessel appears empty — a geometry problem, not an occlusion. Heel–toe the probe to
                  restore an angle and the colour returns.
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
                Blood at <b>{state.velocityMs.toFixed(2)} m/s</b> insonated at{' '}
                <b>{state.frequencyMHz} MHz</b> and <b>{state.angleDeg}°</b> returns a shift of{' '}
                <b>{shiftKHz.toFixed(3)} kHz</b> — {state.towards ? 'positive' : 'negative'},
                because the flow is {state.towards ? 'towards' : 'away from'} the probe.
              </>
            }
            why={
              <>
                Only the component of motion <b>along the beam</b> compresses or stretches the
                returning wavefronts, and that component is v cos θ. The factor of two exists
                because the moving cell first receives a shifted wave and then re-radiates it — the
                shift is applied twice.
              </>
            }
            equation={
              showEquation
                ? `Δf = 2 f₀ v cos θ / c
   = 2 × ${state.frequencyMHz.toFixed(1)} MHz × ${state.velocityMs.toFixed(2)} m/s × cos ${state.angleDeg}° / ${ASSUMED_SPEED}
   = ${(dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg) / 1000).toFixed(3)} kHz

v  = Δf c / (2 f₀ cos θ) = ${
                    Number.isFinite(derived.vEst) ? `${derived.vEst.toFixed(2)} m/s` : 'undefined at 90° (division by cos 90° = 0)'
                  }`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Align the <b>angle-correct cursor</b> with the true flow direction and keep θ at or
                below <b>60°</b>: the machine divides by cos θ, so a small angle error near 90°
                becomes an enormous velocity error. <b>Duplex</b> means real-time B-mode plus
                Doppler; <b>triplex</b> adds colour on top at a further frame-rate cost.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “The Doppler shift is directly proportional to the <b>angle</b>” is <b>FALSE</b> —
                  it follows the <b>cosine</b> of the angle, and this is among the most repeated
                  statements in the recall collection. Also FALSE: “the effect is greatest at right
                  angles” — it is greatest when the beam is <b>parallel</b> to flow.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — what feeds the equation, and what does not">
            <p>
              <strong>Four inputs and no others.</strong> Transmitted frequency, velocity, cos θ and
              the speed of sound. Beam intensity, PRF, vessel diameter, reflector size, tissue
              density and compressibility are all irrelevant to the size of the shift — each appears
              as a false stem in the question bank.
            </p>
            <p>
              <strong>The shift is audible.</strong> A few MHz carrier shifted by a fraction of a
              kilohertz lands the difference frequency in the audible range, which is why machines
              can play the spectrum through a speaker.
            </p>
            <p>
              <strong>Doppler does not need a higher frequency than B-mode.</strong> The same probe
              frequencies serve both; in practice a <em>lower</em> frequency is often selected for
              Doppler because it keeps the shift smaller and postpones aliasing — that story
              continues in the <Link to="/ultrasound-lab/aliasing">PRF &amp; Aliasing laboratory</Link>.
            </p>
            <p>
              <strong>Spectral broadening</strong> means many velocities inside one sample volume. A
              stenotic jet does it genuinely; an oversized gate, a gate against the vessel wall, or
              excessive gain do it artefactually. Read the window before you read pathology.
            </p>

            <TrapNote>
              “The frequency of reflected waves <em>decreases</em> for objects moving towards the
              transducer” is <b>FALSE</b> — it increases. And “duplex = Doppler + M-mode” is{' '}
              <b>FALSE</b>: duplex is Doppler + <b>B-mode</b>. Both wordings recur in the recall
              collection.
            </TrapNote>

            <SourceNote>
              QBank Q34, Q66–Q70, Q211 and Q353 (all carrying high-yield recall flags) drill the
              Doppler equation and its cosine dependence. QBank Q422 marks “amplitude and direction
              of blood flow can be assessed using power Doppler” <b>FALSE</b> — amplitude yes,
              direction no — and QBank Q112 rejects “M-mode duplex”. This page reproduces those
              verdicts exactly.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The spectral trace uses a modelled arterial waveform and the colour box a parabolic
            velocity profile, so the display is illustrative — but every hue and every trace height
            is computed from the same Δf = 2f₀v cosθ/c the readouts show, with the animation slowed
            by a large constant factor. The transmitted/received comparison exaggerates the
            frequency difference visually; the labelled Δf value is the true one.
          </ModelNote>
        </>
      }
    />
  )
}
