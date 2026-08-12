/**
 * Module 15 — Contrast Agents.
 *
 * The microbubble chamber: scale (micrometres against a wavelength of hundreds
 * of micrometres), resonance, the three pressure regimes — linear, nonlinear,
 * destruction — and destruction–replenishment perfusion imaging. The MI on the
 * stage is computed by the engine from the pressure and frequency the learner
 * sets, and every regime boundary is driven by it.
 */

import { useCallback, useMemo, useState } from 'react'

import { ControlGroup, Slider, StageFlash, useFlash } from '../components/Controls'
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
  ContrastStage,
  type BubbleRegime,
  type ContrastPhase,
} from '../scenes/ContrastStage'
import { mechanicalIndex, pulseDurationUs, wavelengthMm } from '../engine'
import { ASSUMED_SPEED } from '../engine/media'

type State = {
  pressureMPa: number
  frequencyMHz: number
  bubbleDiameterUm: number
  cycles: number
  /** Clock time of the last destruction burst, or null. */
  burstAt: number | null
}

const DEFAULTS: State = {
  pressureMPa: 0.35,
  frequencyMHz: 3,
  bubbleDiameterUm: 3,
  cycles: 2,
  burstAt: null,
}

/**
 * Teaching model of bubble resonance (Minnaert-style): the resonant frequency
 * of a free microbubble is inversely proportional to its diameter, and for
 * clinically sized bubbles it lands in the low diagnostic megahertz — the happy
 * accident that makes contrast imaging work. The constant is chosen so a 3 µm
 * bubble resonates near 2 MHz; shells raise it somewhat in reality.
 */
function resonantMHzFor(diameterUm: number): number {
  return 6.5 / Math.max(0.5, diameterUm)
}

function regimeFor(mi: number): BubbleRegime {
  if (mi < 0.1) return 'linear'
  if (mi < 0.7) return 'nonlinear'
  return 'destruction'
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'anatomy',
    title: 'A gas core in a stabilising shell',
    phase: 'anatomy',
    state: { pressureMPa: 0.1, frequencyMHz: 3, bubbleDiameterUm: 3, burstAt: null },
    caption: (
      <>
        A microbubble is a <b>gas core</b> wrapped in a <b>stabilising shell</b> of lipid or
        protein, <b>1–8 µm</b> across — small enough to cross the pulmonary capillary bed and
        circulate as a true <b>blood-pool agent</b>. Compare the bars on the stage: the bubble is
        hundreds of times smaller than the wavelength.
      </>
    ),
  },
  {
    id: 'resonance',
    hands: true,
    title: 'Size sets the resonant frequency',
    phase: 'resonance',
    state: { bubbleDiameterUm: 3, frequencyMHz: 2 },
    duration: 1.6,
    caption: (state) => (
      <>
        A bubble has a natural ringing frequency that <b>rises as it shrinks</b>. At{' '}
        {state.bubbleDiameterUm.toFixed(1)} µm it resonates near{' '}
        <b>{resonantMHzFor(state.bubbleDiameterUm).toFixed(1)} MHz</b> — happily inside the
        diagnostic range. Drive it near resonance and the oscillation, and the returned signal, are
        enormously stronger.
      </>
    ),
  },
  {
    id: 'linear',
    title: 'Low pressure: linear, symmetric oscillation',
    phase: 'linear',
    state: { pressureMPa: 0.12, frequencyMHz: 3 },
    duration: 1.6,
    caption: (
      <>
        At very low acoustic pressure the bubble expands and compresses <b>symmetrically</b>,
        re-radiating at the transmitted frequency only. Harmless, stable — and not yet especially
        useful, because tissue echoes share the same frequency.
      </>
    ),
  },
  {
    id: 'nonlinear',
    title: 'Moderate pressure: asymmetric — and harmonic',
    phase: 'nonlinear',
    state: { pressureMPa: 0.5, frequencyMHz: 3 },
    duration: 1.8,
    caption: (
      <>
        Raise the pressure and the asymmetry appears: a bubble <b>expands more easily than it
        compresses</b>. The distorted oscillation radiates <b>harmonics</b> — the green 2f₀ ripples
        — far more strongly than tissue does. Contrast-specific <b>low-MI modes</b> image exactly
        this signal for minutes without killing the bubbles.
      </>
    ),
  },
  {
    id: 'destruction',
    title: 'High MI: inertial cavitation destroys the bubble',
    phase: 'destruction',
    state: { pressureMPa: 1.6, frequencyMHz: 3 },
    duration: 1.6,
    caption: (state) => (
      <>
        At MI {mechanicalIndex(state.pressureMPa, state.frequencyMHz).toFixed(2)} the rarefaction
        phase drives the bubble into <b>inertial cavitation</b>: it over-expands, collapses
        violently — the amber flashes — and the gas dissolves. The signal is gone. This is why
        contrast studies run at <b>low MI</b>.
      </>
    ),
  },
  {
    id: 'replenish',
    hands: true,
    title: 'Destruction–replenishment: perfusion made visible',
    phase: 'replenish',
    state: { pressureMPa: 0.4, frequencyMHz: 3 },
    duration: 1.8,
    caption: (
      <>
        Used deliberately, destruction becomes a measurement: a high-MI <b>burst</b> wipes the
        bubbles from the imaging plane, then low-MI imaging watches them <b>re-fill from the
        inflow</b> over seconds. The refill rate is a direct read-out of tissue <b>perfusion</b>.
        Press <b>Burst</b> in the controls to fire one yourself.
      </>
    ),
  },
  {
    id: 'safety',
    title: 'The safety line: MI 0.7',
    phase: 'safety',
    state: { pressureMPa: 0.55, frequencyMHz: 3 },
    caption: (
      <>
        Bubble gas cores are ready-made <b>cavitation nuclei</b>, so cavitation happens far more
        readily with contrast on board. <b>BMUS</b> guidance is that <b>MI above 0.7</b> should not
        be used once a contrast agent is on board; above that line caution applies and scanning
        time should be limited — the recall collection tests that number with contrast specifically.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Drive the chamber yourself',
    phase: 'free',
    caption: (
      <>
        Sweep the pressure through all three regimes, tune the frequency across the resonance of
        your chosen bubble size, and fire destruction bursts. Watch the MI readout — the regime
        boundaries follow it, not the sliders directly.
      </>
    ),
  },
]

export default function ContrastPage() {
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

  const phase: ContrastPhase = api.mode === 'manual' ? 'free' : (api.phase as ContrastPhase)

  const mi = mechanicalIndex(state.pressureMPa, state.frequencyMHz)
  const regime = regimeFor(mi)
  const resonantMHz = resonantMHzFor(state.bubbleDiameterUm)

  // In the replenish teaching phase the burst cycles automatically so the
  // learner can watch refills without touching a control; a manual burst
  // (the button) takes precedence.
  const burstElapsed = useMemo(() => {
    if (state.burstAt !== null) return Math.max(0, clock - state.burstAt)
    if (phase === 'replenish') return clock % 9
    return null
  }, [state.burstAt, clock, phase])

  const derived = useMemo(
    () => ({
      lambdaUm: wavelengthMm(ASSUMED_SPEED, state.frequencyMHz) * 1000,
      pulseUs: pulseDurationUs(state.cycles, state.frequencyMHz),
      sizeRatio: (wavelengthMm(ASSUMED_SPEED, state.frequencyMHz) * 1000) / state.bubbleDiameterUm,
    }),
    [state.frequencyMHz, state.cycles, state.bubbleDiameterUm],
  )

  /* --- controls announce their consequence -------------------------------- */

  const onPressure = (value: number) => {
    const up = value > state.pressureMPa
    const nextMi = mechanicalIndex(value, state.frequencyMHz)
    const nextRegime = regimeFor(nextMi)
    patch({ pressureMPa: value })
    flash.fire([
      { text: up ? 'Acoustic pressure increased' : 'Acoustic pressure decreased', dir: up ? 'up' : 'down' },
      { text: `MI now ${nextMi.toFixed(2)}`, dir: nextMi >= 0.7 ? 'warn' : 'flat' },
      {
        text:
          nextRegime === 'linear'
            ? 'Linear oscillation'
            : nextRegime === 'nonlinear'
              ? 'Nonlinear — harmonic emission'
              : 'Bubble destruction!',
        dir: nextRegime === 'destruction' ? 'warn' : nextRegime === 'nonlinear' ? 'up' : 'flat',
      },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    const nextMi = mechanicalIndex(state.pressureMPa, value)
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'MI falls (÷√f)' : 'MI rises (÷√f)', dir: up ? 'down' : 'warn' },
      { text: `MI now ${nextMi.toFixed(2)}`, dir: nextMi >= 0.7 ? 'warn' : 'flat' },
      {
        text:
          Math.abs(value - resonantMHz) / resonantMHz < 0.3
            ? 'Near bubble resonance — strong response'
            : 'Off bubble resonance',
        dir: Math.abs(value - resonantMHz) / resonantMHz < 0.3 ? 'up' : 'flat',
      },
    ])
  }

  const onBubbleSize = (value: number) => {
    const up = value > state.bubbleDiameterUm
    patch({ bubbleDiameterUm: value })
    flash.fire([
      { text: up ? 'Bubble diameter increased' : 'Bubble diameter decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Resonant frequency falls' : 'Resonant frequency rises', dir: up ? 'down' : 'up' },
      { text: `f_res ≈ ${resonantMHzFor(value).toFixed(1)} MHz`, dir: 'flat' },
      { text: 'Still hundreds of times smaller than λ', dir: 'flat' },
    ])
  }

  const onCycles = (value: number) => {
    const up = value > state.cycles
    patch({ cycles: value })
    flash.fire([
      { text: up ? 'Longer pulse' : 'Shorter pulse', dir: up ? 'up' : 'down' },
      { text: up ? 'More energy delivered per pulse' : 'Less energy per pulse', dir: up ? 'warn' : 'down' },
      { text: up ? 'Bubble disruption more likely' : 'Bubbles better preserved', dir: up ? 'warn' : 'up' },
    ])
  }

  const onBurst = () => {
    patch({ burstAt: clock })
    flash.fire([
      { text: 'High-MI burst fired', dir: 'warn' },
      { text: 'Bubbles in the plane destroyed', dir: 'warn' },
      { text: 'Watch the inflow replenish them', dir: 'up' },
      { text: 'Refill rate = perfusion', dir: 'flat' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'pressure ↑ → MI ↑', dir: 'warn' },
    { label: 'frequency ↑ → MI ↓', dir: 'down' },
    { label: 'MI < 0.1 → linear echo', dir: 'flat' },
    { label: 'moderate MI → harmonic signal ↑', dir: 'up' },
    { label: 'MI ≥ 0.7 → destruction, caution', dir: 'warn' },
    { label: 'diameter ↓ → resonant f ↑', dir: 'up' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/contrast"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Microbubble chamber">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="bubble" size={14} />
                <b>Stage</b> Microbubble chamber
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Incident f₀
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Harmonic 2f₀
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Shell / collapse
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <ContrastStage
                  frequencyMHz={state.frequencyMHz}
                  mi={mi}
                  regime={regime}
                  bubbleDiameterUm={state.bubbleDiameterUm}
                  resonantMHz={resonantMHz}
                  time={clock}
                  burstElapsed={burstElapsed}
                  phase={phase}
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
              <b>Enter manual lab</b> to sweep pressure, frequency and bubble size yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Mechanical index', value: mi.toFixed(2), tone: mi >= 0.7 ? 'red' : 'amber' },
                {
                  label: 'Regime',
                  value:
                    regime === 'linear' ? 'Linear' : regime === 'nonlinear' ? 'Nonlinear' : 'Destruction',
                  tone: regime === 'destruction' ? 'red' : regime === 'nonlinear' ? 'green' : 'cyan',
                },
                { label: 'Bubble diameter', value: state.bubbleDiameterUm.toFixed(1), unit: 'µm' },
                { label: 'Resonant frequency', value: resonantMHz.toFixed(1), unit: 'MHz', tone: 'cyan' },
                { label: 'Wavelength', value: derived.lambdaUm.toFixed(0), unit: 'µm' },
                { label: 'λ ÷ bubble', value: derived.sizeRatio.toFixed(0), unit: '×', tone: 'green' },
                { label: 'Pulse duration', value: derived.pulseUs.toFixed(2), unit: 'µs' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Acoustic drive" icon="wave" defaultOpen>
            <Slider
              label="Peak rarefactional pressure"
              unit="MPa"
              value={state.pressureMPa}
              min={0.05}
              max={2.5}
              step={0.05}
              decimals={2}
              onChange={onPressure}
              hint="MI = p₋/√f. Below about 0.1 the bubbles behave linearly; above 0.7, destruction — and the contrast safety caution."
              markers={[
                { value: 0.1, label: 'linear' },
                { value: 0.5, label: 'low-MI imaging' },
                { value: 1.6, label: 'burst' },
              ]}
            />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={1}
              max={7}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="Raising the frequency LOWERS the MI for the same pressure — and moves you across the bubble resonance."
            />
            <Slider
              label="Pulse duration"
              unit="cycles"
              value={state.cycles}
              min={1}
              max={8}
              step={1}
              onChange={onCycles}
              hint="Longer pulses deliver more energy to each bubble and disrupt them more readily."
            />
          </ControlGroup>

          <ControlGroup title="The agent" icon="bubble" defaultOpen>
            <Slider
              label="Bubble diameter"
              unit="µm"
              value={state.bubbleDiameterUm}
              min={0.5}
              max={10}
              step={0.5}
              decimals={1}
              onChange={onBubbleSize}
              hint="Clinical agents are 1–8 µm — capillary-sized. Smaller bubble, higher resonant frequency."
            />
            <p className="us-slider-hint">
              {Math.abs(state.frequencyMHz - resonantMHz) / resonantMHz < 0.3 ? (
                <strong>Near resonance:</strong>
              ) : (
                <strong>Off resonance:</strong>
              )}{' '}
              this bubble rings at ≈ {resonantMHz.toFixed(1)} MHz; you are driving it at{' '}
              {state.frequencyMHz.toFixed(1)} MHz.
            </p>
            <button type="button" className="us-btn" onClick={onBurst}>
              <UsIcon name="spark" size={13} />
              Burst — high-MI destruction pulse
            </button>
            <p className="us-slider-hint">
              Wipes the bubbles from the plane, then watch them replenish from the inflow —
              destruction–replenishment perfusion imaging.
            </p>
          </ControlGroup>

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Microbubbles work because their diameter equals the wavelength — true or false?"
              options={['True', 'False — they are far smaller, and resonate nonlinearly']}
              correct={1}
              explanation={
                <>
                  At 3 MHz the wavelength is about <b>{wavelengthMm(ASSUMED_SPEED, 3).toFixed(2)} mm</b>{' '}
                  — hundreds of times a 3 µm bubble. The recall collection marks the
                  diameter-equals-wavelength stem <b>FALSE</b> (QBank Q203): bubbles work by{' '}
                  <b>resonating and oscillating nonlinearly</b>, not by matching the wavelength.
                  Their size is also unrelated to the piezoelectric element thickness.
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
                {state.bubbleDiameterUm.toFixed(1)} µm bubbles are being driven at{' '}
                {state.frequencyMHz.toFixed(1)} MHz and {state.pressureMPa.toFixed(2)} MPa, giving{' '}
                <b>MI {mi.toFixed(2)}</b> — the{' '}
                <b>
                  {regime === 'linear'
                    ? 'linear'
                    : regime === 'nonlinear'
                      ? 'nonlinear (harmonic-emitting)'
                      : 'destruction'}
                </b>{' '}
                regime. The bubble is <b>{derived.sizeRatio.toFixed(0)}×</b> smaller than the
                wavelength.
              </>
            }
            why={
              <>
                A gas core is enormously more compressible than tissue, so a bubble is a resonant
                oscillator sitting in the beam. Near resonance it converts incident sound into a
                huge re-radiated echo; at moderate pressure the oscillation is asymmetric —
                expansion is easier than compression — so the echo is rich in <b>harmonics</b>,
                which is what contrast-specific low-MI modes listen for.
              </>
            }
            equation={
              showEquation
                ? `MI = p₋ / √f = ${state.pressureMPa.toFixed(2)} / √${state.frequencyMHz.toFixed(1)} = ${mi.toFixed(2)}
regimes: MI < 0.1 linear · 0.1–0.7 nonlinear (imaging) · ≥ 0.7 destruction/caution
f_res ≈ constant / diameter → ${state.bubbleDiameterUm.toFixed(1)} µm rings at ≈ ${resonantMHz.toFixed(1)} MHz
λ = ${derived.lambdaUm.toFixed(0)} µm  vs  bubble = ${state.bubbleDiameterUm.toFixed(1)} µm  (${derived.sizeRatio.toFixed(0)}×)`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Contrast studies run at deliberately <b>low MI</b> so the agent survives minutes of
                continuous imaging — lesion wash-in and wash-out in liver work, endocardial border
                definition in echo. Destruction–replenishment turns the artefact of bubble death
                into a quantitative perfusion measurement.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Microbubbles have a diameter equal to the wavelength” — <b>FALSE</b>, a
                  high-yield recall stem (QBank Q203). They are micrometres against hundreds of
                  micrometres, and their size is equally unrelated to the piezo element thickness.
                  And bubbles are <b>not</b> routinely imaged at high MI: high MI kills them.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — shells, regimes and safety">
            <p>
              <strong>The shell is what makes the agent possible.</strong> A naked gas bubble
              dissolves in milliseconds; the lipid or protein shell stabilises it for minutes, and
              low-solubility gases extend this further. At <b>1–8 µm</b> the bubbles pass the
              pulmonary capillaries and recirculate — a genuine blood-pool agent, unlike CT or MR
              contrast which leaks into the interstitium.
            </p>
            <p>
              <strong>Three regimes, one dial.</strong> The mechanical index is the dial. Linear
              oscillation returns only f₀ and is indistinguishable from tissue. Nonlinear
              oscillation returns harmonics that tissue barely produces at these pressures, so
              subtracting or filtering the fundamental leaves an almost bubble-only image. Inertial
              cavitation destroys the agent — useless accidentally, powerful deliberately.
            </p>
            <p>
              <strong>Safety follows the same dial.</strong> Gas cores are pre-formed cavitation
              nuclei, so the cavitation threshold falls when contrast is present. The examinable
              line is <b>MI 0.7</b>: above it, caution and limited scanning time with contrast or
              other gas bodies in the field.
            </p>

            <TrapNote>
              Keep the two “bubble size” lies apart: diameter ≠ wavelength, and diameter ≠
              piezoelectric element thickness. Both appear as distractors on the same recall
              question, and both fail the same way — the bubble is <em>micrometres</em>; the
              wavelength and the element are hundreds of micrometres.
            </TrapNote>

            <SourceNote>
              QBank Q203 (high-yield recall) anchors the size fact; Q323 and Q21 carry the low-MI
              imaging, cavitation and MI 0.7 caution stems. The regime thresholds drawn here (0.1
              and 0.7) are the teaching figures those questions use — real behaviour is a continuum
              that also depends on bubble size and pulse length.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Bubble oscillation is drawn thousands of times slower and larger than life, and the
            resonance rule f_res ∝ 1/diameter is a simplified Minnaert-style model — shells stiffen
            real bubbles and raise the figure. The MI, wavelength and pulse duration on this page
            are computed exactly; the regime boundaries are the examinable teaching values.
          </ModelNote>
        </>
      }
    />
  )
}
