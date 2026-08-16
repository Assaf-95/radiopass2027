/**
 * Module 14 — Harmonic Imaging.
 *
 * Nonlinear propagation from first principles: the transmitted sine wave leans
 * progressively as it travels, the leaning waveform IS harmonic content, the
 * spectrum grows a 2f₀ peak with depth, and the receiver filter throws the
 * fundamental away. The split-screen B-mode comparison shows the payoff — near
 * -field clutter gone, cysts clean — and the honest cost: a noisier far field,
 * because the harmonic signal is weak.
 */

import { useCallback, useMemo, useState } from 'react'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
import { ControlGroup, Slider, StageFlash, Toggle, useFlash } from '../components/Controls'
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
  HARMONIC_DEPTH_CM,
  HarmonicStage,
  harmonicAmplitudes,
  type HarmonicPhase,
} from '../scenes/HarmonicStage'
import { ratioToDb, wavelengthMm } from '../engine'
import { ASSUMED_SPEED } from '../engine/media'

type State = {
  frequencyMHz: number
  amplitude: number
  observeDepthCm: number
  harmonicsOn: boolean
}

const DEFAULTS: State = {
  frequencyMHz: 3.5,
  amplitude: 0.75,
  observeDepthCm: 5,
  harmonicsOn: true,
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'transmit',
    title: 'The probe transmits a pure fundamental',
    phase: 'transmit',
    state: { frequencyMHz: 3.5, amplitude: 0.75, observeDepthCm: 0.4 },
    caption: (state) => (
      <>
        At the probe face the wave is a clean sine at <b>f₀ = {state.frequencyMHz.toFixed(1)} MHz</b>{' '}
        — and that is ALL the probe ever emits. The spectrum below shows a single peak. Whatever
        appears at 2f₀ later has to be made <b>somewhere else</b>.
      </>
    ),
  },
  {
    id: 'distort',
    title: 'The waveform distorts as it propagates',
    phase: 'distort',
    state: { observeDepthCm: 5 },
    duration: 1.8,
    caption: (
      <>
        Sound travels marginally faster through the <b>compressed</b> half of each cycle than the{' '}
        <b>rarefied</b> half, so the peaks slowly catch up on the troughs. The sine leans towards a
        sawtooth — and the lean is <b>cumulative</b>: the deeper the wave has travelled, the more
        distorted it is.
      </>
    ),
  },
  {
    id: 'spectrum',
    title: 'Distortion IS harmonic content',
    phase: 'spectrum',
    state: { observeDepthCm: 7 },
    duration: 1.6,
    caption: (state) => {
      const d = Math.min(1, state.amplitude * 1.5 * (state.observeDepthCm / HARMONIC_DEPTH_CM))
      const { a2 } = harmonicAmplitudes(d)
      return (
        <>
          A leaning waveform is no longer a single frequency. Fourier decomposes it into f₀ plus
          multiples: at {state.observeDepthCm.toFixed(0)} cm the second harmonic has grown to about{' '}
          <b>{Math.round(a2 * 100)}%</b> of the fundamental. The harmonics were{' '}
          <b>generated in the tissue</b>, progressively, with depth.
        </>
      )
    },
  },
  {
    id: 'receive',
    title: 'Receive at 2f₀, reject f₀',
    phase: 'receive',
    state: { observeDepthCm: 6 },
    duration: 1.4,
    caption: (
      <>
        The receiver filter accepts a band around <b>2f₀</b> and rejects the fundamental. Everything
        that never generated harmonics — reverberation clutter bouncing near the probe, weak
        side-lobe echoes — carries <b>no 2f₀ content</b>, so the filter silently deletes it.
      </>
    ),
  },
  {
    id: 'compare',
    title: 'Fundamental against harmonic, same anatomy',
    phase: 'compare',
    state: { harmonicsOn: true },
    duration: 1.4,
    caption: (
      <>
        The two B-mode panels share one phantom: a cyst under near-field clutter. On the{' '}
        <b>fundamental</b> image the cyst fills with haze; on the <b>harmonic</b> image it clears,
        because the clutter had no harmonic content to be received. That is a gain in{' '}
        <b>contrast resolution</b>.
      </>
    ),
  },
  {
    id: 'tradeoffs',
    title: 'The honest cost: a weak signal at depth',
    phase: 'tradeoffs',
    duration: 1.4,
    caption: (
      <>
        The harmonic is always far <b>weaker</b> than the fundamental, so the harmonic image runs
        closer to the noise floor: look at the <b>far field</b> of the right-hand panel. Harmonics
        buy contrast and clutter rejection — they do not buy penetration, and they do not sharpen
        the beam sideways.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Drive the nonlinearity yourself',
    phase: 'free',
    caption: (
      <>
        Raise the <b>output amplitude</b> and watch the distortion — and the 2f₀ bar — grow:
        nonlinearity is a <b>finite-amplitude</b> effect. Slide the observation depth to see the
        harmonic build with distance, and toggle the harmonic panel to compare images.
      </>
    ),
  },
]

export default function HarmonicsPage() {
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
    const distortion = Math.min(1, state.amplitude * 1.5 * (state.observeDepthCm / HARMONIC_DEPTH_CM))
    const { a1, a2, a3 } = harmonicAmplitudes(distortion)
    return {
      distortion,
      a1,
      a2,
      a3,
      // How far below the fundamental the harmonic sits, in dB.
      harmonicDb: a2 > 0 ? ratioToDb(a2 / a1) : Infinity,
      lambda: wavelengthMm(ASSUMED_SPEED, state.frequencyMHz),
      harmonicLambda: wavelengthMm(ASSUMED_SPEED, 2 * state.frequencyMHz),
    }
  }, [state.amplitude, state.observeDepthCm, state.frequencyMHz])

  /* --- controls announce their consequence -------------------------------- */

  const onAmplitude = (value: number) => {
    const up = value > state.amplitude
    patch({ amplitude: value })
    flash.fire([
      { text: up ? 'Output amplitude increased' : 'Output amplitude decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Waveform distortion grows' : 'Waveform distortion shrinks', dir: up ? 'up' : 'down' },
      { text: up ? 'Harmonic generation rises' : 'Harmonic generation falls', dir: up ? 'up' : 'down' },
      { text: up ? 'Patient exposure rises' : 'Patient exposure falls', dir: up ? 'warn' : 'up' },
    ])
  }

  const onDepth = (value: number) => {
    const up = value > state.observeDepthCm
    patch({ observeDepthCm: value })
    flash.fire([
      { text: up ? 'Observing deeper' : 'Observing shallower', dir: up ? 'up' : 'down' },
      { text: up ? 'Cumulative distortion rises' : 'Cumulative distortion falls', dir: up ? 'up' : 'down' },
      { text: up ? '2f₀ peak grows' : '2f₀ peak shrinks', dir: up ? 'up' : 'down' },
      { text: 'Transmitted f₀ unchanged', dir: 'flat' },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'f₀ increased' : 'f₀ decreased', dir: up ? 'up' : 'down' },
      { text: `Receive band now ${(2 * value).toFixed(1)} MHz`, dir: 'flat' },
      { text: up ? 'Attenuation of 2f₀ rises' : 'Attenuation of 2f₀ falls', dir: up ? 'warn' : 'up' },
    ])
  }

  const onHarmonics = (value: boolean) => {
    patch({ harmonicsOn: value })
    flash.fire([
      { text: value ? 'Harmonic mode ON' : 'Harmonic mode OFF', dir: 'flat' },
      { text: value ? 'Near-field clutter suppressed' : 'Near-field clutter returns', dir: value ? 'up' : 'warn' },
      { text: value ? 'Contrast resolution improves' : 'Contrast resolution falls', dir: value ? 'up' : 'down' },
      { text: value ? 'Far field slightly noisier' : 'Far field cleaner', dir: value ? 'warn' : 'up' },
    ])
  }

  /* --- the shared B-mode phantom ------------------------------------------ */

  const scene: BModeScene = useMemo(
    () => ({
      widthCm: 4,
      depthCm: 8,
      background: 0.34,
      backgroundAttenuation: 0.5,
      targets: [
        // The cyst that clutter loves to fill.
        { x: 0, depthCm: 2.6, radiusCm: 0.8, echogenicity: 0.02, attenuation: 0.02, scatter: 0.1 },
        // A deep reflector to judge penetration honestly.
        { x: -0.4, depthCm: 6.4, radiusCm: 0.25, echogenicity: 0.7, scatter: 0.4 },
      ],
    }),
    [],
  )

  const fundamentalSettings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 34,
      dynamicRangeDb: 55,
      focusCm: [3],
      apertureMm: 12,
      cycles: 2,
      power: state.amplitude,
      harmonics: false,
      noise: 0.06,
    }),
    [state.frequencyMHz, state.amplitude],
  )

  const harmonicSettings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 34,
      dynamicRangeDb: 55,
      focusCm: [3],
      apertureMm: 12,
      cycles: 2,
      power: state.amplitude,
      harmonics: state.harmonicsOn,
      // The harmonic signal is weak, so the harmonic image sits closer to the
      // noise floor — the honest penetration cost.
      noise: state.harmonicsOn ? 0.17 : 0.06,
    }),
    [state.frequencyMHz, state.amplitude, state.harmonicsOn],
  )

  const deltas: Delta[] = [
    { label: 'amplitude ↑ → distortion ↑ → 2f₀ ↑', dir: 'up' },
    { label: 'depth ↑ → cumulative 2f₀ ↑', dir: 'up' },
    { label: 'clutter ↓ (no harmonic content)', dir: 'up' },
    { label: 'contrast resolution ↑', dir: 'up' },
    { label: 'penetration ↓ (weak signal)', dir: 'down' },
    { label: 'lateral resolution — not the benefit', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/harmonics"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Nonlinear propagation stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="harmonic" size={14} />
                <b>Stage</b> Nonlinear propagation
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> f₀
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> 2f₀
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Observation depth
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <HarmonicStage
                  frequencyMHz={state.frequencyMHz}
                  amplitude={state.amplitude}
                  observeDepthCm={state.observeDepthCm}
                  time={clock}
                  phase={api.mode === 'manual' ? 'free' : (api.phase as HarmonicPhase)}
                />
              </div>
              <div
                style={{
                  flex: '0 0 190px',
                  maxWidth: 190,
                  minWidth: 130,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div className="us-canvas-wrap" style={{ flex: 1 }}>
                  <BMode scene={scene} settings={fundamentalSettings} label="Fundamental f₀" />
                </div>
                <div className="us-canvas-wrap" style={{ flex: 1 }}>
                  <BMode
                    scene={scene}
                    settings={harmonicSettings}
                    label={state.harmonicsOn ? 'Harmonic 2f₀' : 'Harmonic OFF'}
                  />
                </div>
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
              <b>Enter manual lab</b> to drive amplitude, depth and the receive filter yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Transmitted f₀', value: state.frequencyMHz.toFixed(1), unit: 'MHz', tone: 'cyan' },
                { label: 'Received 2f₀', value: (2 * state.frequencyMHz).toFixed(1), unit: 'MHz', tone: 'green' },
                { label: 'Distortion at marker', value: (derived.distortion * 100).toFixed(0), unit: '%' },
                { label: '2f₀ level', value: (derived.a2 * 100).toFixed(0), unit: '% of f₀ scale', tone: 'green' },
                {
                  label: '2f₀ below f₀',
                  value: Number.isFinite(derived.harmonicDb) ? derived.harmonicDb.toFixed(1) : '—',
                  unit: 'dB',
                  tone: 'amber',
                },
                { label: 'λ at f₀', value: derived.lambda.toFixed(2), unit: 'mm' },
                { label: 'λ at 2f₀', value: derived.harmonicLambda.toFixed(2), unit: 'mm' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Transmit" icon="wave" defaultOpen>
            <Slider
              label="Output amplitude"
              unit="%"
              value={Math.round(state.amplitude * 100)}
              min={10}
              max={100}
              step={5}
              onChange={(v) => onAmplitude(v / 100)}
              hint="Nonlinearity is a finite-amplitude effect: more pressure, more distortion, more harmonic."
            />
            <Slider
              label="Transmit frequency f₀"
              unit="MHz"
              value={state.frequencyMHz}
              min={1.5}
              max={6}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="The probe needs the bandwidth to RECEIVE 2f₀ — one reason harmonic probes are broadband."
            />
          </ControlGroup>

          <ControlGroup title="Observe" icon="eye" defaultOpen>
            <Slider
              label="Observation depth"
              unit="cm"
              value={state.observeDepthCm}
              min={0.5}
              max={9.5}
              step={0.5}
              decimals={1}
              onChange={onDepth}
              hint="Distortion accumulates with distance travelled, so the 2f₀ peak grows with depth."
            />
            <Toggle
              label="Harmonic mode in the right panel"
              checked={state.harmonicsOn}
              onChange={onHarmonics}
              hint="Switch it off and the near-field clutter floods straight back into the cyst."
            />
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Where is the second harmonic created?"
              options={[
                'In the tissue, progressively with depth',
                'In the transducer, alongside the fundamental',
                'In the receiver amplifier electronics',
              ]}
              correct={0}
              explanation={
                <>
                  The probe transmits <b>only f₀</b>. The harmonic grows out of the wave itself as
                  it propagates — compression travels slightly faster than rarefaction, the
                  waveform leans, and the lean IS harmonic content. That is why there is almost no
                  harmonic in the near field, and why near-field clutter vanishes on harmonic
                  imaging.
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
                A {state.frequencyMHz.toFixed(1)} MHz wave at {Math.round(state.amplitude * 100)}%
                output has accumulated <b>{(derived.distortion * 100).toFixed(0)}%</b> of full
                distortion by {state.observeDepthCm.toFixed(1)} cm, putting the second harmonic
                about <b>{Number.isFinite(derived.harmonicDb) ? derived.harmonicDb.toFixed(0) : '—'} dB</b>{' '}
                below the fundamental. The receiver keeps the band around{' '}
                <b>{(2 * state.frequencyMHz).toFixed(1)} MHz</b> and discards the rest.
              </>
            }
            why={
              <>
                Propagation speed rises slightly with the local pressure, so the compression peaks
                gain on the rarefaction troughs cycle after cycle. A wave that started as a pure
                sine arrives at depth as a leaning near-sawtooth — and a leaning waveform contains
                multiples of f₀. Clutter and side-lobe echoes are too weak ever to distort, which is
                exactly why filtering for 2f₀ deletes them.
              </>
            }
            equation={
              showEquation
                ? `transmit:  f₀ = ${state.frequencyMHz.toFixed(1)} MHz   (the probe emits nothing else)
receive:   2f₀ = ${(2 * state.frequencyMHz).toFixed(1)} MHz
distortion at ${state.observeDepthCm.toFixed(1)} cm ∝ amplitude × distance = ${(derived.distortion * 100).toFixed(0)} %
2f₀ level ≈ ${(derived.a2 * 100).toFixed(0)} %  →  ${Number.isFinite(derived.harmonicDb) ? derived.harmonicDb.toFixed(1) : '—'} dB below f₀`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Harmonic imaging is the default in technically difficult abdominal and cardiac
                scanning: cysts and chambers clear of haze, and lesion conspicuity improves because
                the gain is in <b>contrast</b>. Expect to give a little penetration back — the
                harmonic is weak, and at depth the image runs out of signal sooner.
              </>
            }
            trap={
              showTrap ? (
                <>
                  Two favourites from the question bank: the probe does <b>NOT</b> transmit the
                  harmonic — tissue creates it (QBank Q412); and harmonic imaging improves{' '}
                  <b>contrast</b> resolution, not lateral resolution (QBank Q422).
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — why the filter works, and pulse inversion">
            <p>
              <strong>Harmonics need amplitude and distance.</strong> Distortion is proportional to
              the local pressure and accumulates along the path. Near the probe there has been no
              path; in weak echoes there is no pressure. Both facts favour the deep, strong main
              beam and starve the clutter.
            </p>
            <p>
              <strong>So harmonic imaging has a window, not a monotonic benefit.</strong> It is
              weakest <em>superficially</em>, where the wave has not yet travelled far enough to
              lean — which is exactly why near-field clutter drops out. It then fades again at{' '}
              <em>great depth</em>, because the returning 2f₀ signal is at double the frequency and
              therefore attenuates roughly twice as fast per centimetre as the fundamental it came
              from. The useful harmonic signal lives in the middle.
            </p>
            <p>
              <strong>The filter has a rival technique.</strong> <b>Pulse inversion</b> is a
              specific transmission technique: two pulses are sent down each line, the second an
              inverted copy of the first, and the echoes are summed. The fundamental — linear —
              cancels exactly, while the harmonic — generated identically by both pulses — adds.
              It removes the fundamental more cleanly than any filter and preserves bandwidth, at
              the cost of halving frame rate.
            </p>
            <p>
              <strong>Receiving at 2f₀ is not a free frequency upgrade.</strong> The received band
              is higher, but the transmit beam that generated it is still the f₀ beam, and the
              harmonic signal is weak. The measurable wins are in clutter, haze and contrast
              resolution — which is precisely how the exam words it.
            </p>

            <TrapNote>
              “Tissue harmonics are transmitted by the probe” and “harmonic imaging improves
              lateral resolution” are both marked <b>FALSE</b> in the question bank. The harmonic
              is made <em>in the tissue</em>, and the benefit is <em>contrast</em>, not beam width.
            </TrapNote>

            <SourceNote>
              QBank Q412 and Q422 carry the harmonic stems: generation in tissue by nonlinear
              propagation, near-field clutter suppression, and the contrast-not-lateral benefit.
              The harmonic percentages drawn on this stage follow a leaning-sawtooth teaching
              model; real levels vary with machine and tissue, but the direction — growth with
              amplitude and with depth — is the examinable physics.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The waveform lean is exaggerated so it can be watched; real distortion at diagnostic
            levels is subtler, and the 2f₀ signal genuinely sits tens of decibels below the
            fundamental. The spectrum uses a fixed three-term series — direction and depth
            dependence are faithful, the exact percentages are illustrative.
          </ModelNote>
        </>
      }
    />
  )
}
