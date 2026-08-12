/**
 * Module 10 — Image Controls.
 *
 * A working ultrasound console driving a computed abdominal-style phantom.
 * Every knob acts on the same renderer the rest of the laboratory uses, so
 * shadowing, enhancement, noise and blur respond honestly — and the page's
 * central lesson is a safety one: gain and TGC brighten the image for free,
 * output power brightens it at the patient's expense. The preset challenges
 * mis-set the console and ask the learner to rescue it properly.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import type { BModeResult, BModeScene, BModeSettings } from '../components/BMode'
import {
  ChipRow,
  ControlGroup,
  Slider,
  StageFlash,
  TgcSliders,
  Toggle,
  useFlash,
} from '../components/Controls'
import {
  GuidedCaption,
  GuidedTransport,
  Predict,
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
import { ConsoleStage, type ConsolePhase } from '../scenes/ConsoleStage'
import {
  clamp,
  frameRate,
  linesPerFrame,
  maxPrfHz,
  mechanicalIndex,
  penetrationDepthCm,
  thermalIndexEstimate,
} from '../engine'

type ProbeId = 'curvilinear' | 'linear'

type State = {
  probe: ProbeId
  /** Relative acoustic output power, 0.1–1. */
  power: number
  gainDb: number
  tgc: number[]
  depthCm: number
  frequencyMHz: number
  focusCm: number
  focalZones: number
  dynamicRangeDb: number
  persistence: number
  speckleReduction: number
  compounding: boolean
  harmonics: boolean
  zoom: number
  /** Sector / field width as a percentage of the probe's full field. */
  sectorPct: number
}

const DEFAULTS: State = {
  probe: 'curvilinear',
  power: 0.6,
  gainDb: 34,
  tgc: [4, 6, 9, 11, 14, 16],
  depthCm: 14,
  frequencyMHz: 3.5,
  focusCm: 7,
  focalZones: 1,
  dynamicRangeDb: 60,
  persistence: 0.2,
  speckleReduction: 0.2,
  compounding: false,
  harmonics: false,
  zoom: 1,
  sectorPct: 100,
}

/* The abdominal-style phantom, in fixed centimetre coordinates. */
const PHANTOM_TARGETS: BModeScene['targets'] = [
  // Superficial small target — the structure a high-frequency probe is for.
  { x: -0.12, depthCm: 1.6, radiusCm: 0.16, echogenicity: 0.9, scatter: 0.4 },
  // Simple cyst: anechoic, barely attenuating → posterior enhancement emerges.
  { x: -0.38, depthCm: 5, radiusCm: 1.1, echogenicity: 0.02, attenuation: 0.02, scatter: 0.1 },
  // Calcified focus: bright rim, savage attenuation → clean shadow emerges.
  { x: 0.4, depthCm: 7.5, radiusCm: 0.4, echogenicity: 0.95, rim: 0.9, attenuation: 24, scatter: 0.3 },
  // Deep hypoechoic lesion — the thing the deep-liver challenge is about.
  { x: 0.12, depthCm: 9.5, radiusCm: 0.8, echogenicity: 0.16, attenuation: 0.55 },
  // Diaphragm-like bright curve, approximated by a thin very echogenic box.
  { x: 0, depthCm: 11.2, radiusCm: 0.16, halfWidthCm: 5.5, shape: 'box', echogenicity: 1, rim: 0.5, attenuation: 0.8 },
]

type ChallengeId = 'deep' | 'superficial' | 'framerate' | 'rescue'

const CHALLENGES: { id: ChallengeId; title: string; goal: string; start: Partial<State> }[] = [
  {
    id: 'deep',
    title: 'Optimise the deep liver image',
    goal: 'Frequency ≤ 4 MHz, TGC rising with depth, depth ≥ 12 cm.',
    start: { frequencyMHz: 12, tgc: [0, 0, 0, 0, 0, 0], depthCm: 14, probe: 'curvilinear', zoom: 1 },
  },
  {
    id: 'superficial',
    title: 'Optimise the superficial thyroid-style target',
    goal: 'Frequency ≥ 10 MHz, depth ≤ 5 cm, focus < 3 cm.',
    start: { frequencyMHz: 2.5, depthCm: 16, focusCm: 8, probe: 'linear', zoom: 1 },
  },
  {
    id: 'framerate',
    title: 'Improve frame rate on a moving target',
    goal: 'One focal zone, sector ≤ 60%, depth ≤ 8 cm.',
    start: { focalZones: 4, sectorPct: 100, depthCm: 18, persistence: 0.8 },
  },
  {
    id: 'rescue',
    title: 'Rescue a weak deep image WITHOUT raising output power',
    goal: 'Frequency ≤ 5 MHz, far TGC ≥ 12 dB or gain ≥ 28 dB, focus ≥ 8 cm — power untouched.',
    start: { power: 0.4, gainDb: 16, tgc: [0, 0, 0, 0, 0, 0], frequencyMHz: 10, depthCm: 14, focusCm: 3 },
  },
]

function tgcRising(tgc: number[]): boolean {
  if (tgc[tgc.length - 1] < tgc[0] + 8) return false
  for (let i = 1; i < tgc.length; i += 1) if (tgc[i] < tgc[i - 1] - 1) return false
  return true
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'welcome',
    title: 'A console, and an image computed from physics',
    phase: 'welcome',
    state: { ...DEFAULTS },
    caption: (
      <>
        This phantom is not a photograph: every pixel is computed from the beam physics. The cyst{' '}
        <b>enhances</b> behind itself and the calcified focus <b>shadows</b> because attenuation is
        integrated down each scan line. Every control on the right acts on that computation.
      </>
    ),
  },
  {
    id: 'gain-power',
    title: 'Gain and power look alike — and could not be more different',
    phase: 'gain-power',
    duration: 1.4,
    state: { gainDb: 44, power: 0.35 },
    caption: (
      <>
        Both brighten the image. <b>Receiver gain</b> amplifies the echoes after they return —
        noise included, <b>patient exposure unchanged</b>. <b>Output power</b> drives a stronger
        pulse into the patient: better signal-to-noise, but <b>MI and TI rise</b>. The safety habit:
        gain first, power last.
      </>
    ),
  },
  {
    id: 'tgc',
    title: 'TGC pays back what depth has taken',
    phase: 'tgc',
    duration: 1.4,
    state: { tgc: [2, 6, 10, 14, 18, 22], gainDb: 34, power: 0.6 },
    caption: (
      <>
        Attenuation removes a fixed number of decibels per centimetre, so deeper echoes arrive
        weaker. <b>Time gain compensation</b> amplifies later-returning echoes more, band by band,
        until identical tissue looks identical at every depth. It is receive-side only — exposure is
        untouched.
      </>
    ),
  },
  {
    id: 'depth',
    title: 'Depth buys anatomy and spends frame rate',
    phase: 'depth',
    duration: 1.4,
    state: { depthCm: 18 },
    caption: (
      <>
        Every centimetre of depth lengthens the listening time per line, capping the PRF at{' '}
        <b>c / (2 × depth)</b> — and the frame rate falls with it. Show only the depth you need:
        wasted centimetres at the bottom of the screen cost temporal resolution.
      </>
    ),
  },
  {
    id: 'frequency',
    title: 'Frequency: resolution against penetration',
    phase: 'frequency',
    duration: 1.4,
    state: { frequencyMHz: 9, depthCm: 14 },
    caption: (state) => (
      <>
        At <b>{state.frequencyMHz} MHz</b> the detail is finer but attenuation has risen with
        frequency: practical penetration is roughly{' '}
        <b>{penetrationDepthCm(0.5, state.frequencyMHz).toFixed(0)} cm</b> — the deep field has
        gone dark. Choose the <b>highest frequency that still reaches the target</b>, which for a
        14 cm liver is not 9 MHz.
      </>
    ),
  },
  {
    id: 'focus',
    title: 'Put the focus where the question is',
    phase: 'focus',
    duration: 1.4,
    state: { frequencyMHz: 3.5, focusCm: 9.5, focalZones: 1 },
    caption: (
      <>
        The beam is narrowest — and lateral resolution best — at the <b>focal depth</b> (the amber
        caret). Place it at or just below the region of interest. Extra focal zones widen the sharp
        band but each one needs another pulse down every line, so the <b>frame rate divides</b>.
      </>
    ),
  },
  {
    id: 'processing',
    title: 'Dynamic range and persistence shape the display',
    phase: 'processing',
    duration: 1.4,
    state: { dynamicRangeDb: 75, persistence: 0.7 },
    caption: (
      <>
        A <b>wide dynamic range</b> shows many grey levels — smooth, low-contrast, good for
        parenchyma. A narrow one is punchy and near black-and-white. <b>Persistence</b> averages
        successive frames: quieter speckle, but anything moving smears — turn it down for a beating
        heart.
      </>
    ),
  },
  {
    id: 'harmonics',
    title: 'Harmonic imaging cleans the clutter',
    phase: 'harmonics',
    duration: 1.4,
    state: { harmonics: true, dynamicRangeDb: 60, persistence: 0.2 },
    caption: (
      <>
        Listening at <b>twice the transmitted frequency</b> rejects the near-field reverberation
        and side-lobe haze, because harmonics are generated <b>within the tissue</b> where the beam
        is strong. The cyst clears out; the price is reduced penetration.
      </>
    ),
  },
  {
    id: 'free',
    title: 'The console is yours',
    phase: 'free',
    caption: (
      <>
        Try the <b>preset challenges</b> in the controls column: each one mis-sets the console and
        states a goal, with a live solved check. Remember the order of rescue: gain, TGC,
        frequency, focus, depth, positioning — and only then output power.
      </>
    ),
  },
]

export default function ControlsPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  const [bResult, setBResult] = useState<BModeResult | null>(null)
  const [challenge, setChallenge] = useState<{
    id: ChallengeId
    powerAtStart: number
    violated: boolean
  } | null>(null)
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    setChallenge(null)
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })

  /* --- everything derived, from the engine ------------------------------- */
  const derived = useMemo(() => {
    const prfCap = maxPrfHz(state.depthCm * 10)
    const sectorDeg = (state.probe === 'curvilinear' ? 70 : 52) * (state.sectorPct / 100)
    const lines = linesPerFrame(sectorDeg, state.probe === 'linear' ? 2.6 : 1.9)
    const fr = frameRate(prfCap, lines, state.focalZones)
    const mi = mechanicalIndex(state.power * 2.2, state.frequencyMHz)
    const ti = thermalIndexEstimate({
      power: state.power,
      frequencyMHz: state.frequencyMHz,
      mode: 'bmode',
      target: 'soft',
    })
    const penetration = penetrationDepthCm(0.5, state.frequencyMHz)
    return { prfCap, sectorDeg, lines, fr, mi, ti, penetration }
  }, [state])

  const scene: BModeScene = useMemo(() => {
    const displayDepth = state.depthCm / state.zoom
    const widthCm =
      (state.probe === 'linear' ? 6 : Math.max(6, displayDepth * 0.85)) * (state.sectorPct / 100)
    return {
      widthCm,
      depthCm: displayDepth,
      background: 0.5,
      backgroundAttenuation: 0.5,
      geometry: state.probe === 'curvilinear' ? 'sector' : 'linear',
      sectorDegrees: derived.sectorDeg,
      targets: PHANTOM_TARGETS,
    }
  }, [state.depthCm, state.zoom, state.probe, state.sectorPct, derived.sectorDeg])

  const settings: BModeSettings = useMemo(() => {
    const zones = Array.from(
      { length: state.focalZones },
      (_, i) => state.focusCm + (i - (state.focalZones - 1) / 2) * 1.8,
    ).filter((f) => f > 0.5)
    return {
      frequencyMHz: state.frequencyMHz,
      gainDb: state.gainDb,
      dynamicRangeDb: state.dynamicRangeDb,
      tgc: state.tgc,
      focusCm: zones,
      apertureMm: state.probe === 'linear' ? 9 : 14,
      cycles: 2,
      power: state.power,
      noise: 0.15,
      // Persistence and spatial compounding are modelled as extra smoothing —
      // see the ModelNote. Compounding also costs a little lateral sharpness.
      speckleReduction: clamp(
        state.speckleReduction + (state.compounding ? 0.3 : 0) + state.persistence * 0.2,
        0,
        1,
      ),
      harmonics: state.harmonics,
    }
  }, [state])

  const onResult = useCallback((r: BModeResult) => {
    setBResult((prev) =>
      prev &&
      Math.abs(prev.penetrationCm - r.penetrationCm) < 1e-6 &&
      Math.abs(prev.beamWidthMm - r.beamWidthMm) < 1e-6 &&
      Math.abs(prev.axialMm - r.axialMm) < 1e-6
        ? prev
        : r,
    )
  }, [])

  /* --- challenge machinery ------------------------------------------------ */

  const startChallenge = (id: ChallengeId) => {
    const spec = CHALLENGES.find((c) => c.id === id)
    if (!spec) return
    api.setMode('manual')
    patch(spec.start)
    setChallenge({ id, powerAtStart: spec.start.power ?? state.power, violated: false })
    flash.fire([
      { text: `Challenge: ${spec.title}`, dir: 'flat' },
      { text: 'Console mis-set — over to you', dir: 'warn' },
    ])
  }

  const challengeSolved = (id: ChallengeId): boolean => {
    switch (id) {
      case 'deep':
        return state.frequencyMHz <= 4 && state.depthCm >= 12 && tgcRising(state.tgc)
      case 'superficial':
        return state.frequencyMHz >= 10 && state.depthCm <= 5 && state.focusCm < 3
      case 'framerate':
        return state.focalZones === 1 && state.sectorPct <= 60 && state.depthCm <= 8
      case 'rescue':
        return (
          !!challenge &&
          !challenge.violated &&
          state.power <= challenge.powerAtStart + 1e-6 &&
          state.frequencyMHz <= 5 &&
          (state.gainDb >= 28 || state.tgc[5] >= 12) &&
          state.focusCm >= 8
        )
    }
  }

  /* --- controls announce their consequence immediately -------------------- */

  const onPower = (v: number) => {
    const up = v > state.power
    if (up && challenge && challenge.id === 'rescue' && v > challenge.powerAtStart + 1e-6 && !challenge.violated) {
      setChallenge({ ...challenge, violated: true })
      patch({ power: v })
      flash.fire([
        { text: 'Output power raised!', dir: 'warn' },
        { text: 'Challenge failed — the goal was to rescue WITHOUT power', dir: 'warn' },
        { text: 'MI and TI have risen', dir: 'warn' },
      ])
      return
    }
    patch({ power: v })
    flash.fire([
      { text: up ? 'Output power increased' : 'Output power decreased', dir: up ? 'warn' : 'down' },
      { text: up ? 'MI and TI rise — exposure up' : 'MI and TI fall — exposure down', dir: up ? 'warn' : 'up' },
      { text: up ? 'Signal-to-noise improves' : 'Signal-to-noise falls', dir: up ? 'up' : 'down' },
      { text: 'Try gain, TGC, frequency and focus first', dir: 'flat' },
    ])
  }

  const onGain = (v: number) => {
    const up = v > state.gainDb
    patch({ gainDb: v })
    flash.fire([
      { text: up ? 'Gain increased' : 'Gain decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Everything brighter — noise included' : 'Everything darker', dir: up ? 'up' : 'down' },
      { text: 'Patient exposure unchanged', dir: 'flat' },
      { text: 'Signal-to-noise ratio unchanged', dir: 'flat' },
    ])
  }

  const onTgc = (values: number[]) => {
    const oldMean = state.tgc.reduce((a, b) => a + b, 0) / state.tgc.length
    const newMean = values.reduce((a, b) => a + b, 0) / values.length
    const up = newMean >= oldMean
    patch({ tgc: values })
    flash.fire([
      { text: 'TGC adjusted', dir: 'flat' },
      { text: up ? 'That depth band brightens' : 'That depth band darkens', dir: up ? 'up' : 'down' },
      { text: 'Receive-side only — exposure unchanged', dir: 'flat' },
    ])
  }

  const onDepth = (v: number) => {
    const up = v > state.depthCm
    patch({ depthCm: v })
    flash.fire([
      { text: up ? 'Depth increased' : 'Depth reduced', dir: up ? 'up' : 'down' },
      { text: up ? 'PRF cap falls' : 'PRF cap rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Frame rate falls' : 'Frame rate rises', dir: up ? 'down' : 'up' },
    ])
  }

  const onFrequency = (v: number) => {
    const up = v > state.frequencyMHz
    patch({ frequencyMHz: v })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Axial and lateral resolution improve' : 'Resolution coarsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Attenuation rises — penetration falls' : 'Penetration rises', dir: up ? 'warn' : 'up' },
      { text: `Practical penetration ≈ ${penetrationDepthCm(0.5, v).toFixed(0)} cm`, dir: 'flat' },
    ])
  }

  const onFocus = (v: number) => {
    patch({ focusCm: v })
    flash.fire([
      { text: `Focus at ${v.toFixed(1)} cm`, dir: 'flat' },
      { text: 'Beam narrowest there — lateral resolution best', dir: 'up' },
      { text: 'Blurrier away from the focus', dir: 'down' },
    ])
  }

  const onZones = (v: number) => {
    const up = v > state.focalZones
    patch({ focalZones: v })
    flash.fire([
      { text: `${v} focal zone${v > 1 ? 's' : ''}`, dir: 'flat' },
      { text: up ? 'Sharp band widens over depth' : 'Sharp band narrows to one depth', dir: up ? 'up' : 'down' },
      { text: up ? 'One more pulse per line — frame rate divides' : 'Fewer pulses per line — frame rate recovers', dir: up ? 'warn' : 'up' },
    ])
  }

  const onDynamicRange = (v: number) => {
    const up = v > state.dynamicRangeDb
    patch({ dynamicRangeDb: v })
    flash.fire([
      { text: up ? 'Dynamic range widened' : 'Dynamic range narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'More grey shades — smoother, flatter' : 'Fewer greys — punchier contrast', dir: 'flat' },
      { text: up ? 'Contrast resolution: subtler differences visible' : 'Subtle differences may clip to black or white', dir: up ? 'up' : 'warn' },
    ])
  }

  const onPersistence = (v: number) => {
    const up = v > state.persistence
    patch({ persistence: v })
    const items = [
      { text: up ? 'Persistence increased' : 'Persistence decreased', dir: up ? 'up' : 'down' } as const,
      { text: up ? 'Frames averaged — speckle quietens' : 'Less temporal smoothing', dir: 'flat' } as const,
    ]
    flash.fire(
      v > 0.5
        ? [...items, { text: 'Moving targets will smear — beware', dir: 'warn' }]
        : [...items],
    )
  }

  const onSpeckle = (v: number) => {
    const up = v > state.speckleReduction
    patch({ speckleReduction: v })
    flash.fire([
      { text: up ? 'Speckle reduction increased' : 'Speckle reduction decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Smoother parenchyma, crisper edges' : 'Raw speckle texture returns', dir: 'flat' },
      { text: up ? 'Fine texture may be processed away' : 'True texture preserved', dir: up ? 'warn' : 'up' },
    ])
  }

  const onCompounding = (v: boolean) => {
    patch({ compounding: v })
    flash.fire(
      v
        ? [
            { text: 'Spatial compounding on', dir: 'flat' },
            { text: 'Several look angles averaged — speckle falls', dir: 'up' },
            { text: 'Slight lateral softening; shadows wash out', dir: 'warn' },
          ]
        : [
            { text: 'Spatial compounding off', dir: 'flat' },
            { text: 'Single look angle — shadows crisp again', dir: 'up' },
          ],
    )
  }

  const onHarmonics = (v: boolean) => {
    patch({ harmonics: v })
    flash.fire(
      v
        ? [
            { text: 'Tissue harmonic imaging on', dir: 'flat' },
            { text: 'Near-field clutter and haze rejected', dir: 'up' },
            { text: 'Cyst contents clear', dir: 'up' },
            { text: 'Penetration reduced', dir: 'warn' },
          ]
        : [
            { text: 'Fundamental imaging', dir: 'flat' },
            { text: 'Clutter returns; penetration recovers', dir: 'flat' },
          ],
    )
  }

  const onZoom = (v: number) => {
    const up = v > state.zoom
    patch({ zoom: v })
    flash.fire([
      { text: up ? 'Zoomed in' : 'Zoomed out', dir: 'flat' },
      { text: up ? 'Shallower window magnified' : 'Full field restored', dir: 'flat' },
      { text: 'Resolution of the data unchanged', dir: 'flat' },
    ])
  }

  const onSector = (v: number) => {
    const up = v > state.sectorPct
    patch({ sectorPct: v })
    flash.fire([
      { text: up ? 'Sector widened' : 'Sector narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'More lines per frame — frame rate falls' : 'Fewer lines per frame — frame rate rises', dir: up ? 'down' : 'up' },
    ])
  }

  const onProbe = (v: ProbeId) => {
    patch({ probe: v })
    flash.fire(
      v === 'linear'
        ? [
            { text: 'Linear array', dir: 'flat' },
            { text: 'Rectangular field, superficial detail', dir: 'up' },
            { text: 'Raise the frequency to match', dir: 'flat' },
          ]
        : [
            { text: 'Curvilinear array', dir: 'flat' },
            { text: 'Sector field, deeper reach', dir: 'up' },
            { text: 'Lower frequency for penetration', dir: 'flat' },
          ],
    )
  }

  const deltas: Delta[] = [
    { label: 'gain ↑ → exposure unchanged', dir: 'flat' },
    { label: 'power ↑ → MI & TI ↑', dir: 'warn' },
    { label: 'depth ↑ → frame rate ↓', dir: 'down' },
    { label: 'focal zones ↑ → frame rate ↓', dir: 'down' },
    { label: 'sector ↓ → frame rate ↑', dir: 'up' },
    { label: 'f ↑ → resolution ↑, penetration ↓', dir: 'down' },
  ]

  const displayDepth = state.depthCm / state.zoom

  return (
    <UsLab
      path="/ultrasound-lab/controls"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Ultrasound console and phantom">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="sliders" size={14} />
                <b>Stage</b> Working console
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Focus
                </span>
                <span>
                  <i style={{ background: 'var(--us-red)' }} /> Penetration limit
                </span>
                <span>
                  <i className="is-dot" style={{ background: '#cbd5e1' }} /> B-mode (greyscale)
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <ConsoleStage
                  scene={scene}
                  settings={settings}
                  phase={api.phase as ConsolePhase}
                  frameRateHz={derived.fr}
                  penetrationCm={Math.min(derived.penetration, bResult?.penetrationCm ?? derived.penetration)}
                  label={`${state.frequencyMHz.toFixed(1)} MHz · ${displayDepth.toFixed(1)} cm · ${
                    state.probe === 'linear' ? 'linear' : 'curvilinear'
                  } · ${derived.fr.toFixed(0)} fps`}
                  onResult={onResult}
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
              <b>Enter manual lab</b> to drive the whole console — and try the preset challenges.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Frame rate', value: derived.fr.toFixed(0), unit: 'Hz', tone: 'green' },
                {
                  label: 'Penetration',
                  value: (bResult ? Math.min(bResult.penetrationCm, derived.penetration) : derived.penetration).toFixed(1),
                  unit: 'cm',
                  tone: 'cyan',
                },
                {
                  label: 'Mechanical index',
                  value: derived.mi.toFixed(2),
                  tone: derived.mi > 0.7 ? 'amber' : undefined,
                },
                {
                  label: 'Thermal index',
                  value: derived.ti.toFixed(2),
                  tone: derived.ti > 0.7 ? 'amber' : undefined,
                },
                { label: 'Axial resolution', value: bResult ? bResult.axialMm.toFixed(2) : '—', unit: 'mm' },
                { label: 'Beam width (mid-field)', value: bResult ? bResult.beamWidthMm.toFixed(1) : '—', unit: 'mm' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Output and gain" icon="sliders" defaultOpen>
            <Slider
              label="Output power"
              unit="%"
              value={Math.round(state.power * 100)}
              min={10}
              max={100}
              step={5}
              onChange={(v) => onPower(v / 100)}
              hint="Drives the transmitted pulse. MI and TI rise with it — the last resort, not the first."
            />
            <Slider
              label="Overall gain"
              unit="dB"
              value={state.gainDb}
              min={10}
              max={60}
              step={1}
              onChange={onGain}
              hint="Receive-side amplification. Free of exposure cost — but it amplifies the noise too."
            />
            <TgcSliders values={state.tgc} onChange={onTgc} />
          </ControlGroup>

          <ControlGroup title="Geometry" icon="beam" defaultOpen>
            <ChipRow
              label="Probe"
              value={state.probe}
              options={[
                { value: 'curvilinear', label: 'Curvilinear (sector)' },
                { value: 'linear', label: 'Linear' },
              ]}
              onChange={onProbe}
            />
            <Slider
              label="Depth"
              unit="cm"
              value={state.depthCm}
              min={3}
              max={20}
              step={0.5}
              decimals={1}
              onChange={onDepth}
              hint={`PRF cap ${Math.floor(derived.prfCap)} Hz → ${derived.fr.toFixed(0)} fps at this sector.`}
            />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={2}
              max={14}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              markers={[
                { value: 3.5, label: '3.5 (abdo)' },
                { value: 12, label: '12 (superficial)' },
              ]}
            />
            <Slider
              label="Focus depth"
              unit="cm"
              value={state.focusCm}
              min={1}
              max={16}
              step={0.5}
              decimals={1}
              onChange={onFocus}
              hint="Place it at, or just below, the region of interest."
            />
            <Slider
              label="Focal zones"
              value={state.focalZones}
              min={1}
              max={4}
              step={1}
              onChange={onZones}
            />
            <Slider
              label="Sector width"
              unit="%"
              value={state.sectorPct}
              min={40}
              max={100}
              step={5}
              onChange={onSector}
              hint="Narrower sector, fewer lines, faster frames."
            />
            <Slider
              label="Zoom"
              unit="×"
              value={state.zoom}
              min={1}
              max={2.5}
              step={0.25}
              decimals={2}
              onChange={onZoom}
            />
          </ControlGroup>

          <ControlGroup title="Processing" icon="spark">
            <Slider
              label="Dynamic range"
              unit="dB"
              value={state.dynamicRangeDb}
              min={30}
              max={90}
              step={5}
              onChange={onDynamicRange}
              hint="Narrow = high contrast; wide = smooth grey. This is contrast resolution."
            />
            <Slider
              label="Persistence"
              unit="%"
              value={Math.round(state.persistence * 100)}
              min={0}
              max={100}
              step={10}
              onChange={(v) => onPersistence(v / 100)}
              hint="Temporal frame averaging. Calms speckle, blurs motion."
            />
            <Slider
              label="Speckle reduction / edge enhancement"
              unit="%"
              value={Math.round(state.speckleReduction * 100)}
              min={0}
              max={100}
              step={10}
              onChange={(v) => onSpeckle(v / 100)}
            />
            <Toggle label="Spatial compounding" checked={state.compounding} onChange={onCompounding} hint="Averages several look angles: less speckle, slightly softer laterally, shadows wash out." />
            <Toggle label="Tissue harmonic imaging" checked={state.harmonics} onChange={onHarmonics} hint="Receive at 2f₀: cleaner cysts, less near-field clutter, reduced penetration." />
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="target" size={13} />
              Preset challenges
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              {CHALLENGES.map((c) => {
                const active = challenge?.id === c.id
                const solved = active && challengeSolved(c.id)
                return (
                  <div key={c.id}>
                    <button
                      type="button"
                      className={active ? 'us-chip is-on' : 'us-chip'}
                      style={{ width: '100%', justifyContent: 'space-between', borderRadius: 8 }}
                      onClick={() => startChallenge(c.id)}
                    >
                      <span style={{ flex: 1, textAlign: 'left' }}>{c.title}</span>
                      {active && (
                        <b
                          style={{
                            color: solved ? 'var(--us-green)' : challenge?.violated ? 'var(--us-red)' : 'var(--us-muted)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {solved ? (
                            <>
                              <UsIcon name="check" size={13} /> Solved
                            </>
                          ) : challenge?.violated ? (
                            'Failed'
                          ) : (
                            'Not yet'
                          )}
                        </b>
                      )}
                    </button>
                    {active && (
                      <p className="us-slider-hint" style={{ marginTop: 4 }}>
                        <strong>Goal:</strong> {c.goal}
                        {challenge?.violated && (
                          <>
                            {' '}
                            <strong style={{ color: 'var(--us-red)' }}>
                              Output power was raised — restart the challenge to try again.
                            </strong>
                          </>
                        )}
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <p className="us-slider-hint">
              Starting a challenge switches to the manual laboratory and mis-sets the console.
            </p>
          </div>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="The deep liver looks too dark. What is the correct FIRST move?"
              options={[
                'Optimise TGC, gain, frequency and focus',
                'Increase output power',
                'Widen the dynamic range',
              ]}
              correct={0}
              explanation={
                <>
                  The receive-side and geometric controls cost the patient <b>nothing</b>: rising
                  TGC, adequate gain, a lower frequency and a deep focus usually rescue the image.
                  Output power raises MI and TI, so it comes <b>last</b> — and dynamic range only
                  re-maps the greys it already has.
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
                A {state.probe === 'linear' ? 'linear' : 'curvilinear'} probe at{' '}
                <b>{state.frequencyMHz.toFixed(1)} MHz</b> imaging to{' '}
                <b>{state.depthCm.toFixed(0)} cm</b>: frame rate <b>{derived.fr.toFixed(0)} Hz</b>,
                MI <b>{derived.mi.toFixed(2)}</b>, TI <b>{derived.ti.toFixed(2)}</b>. Power is at{' '}
                <b>{Math.round(state.power * 100)}%</b> — every echo you brighten with gain instead
                is exposure saved.
              </>
            }
            why={
              <>
                The console is a set of trades. Depth and sector width spend frame rate; frequency
                trades penetration for resolution; focal zones trade temporal for lateral
                resolution. Only <b>output power</b> trades image quality against the{' '}
                <b>patient</b> — which is why it sits apart from every other knob.
              </>
            }
            equation={
              showEquation
                ? `PRF max    = c / (2 × depth) = ${Math.floor(derived.prfCap)} Hz
frame rate = PRF / (lines × zones) = ${Math.floor(derived.prfCap)} / (${derived.lines} × ${state.focalZones}) = ${derived.fr.toFixed(0)} Hz
MI         = p₋ / √f = ${(state.power * 2.2).toFixed(2)} / √${state.frequencyMHz.toFixed(1)} = ${derived.mi.toFixed(2)}
penetration ≈ ${derived.penetration.toFixed(1)} cm at ${state.frequencyMHz.toFixed(1)} MHz (0.5 dB/cm/MHz, two-way)`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                The habit the challenges rehearse: a weak image is fixed with <b>gain, TGC,
                frequency, focus, depth and probe position first</b>. Reach for output power only
                when those are exhausted — and drop it again the moment the question is answered.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Turning up the gain increases the dose to the patient” is <b>FALSE</b> — gain is
                  receive-side amplification and exposure is unchanged. It is <b>output power</b>{' '}
                  that raises MI and TI. Blurring the two is the classic controls trap.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — what each family of controls really does">
            <p>
              <strong>Gain and TGC</strong> act after the echoes have returned. They cannot improve
              signal-to-noise — amplifying both equally leaves the ratio untouched — but they make
              the information already received visible, and TGC does it depth band by depth band.
            </p>
            <p>
              <strong>Frame rate</strong> has exactly four levers: depth, sector width, line
              density and focal zones. The recall collection lists PRF, frame rate and focal zone
              as explicitly <b>operator-controlled</b> — image optimisation is an active skill, not
              a preset.
            </p>
            <p>
              <strong>Dynamic range</strong> is contrast resolution: narrow for punchy
              black-and-white (vessels, cysts), wide for subtle parenchymal work.{' '}
              <strong>Persistence</strong> buys smoothness with temporal blur — protect it around
              anything that moves.
            </p>
            <p>
              <strong>Harmonics</strong> are generated within the tissue by nonlinear propagation,
              so near-field reverberation and weak side lobes contribute almost nothing at 2f₀ —
              that is why the cyst clears. The gain is contrast and clutter, <em>not</em> lateral
              resolution, and penetration is the price.
            </p>

            <TrapNote>
              “B-mode sends one pulse per scan line” is true for a single-focus frame — but select
              multiple focal zones and several pulses go down each line, which is exactly why the
              frame rate divides. The two facts are one mechanism, not a contradiction.
            </TrapNote>

            <SourceNote>
              QBank Q289 (high-yield recall) lists PRF, frame rate and focal zone as operator
              controls; QBank Q446 carries the frame-rate levers; QBank Q379 covers TGC as
              depth-dependent receive gain. The gain-versus-power distinction and the
              “lowest output that answers the question” habit follow the safety sources used by the{' '}
              <Link to="/ultrasound-lab/safety">Bioeffects &amp; Safety laboratory</Link>.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Persistence and spatial compounding are modelled as extra speckle smoothing on a static
            frame — a real machine averages successive frames and look angles, which this still
            image cannot show directly. MI uses a nominal peak pressure proportional to the power
            setting, and TI is the teaching estimate from the engine: the directions and relative
            sizes are faithful; the absolute values are illustrative.
          </ModelNote>
        </>
      }
    />
  )
}
