/**
 * Module 9 — Resolution.
 *
 * Five sub-experiments — axial, lateral, elevational, temporal and contrast —
 * each with targets that genuinely merge or separate on a live analysis
 * surface and on the B-mode image, because the thresholds are computed by the
 * engine, never asserted.
 */

import { useCallback, useMemo, useState } from 'react'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
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
import {
  CYST_DIAMETER_MM,
  ELEV_APERTURE_MM,
  ResolutionStage,
  type ResolutionPhase,
} from '../scenes/ResolutionStage'
import {
  axialResolutionMm,
  cyclesFromDamping,
  elevationalThicknessMm,
  focusedBeamWidthMm,
  frameRate,
  linesPerFrame,
  maxPrfHz,
  spatialPulseLengthMm,
  wavelengthMm,
} from '../engine'

type State = {
  axialSepMm: number
  frequencyMHz: number
  dampingPct: number
  lateralSepMm: number
  targetDepthMm: number
  focusDepthMm: number
  apertureMm: number
  cystDepthMm: number
  elevationFocusMm: number
  depthMm: number
  sectorDeg: number
  lineDensity: number
  zones: number
  dynamicRangeDb: number
}

const DEFAULTS: State = {
  axialSepMm: 2,
  frequencyMHz: 5,
  dampingPct: 85,
  lateralSepMm: 3,
  targetDepthMm: 60,
  focusDepthMm: 30,
  apertureMm: 12,
  cystDepthMm: 50,
  elevationFocusMm: 50,
  depthMm: 120,
  sectorDeg: 60,
  lineDensity: 2,
  zones: 1,
  dynamicRangeDb: 55,
}

const AXIAL_TARGET_DEPTH_CM = 4.8

const STEPS: GuidedStep<State>[] = [
  {
    id: 'axial-resolved',
    title: 'Axial: two echoes along the beam',
    phase: 'axial',
    state: { axialSepMm: 3, frequencyMHz: 5, dampingPct: 85 },
    caption: (state) => {
      const cycles = cyclesFromDamping(state.dampingPct / 100)
      const threshold = axialResolutionMm(cycles, wavelengthMm(1540, state.frequencyMHz))
      return (
        <>
          Two reflectors sit <b>{state.axialSepMm.toFixed(1)} mm</b> apart along the beam. The
          pulse is <b>{spatialPulseLengthMm(cycles, wavelengthMm(1540, state.frequencyMHz)).toFixed(2)} mm</b>{' '}
          long, so echoes separate whenever the gap exceeds <b>SPL/2 = {threshold.toFixed(2)} mm</b>.
          Here it does — the A-mode trace shows <b>two clean peaks</b>.
        </>
      )
    },
  },
  {
    id: 'axial-merged',
    title: 'Shrink the gap below SPL/2 and the echoes merge',
    phase: 'axial',
    state: { axialSepMm: 0.3 },
    duration: 1.4,
    caption: (state) => {
      const cycles = cyclesFromDamping(state.dampingPct / 100)
      const threshold = axialResolutionMm(cycles, wavelengthMm(1540, state.frequencyMHz))
      return (
        <>
          At <b>{state.axialSepMm.toFixed(1)} mm</b> the second echo begins before the first has
          finished: <b>one peak</b>, one apparent structure. The threshold is{' '}
          <b>{threshold.toFixed(2)} mm</b> — now raise the <b>frequency</b> or the <b>damping</b>{' '}
          slider and watch it fall until the peaks split again. Depth changes nothing.
        </>
      )
    },
  },
  {
    id: 'lateral-merged',
    title: 'Lateral: side by side, inside one beam',
    phase: 'lateral',
    state: { lateralSepMm: 3, targetDepthMm: 60, focusDepthMm: 25, apertureMm: 12 },
    duration: 1.4,
    caption: (state) => {
      const beam = focusedBeamWidthMm(
        state.targetDepthMm,
        state.apertureMm,
        wavelengthMm(1540, state.frequencyMHz),
        state.focusDepthMm,
      )
      return (
        <>
          These reflectors are <b>{state.lateralSepMm.toFixed(1)} mm</b> apart at{' '}
          <b>{(state.targetDepthMm / 10).toFixed(0)} cm</b> — but the focus is parked at{' '}
          {(state.focusDepthMm / 10).toFixed(1)} cm, so the beam is <b>{beam.toFixed(1)} mm</b>{' '}
          wide down there. Both sit inside it at the same instant: <b>one blob</b>.
        </>
      )
    },
  },
  {
    id: 'lateral-focus',
    title: 'Move the focus to their depth and they separate',
    phase: 'lateral',
    state: { focusDepthMm: 60 },
    duration: 1.4,
    caption: (state) => {
      const beam = focusedBeamWidthMm(
        state.targetDepthMm,
        state.apertureMm,
        wavelengthMm(1540, state.frequencyMHz),
        state.focusDepthMm,
      )
      return (
        <>
          Focus at <b>{(state.focusDepthMm / 10).toFixed(0)} cm</b>: the beam narrows to{' '}
          <b>{beam.toFixed(1)} mm</b> at the targets — narrower than their separation, so the
          B-mode image now shows <b>two dots</b>. Lateral resolution <b>is</b> the beam width:
          best at the focus, worse everywhere else, always depth-dependent.
        </>
      )
    },
  },
  {
    id: 'elevational',
    hands: true,
    title: 'Elevational: the slice has thickness',
    phase: 'elevational',
    state: { cystDepthMm: 90, elevationFocusMm: 30 },
    duration: 1.4,
    caption: (state) => {
      const slice = elevationalThicknessMm(state.cystDepthMm, ELEV_APERTURE_MM, state.elevationFocusMm)
      return (
        <>
          The lens focuses the slice at {(state.elevationFocusMm / 10).toFixed(0)} cm, so at the
          cyst's depth the slice is <b>{slice.toFixed(1)} mm</b> thick — far more than the{' '}
          {CYST_DIAMETER_MM} mm cyst. Tissue in front of and behind the image plane is{' '}
          <b>averaged in</b>, and the anechoic cyst fills with <b>pseudo-debris</b>: the
          partial-volume artefact. Slide the lens focus to the cyst and watch it clear.
        </>
      )
    },
  },
  {
    id: 'temporal',
    title: 'Temporal: a moving target at a low frame rate',
    phase: 'temporal',
    state: { depthMm: 200, sectorDeg: 90, lineDensity: 3, zones: 3 },
    duration: 1.6,
    caption: (state) => {
      const fps = frameRate(
        maxPrfHz(state.depthMm),
        linesPerFrame(state.sectorDeg, state.lineDensity),
        state.zones,
      )
      return (
        <>
          Deep field, wide sector, dense lines and three focal zones: the frame rate collapses to{' '}
          <b>{fps.toFixed(0)} fps</b> and the target visibly <b>jumps</b> between positions.
          Every lever that improves the other resolutions spends the time budget — pull the
          depth, sector, density or zones sliders back and watch the motion smooth out.
        </>
      )
    },
  },
  {
    id: 'contrast',
    title: 'Contrast: dynamic range decides what a grey means',
    phase: 'contrast',
    state: { dynamicRangeDb: 40 },
    duration: 1.4,
    caption: (state) => (
      <>
        A <b>narrow</b> dynamic range ({state.dynamicRangeDb} dB) is a steep window: the lesion
        and its background land on <b>very different greys</b> — a punchy, high-contrast image.
        Widen the range and the same two echoes map to <b>nearly the same grey</b>: flatter, but
        subtle tissue differences elsewhere become visible. Compression, not gain, is the control
        here.
      </>
    ),
  },
  {
    id: 'summary',
    title: 'The trade-off that binds them all: frequency',
    phase: 'summary',
    state: { frequencyMHz: 5 },
    caption: (
      <>
        Raising the frequency shortens λ: <b>axial and lateral resolution both improve</b> — and
        attenuation rises, so <b>penetration falls</b>. That is the whole probe-selection
        decision: <b>the highest frequency that still reaches the target</b>. Temporal and
        contrast resolution are spent separately, with the time budget and the grey map.
      </>
    ),
  },
]

const MANUAL_VIEWS: { value: ResolutionPhase; label: string }[] = [
  { value: 'axial', label: 'Axial' },
  { value: 'lateral', label: 'Lateral' },
  { value: 'elevational', label: 'Elevational' },
  { value: 'temporal', label: 'Temporal' },
  { value: 'contrast', label: 'Contrast' },
  { value: 'summary', label: 'Trade-off' },
]

export default function ResolutionPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  const [manualView, setManualView] = useState<ResolutionPhase>('axial')
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    setManualView('axial')
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)
  const scenePhase: ResolutionPhase =
    api.mode === 'manual' ? manualView : (api.phase as ResolutionPhase)

  const derived = useMemo(() => {
    const lambda = wavelengthMm(1540, state.frequencyMHz)
    const cycles = cyclesFromDamping(state.dampingPct / 100)
    const slice = elevationalThicknessMm(state.cystDepthMm, ELEV_APERTURE_MM, state.elevationFocusMm)
    const prf = maxPrfHz(state.depthMm)
    const lines = linesPerFrame(state.sectorDeg, state.lineDensity)
    return {
      lambda,
      cycles,
      spl: spatialPulseLengthMm(cycles, lambda),
      axialRes: axialResolutionMm(cycles, lambda),
      beamAtTarget: focusedBeamWidthMm(state.targetDepthMm, state.apertureMm, lambda, state.focusDepthMm),
      slice,
      partialVolume: slice > CYST_DIAMETER_MM * 0.9,
      prf,
      lines,
      fps: frameRate(prf, lines, state.zones),
    }
  }, [state])

  /* --- controls announce their consequence immediately ------------------- */

  const onAxialSep = (value: number) => {
    const resolvedNow = value > derived.axialRes
    patch({ axialSepMm: value })
    flash.fire([
      { text: `Separation ${value.toFixed(1)} mm`, dir: 'flat' },
      { text: `Threshold SPL/2 = ${derived.axialRes.toFixed(2)} mm`, dir: 'flat' },
      { text: resolvedNow ? 'Two echoes — resolved' : 'One echo — merged', dir: resolvedNow ? 'up' : 'warn' },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'λ and SPL shorten' : 'λ and SPL lengthen', dir: up ? 'down' : 'up' },
      { text: up ? 'Axial AND lateral resolution improve' : 'Axial and lateral resolution worsen', dir: up ? 'up' : 'down' },
      { text: up ? 'Penetration falls' : 'Penetration rises', dir: up ? 'warn' : 'up' },
    ])
  }

  const onDamping = (value: number) => {
    const up = value > state.dampingPct
    patch({ dampingPct: value })
    flash.fire([
      { text: up ? 'More damping — fewer cycles' : 'Less damping — more cycles', dir: up ? 'down' : 'up' },
      { text: up ? 'SPL shortens, axial resolution improves' : 'SPL lengthens, axial resolution worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Sensitivity falls' : 'Sensitivity rises', dir: up ? 'warn' : 'up' },
    ])
  }

  const onLateralSep = (value: number) => {
    const resolvedNow = value > derived.beamAtTarget
    patch({ lateralSepMm: value })
    flash.fire([
      { text: `Separation ${value.toFixed(1)} mm`, dir: 'flat' },
      { text: `Beam width there ${derived.beamAtTarget.toFixed(1)} mm`, dir: 'flat' },
      { text: resolvedNow ? 'Two dots — resolved' : 'One blob — merged', dir: resolvedNow ? 'up' : 'warn' },
    ])
  }

  const onTargetDepth = (value: number) => {
    patch({ targetDepthMm: value })
    const beam = focusedBeamWidthMm(value, state.apertureMm, derived.lambda, state.focusDepthMm)
    flash.fire([
      { text: `Targets at ${(value / 10).toFixed(1)} cm`, dir: 'flat' },
      { text: `Beam width there ${beam.toFixed(1)} mm`, dir: 'flat' },
      { text: 'Lateral resolution varies with depth', dir: 'flat' },
      { text: 'Axial threshold unchanged', dir: 'flat' },
    ])
  }

  const onFocusDepth = (value: number) => {
    const towards = Math.abs(value - state.targetDepthMm) < Math.abs(state.focusDepthMm - state.targetDepthMm)
    patch({ focusDepthMm: value })
    flash.fire([
      { text: `Focus at ${(value / 10).toFixed(1)} cm`, dir: 'flat' },
      { text: towards ? 'Beam narrows at the targets' : 'Beam widens at the targets', dir: towards ? 'up' : 'warn' },
      { text: 'Axial resolution unaffected by focusing', dir: 'flat' },
    ])
  }

  const onAperture = (value: number) => {
    const up = value > state.apertureMm
    patch({ apertureMm: value })
    flash.fire([
      { text: up ? 'Aperture widened' : 'Aperture narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'Tighter focal waist — lateral improves' : 'Wider waist — lateral worsens', dir: up ? 'up' : 'down' },
      { text: 'Axial resolution unchanged', dir: 'flat' },
    ])
  }

  const onCystDepth = (value: number) => {
    patch({ cystDepthMm: value })
    const slice = elevationalThicknessMm(value, ELEV_APERTURE_MM, state.elevationFocusMm)
    flash.fire([
      { text: `Cyst at ${(value / 10).toFixed(1)} cm`, dir: 'flat' },
      { text: `Slice there ${slice.toFixed(1)} mm`, dir: 'flat' },
      { text: slice > CYST_DIAMETER_MM * 0.9 ? 'Partial volume — pseudo-debris' : 'Slice thin — cyst clean', dir: slice > CYST_DIAMETER_MM * 0.9 ? 'warn' : 'up' },
    ])
  }

  const onElevationFocus = (value: number) => {
    patch({ elevationFocusMm: value })
    const slice = elevationalThicknessMm(state.cystDepthMm, ELEV_APERTURE_MM, value)
    flash.fire([
      { text: `Lens focus ${(value / 10).toFixed(1)} cm`, dir: 'flat' },
      { text: `Slice at the cyst ${slice.toFixed(1)} mm`, dir: 'flat' },
      { text: 'Fixed by the lens on a real 1D probe', dir: 'warn' },
    ])
  }

  const fireTemporal = (label: string, next: Partial<State>) => {
    const merged = { ...state, ...next }
    const fps = frameRate(
      maxPrfHz(merged.depthMm),
      linesPerFrame(merged.sectorDeg, merged.lineDensity),
      merged.zones,
    )
    const up = fps > derived.fps
    patch(next)
    flash.fire([
      { text: label, dir: 'flat' },
      { text: up ? 'Frame rate rises' : 'Frame rate falls', dir: up ? 'up' : 'warn' },
      { text: `${fps.toFixed(0)} fps`, dir: fps < 20 ? 'warn' : 'up' },
    ])
  }

  const onDynamicRange = (value: number) => {
    const up = value > state.dynamicRangeDb
    patch({ dynamicRangeDb: value })
    flash.fire([
      { text: up ? 'Dynamic range widened' : 'Dynamic range narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'Flatter, greyer image — subtle levels visible' : 'Punchy, high-contrast image', dir: 'flat' },
      { text: 'Patient exposure unchanged', dir: 'flat' },
    ])
  }

  /* --- B-mode surface ----------------------------------------------------- */

  const showBMode =
    scenePhase === 'axial' ||
    scenePhase === 'lateral' ||
    scenePhase === 'elevational' ||
    scenePhase === 'contrast'

  const scene: BModeScene = useMemo(() => {
    if (scenePhase === 'lateral') {
      return {
        widthCm: 4,
        depthCm: 10,
        background: 0.28,
        backgroundAttenuation: 0.4,
        targets: [-1, 1].map((side) => ({
          x: (side * state.lateralSepMm) / 2 / 20,
          depthCm: state.targetDepthMm / 10,
          radiusCm: 0.05,
          echogenicity: 0.95,
          scatter: 0.2,
        })),
      }
    }
    if (scenePhase === 'elevational') {
      const targets = [
        {
          x: 0,
          depthCm: state.cystDepthMm / 10,
          radiusCm: CYST_DIAMETER_MM / 20,
          echogenicity: 0.02,
          attenuation: 0.02,
          scatter: 0.1,
        },
      ]
      if (derived.partialVolume)
        targets.push({
          x: 0,
          depthCm: state.cystDepthMm / 10,
          radiusCm: CYST_DIAMETER_MM / 26,
          echogenicity: 0.17,
          attenuation: 0.02,
          scatter: 0.8,
        })
      return {
        widthCm: 4,
        depthCm: 10,
        background: 0.32,
        backgroundAttenuation: 0.4,
        targets,
      }
    }
    if (scenePhase === 'contrast') {
      return {
        widthCm: 4,
        depthCm: 8,
        background: 0.5,
        backgroundAttenuation: 0.4,
        targets: [
          {
            x: 0,
            depthCm: 4,
            radiusCm: 0.7,
            echogenicity: 0.36,
            attenuation: 0.4,
            scatter: 0.9,
          },
        ],
      }
    }
    // Axial (and default): two reflectors along the beam axis.
    return {
      widthCm: 4,
      depthCm: 8,
      background: 0.28,
      backgroundAttenuation: 0.4,
      targets: [
        {
          x: 0,
          depthCm: AXIAL_TARGET_DEPTH_CM,
          radiusCm: 0.04,
          echogenicity: 0.95,
          scatter: 0.2,
        },
        {
          x: 0,
          depthCm: AXIAL_TARGET_DEPTH_CM + state.axialSepMm / 10,
          radiusCm: 0.04,
          echogenicity: 0.95,
          scatter: 0.2,
        },
      ],
    }
  }, [scenePhase, state.axialSepMm, state.lateralSepMm, state.targetDepthMm, state.cystDepthMm, derived.partialVolume])

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 34,
      dynamicRangeDb: scenePhase === 'contrast' ? state.dynamicRangeDb : 55,
      focusCm: [state.focusDepthMm / 10],
      apertureMm: state.apertureMm,
      cycles: Math.max(1, Math.round(derived.cycles)),
    }),
    [state.frequencyMHz, state.dynamicRangeDb, state.focusDepthMm, state.apertureMm, derived.cycles, scenePhase],
  )

  /* --- teaching content --------------------------------------------------- */

  const deltas: Delta[] = [
    { label: 'frequency ↑ → axial and lateral ↑', dir: 'up' },
    { label: 'damping ↑ → axial ↑', dir: 'up' },
    { label: 'focus at target → lateral ↑', dir: 'up' },
    { label: 'depth: axial unchanged', dir: 'flat' },
    { label: 'zones ↑ → temporal ↓', dir: 'warn' },
    { label: 'dynamic range ↓ → displayed contrast ↑', dir: 'up' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/resolution"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Resolution stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="target" size={14} />
                <b>Stage</b> Resolution bench — {scenePhase === 'free' ? 'trade-off' : scenePhase}
              </h2>
              <div className="us-legend">
                <span>
                  <i className="is-dot" style={{ background: 'var(--us-amber)' }} /> Targets
                </span>
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Beam / trace
                </span>
                <span>
                  <i style={{ background: 'var(--us-violet)' }} /> Slice
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <ResolutionStage
                  phase={scenePhase}
                  time={clock}
                  axialSepMm={state.axialSepMm}
                  lateralSepMm={state.lateralSepMm}
                  targetDepthMm={state.targetDepthMm}
                  apertureMm={state.apertureMm}
                  focusDepthMm={state.focusDepthMm}
                  frequencyMHz={state.frequencyMHz}
                  cycles={derived.cycles}
                  cystDepthMm={state.cystDepthMm}
                  elevationFocusMm={state.elevationFocusMm}
                  fps={derived.fps}
                  dynamicRangeDb={state.dynamicRangeDb}
                />
              </div>
              {showBMode && (
                <div
                  className="us-canvas-wrap"
                  style={{ flex: '0 0 168px', maxWidth: 168, minWidth: 120 }}
                >
                  <BMode scene={scene} settings={settings} label={`${state.frequencyMHz} MHz`} />
                </div>
              )}
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
              <b>Enter manual lab</b> to run all five resolution benches yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Axial threshold SPL/2', value: derived.axialRes.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'Axial separation', value: state.axialSepMm.toFixed(1), unit: 'mm', tone: state.axialSepMm > derived.axialRes ? 'green' : 'red' },
                { label: 'Beam at targets', value: derived.beamAtTarget.toFixed(1), unit: 'mm', tone: state.lateralSepMm > derived.beamAtTarget ? 'green' : 'red' },
                { label: 'Slice at cyst', value: derived.slice.toFixed(1), unit: 'mm', tone: derived.partialVolume ? 'red' : 'green' },
                { label: 'Frame rate', value: derived.fps.toFixed(0), unit: 'fps', tone: derived.fps < 20 ? 'red' : 'green' },
                { label: 'Dynamic range', value: state.dynamicRangeDb.toFixed(0), unit: 'dB' },
                { label: 'Cycles per pulse', value: derived.cycles.toFixed(1) },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          {api.mode === 'manual' && (
            <ControlGroup title="Bench" icon="target" defaultOpen>
              <Segmented
                label="Sub-experiment"
                value={manualView}
                options={MANUAL_VIEWS}
                onChange={(v) => setManualView(v)}
              />
            </ControlGroup>
          )}

          <ControlGroup title="Axial resolution" icon="pulse" defaultOpen>
            <Slider
              label="Reflector separation (along beam)"
              unit="mm"
              value={state.axialSepMm}
              min={0.2}
              max={5}
              step={0.1}
              decimals={1}
              onChange={onAxialSep}
              hint={`Resolved when the gap exceeds SPL/2 = ${derived.axialRes.toFixed(2)} mm.`}
            />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={2}
              max={15}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Shorter wavelength, shorter pulse — the axial threshold falls."
            />
            <Slider
              label="Backing damping"
              unit="%"
              value={state.dampingPct}
              min={0}
              max={100}
              step={5}
              onChange={onDamping}
              hint="Fewer cycles per pulse — the other route to a shorter SPL."
            />
          </ControlGroup>

          <ControlGroup title="Lateral resolution" icon="beam" defaultOpen={api.index >= 2}>
            <Slider
              label="Reflector separation (side by side)"
              unit="mm"
              value={state.lateralSepMm}
              min={0.5}
              max={6}
              step={0.1}
              decimals={1}
              onChange={onLateralSep}
              hint={`Resolved when the gap exceeds the beam width at their depth — currently ${derived.beamAtTarget.toFixed(1)} mm.`}
            />
            <Slider
              label="Target depth"
              unit="mm"
              value={state.targetDepthMm}
              min={20}
              max={100}
              step={5}
              onChange={onTargetDepth}
            />
            <Slider
              label="Focus depth"
              unit="mm"
              value={state.focusDepthMm}
              min={20}
              max={100}
              step={5}
              onChange={onFocusDepth}
              hint="Put the focus at the targets and the beam — and so the lateral threshold — narrows."
            />
            <Slider
              label="Aperture"
              unit="mm"
              value={state.apertureMm}
              min={6}
              max={24}
              step={1}
              onChange={onAperture}
            />
          </ControlGroup>

          <ControlGroup title="Elevational (slice)" icon="layers" defaultOpen={api.index >= 4}>
            <Slider
              label="Cyst depth"
              unit="mm"
              value={state.cystDepthMm}
              min={20}
              max={100}
              step={5}
              onChange={onCystDepth}
            />
            <Slider
              label="Elevation lens focus"
              unit="mm"
              value={state.elevationFocusMm}
              min={20}
              max={100}
              step={5}
              onChange={onElevationFocus}
              hint="Fixed at manufacture on a 1D array — moving it here means choosing a different probe."
            />
          </ControlGroup>

          <ControlGroup title="Temporal (frame rate)" icon="alias" defaultOpen={api.index >= 5}>
            <Slider
              label="Imaging depth"
              unit="mm"
              value={state.depthMm}
              min={50}
              max={200}
              step={10}
              onChange={(v) => fireTemporal(`Depth ${(v / 10).toFixed(0)} cm — PRF cap moves`, { depthMm: v })}
              hint="Deeper listening caps the PRF: PRF_max = c/2d."
            />
            <Slider
              label="Sector width"
              unit="°"
              value={state.sectorDeg}
              min={30}
              max={90}
              step={5}
              onChange={(v) => fireTemporal(`Sector ${v}°`, { sectorDeg: v })}
            />
            <Slider
              label="Line density"
              unit="lines/°"
              value={state.lineDensity}
              min={1}
              max={4}
              step={0.5}
              decimals={1}
              onChange={(v) => fireTemporal(`Line density ${v.toFixed(1)}/°`, { lineDensity: v })}
            />
            <Slider
              label="Focal zones"
              value={state.zones}
              min={1}
              max={3}
              step={1}
              onChange={(v) => fireTemporal(`${v} focal zone${v > 1 ? 's' : ''}`, { zones: v })}
            />
          </ControlGroup>

          <ControlGroup title="Contrast resolution" icon="eye" defaultOpen={api.index >= 6}>
            <Slider
              label="Dynamic range"
              unit="dB"
              value={state.dynamicRangeDb}
              min={30}
              max={80}
              step={5}
              onChange={onDynamicRange}
              hint="Narrow = punchy black-and-white; wide = flatter, with subtle greys preserved."
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
              question="Which of these improves axial resolution?"
              options={['Higher transmit frequency', 'Bigger aperture', 'More focal zones']}
              correct={0}
              explanation={
                <>
                  Axial resolution is <b>SPL/2</b>, and only frequency and cycle count change the
                  spatial pulse length. Aperture and focusing act on the <b>beam width</b> —
                  lateral resolution — and focal zones buy lateral coverage at a temporal cost.
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
                At {state.frequencyMHz} MHz with {derived.cycles.toFixed(1)} cycles the axial
                threshold is <b>{derived.axialRes.toFixed(2)} mm</b> at every depth. The beam is{' '}
                <b>{derived.beamAtTarget.toFixed(1)} mm</b> wide at the lateral targets, the slice{' '}
                <b>{derived.slice.toFixed(1)} mm</b> thick at the cyst, and the machine is
                delivering <b>{derived.fps.toFixed(0)} frames per second</b>.
              </>
            }
            why={
              <>
                Each resolution is limited by a different piece of geometry: the <b>pulse
                length</b> along the beam, the <b>beam width</b> across it, the <b>slice
                thickness</b> out of plane, the <b>frame interval</b> in time and the{' '}
                <b>grey-level map</b> in amplitude. That is why each has its own controls — and
                why fixing one often spends another.
              </>
            }
            equation={
              showEquation
                ? `axial = SPL/2 = (n × λ)/2 = (${derived.cycles.toFixed(1)} × ${derived.lambda.toFixed(2)})/2 = ${derived.axialRes.toFixed(2)} mm   (depth-independent)
lateral = beam width at depth = ${derived.beamAtTarget.toFixed(1)} mm at ${(state.targetDepthMm / 10).toFixed(1)} cm
slice = ${derived.slice.toFixed(1)} mm at the cyst (lens focus ${(state.elevationFocusMm / 10).toFixed(0)} cm)
frame rate = PRF/(lines × zones) = ${derived.prf.toFixed(0)}/(${derived.lines} × ${state.zones}) = ${derived.fps.toFixed(0)} fps`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Decide what the question needs before touching the console: a fetal heart needs{' '}
                <b>temporal</b> resolution; a possible septum in a cyst needs <b>axial and
                elevational</b>; a subtle liver lesion needs <b>contrast</b>. Protect that one,
                and spend the others.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Axial resolution improves with focusing / a larger diameter / higher PRF / at
                  shallower depths” — <b>all FALSE</b>, and all four appear as stems in QBank
                  Q321. Axial resolution is SPL/2, full stop. Those controls belong to{' '}
                  <b>lateral</b> and <b>temporal</b> resolution.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — five resolutions, kept apart">
            <p>
              <strong>Axial</strong> is the pulse's job: SPL/2, typically <b>0.5–1 mm</b>,
              improved by frequency and damping, and <em>independent of depth</em> because the
              pulse does not lengthen as it travels.
            </p>
            <p>
              <strong>Lateral</strong> is the beam's job: equal to the beam width, best on the
              central axis at the focus, improved by aperture, frequency and focus placement —
              and always worse than axial away from the focal zone.
            </p>
            <p>
              <strong>Elevational</strong> is the lens's job: the slice is thinnest at the fixed
              lens focus and is usually the worst of the three. A slice thicker than a small cyst
              averages adjacent tissue in — the partial-volume pseudo-debris this bench creates
              on demand. A matrix array is the hardware fix.
            </p>
            <p>
              <strong>Temporal</strong> is the time budget: frame rate = PRF/(lines × zones),
              with the PRF itself capped by depth. <strong>Contrast</strong> is the grey map:
              narrow dynamic range separates similar echoes; wide preserves the subtle ones.
            </p>
            <div className="us-table-wrap">
              <table className="us-table">
                <thead>
                  <tr>
                    <th scope="col">Resolution</th>
                    <th scope="col">Determined by</th>
                    <th scope="col">Improved by</th>
                    <th scope="col">Varies with depth?</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <th scope="row">Axial</th>
                    <td>SPL/2 — <b>not</b> depth, diameter, PRF or focusing</td>
                    <td>Higher f, fewer cycles, more damping</td>
                    <td>No</td>
                  </tr>
                  <tr>
                    <th scope="row">Lateral</th>
                    <td>Beam width</td>
                    <td>Larger aperture, higher f, focus at target</td>
                    <td>Yes — best at focus</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <TrapNote>
              The classic swap: focusing and crystal diameter change <em>lateral</em> resolution;
              pulse length changes <em>axial</em>. Any stem wiring one to the other's controls is
              false — the false stems of QBank Q321 are exactly this table's first row.
            </TrapNote>

            <SourceNote>
              The axial rule and its independence from depth, diameter, PRF and focusing follow
              QBank Q321, Q352 and Q238 (high-yield recall); typical axial values of 0.5–1 mm are
              from QBank Q352. The frame-rate levers — depth, sector width, line density and
              focal zones — are tested in QBank Q446 and Q289, which also list PRF, frame rate
              and focal zone as operator controls.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Target sizes and the vertical scales are exaggerated so millimetre-scale physics is
            visible, and the bouncing target moves far more slowly than blood or a valve. The
            thresholds — SPL/2, beam width, slice thickness, frame interval and the grey map —
            are computed exactly.
          </ModelNote>
        </>
      }
    />
  )
}
