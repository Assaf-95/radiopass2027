/**
 * Module 7 — Transducer Laboratory.
 *
 * A virtual probe the learner explodes into its layers and reassembles, then
 * drives through the piezoelectric effect in both directions, thickness
 * resonance, the λ/4 matching layer, the damping chain and array firing —
 * including the corrected electronic-focus fact: to focus, the OUTER elements
 * fire FIRST.
 *
 * Every number on the page comes from the engine, so the stage, the readouts
 * and the explanation cannot disagree.
 */

import { useCallback, useMemo, useState } from 'react'

import { ChipRow, ControlGroup, Segmented, Slider, StageFlash, useFlash } from '../components/Controls'
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
  PROBE_INFO,
  TransducerStage,
  type ArrayMode,
  type ProbeType,
  type TransducerPhase,
} from '../scenes/TransducerStage'
import {
  ASSUMED_SPEED,
  axialResolutionMm,
  cyclesFromDamping,
  fractionalBandwidth,
  impedanceOf,
  matchingLayerImpedance,
  qFactor,
  resonantFrequencyMHz,
  sensitivityFromDamping,
  transmissionCoefficient,
  wavelengthMm,
} from '../engine'

const CRYSTAL_SPEED = 4000

type State = {
  explode: number
  thicknessMm: number
  dampingPct: number
  arrayMode: ArrayMode
  focusDepthMm: number
  probeType: ProbeType
}

const DEFAULTS: State = {
  explode: 0,
  thicknessMm: 0.4,
  dampingPct: 85,
  arrayMode: 'focus',
  focusDepthMm: 45,
  probeType: 'linear',
}

const PROBE_CHOICES: { value: ProbeType; label: string }[] = [
  { value: 'single', label: 'Single element' },
  { value: 'linear', label: 'Linear' },
  { value: 'curvilinear', label: 'Curvilinear' },
  { value: 'phased', label: 'Phased' },
  { value: 'annular', label: 'Annular' },
  { value: 'matrix', label: 'Matrix' },
  { value: 'endocavitary', label: 'Endocavitary' },
  { value: 'cw', label: 'CW pencil' },
]

const STEPS: GuidedStep<State>[] = [
  {
    id: 'assembled',
    title: 'The probe, assembled',
    phase: 'assembled',
    state: { explode: 0, probeType: 'linear' },
    caption: (
      <>
        Everything a transducer does happens in this sandwich of layers behind the face. Before
        taking it apart, notice how thin the working parts are: the <b>element itself is well under
        a millimetre thick</b>, and that thickness is a design decision, not an accident.
      </>
    ),
  },
  {
    id: 'exploded',
    title: 'Explode it — nine parts, nine jobs',
    phase: 'exploded',
    state: { explode: 1 },
    duration: 1.6,
    caption: (
      <>
        From the cable down: <b>housing</b>, <b>backing block</b>, an <b>electrode</b> either side
        of the <b>PZT elements</b>, the <b>matching layer</b>, the <b>acoustic lens</b>, the{' '}
        <b>protective face</b> and finally the <b>gel</b>. Each layer exists to fix one specific
        physics problem — the rest of this walkthrough visits them in turn.
      </>
    ),
  },
  {
    id: 'piezo-direct',
    title: 'The direct effect: pressure in, voltage out',
    phase: 'piezo-direct',
    state: { explode: 0 },
    duration: 1.8,
    caption: (
      <>
        A returning echo squeezes the crystal. The deformation separates charge, and a{' '}
        <b>voltage appears across the electrodes</b> — that trace is the raw material of the whole
        image. This is the <b>direct piezoelectric effect</b>: reception.
      </>
    ),
  },
  {
    id: 'piezo-inverse',
    hands: true,
    title: 'The inverse effect: voltage in, wave out',
    phase: 'piezo-inverse',
    duration: 1.8,
    caption: (
      <>
        Drive the electrodes with a voltage spike and the crystal <b>changes shape</b>, pushing a
        pressure wave into the tissue. This is the <b>inverse piezoelectric effect</b>:
        transmission. The same element does both jobs, which is why it must stop transmitting
        before it can listen.
      </>
    ),
  },
  {
    id: 'resonance',
    title: 'Thickness sets the frequency: t = λ/2',
    phase: 'resonance',
    state: { thicknessMm: 0.4 },
    caption: (state) => (
      <>
        The element rings most strongly when its thickness is <b>half a wavelength in the
        crystal</b>. At t = <b>{state.thicknessMm.toFixed(2)} mm</b> that means f₀ = c/2t ={' '}
        <b>{resonantFrequencyMHz(state.thicknessMm, CRYSTAL_SPEED).toFixed(1)} MHz</b>. Thicker
        element → lower frequency. The <b>diameter has nothing to do with it</b>.
      </>
    ),
  },
  {
    id: 'matching',
    title: 'The matching layer bridges a 20-fold impedance gap',
    phase: 'matching',
    duration: 1.6,
    caption: (
      <>
        PZT sits near <b>30 MRayl</b>; tissue near <b>1.6</b>. Unbridged, that boundary reflects
        most of the pulse straight back into the probe. A layer with the <b>geometric-mean
        impedance</b>, exactly <b>λ/4 thick</b>, lets the reflections cancel and the energy
        through — compare the two bars.
      </>
    ),
  },
  {
    id: 'damping',
    hands: true,
    title: 'Damping: one control, six consequences',
    phase: 'damping',
    state: { dampingPct: 85 },
    duration: 1.6,
    caption: (state) => {
      const cycles = cyclesFromDamping(state.dampingPct / 100)
      return (
        <>
          The backing block absorbs the ringing. At <b>{state.dampingPct}%</b> damping the pulse
          dies after <b>{cycles.toFixed(1)} cycles</b>, so the pulse is short, the{' '}
          <b>bandwidth wide</b>, the <b>Q low</b> and the <b>axial resolution good</b> — at the
          price of <b>sensitivity</b>. Drag the damping slider and watch the whole chain move.
        </>
      )
    },
  },
  {
    id: 'arrays-sequential',
    title: 'Arrays: fire small groups in sequence',
    phase: 'arrays',
    state: { arrayMode: 'sequential', probeType: 'linear', explode: 0 },
    duration: 1.8,
    caption: (
      <>
        A linear array builds its image one line at a time: a <b>small group of adjacent
        elements</b> fires together, the machine listens, then the group steps one element along.
        No delays are needed — the geometry of the row does the work.
      </>
    ),
  },
  {
    id: 'arrays-focus',
    title: 'Electronic focus: the OUTER elements fire first',
    phase: 'arrays',
    state: { arrayMode: 'focus' },
    duration: 1.8,
    caption: (state) => (
      <>
        To converge at <b>{state.focusDepthMm.toFixed(0)} mm</b>, every wavefront must arrive at
        the focus at the same instant. The outer elements are <b>further away</b>, so they must
        set off <b>earlier</b> — the delay profile is a curve with the <b>centre delayed most</b>.
        One source question states this backwards; the note below the stage corrects it.
      </>
    ),
  },
  {
    id: 'arrays-steer',
    title: 'Steering: a linear delay ramp tilts the beam',
    phase: 'arrays',
    state: { arrayMode: 'steer' },
    duration: 1.8,
    caption: (
      <>
        Replace the curved delay profile with a <b>straight ramp</b> across the array and the
        wavefront leaves at an angle — the whole beam <b>tilts without anything moving</b>. This
        is how a phased array sweeps a sector from a footprint small enough to fit between ribs.
      </>
    ),
  },
]

export default function TransducerPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  // In the manual laboratory the learner chooses which bench to stand at.
  const [manualView, setManualView] = useState<TransducerPhase>('free')
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    setManualView('free')
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)
  const scenePhase: TransducerPhase =
    api.mode === 'manual' ? manualView : (api.phase as TransducerPhase)

  const derived = useMemo(() => {
    const f0 = resonantFrequencyMHz(state.thicknessMm, CRYSTAL_SPEED)
    const damping = state.dampingPct / 100
    const cycles = cyclesFromDamping(damping)
    const lambdaTissue = wavelengthMm(ASSUMED_SPEED, f0)
    const zPzt = impedanceOf('pzt')
    const zTissue = impedanceOf('softTissue')
    return {
      f0,
      lambdaCrystal: 2 * state.thicknessMm,
      cycles,
      bandwidth: fractionalBandwidth(cycles),
      q: qFactor(cycles),
      lambdaTissue,
      axial: axialResolutionMm(cycles, lambdaTissue),
      sensitivity: sensitivityFromDamping(damping),
      zPzt,
      zTissue,
      zMatch: matchingLayerImpedance(zPzt, zTissue),
      tBare: transmissionCoefficient(zPzt, zTissue),
    }
  }, [state.thicknessMm, state.dampingPct])

  /* --- controls announce their consequence immediately ------------------- */

  const onExplode = (value: number) => {
    const up = value > state.explode
    patch({ explode: value })
    flash.fire([
      { text: up ? 'Layers separate' : 'Layers reassemble', dir: up ? 'up' : 'down' },
      { text: 'Each part labels its job', dir: 'flat' },
      { text: 'Physics unchanged — this is anatomy', dir: 'flat' },
    ])
  }

  const onThickness = (value: number) => {
    const up = value > state.thicknessMm
    patch({ thicknessMm: value })
    flash.fire([
      { text: up ? 'Element thicker' : 'Element thinner', dir: up ? 'up' : 'down' },
      { text: up ? 'Resonant frequency falls' : 'Resonant frequency rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Wavelength lengthens' : 'Wavelength shortens', dir: up ? 'up' : 'down' },
      { text: 'f₀ = c / 2t', dir: 'flat' },
    ])
  }

  const onDamping = (value: number) => {
    const up = value > state.dampingPct
    patch({ dampingPct: value })
    flash.fire([
      { text: up ? 'More damping' : 'Less damping', dir: up ? 'up' : 'down' },
      { text: up ? 'Fewer cycles, shorter pulse' : 'More cycles, longer pulse', dir: up ? 'down' : 'up' },
      { text: up ? 'Bandwidth widens, Q falls' : 'Bandwidth narrows, Q rises', dir: up ? 'up' : 'down' },
      { text: up ? 'Axial resolution improves' : 'Axial resolution worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Sensitivity falls' : 'Sensitivity rises', dir: up ? 'warn' : 'up' },
    ])
  }

  const onArrayMode = (value: ArrayMode) => {
    patch({ arrayMode: value })
    flash.fire(
      value === 'focus'
        ? [
            { text: 'Electronic focus', dir: 'flat' },
            { text: 'OUTER elements fire first', dir: 'up' },
            { text: 'Curved delay profile', dir: 'flat' },
          ]
        : value === 'steer'
          ? [
              { text: 'Beam steering', dir: 'flat' },
              { text: 'Linear delay ramp across the array', dir: 'flat' },
              { text: 'Wavefront tilts', dir: 'up' },
            ]
          : [
              { text: 'Sequential firing', dir: 'flat' },
              { text: 'Groups step along the array', dir: 'flat' },
              { text: 'One scan line per group', dir: 'flat' },
            ],
    )
  }

  const onFocusDepth = (value: number) => {
    const up = value > state.focusDepthMm
    patch({ focusDepthMm: value })
    flash.fire([
      { text: up ? 'Focus deeper' : 'Focus shallower', dir: up ? 'down' : 'up' },
      { text: 'Delay curve flattens with depth', dir: 'flat' },
      { text: 'Outer elements still fire first', dir: 'flat' },
    ])
  }

  const onProbeType = (value: ProbeType) => {
    const info = PROBE_INFO[value]
    patch({ probeType: value })
    flash.fire([
      { text: info.label, dir: 'flat' },
      { text: info.field, dir: 'flat' },
      { text: info.steer, dir: value === 'annular' || value === 'single' ? 'warn' : 'flat' },
    ])
  }

  /* --- teaching panel content ------------------------------------------- */

  const deltas: Delta[] = [
    { label: 'thickness ↑ → f₀ ↓', dir: 'down' },
    { label: 'damping ↑ → cycles ↓', dir: 'down' },
    { label: 'damping ↑ → bandwidth ↑, Q ↓', dir: 'up' },
    { label: 'damping ↑ → axial resolution ↑', dir: 'up' },
    { label: 'damping ↑ → sensitivity ↓', dir: 'warn' },
    { label: 'matching layer → transmission ↑', dir: 'up' },
  ]

  const probeInfo = PROBE_INFO[state.probeType]

  return (
    <UsLab
      path="/ultrasound-lab/transducer"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Transducer stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="probe" size={14} />
                <b>Stage</b> Virtual transducer
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-violet)' }} /> PZT
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Matching
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Delays
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <TransducerStage
                  explode={state.explode}
                  thicknessMm={state.thicknessMm}
                  dampingPct={state.dampingPct}
                  arrayMode={state.arrayMode}
                  focusDepthMm={state.focusDepthMm}
                  probeType={state.probeType}
                  time={clock}
                  phase={scenePhase}
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
              <b>Enter manual lab</b> to explode, re-tune and refire the probe yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Resonant f₀', value: derived.f0.toFixed(1), unit: 'MHz', tone: 'cyan' },
                { label: 'λ in crystal', value: derived.lambdaCrystal.toFixed(2), unit: 'mm' },
                { label: 'Element t', value: state.thicknessMm.toFixed(2), unit: 'mm' },
                { label: 'Cycles per pulse', value: derived.cycles.toFixed(1) },
                { label: 'Bandwidth', value: (derived.bandwidth * 100).toFixed(0), unit: '%', tone: 'green' },
                { label: 'Q factor', value: derived.q.toFixed(1) },
                { label: 'Axial resolution', value: derived.axial.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'Rel. sensitivity', value: (derived.sensitivity * 100).toFixed(0), unit: '%', tone: 'amber' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Anatomy" icon="layers" defaultOpen>
            <Slider
              label="Explode the probe"
              unit="%"
              value={Math.round(state.explode * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => onExplode(v / 100)}
              hint="Spreads the layers apart so each one can label its job. Reassemble before firing."
            />
            <ChipRow label="Probe construction" value={state.probeType} options={PROBE_CHOICES} onChange={onProbeType} />
            <p className="us-slider-hint">
              <strong>{probeInfo.label}</strong> — {probeInfo.field}. {probeInfo.steer}.{' '}
              {probeInfo.use}.
            </p>
          </ControlGroup>

          <ControlGroup title="The element" icon="probe" defaultOpen>
            <Slider
              label="Element thickness"
              unit="mm"
              value={state.thicknessMm}
              min={0.2}
              max={1}
              step={0.05}
              decimals={2}
              onChange={onThickness}
              hint={`t = λ/2 in the crystal, so f₀ = c/2t = ${derived.f0.toFixed(1)} MHz at this thickness.`}
              markers={[
                { value: 0.2, label: '0.2 (10 MHz)' },
                { value: 0.4, label: '0.4 (5 MHz)' },
                { value: 1, label: '1.0 (2 MHz)' },
              ]}
            />
            <Slider
              label="Backing damping"
              unit="%"
              value={state.dampingPct}
              min={0}
              max={100}
              step={5}
              onChange={onDamping}
              hint="Drives the whole chain: cycles → pulse length → bandwidth → Q → axial resolution → sensitivity."
            />
          </ControlGroup>

          <ControlGroup title="Array firing" icon="beam" defaultOpen={api.index >= 7}>
            <Segmented
              label="Firing mode"
              value={state.arrayMode}
              options={[
                { value: 'sequential', label: 'Sequential' },
                { value: 'focus', label: 'Focus' },
                { value: 'steer', label: 'Steer' },
              ]}
              onChange={onArrayMode}
            />
            <Slider
              label="Electronic focus depth"
              unit="mm"
              value={state.focusDepthMm}
              min={20}
              max={80}
              step={5}
              onChange={onFocusDepth}
              hint="The outer elements are furthest from the focus, so they fire first — always."
            />
          </ControlGroup>

          <ControlGroup title="Display" icon="sliders">
            {api.mode === 'manual' && (
              <Segmented
                label="Bench"
                value={manualView}
                options={[
                  { value: 'free', label: 'Probe' },
                  { value: 'resonance', label: 'Resonance' },
                  { value: 'matching', label: 'Matching' },
                  { value: 'damping', label: 'Damping' },
                  { value: 'arrays', label: 'Arrays' },
                ]}
                onChange={(v) => setManualView(v as TransducerPhase)}
              />
            )}
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
              question="You double the element thickness. What happens to the resonant frequency?"
              options={['It halves', 'It doubles', 'It is unchanged']}
              correct={0}
              explanation={
                <>
                  Resonance requires t = λ/2 in the crystal, so <b>f₀ = c/2t</b>. Double the
                  thickness and the frequency <b>halves</b> — and the emitted wavelength doubles.
                  The diameter plays no part; it sets the aperture, not the frequency.
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
                A <b>{state.thicknessMm.toFixed(2)} mm</b> element resonates at{' '}
                <b>{derived.f0.toFixed(1)} MHz</b>. With {state.dampingPct}% damping the pulse
                rings for <b>{derived.cycles.toFixed(1)} cycles</b>, giving a bandwidth of{' '}
                <b>{(derived.bandwidth * 100).toFixed(0)}%</b>, Q ={' '}
                <b>{derived.q.toFixed(1)}</b> and axial resolution{' '}
                <b>{derived.axial.toFixed(2)} mm</b>.
              </>
            }
            why={
              <>
                The element is a bell: its thickness fixes the note it rings at (t = λ/2), and the
                backing block decides how quickly the ringing dies. A short ring needs a wide band
                of frequencies, which is why a heavily damped imaging probe is broadband and a
                continuous-wave probe — no damping at all — is narrow band and high Q.
              </>
            }
            equation={
              showEquation
                ? `f₀ = c_crystal / 2t = ${CRYSTAL_SPEED} / (2 × ${state.thicknessMm.toFixed(2)} mm) = ${derived.f0.toFixed(1)} MHz
λ_crystal = 2t = ${derived.lambdaCrystal.toFixed(2)} mm
Z_match = √(Z_PZT × Z_tissue) = √(${derived.zPzt.toFixed(0)} × ${derived.zTissue.toFixed(2)}) = ${derived.zMatch.toFixed(2)} MRayl   (λ/4 thick)
without matching: T = ${(derived.tBare * 100).toFixed(0)} %
cycles (damping ${state.dampingPct}%) = ${derived.cycles.toFixed(1)}
bandwidth ≈ 1/n = ${(derived.bandwidth * 100).toFixed(0)} %        Q = f₀/Δf = ${derived.q.toFixed(1)}
axial res = n λ / 2 = ${derived.cycles.toFixed(1)} × ${derived.lambdaTissue.toFixed(2)} / 2 = ${derived.axial.toFixed(2)} mm`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                One probe, two personalities: <b>heavy damping</b> for imaging (short pulse, fine
                axial detail, weaker echoes) and <b>no damping</b> for continuous-wave Doppler
                (long ring, narrow band, maximum sensitivity). The backing block is the difference.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Focusing is achieved by triggering the <b>inner</b> elements before the outer
                  ones” — <b>FALSE</b>, though one QBank explanation states it. The outer elements
                  are further from the focus and must fire <b>first</b>. What the examiners want:
                  focusing is achieved by <b>timing delays between elements</b>.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the probe, layer by layer">
            <p>
              <strong>The piezoelectric effect runs both ways.</strong> The <em>inverse</em> effect
              turns a voltage into vibration — transmission. The <em>direct</em> effect turns a
              returning pressure wave into a voltage — reception. The same PZT element does both.
            </p>
            <p>
              <strong>Thickness, not diameter, sets the frequency.</strong> The element resonates
              when its thickness is half a wavelength in the crystal. A thicker element resonates
              lower and emits a longer wavelength. The diameter sets the <em>aperture</em> — beam
              shape and lateral resolution — a different job entirely.
            </p>
            <p>
              <strong>The matching layer and the gel solve different problems.</strong> The λ/4
              layer bridges the crystal–tissue impedance gap inside the probe; the gel displaces
              the air layer at the skin. A probe needs both.
            </p>
            <p>
              <strong>Damping is a chain, not a single fact.</strong> More backing absorption →
              fewer cycles → shorter pulse → wider bandwidth → lower Q → better axial resolution →
              less sensitivity. Examiners test every link, in both directions.
            </p>
            <p>
              <strong>Array types differ in how they aim the beam.</strong> A phased array steers
              and focuses electronically from a tiny footprint; an <em>annular</em> array focuses
              beautifully in both planes but cannot steer electronically at all — it must be swept
              mechanically. A matrix array adds electronic control in the elevation plane.
            </p>

            <TrapNote>
              “The transducer crystal resonates at a frequency determined by its <em>diameter</em>”
              is <b>FALSE</b> (QBank Q411, Q422). Thickness decides frequency; diameter decides
              aperture. And the half-wavelength rule is often mis-stated as a full wavelength —
              it is t = λ/2.
            </TrapNote>

            <SourceNote>
              QBank Q446 states that electronic focusing triggers the <em>inner</em> elements
              first — that is the wrong way round, and this laboratory deliberately does not
              reproduce it: the <b>outer</b> elements fire first, because their wavefronts have
              further to travel to the focus. Q422’s printed explanation also begins “for a given
              resonant frequency” while arguing that a thicker element emits a longer wavelength —
              the correct chain is thicker element → <b>lower</b> resonant frequency → longer
              wavelength.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Layer thicknesses are exaggerated so they can be seen — a real matching layer is a
            fraction of a millimetre — and the sixteen-element array fires thousands of times more
            slowly than a real one. The delay <em>pattern</em>, the damping chain and every number
            in the readouts follow the real physics.
          </ModelNote>
        </>
      }
    />
  )
}
