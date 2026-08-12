/**
 * Module 16 — Elastography.
 *
 * One phantom, two questions. STRAIN asks "how much did it deform?" and answers
 * relatively, qualitatively and operator-dependently. SHEAR WAVE asks "how fast
 * does a shear wave cross it?" and answers in metres per second, which E = 3ρc²
 * turns into kilopascals.
 *
 * Every number on the page comes from that one equation, so the sliders, the
 * colour map, the wavefront speed and the read-outs cannot disagree.
 */

import { useCallback, useMemo, useState } from 'react'

import { ControlGroup, Segmented, Slider, StageFlash, useFlash } from '../components/Controls'
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
import { ElastoStage, type ElastoMode, type ElastoPhase } from '../scenes/ElastoStage'
import { ASSUMED_SPEED } from '../engine/media'

/** Tissue density used by the Young's modulus relation, kg/m³. */
const RHO = 1050

/** Shear-wave speed in m/s from Young's modulus in kPa: E ≈ 3 ρ c², so c = √(E/3ρ). */
function shearSpeedMs(kPa: number): number {
  return Math.sqrt((kPa * 1000) / (3 * RHO))
}

/** Young's modulus in kPa from a shear-wave speed in m/s. */
function youngsModulusKpa(speedMs: number): number {
  return (3 * RHO * speedMs * speedMs) / 1000
}

type State = {
  mode: ElastoMode
  compression: number
  precompression: number
  softKpa: number
  stiffKpa: number
  pushDepthCm: number
}

const DEFAULTS: State = {
  mode: 'strain',
  compression: 0,
  precompression: 0,
  softKpa: 6,
  stiffKpa: 60,
  pushDepthCm: 4,
}

const BACKGROUND_KPA = 18

const STEPS: GuidedStep<State>[] = [
  {
    id: 'phantom',
    title: 'One phantom, two lesions',
    phase: 'phantom',
    state: { mode: 'strain', compression: 0, precompression: 0, softKpa: 6, stiffKpa: 60 },
    caption: (state) => (
      <>
        A block of medium tissue at <b>{BACKGROUND_KPA} kPa</b> holds a <b>soft</b> lesion (
        {state.softKpa.toFixed(0)} kPa) on the left and a <b>stiff</b> lesion (
        {state.stiffKpa.toFixed(0)} kPa) on the right. Nothing has been pressed or pushed yet — this
        is the starting geometry both techniques will interrogate.
      </>
    ),
  },
  {
    id: 'strain-press',
    title: 'Strain: press, and watch what gives',
    phase: 'strain-press',
    state: { mode: 'strain', compression: 0.75, precompression: 0 },
    duration: 1.8,
    caption: (
      <>
        A compression bar presses from the surface. The mesh shows where the displacement went:
        the <b>soft lesion squashes a lot</b>, the <b>stiff one barely moves</b>, and the
        background takes the rest. Strain is deformation ÷ original length — a{' '}
        <b>relative</b> quantity.
      </>
    ),
  },
  {
    id: 'strain-map',
    title: 'The strain map is qualitative',
    phase: 'strain-map',
    state: { mode: 'strain', compression: 0.75 },
    duration: 1.4,
    caption: (
      <>
        Colour the mesh by how much each cell deformed and you have a <b>strain elastogram</b>. It
        ranks stiffness — but it depends entirely on <b>how hard you pressed</b>, so it carries no
        units and is <b>operator-dependent</b>. Two operators get two maps of the same lesion.
      </>
    ),
  },
  {
    id: 'push',
    title: 'Shear wave: a push pulse, not a squeeze',
    phase: 'push',
    state: { mode: 'shear', compression: 0, precompression: 0, pushDepthCm: 4 },
    duration: 1.4,
    caption: (state) => (
      <>
        Now the machine does the work. A focused <b>acoustic radiation force</b> pulse — long and
        intense — is fired down one line to {state.pushDepthCm.toFixed(1)} cm and displaces the
        tissue by a few micrometres. No operator pressure is involved at all.
      </>
    ),
  },
  {
    id: 'shear-travel',
    title: 'Watch the shear wavefront race and crawl',
    phase: 'shear-travel',
    state: { mode: 'shear' },
    duration: 2,
    caption: (state) => (
      <>
        The push launches a <b>transverse shear wave</b> travelling <b>sideways</b> at just{' '}
        <b>{shearSpeedMs(BACKGROUND_KPA).toFixed(1)} m/s</b> in the background — slow enough to
        watch. See it <b>outrun</b> its twin through the stiff lesion (
        {shearSpeedMs(state.stiffKpa).toFixed(1)} m/s) and <b>crawl</b> through the soft one (
        {shearSpeedMs(state.softKpa).toFixed(1)} m/s). Tracking beams time each arrival.
      </>
    ),
  },
  {
    id: 'quantify',
    title: 'Speed becomes kilopascals',
    phase: 'quantify',
    state: { mode: 'shear' },
    duration: 1.4,
    caption: (state) => (
      <>
        Because <b>E ≈ 3 ρ c_s²</b>, a measured speed is a measured stiffness. The stiff lesion
        reads <b>{shearSpeedMs(state.stiffKpa).toFixed(2)} m/s = {state.stiffKpa.toFixed(0)} kPa</b>
        , the soft one <b>{shearSpeedMs(state.softKpa).toFixed(2)} m/s ={' '}
        {state.softKpa.toFixed(0)} kPa</b>. This is a <b>quantitative</b> measurement — the whole
        difference from strain.
      </>
    ),
  },
  {
    id: 'errors',
    title: 'Press too hard and everything reads stiff',
    phase: 'errors',
    state: { mode: 'shear', precompression: 0.85 },
    duration: 1.6,
    caption: (
      <>
        Tissue stiffens as it is squeezed. Excessive <b>pre-compression</b> from the probe raises
        the measured stiffness of <b>every</b> region, so the soft lesion stops looking soft —
        the classic false-positive in liver work. Depth and motion degrade it too: shear waves
        attenuate quickly, so deep measurements are noisy.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Compare the two techniques yourself',
    phase: 'free',
    state: { precompression: 0 },
    caption: (
      <>
        Switch modes and set the lesion stiffnesses. <b>Strain</b> gives you a relative picture
        that needs your hand; <b>shear wave</b> gives you a number that does not. Say which one is
        quantitative — that single distinction is what the exam asks.
      </>
    ),
  },
]

export default function ElastographyPage() {
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

  const phase: ElastoPhase = api.mode === 'manual' ? 'free' : (api.phase as ElastoPhase)

  /**
   * Pre-compression stiffens everything — and stiffens soft tissue
   * proportionally more, which is exactly why a heavily pre-compressed soft
   * lesion stops looking soft.
   */
  const effective = useMemo(() => {
    const p = state.precompression
    const bump = (kPa: number) => kPa * (1 + 2.6 * p) + 26 * p
    return {
      softKpa: bump(state.softKpa),
      stiffKpa: bump(state.stiffKpa),
      backgroundKpa: bump(BACKGROUND_KPA),
    }
  }, [state.softKpa, state.stiffKpa, state.precompression])

  const speeds = useMemo(
    () => ({
      soft: shearSpeedMs(effective.softKpa),
      stiff: shearSpeedMs(effective.stiffKpa),
      background: shearSpeedMs(effective.backgroundKpa),
    }),
    [effective],
  )

  const misleading = state.precompression > 0.5 && effective.softKpa > 25

  /* --- controls announce their consequence -------------------------------- */

  const onMode = (value: ElastoMode) => {
    patch({ mode: value })
    flash.fire([
      { text: value === 'strain' ? 'Strain elastography' : 'Shear-wave elastography', dir: 'flat' },
      {
        text: value === 'strain' ? 'Qualitative, relative map' : 'Quantitative m/s and kPa',
        dir: value === 'strain' ? 'down' : 'up',
      },
      {
        text: value === 'strain' ? 'Operator applies the stress' : 'Machine applies the ARF push',
        dir: value === 'strain' ? 'warn' : 'up',
      },
    ])
  }

  const onCompression = (value: number) => {
    const up = value > state.compression
    patch({ compression: value })
    flash.fire([
      { text: up ? 'Compression increased' : 'Compression released', dir: up ? 'up' : 'down' },
      { text: up ? 'Soft lesion deforms more' : 'Deformation reduces', dir: up ? 'up' : 'down' },
      { text: 'Stiff lesion barely changes', dir: 'flat' },
      { text: 'Strain map is relative — no units', dir: 'warn' },
    ])
  }

  const onPrecompression = (value: number) => {
    const up = value > state.precompression
    patch({ precompression: value })
    flash.fire([
      { text: up ? 'Pre-compression increased' : 'Pre-compression reduced', dir: up ? 'warn' : 'up' },
      { text: up ? 'All tissue stiffens' : 'Measured stiffness falls back', dir: up ? 'warn' : 'down' },
      { text: up ? 'Shear speeds rise everywhere' : 'Shear speeds fall', dir: up ? 'up' : 'down' },
      { text: up ? 'Soft lesion may read falsely stiff' : 'Contrast between lesions restored', dir: up ? 'warn' : 'up' },
    ])
  }

  const onSoft = (value: number) => {
    const up = value > state.softKpa
    patch({ softKpa: value })
    flash.fire([
      { text: up ? 'Soft lesion stiffer' : 'Soft lesion softer', dir: up ? 'up' : 'down' },
      { text: `c_s = ${shearSpeedMs(value).toFixed(2)} m/s`, dir: up ? 'up' : 'down' },
      { text: up ? 'Wavefront crosses it faster' : 'Wavefront crosses it slower', dir: up ? 'up' : 'down' },
    ])
  }

  const onStiff = (value: number) => {
    const up = value > state.stiffKpa
    patch({ stiffKpa: value })
    flash.fire([
      { text: up ? 'Stiff lesion stiffer' : 'Stiff lesion softer', dir: up ? 'up' : 'down' },
      { text: `c_s = ${shearSpeedMs(value).toFixed(2)} m/s`, dir: up ? 'up' : 'down' },
      { text: up ? 'It outruns the background further' : 'Its advantage shrinks', dir: up ? 'up' : 'down' },
    ])
  }

  const onPushDepth = (value: number) => {
    const up = value > state.pushDepthCm
    patch({ pushDepthCm: value })
    flash.fire([
      { text: up ? 'Push focus deeper' : 'Push focus shallower', dir: up ? 'up' : 'down' },
      { text: up ? 'Push amplitude at depth falls' : 'Push amplitude rises', dir: up ? 'warn' : 'up' },
      { text: up ? 'Measurement noisier with depth' : 'Measurement more reliable', dir: up ? 'warn' : 'up' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'stiffness ↑ → shear speed ↑', dir: 'up' },
    { label: 'strain = relative, no units', dir: 'flat' },
    { label: 'shear wave = m/s and kPa', dir: 'up' },
    { label: 'pre-compression ↑ → all stiffness ↑', dir: 'warn' },
    { label: 'depth ↑ → measurement noise ↑', dir: 'warn' },
    { label: 'shear waves ≪ 1540 m/s longitudinal', dir: 'down' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/elastography"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Elastography phantom">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="strain" size={14} />
                <b>Stage</b>{' '}
                {state.mode === 'strain' ? 'Strain phantom' : 'Shear-wave phantom'}
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Soft lesion
                </span>
                <span>
                  <i style={{ background: 'var(--us-violet)' }} /> Stiff lesion
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} />{' '}
                  {state.mode === 'strain' ? 'Compression' : 'ARF push'}
                </span>
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Shear wavefront
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <ElastoStage
                  mode={state.mode}
                  phase={phase}
                  compression={state.compression}
                  precompression={state.precompression}
                  stiffness={effective}
                  shearSpeeds={speeds}
                  pushDepthCm={state.pushDepthCm}
                  time={clock}
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
              <b>Enter manual lab</b> to switch modes and set the stiffnesses yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                {
                  label: 'Technique',
                  value: state.mode === 'strain' ? 'Strain (qualitative)' : 'Shear wave (quantitative)',
                  tone: state.mode === 'strain' ? 'amber' : 'green',
                },
                { label: 'Soft lesion', value: effective.softKpa.toFixed(0), unit: 'kPa', tone: 'green' },
                { label: 'Soft c_s', value: speeds.soft.toFixed(2), unit: 'm/s' },
                { label: 'Stiff lesion', value: effective.stiffKpa.toFixed(0), unit: 'kPa', tone: 'violet' },
                { label: 'Stiff c_s', value: speeds.stiff.toFixed(2), unit: 'm/s' },
                { label: 'Background', value: effective.backgroundKpa.toFixed(0), unit: 'kPa' },
                { label: 'Longitudinal c', value: ASSUMED_SPEED, unit: 'm/s', tone: 'cyan' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Technique" icon="strain" defaultOpen>
            <Segmented
              label="Elastography mode"
              value={state.mode}
              options={[
                { value: 'strain', label: 'Strain' },
                { value: 'shear', label: 'Shear wave' },
              ]}
              onChange={onMode}
            />
            <p className="us-slider-hint">
              <strong>Strain</strong> measures relative deformation under an applied stress —
              qualitative. <strong>Shear wave</strong> measures wave speed — quantitative, in m/s
              or kPa.
            </p>
          </ControlGroup>

          <ControlGroup title="Strain controls" icon="sliders" defaultOpen={state.mode === 'strain'}>
            <Slider
              label="Compression applied"
              unit="%"
              value={Math.round(state.compression * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => onCompression(v / 100)}
              disabled={state.mode !== 'strain'}
              disabledReason="Switch to strain mode to press the compression bar."
              hint="Press and the soft lesion squashes while the stiff one resists. How hard you press changes the map — that is the operator dependence."
            />
          </ControlGroup>

          <ControlGroup title="Shear-wave controls" icon="beam" defaultOpen={state.mode === 'shear'}>
            <Slider
              label="Push (ARF) depth"
              unit="cm"
              value={state.pushDepthCm}
              min={1}
              max={7}
              step={0.5}
              decimals={1}
              onChange={onPushDepth}
              disabled={state.mode !== 'shear'}
              disabledReason="Switch to shear-wave mode to place the push pulse."
              hint="The push must be strong enough at the focus. Deeper pushes are weaker, so deep measurements are less reliable."
            />
          </ControlGroup>

          <ControlGroup title="Phantom and errors" icon="phantom" defaultOpen>
            <Slider
              label="Soft lesion stiffness"
              unit="kPa"
              value={state.softKpa}
              min={2}
              max={40}
              step={1}
              onChange={onSoft}
              hint={`c_s = √(E/3ρ) = ${shearSpeedMs(state.softKpa).toFixed(2)} m/s`}
            />
            <Slider
              label="Stiff lesion stiffness"
              unit="kPa"
              value={state.stiffKpa}
              min={20}
              max={150}
              step={5}
              onChange={onStiff}
              hint={`c_s = √(E/3ρ) = ${shearSpeedMs(state.stiffKpa).toFixed(2)} m/s`}
            />
            <Slider
              label="Probe pre-compression"
              unit="%"
              value={Math.round(state.precompression * 100)}
              min={0}
              max={100}
              step={5}
              onChange={(v) => onPrecompression(v / 100)}
              hint="Squeezed tissue stiffens. Push too hard on the probe and both lesions read stiff — a genuine source of false positives."
            />
            {misleading && (
              <p className="us-trap-note">
                <strong>Reading is unreliable</strong>
                At this pre-compression the “soft” lesion reads{' '}
                <b>{effective.softKpa.toFixed(0)} kPa</b>. Ease off the probe before believing any
                number.
              </p>
            )}
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Stiffer tissue propagates shear waves…?"
              options={['Faster', 'Slower', 'At the same speed — 1540 m/s']}
              correct={0}
              explanation={
                <>
                  Stiffer means <b>faster</b>: c_s = √(E/3ρ). That is why shear-wave speed can
                  stand in for stiffness at all. Note the third option is a trap — shear waves are{' '}
                  <b>transverse</b> and travel at just <b>1–10 m/s</b>, hundreds of times slower
                  than the 1540 m/s longitudinal imaging wave.
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
              state.mode === 'strain' ? (
                <>
                  <b>Strain elastography.</b> {Math.round(state.compression * 100)}% compression is
                  applied from the surface. The soft lesion deforms far more than the stiff one, and
                  the colour map ranks them — but it has <b>no units</b> and depends on how hard you
                  pressed.
                </>
              ) : (
                <>
                  <b>Shear-wave elastography.</b> An ARF push at {state.pushDepthCm.toFixed(1)} cm
                  launches a transverse wave travelling laterally at{' '}
                  <b>{speeds.background.toFixed(2)} m/s</b> in the background,{' '}
                  <b>{speeds.stiff.toFixed(2)} m/s</b> through the stiff lesion and{' '}
                  <b>{speeds.soft.toFixed(2)} m/s</b> through the soft one.
                </>
              )
            }
            why={
              <>
                Both techniques measure the same physical property — the tissue's resistance to
                shear — by different routes. Strain applies a stress and watches the{' '}
                <b>deformation</b>, which depends on the stress you happened to apply. Shear-wave
                imaging measures a <b>wave speed</b>, which does not: speed is a property of the
                material, so the answer arrives with units attached.
              </>
            }
            equation={
              showEquation
                ? `strain = Δlength / original length          (dimensionless, relative)

shear-wave speed  c_s = √(E / 3ρ)
  soft   : √(${effective.softKpa.toFixed(0)} kPa / 3 × ${RHO}) = ${speeds.soft.toFixed(2)} m/s
  stiff  : √(${effective.stiffKpa.toFixed(0)} kPa / 3 × ${RHO}) = ${speeds.stiff.toFixed(2)} m/s

Young's modulus  E ≈ 3 ρ c_s²
  ${speeds.stiff.toFixed(2)} m/s → ${youngsModulusKpa(speeds.stiff).toFixed(0)} kPa

longitudinal imaging wave = ${ASSUMED_SPEED} m/s — hundreds of times faster`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Liver fibrosis staging is the standard application, and it is <b>shear wave</b>
                that is used because the answer must be a number that can be tracked over time.
                Strain still earns its place where relative stiffness is enough — breast and thyroid
                nodule characterisation, where a lesion far stiffer than its surroundings is the
                finding.
              </>
            }
            trap={
              showTrap ? (
                <>
                  Keep the two apart: <b>strain = relative deformation, qualitative,
                  operator-dependent</b>; <b>shear wave = wave speed, quantitative, in m/s or
                  kPa</b>. And shear waves are <b>transverse</b> and travel at <b>1–10 m/s</b> — a
                  stem that gives a shear-wave speed near 1540 m/s has confused it with the
                  longitudinal imaging pulse.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — what each technique actually measures">
            <p>
              <strong>Strain imaging needs a stress you cannot measure.</strong> The map shows
              deformation, and deformation depends on both the stiffness and the force applied.
              Because the applied force is unknown, only <em>relative</em> comparisons within one
              image are valid — which is why strain elastograms are reported as ratios or patterns,
              never in kilopascals.
            </p>
            <p>
              <strong>Shear-wave imaging supplies its own stress.</strong> The acoustic radiation
              force push is generated by the machine and is reproducible. What is measured is the
              speed of the resulting transverse wave, and speed is intrinsic to the tissue — so the
              result is a number, comparable between operators and between visits.
            </p>
            <p>
              <strong>Shear waves are a different wave.</strong> They are <em>transverse</em>:
              particles move perpendicular to the direction of travel. They travel at{' '}
              <b>1–10 m/s</b>, attenuate rapidly, and do not propagate through simple fluids at all
              — which is why elastography fails inside cysts and ascites.
            </p>
            <p>
              <strong>Errors worth naming.</strong> Depth (the push weakens and the wave attenuates),
              motion (breathing and vessels), and <b>pre-compression</b> — press hard on the probe
              and the tissue stiffens genuinely, so the machine reports a stiffness that is real but
              not the one you wanted. Slide the pre-compression control to 100% and watch both
              lesions converge.
            </p>

            <TrapNote>
              “Elastography measures the speed of sound in the tissue” is wrong twice over: it is
              the <em>shear</em>-wave speed, not the longitudinal 1540 m/s, and strain elastography
              measures no speed at all.
            </TrapNote>

            <SourceNote>
              The distinction between qualitative strain and quantitative shear-wave imaging, and
              the 1–10 m/s shear-speed range, come from the fact bank entries for this module.
              E ≈ 3ρc² assumes an incompressible, isotropic, elastic medium — the assumption every
              clinical system makes when it prints kilopascals, and one worth being aware of.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The shear wavefront is drawn far slower than real time so it can be followed, and the
            phantom is schematic. The stiffness-to-speed conversion is exact (c = √(E/3ρ) with ρ =
            {' '}{RHO} kg/m³), so every speed and kilopascal figure on the page is the arithmetic of
            that one equation. Pre-compression stiffening is modelled as a smooth increase — real
            tissue nonlinearity is more complex, but the direction and the clinical consequence are
            faithful.
          </ModelNote>
        </>
      }
    />
  )
}
