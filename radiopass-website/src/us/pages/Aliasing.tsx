/**
 * Module 12 — PRF, Nyquist & Aliasing.
 *
 * The sampling laboratory. A pulsed Doppler system only glimpses the moving
 * blood once per pulse, so it can only reconstruct a shift it samples at least
 * twice per cycle. This page shows the true motion and the reconstruction side
 * by side, wraps the spectrum with the same engine arithmetic the readouts
 * use, and — crucially — separates the fixes that genuinely raise the Nyquist
 * limit from the one that only moves the display.
 */

import { useCallback, useMemo, useState } from 'react'

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
import { AliasingStage, type AliasingPhase } from '../scenes/AliasingStage'
import {
  aliasedShiftHz,
  dopplerShiftHz,
  isAliasing,
  maxPrfHz,
  maxVelocityMs,
  nyquistLimitHz,
} from '../engine'

type State = {
  velocityMs: number
  frequencyMHz: number
  prfHz: number
  depthCm: number
  angleDeg: number
  baselineShift: number
  cw: boolean
}

const DEFAULTS: State = {
  velocityMs: 0.4,
  frequencyMHz: 4,
  prfHz: 9000,
  depthCm: 3,
  angleDeg: 30,
  baselineShift: 0,
  cw: false,
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'sampling',
    title: 'Adequate sampling reconstructs the motion correctly',
    phase: 'sampling',
    state: { ...DEFAULTS },
    caption: (state) => {
      const shift = dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg)
      return (
        <>
          A pulsed system only observes the blood <b>once per pulse</b> — at the PRF. Here the
          shift is <b>{shift.toFixed(0)} Hz</b> and the PRF is <b>{state.prfHz} Hz</b>, giving{' '}
          <b>{(state.prfHz / shift).toFixed(1)} samples per cycle</b>. The dashed amber
          reconstruction lies on top of the true cyan motion: sampling is adequate.
        </>
      )
    },
  },
  {
    id: 'undersampled',
    title: 'Drop the PRF and the reconstruction goes wrong',
    phase: 'undersampled',
    duration: 1.6,
    state: { prfHz: 2500, velocityMs: 0.4, frequencyMHz: 4, angleDeg: 30, cw: false },
    caption: (state) => {
      const shift = dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg)
      return (
        <>
          Same flow, but now only <b>{(state.prfHz / shift).toFixed(1)} samples per cycle</b> —
          below the required two. The samples still lie on the true curve, yet the only smooth wave
          that fits them runs at the <b>wrong, lower — even reversed — frequency</b>. This is the
          wagon-wheel effect, and the wheel on the left is spinning it backwards.
        </>
      )
    },
  },
  {
    id: 'nyquist',
    title: 'The Nyquist limit is half the PRF',
    phase: 'nyquist',
    duration: 1.4,
    state: { prfHz: 4000, velocityMs: 0.5, frequencyMHz: 4, angleDeg: 30, cw: false },
    caption: (state) => (
      <>
        The red dashed lines mark <b>±PRF/2 = ±{(nyquistLimitHz(state.prfHz) / 1000).toFixed(1)} kHz</b>{' '}
        — the largest shift this PRF can represent. The systolic peak now crosses the line, and the
        moment it does, the trace <b>wraps to the opposite side</b> of the baseline.
      </>
    ),
  },
  {
    id: 'wraparound',
    title: 'Wraparound: spectral and colour aliasing together',
    phase: 'wraparound',
    duration: 1.6,
    state: { prfHz: 4000, velocityMs: 0.6, frequencyMHz: 4, angleDeg: 30, cw: false },
    caption: (
      <>
        On the spectrum the peak is decapitated and pasted below the baseline. In the colour box the
        stenotic jet — where continuity forces the velocity up — crosses the limit and goes{' '}
        <b>mosaic</b>: wrapped hues speckled against true ones. Same arithmetic, two displays.
      </>
    ),
  },
  {
    id: 'fixes',
    title: 'Which fixes raise the limit — and which only move the display',
    phase: 'fixes',
    duration: 1.4,
    state: { prfHz: 4000, velocityMs: 0.5, frequencyMHz: 4, angleDeg: 30, cw: false },
    caption: (
      <>
        <b>True fixes</b> raise the Nyquist limit or shrink the shift: <b>increase the PRF</b>{' '}
        (capped by depth), <b>reduce the depth</b>, <b>lower the transmit frequency</b>, or{' '}
        <b>switch to CW</b>, which cannot alias. <b>Baseline shift</b> is different: it re-allocates
        the existing display range and the limit is <b>unchanged</b> — though that can be enough to
        unwrap a spectrum that only just exceeds it.
      </>
    ),
  },
  {
    id: 'physiological',
    title: 'Ordinary velocities alias too',
    phase: 'physiological',
    duration: 1.4,
    state: { velocityMs: 0.3, depthCm: 6, frequencyMHz: 5, prfHz: 3000, angleDeg: 30, cw: false },
    caption: (state) => {
      const shift = dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg)
      return (
        <>
          A completely physiological <b>30 cm/s</b> at 6 cm depth, 5 MHz, and a modest scale:
          the shift is <b>{shift.toFixed(0)} Hz</b> against a Nyquist limit of{' '}
          <b>{nyquistLimitHz(state.prfHz).toFixed(0)} Hz</b> — aliased. The question bank makes
          exactly this point: aliasing is <b>not</b> proof of pathological velocity.
        </>
      )
    },
  },
  {
    id: 'free',
    title: 'The sampling laboratory is yours',
    phase: 'free',
    caption: (
      <>
        Push the PRF into the depth cap and meet range ambiguity, watch the samples-per-cycle
        readout cross two, and flip to CW to make aliasing impossible. Every wrap on screen is the
        same <b>aliasedShiftHz</b> arithmetic as the readouts.
      </>
    ),
  },
]

export default function AliasingPage() {
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
    const shift = dopplerShiftHz(state.frequencyMHz, state.velocityMs, state.angleDeg)
    const prfCap = maxPrfHz(state.depthCm * 10)
    const nyquist = nyquistLimitHz(state.prfHz)
    const displayed = state.cw ? shift : aliasedShiftHz(shift, state.prfHz)
    const aliasing = !state.cw && isAliasing(shift, state.prfHz)
    const maxV = maxVelocityMs(state.prfHz, state.frequencyMHz, state.angleDeg)
    const samplesPerCycle = shift > 0 ? state.prfHz / shift : Number.POSITIVE_INFINITY
    return { shift, prfCap, nyquist, displayed, aliasing, maxV, samplesPerCycle }
  }, [state])

  /* --- controls announce their consequence immediately ------------------- */

  const onVelocity = (v: number) => {
    const up = v > state.velocityMs
    patch({ velocityMs: v })
    const willAlias = !state.cw && isAliasing(
      dopplerShiftHz(state.frequencyMHz, v, state.angleDeg),
      state.prfHz,
    )
    flash.fire([
      { text: up ? 'Velocity increased' : 'Velocity decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Shift rises towards the limit' : 'Shift falls from the limit', dir: up ? 'warn' : 'down' },
      willAlias
        ? { text: 'Shift exceeds PRF/2 — aliasing', dir: 'warn' }
        : { text: 'Within the Nyquist limit', dir: 'up' },
    ])
  }

  const onFrequency = (v: number) => {
    const up = v > state.frequencyMHz
    patch({ frequencyMHz: v })
    flash.fire([
      { text: up ? 'Transmit frequency increased' : 'Transmit frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Bigger shift for the same velocity' : 'Smaller shift for the same velocity', dir: up ? 'up' : 'down' },
      { text: up ? 'Aliasing MORE likely' : 'Aliasing less likely — a true fix', dir: up ? 'warn' : 'up' },
      { text: 'Nyquist limit itself unchanged', dir: 'flat' },
    ])
  }

  const onPrf = (v: number) => {
    const cap = maxPrfHz(state.depthCm * 10)
    const clamped = Math.min(v, Math.floor(cap))
    const up = clamped > state.prfHz
    patch({ prfHz: clamped })
    const items = [
      { text: up ? 'PRF increased' : 'PRF decreased', dir: up ? 'up' : 'down' } as const,
      { text: up ? 'Nyquist limit raised — a true fix' : 'Nyquist limit lowered', dir: up ? 'up' : 'warn' } as const,
    ]
    flash.fire(
      v >= cap
        ? [
            ...items,
            { text: 'At the depth cap — pulses would overlap', dir: 'warn' },
            { text: 'Any higher → range ambiguity', dir: 'warn' },
          ]
        : [...items],
    )
  }

  const onDepth = (v: number) => {
    const up = v > state.depthCm
    const cap = Math.floor(maxPrfHz(v * 10))
    const clampedPrf = Math.min(state.prfHz, cap)
    patch({ depthCm: v, prfHz: clampedPrf })
    const items = [
      { text: up ? 'Depth increased' : 'Depth reduced', dir: up ? 'up' : 'down' } as const,
      { text: up ? 'Listening time longer → PRF cap falls' : 'PRF cap rises — a true fix', dir: up ? 'down' : 'up' } as const,
    ]
    flash.fire(
      clampedPrf < state.prfHz
        ? [...items, { text: `PRF forced down to ${clampedPrf} Hz`, dir: 'warn' }]
        : [...items],
    )
  }

  const onBaseline = (v: number) => {
    patch({ baselineShift: v })
    flash.fire([
      { text: 'Baseline shifted', dir: 'flat' },
      { text: 'Display range re-allocated', dir: 'flat' },
      { text: 'Nyquist limit UNCHANGED', dir: 'warn' },
    ])
  }

  const onAngle = (v: number) => {
    const up = v > state.angleDeg
    patch({ angleDeg: v })
    flash.fire([
      { text: `Angle ${v}° — cos θ = ${Math.cos((v * Math.PI) / 180).toFixed(2)}`, dir: 'flat' },
      { text: up ? 'Shift falls — less likely to alias' : 'Shift rises — more likely to alias', dir: up ? 'down' : 'warn' },
      { text: up ? 'But velocity accuracy degrades — not an accepted fix' : 'Velocity accuracy improves', dir: up ? 'warn' : 'up' },
    ])
  }

  const onCw = (v: boolean) => {
    patch({ cw: v })
    flash.fire(
      v
        ? [
            { text: 'Continuous wave selected', dir: 'flat' },
            { text: 'Sampling is continuous — cannot alias', dir: 'up' },
            { text: 'Range resolution lost — whole line heard', dir: 'warn' },
          ]
        : [
            { text: 'Pulsed wave selected', dir: 'flat' },
            { text: 'Range gate restored', dir: 'up' },
            { text: 'Nyquist limit applies again', dir: 'warn' },
          ],
    )
  }

  const deltas: Delta[] = [
    { label: 'PRF ↑ → Nyquist ↑ (true fix)', dir: 'up' },
    { label: 'depth ↓ → PRF cap ↑ (true fix)', dir: 'up' },
    { label: 'f₀ ↓ → shift ↓ (true fix)', dir: 'up' },
    { label: 'CW → cannot alias', dir: 'up' },
    { label: 'baseline shift → limit unchanged', dir: 'flat' },
    { label: 'depth ↑ → Nyquist ↓', dir: 'down' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/aliasing"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Sampling and aliasing stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="alias" size={14} />
                <b>Stage</b> Sampling laboratory
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> True motion
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Reconstruction
                </span>
                <span>
                  <i style={{ background: 'var(--us-red)' }} /> Nyquist limit
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <AliasingStage
                  velocityMs={state.velocityMs}
                  frequencyMHz={state.frequencyMHz}
                  prfHz={state.prfHz}
                  depthCm={state.depthCm}
                  angleDeg={state.angleDeg}
                  baselineShift={state.baselineShift}
                  cw={state.cw}
                  time={clock}
                  phase={api.phase as AliasingPhase}
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
              <b>Enter manual lab</b> to fight the Nyquist limit with every control.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Doppler shift Δf', value: (derived.shift / 1000).toFixed(3), unit: 'kHz', tone: 'cyan' },
                {
                  label: 'Nyquist limit (PRF/2)',
                  value: (derived.nyquist / 1000).toFixed(2),
                  unit: 'kHz',
                  tone: derived.aliasing ? 'red' : 'green',
                },
                {
                  label: 'Max velocity (no alias)',
                  value: Number.isFinite(derived.maxV) ? derived.maxV.toFixed(2) : '—',
                  unit: 'm/s',
                },
                {
                  label: 'Samples per cycle',
                  value: Number.isFinite(derived.samplesPerCycle)
                    ? derived.samplesPerCycle.toFixed(1)
                    : '∞',
                  tone: !state.cw && derived.samplesPerCycle < 2 ? 'amber' : 'cyan',
                },
                {
                  label: 'Displayed shift',
                  value: (derived.displayed / 1000).toFixed(3),
                  unit: 'kHz',
                  tone: derived.aliasing ? 'amber' : undefined,
                },
                { label: 'PRF cap at this depth', value: Math.floor(derived.prfCap), unit: 'Hz' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="The flow being sampled" icon="flow" defaultOpen>
            <Slider
              label="Flow velocity"
              unit="m/s"
              value={state.velocityMs}
              min={0.05}
              max={2}
              step={0.05}
              decimals={2}
              onChange={onVelocity}
              markers={[{ value: 0.3, label: '0.3 (physiological)' }]}
            />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={2}
              max={10}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Δf ∝ f₀ — a higher transmit frequency produces a bigger shift and makes aliasing MORE likely."
            />
            <Slider
              label="Beam–flow angle"
              unit="°"
              value={state.angleDeg}
              min={0}
              max={85}
              step={1}
              onChange={onAngle}
              hint="Opening the angle shrinks the shift and can hide aliasing — but the velocity error explodes, so it is not an accepted fix."
            />
          </ControlGroup>

          <ControlGroup title="The sampling system" icon="alias" defaultOpen>
            <Slider
              label="Pulse repetition frequency"
              unit="Hz"
              value={state.prfHz}
              min={500}
              max={20000}
              step={100}
              onChange={onPrf}
              hint={`Capped at ${Math.floor(derived.prfCap)} Hz by the ${state.depthCm} cm depth: every echo must return before the next pulse leaves.`}
            />
            <Slider
              label="Imaging depth"
              unit="cm"
              value={state.depthCm}
              min={1}
              max={15}
              step={0.5}
              decimals={1}
              onChange={onDepth}
              hint="PRF max = c / (2 × depth). Going deeper silently drags the Nyquist limit down with it."
            />
            <Slider
              label="Baseline shift"
              value={state.baselineShift}
              min={-0.8}
              max={0.8}
              step={0.05}
              decimals={2}
              onChange={onBaseline}
              hint="Moves the zero line to re-allocate the SAME span. A display manoeuvre — the limit does not move."
            />
            <Toggle
              label="Continuous wave"
              checked={state.cw}
              onChange={onCw}
              hint="Two elements, continuous sampling: no Nyquist limit, no aliasing — and no idea what depth the signal came from."
            />
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Which change genuinely raises the Nyquist limit?"
              options={['Increase the PRF', 'Shift the baseline', 'Increase spectral gain']}
              correct={0}
              explanation={
                <>
                  The limit <b>is</b> PRF/2, so only the PRF moves it — and depth caps how far.
                  Baseline shift re-allocates the display around an unchanged limit, and gain has
                  nothing to do with sampling at all.
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
                A shift of <b>{(derived.shift / 1000).toFixed(2)} kHz</b> is being sampled at{' '}
                <b>{state.prfHz} Hz</b>
                {state.cw ? (
                  <>
                    {' '}
                    — except it is not: <b>CW samples continuously</b>, so the reconstruction is
                    exact at any velocity.
                  </>
                ) : derived.aliasing ? (
                  <>
                    , beyond the <b>{(derived.nyquist / 1000).toFixed(2)} kHz</b> limit — the
                    display wraps to <b>{(derived.displayed / 1000).toFixed(2)} kHz</b>.
                  </>
                ) : (
                  <>
                    , inside the <b>{(derived.nyquist / 1000).toFixed(2)} kHz</b> limit — the
                    reconstruction is faithful.
                  </>
                )}
              </>
            }
            why={
              <>
                To know a wave's frequency you must catch it at least <b>twice per cycle</b>.
                Sampled less often, the recorded points are equally consistent with a slower — or
                reversed — wave, and the machine has no way to tell the difference. The display does
                not fail loudly; it confidently shows the wrong answer.
              </>
            }
            equation={
              showEquation
                ? `Nyquist limit = PRF / 2 = ${state.prfHz} / 2 = ${(derived.nyquist / 1000).toFixed(2)} kHz
Δf            = 2 f₀ v cos θ / c = ${(derived.shift / 1000).toFixed(2)} kHz   ${
                    state.cw ? '(CW: never wraps)' : derived.aliasing ? '→ WRAPS' : '(within limit)'
                  }
PRF max       = c / (2 × depth) = ${Math.floor(derived.prfCap)} Hz at ${state.depthCm} cm
samples/cycle = PRF / Δf = ${
                    Number.isFinite(derived.samplesPerCycle) ? derived.samplesPerCycle.toFixed(1) : '∞'
                  }   (need ≥ 2)`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Mosaic colour in a jet suggests high velocity <b>only after</b> you have checked the
                scale: a low PRF makes normal flow alias too. Fix it in order — scale up, baseline
                down, depth down, lower-frequency probe, CW if you only need the peak velocity.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Aliasing occurs only at abnormally high velocities” is <b>FALSE</b>: the recall
                  collection uses an ordinary <b>30 cm/s</b> to make the point. And “a higher
                  transmit frequency reduces aliasing” is <b>FALSE</b> — Δf ∝ f₀, so it makes it
                  worse.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the fix list, honestly sorted">
            <p>
              <strong>True fixes raise the limit or shrink the shift.</strong> Increase the{' '}
              <b>PRF/scale</b> (the limit is PRF/2 by definition — but depth caps the PRF); reduce
              the <b>depth</b> (raises that cap); lower the <b>transmit frequency</b> (Δf ∝ f₀, so
              the same flow produces a smaller shift); switch to <b>CW</b> (continuous sampling has
              no limit at all).
            </p>
            <p>
              <strong>Baseline shift is a display manoeuvre.</strong> The unambiguous span is one
              whole PRF; the baseline decides how much of it faces forward and how much reverse.
              Shifting it can unwrap a spectrum that only just exceeds the limit, but the span never
              grows.
            </p>
            <p>
              <strong>The angle "fix" is a trap of its own.</strong> Opening θ towards 90° does
              shrink the shift and can remove the wrap — but the machine divides by cos θ to recover
              velocity, so the measurement error explodes. The question bank marks it FALSE as an
              accepted fix for exactly that reason.
            </p>
            <p>
              <strong>Range ambiguity is the price of a greedy PRF.</strong> At the depth cap, the
              deepest echoes arrive after the next pulse has left, and the machine files them at a
              falsely shallow depth. The PRF slider on this page refuses to cross that line.
            </p>

            <TrapNote>
              “Aliasing does not occur during continuous-wave Doppler” is <b>TRUE</b> — a stem worth
              recognising quickly rather than second-guessing. CW pays for it with the loss of all
              range resolution.
            </TrapNote>

            <SourceNote>
              QBank Q119, Q210, Q322 and Q422 (high-yield) carry the Nyquist and aliasing
              stems, including the 30 cm/s physiological example. QBank Q422's printed explanation
              of the angle fix contradicts itself — it suggests <em>reducing</em> the angle, which
              would raise cos θ and make aliasing <b>worse</b>; the exam verdict (not an accepted
              fix) stands, but for the accuracy reason given above. QBank Q413 marks “higher
              operating frequency reduces aliasing” FALSE.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            One sample interval of real Doppler time is stretched to nearly a second of screen time
            so the sampling can be watched. The reconstructed waveform is mathematically honest: a
            sinusoid at Δf − n·PRF passes through exactly the same sample values as the true one,
            which is the entire reason aliasing exists.
          </ModelNote>
        </>
      }
    />
  )
}
