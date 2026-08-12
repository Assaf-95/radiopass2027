/**
 * Module 17 — Bioeffects & Safety.
 *
 * The two risks, kept apart: MI for the mechanical (cavitation) route and TI
 * for the thermal one. The stage puts a heat map on a slab of tissue whose
 * distribution follows the absorption physics — warmest superficially in
 * uniform soft tissue, and jumping to the bone surface the moment bone is put
 * in the beam — while a cavitation inset shows a bubble oscillating gently or
 * collapsing violently as MI crosses its threshold.
 *
 * Both indices come from `engine/acoustics.ts` (`mechanicalIndex` and
 * `thermalIndexEstimate`), so the dials, the readouts and the teaching panel
 * cannot disagree with one another.
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
import { SafetyStage, type SafetyMode, type SafetyPhase, type SafetyTarget } from '../scenes/SafetyStage'
import { mechanicalIndex, thermalIndexEstimate } from '../engine'

type State = {
  /** Relative acoustic output, 5–100%. */
  powerPercent: number
  frequencyMHz: number
  mode: SafetyMode
  target: SafetyTarget
  /** Time the beam dwells on one spot, in minutes. */
  dwellMin: number
  contrast: boolean
  probeInAir: boolean
}

const DEFAULTS: State = {
  powerPercent: 50,
  frequencyMHz: 3,
  mode: 'bmode',
  target: 'soft',
  dwellMin: 1,
  contrast: false,
  probeInAir: false,
}

/**
 * Peak rarefactional pressure in MPa for a given relative output.
 *
 * Pressure amplitude scales with the square root of intensity, and intensity
 * scales with output power — so p₋ ∝ √(output). The 1.6 MPa figure at full
 * output puts a mid-range diagnostic machine on the scale examiners use. It is
 * set by the transmitted pulse, NOT by the frequency, which is exactly why
 * MI = p₋/√f falls when the frequency is raised.
 */
function peakRarefactionalMPa(powerPercent: number): number {
  return 1.6 * Math.sqrt(Math.max(0, powerPercent) / 100)
}

/**
 * An educational temperature-rise curve, in °C.
 *
 * Temperature integrates over dwell time towards a plateau as conduction and
 * perfusion carry heat away, so a longer dwell in one place matters far more
 * than a brief sweep. This is an illustration of the SHAPE of the process, not
 * a calculation of real tissue temperature — see the model note on the page.
 */
function temperatureRiseC(ti: number, dwellMin: number): number {
  return ti * 1.5 * (1 - Math.exp(-dwellMin / 2.5))
}

const MODE_CHOICES: { value: SafetyMode; label: string }[] = [
  { value: 'bmode', label: 'B-mode' },
  { value: 'mmode', label: 'M-mode' },
  { value: 'colour', label: 'Colour' },
  { value: 'pulsedDoppler', label: 'Pulsed Doppler' },
]

const TARGET_CHOICES: { value: SafetyTarget; label: string; colour?: string }[] = [
  { value: 'soft', label: 'Soft tissue', colour: '#cbd5e1' },
  { value: 'boneFocus', label: 'Bone at focus', colour: '#f5f5f5' },
  { value: 'boneSurface', label: 'Bone at surface', colour: '#dfe6ec' },
  { value: 'obstetric', label: 'Obstetric', colour: '#ffd9a8' },
]

const MODE_LABEL: Record<SafetyMode, string> = {
  bmode: 'B-mode',
  mmode: 'M-mode',
  colour: 'colour Doppler',
  pulsedDoppler: 'pulsed Doppler',
}

const TARGET_LABEL: Record<SafetyTarget, string> = {
  soft: 'uniform soft tissue',
  boneFocus: 'bone at the focus',
  boneSurface: 'bone close to the surface',
  obstetric: 'an obstetric scan',
}

/** Which thermal index variant applies to the selected target. */
function tiVariant(target: SafetyTarget): { code: string; name: string } {
  switch (target) {
    case 'boneFocus':
      return { code: 'TIB', name: 'bone at or near the focus' }
    case 'boneSurface':
      return { code: 'TIC', name: 'bone at the surface — transcranial' }
    default:
      return { code: 'TIS', name: 'soft tissue' }
  }
}

/** The engine's thermal model for each target preset. */
function engineTarget(target: SafetyTarget): 'soft' | 'bone' | 'cranial' {
  if (target === 'boneFocus') return 'bone'
  if (target === 'boneSurface') return 'cranial'
  return 'soft'
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'two-risks',
    title: 'Two risks, two indices — keep them apart',
    phase: 'two-risks',
    state: { powerPercent: 50, frequencyMHz: 3, mode: 'bmode', target: 'soft', dwellMin: 1, contrast: false, probeInAir: false },
    caption: (
      <>
        Diagnostic ultrasound carries two distinct potential bioeffects. <b>Heating</b> is read on the{' '}
        <b>thermal index (TI)</b>. <b>Mechanical</b> effects — cavitation — are read on the{' '}
        <b>mechanical index (MI)</b>. One dial never tells you about the other risk.
      </>
    ),
    detail:
      'Neither index is a measurement of damage. Both are dimensionless indices displayed to help you keep exposure sensible.',
  },
  {
    id: 'heating',
    title: 'Absorption is what heats the tissue',
    phase: 'heating',
    state: { target: 'soft', mode: 'bmode', powerPercent: 70, dwellMin: 2 },
    duration: 1.6,
    caption: (
      <>
        Only a tiny fraction of the beam returns as echoes. Almost everything else is{' '}
        <b>absorbed and converted to heat</b>. In <b>uniform soft tissue</b> the beam has been
        attenuated least near the surface, so the glow is <b>warmest superficially</b>.
      </>
    ),
  },
  {
    id: 'bone',
    title: 'Put bone in the beam and the hot spot jumps',
    phase: 'bone',
    state: { target: 'boneFocus', mode: 'bmode', powerPercent: 70, dwellMin: 2 },
    duration: 1.6,
    caption: (
      <>
        Absorption at bone is very high, so energy is dumped over a short distance and the peak
        moves to the <b>bone surface</b>, however deep that is. This is the index labelled{' '}
        <b>TIB</b>. Perfusion works the other way — blood flow carries heat away.
      </>
    ),
  },
  {
    id: 'modes',
    title: 'Pulsed Doppler concentrates the energy on one line',
    phase: 'modes',
    state: { mode: 'pulsedDoppler', target: 'soft', powerPercent: 70, dwellMin: 2 },
    duration: 1.6,
    caption: (state) => (
      <>
        In B-mode the beam sweeps the whole field, so no one spot is insonated for long. In{' '}
        <b>pulsed Doppler</b> the beam <b>stops sweeping and dwells on a single line</b>. TI climbs
        to <b>{thermalIndexEstimate({ power: state.powerPercent / 100, frequencyMHz: state.frequencyMHz, mode: state.mode, target: engineTarget(state.target) }).toFixed(2)}</b>. Colour sits between
        the two; B-mode is the gentlest common mode.
      </>
    ),
  },
  {
    id: 'dwell',
    title: 'Temperature integrates over dwell time',
    phase: 'dwell',
    state: { mode: 'pulsedDoppler', dwellMin: 5, powerPercent: 70, target: 'soft' },
    duration: 1.4,
    caption: (state) => {
      const ti = thermalIndexEstimate({
        power: state.powerPercent / 100,
        frequencyMHz: state.frequencyMHz,
        mode: state.mode,
        target: engineTarget(state.target),
      })
      return (
        <>
          Heat accumulates while the beam stays in one place, rising towards a plateau as conduction
          and perfusion remove it. A sustained rise of <b>4 °C for 5 minutes must be treated as
          potentially hazardous</b>, particularly to a fetus. Estimated rise here:{' '}
          <b>{temperatureRiseC(ti, state.dwellMin).toFixed(1)} °C</b>.
        </>
      )
    },
  },
  {
    id: 'cavitation',
    title: 'MI 0.7: stable oscillation becomes violent collapse',
    phase: 'cavitation',
    state: { powerPercent: 100, frequencyMHz: 2, mode: 'bmode', target: 'soft', contrast: false },
    duration: 1.8,
    caption: (state) => (
      <>
        Below threshold a gas bubble simply <b>oscillates</b> — stable cavitation, with
        microstreaming around it. Above it the bubble <b>collapses violently</b> — inertial
        cavitation. MI here is{' '}
        <b>{mechanicalIndex(peakRarefactionalMPa(state.powerPercent), state.frequencyMHz).toFixed(2)}</b>.
        Switch <b>contrast on</b> and the threshold tightens: the gas cores are ready-made nuclei.
      </>
    ),
  },
  {
    id: 'indices',
    title: 'TIS, TIB, TIC — and what TI is not',
    phase: 'indices',
    state: { target: 'boneSurface', mode: 'bmode', powerPercent: 70 },
    caption: (
      <>
        <b>TIS</b> models soft tissue, <b>TIB</b> bone at or near the focus, <b>TIC</b> bone at the
        surface for transcranial work. TI is the ratio of the power used to the power modelled to
        raise tissue by <b>1 °C</b> — an <b>index, not a thermometer</b>, and never “a 2 ° rise”.
      </>
    ),
  },
  {
    id: 'alara',
    title: 'Lowest output, shortest time',
    phase: 'alara',
    state: { powerPercent: 30, mode: 'bmode', dwellMin: 0.5, target: 'soft', probeInAir: false },
    duration: 1.2,
    caption: (
      <>
        Optimise <b>gain</b>, TGC, focus and probe position before reaching for <b>output power</b>:
        gain costs the patient nothing. Then use the <b>lowest output and the shortest exposure</b>{' '}
        that answers the clinical question — and never claim ultrasound has <em>no</em> biological
        effect.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Now drive it yourself',
    phase: 'free',
    caption: (
      <>
        Try the <b>probe-in-air</b> toggle: with no tissue and no gel the energy has nowhere to go,
        so the probe face itself warms through <b>electrical and mechanical losses</b> — not
        friction, and not simply “higher voltage”. Then push the obstetric preset into the red.
      </>
    ),
  },
]

export default function SafetyPage() {
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
    const pressure = peakRarefactionalMPa(state.powerPercent)
    const mi = mechanicalIndex(pressure, state.frequencyMHz)
    const ti = thermalIndexEstimate({
      power: state.powerPercent / 100,
      frequencyMHz: state.frequencyMHz,
      mode: state.mode,
      target: engineTarget(state.target),
    })
    const cavThreshold = state.contrast ? 0.4 : 0.7
    return {
      pressure,
      mi,
      ti,
      cavThreshold,
      inertial: mi >= cavThreshold,
      tempRise: temperatureRiseC(ti, state.dwellMin),
      variant: tiVariant(state.target),
    }
  }, [state])

  const obstetricStop = state.target === 'obstetric' && derived.ti > 3

  /* --- controls announce their consequence immediately -------------------- */

  const onPower = (value: number) => {
    const up = value > state.powerPercent
    patch({ powerPercent: value })
    flash.fire([
      { text: up ? 'Output power increased' : 'Output power decreased', dir: up ? 'warn' : 'down' },
      { text: up ? 'Peak rarefactional pressure rises' : 'Peak rarefactional pressure falls', dir: up ? 'warn' : 'down' },
      { text: up ? 'MI rises' : 'MI falls', dir: up ? 'warn' : 'down' },
      { text: up ? 'TI rises' : 'TI falls', dir: up ? 'warn' : 'down' },
      { text: 'Receiver gain would have changed neither', dir: 'flat' },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'MI falls (÷ √f)' : 'MI rises (÷ √f)', dir: up ? 'down' : 'warn' },
      { text: up ? 'Absorption rises, so heating rises' : 'Absorption falls, so heating falls', dir: up ? 'warn' : 'down' },
      { text: 'Transmitted pressure unchanged', dir: 'flat' },
    ])
  }

  const onMode = (value: SafetyMode) => {
    const order: SafetyMode[] = ['bmode', 'mmode', 'colour', 'pulsedDoppler']
    const up = order.indexOf(value) > order.indexOf(state.mode)
    patch({ mode: value })
    flash.fire([
      { text: `Mode: ${MODE_LABEL[value]}`, dir: 'flat' },
      {
        text: value === 'pulsedDoppler' ? 'Beam dwells on one line' : 'Beam is spread over more lines',
        dir: value === 'pulsedDoppler' ? 'warn' : 'up',
      },
      { text: up ? 'Acoustic output rises' : 'Acoustic output falls', dir: up ? 'warn' : 'down' },
      { text: up ? 'TI rises' : 'TI falls', dir: up ? 'warn' : 'down' },
      { text: 'MI unchanged by mode alone', dir: 'flat' },
    ])
  }

  const onTarget = (value: SafetyTarget) => {
    const bone = value === 'boneFocus' || value === 'boneSurface'
    patch({ target: value })
    flash.fire([
      { text: `Target: ${TARGET_LABEL[value]}`, dir: 'flat' },
      {
        text: bone ? 'Hot spot moves to the bone surface' : 'Hot spot sits superficially',
        dir: bone ? 'warn' : 'flat',
      },
      { text: bone ? 'TI rises sharply' : 'TI falls', dir: bone ? 'warn' : 'down' },
      { text: `Index shown: ${tiVariant(value).code}`, dir: 'flat' },
      ...(value === 'obstetric'
        ? [{ text: 'Obstetric limits apply: restrict above 0.7, do not scan above 3.0', dir: 'warn' as const }]
        : []),
    ])
  }

  const onDwell = (value: number) => {
    const up = value > state.dwellMin
    patch({ dwellMin: value })
    flash.fire([
      { text: up ? 'Dwell time increased' : 'Dwell time reduced', dir: up ? 'warn' : 'up' },
      { text: up ? 'Temperature integrates higher' : 'Less heat accumulates', dir: up ? 'warn' : 'down' },
      { text: 'MI unaffected by time', dir: 'flat' },
      { text: 'TI itself unchanged — it is a rate, not a dose', dir: 'flat' },
    ])
  }

  const onContrast = (value: boolean) => {
    patch({ contrast: value })
    flash.fire([
      { text: value ? 'Contrast agent present' : 'Contrast agent removed', dir: value ? 'warn' : 'up' },
      {
        text: value ? 'Cavitation threshold tightens to MI 0.4' : 'Cavitation threshold returns to MI 0.7',
        dir: value ? 'warn' : 'up',
      },
      { text: value ? 'Gas cores act as cavitation nuclei' : 'No ready-made nuclei', dir: value ? 'warn' : 'flat' },
      { text: value ? 'Limit scan time at this MI' : 'Standard caution applies', dir: value ? 'warn' : 'flat' },
    ])
  }

  const onProbeInAir = (value: boolean) => {
    patch({ probeInAir: value })
    flash.fire([
      { text: value ? 'Probe lifted into air' : 'Probe coupled to tissue', dir: value ? 'warn' : 'up' },
      { text: value ? 'Almost the whole beam reflects at the face' : 'Beam enters the patient', dir: value ? 'warn' : 'flat' },
      {
        text: value ? 'Probe face heats: electrical and mechanical losses' : 'Heat is carried into tissue and perfusion',
        dir: value ? 'warn' : 'down',
      },
      { text: 'Patient exposure: none while in air', dir: 'flat' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'power ↑ → MI ↑ and TI ↑', dir: 'warn' },
    { label: 'frequency ↑ → MI ↓', dir: 'down' },
    { label: 'frequency ↑ → heating ↑', dir: 'warn' },
    { label: 'bone in beam → heating ↑', dir: 'warn' },
    { label: 'pulsed Doppler → output ↑', dir: 'warn' },
    { label: 'dwell time ↑ → temperature ↑', dir: 'warn' },
    { label: 'perfusion ↑ → heating ↓', dir: 'down' },
    { label: 'gain ↑ → exposure unchanged', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/safety"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Bioeffects and safety stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="shield" size={14} />
                <b>Stage</b> Tissue heating and cavitation
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Beam
                </span>
                <span>
                  <i style={{ background: 'var(--us-red)' }} /> Heat map
                </span>
                <span>
                  <i className="is-dot" style={{ background: 'var(--us-green)' }} /> Microstreaming
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <SafetyStage
                  powerPercent={state.powerPercent}
                  frequencyMHz={state.frequencyMHz}
                  mode={state.mode}
                  target={state.target}
                  dwellMin={state.dwellMin}
                  contrast={state.contrast}
                  probeInAir={state.probeInAir}
                  mi={derived.mi}
                  ti={derived.ti}
                  tempRiseC={derived.tempRise}
                  time={clock}
                  phase={api.phase as SafetyPhase}
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
              <b>Enter manual lab</b> to drive the output, the mode and the target yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Mechanical index MI', value: derived.mi.toFixed(2), tone: derived.inertial ? 'red' : 'amber' },
                {
                  label: `Thermal index ${derived.variant.code}`,
                  value: derived.ti.toFixed(2),
                  tone: derived.ti > 3 ? 'red' : derived.ti > 0.7 ? 'amber' : 'green',
                },
                { label: 'Peak rarefactional p₋', value: derived.pressure.toFixed(2), unit: 'MPa' },
                { label: 'Cavitation threshold', value: derived.cavThreshold.toFixed(1), unit: 'MI' },
                { label: 'Dwell time', value: state.dwellMin.toFixed(1), unit: 'min' },
                {
                  label: 'Estimated rise',
                  value: derived.tempRise.toFixed(1),
                  unit: '°C',
                  tone: derived.tempRise >= 4 ? 'red' : 'cyan',
                },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Acoustic output" icon="target" defaultOpen>
            <Slider
              label="Output power"
              unit="%"
              value={state.powerPercent}
              min={5}
              max={100}
              step={5}
              onChange={onPower}
              hint="The only control here that changes what enters the patient. Gain and TGC do not."
            />
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={1}
              max={12}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="MI = p₋/√f, so raising the frequency LOWERS MI at fixed pressure. Absorption rises with frequency, so heating goes the other way."
            />
            <ChipRow label="Imaging mode" value={state.mode} options={MODE_CHOICES} onChange={onMode} />
            <p className="us-slider-hint">
              <strong>{MODE_LABEL[state.mode]}</strong> —{' '}
              {state.mode === 'pulsedDoppler'
                ? 'the beam stops sweeping and dwells on one line, so energy is concentrated. Highest output of the common modes.'
                : state.mode === 'colour'
                  ? 'repeated pulses down each line inside the colour box: between B-mode and pulsed Doppler.'
                  : state.mode === 'mmode'
                    ? 'one line, sampled rapidly, but with B-mode-like pulses.'
                    : 'the beam sweeps the whole field, so no single spot is insonated for long. The gentlest common mode.'}
            </p>
          </ControlGroup>

          <ControlGroup title="What is in the beam" icon="layers" defaultOpen>
            <ChipRow label="Target" value={state.target} options={TARGET_CHOICES} onChange={onTarget} />
            <p className="us-slider-hint">
              Index displayed: <strong>{derived.variant.code}</strong> — {derived.variant.name}.
            </p>
            <Slider
              label="Dwell time in one place"
              unit="min"
              value={state.dwellMin}
              min={0}
              max={10}
              step={0.5}
              decimals={1}
              onChange={onDwell}
              hint="TI is a rate, not a dose. Temperature is what integrates over time."
            />
          </ControlGroup>

          <ControlGroup title="Conditions" icon="bubble" defaultOpen={api.index >= 5}>
            <Toggle
              label="Microbubble contrast agent present"
              checked={state.contrast}
              onChange={onContrast}
              hint="Gas cores are ready-made cavitation nuclei, so the threshold tightens and scan time should be limited."
            />
            <Toggle
              label="Probe running in air (no gel, no contact)"
              checked={state.probeInAir}
              onChange={onProbeInAir}
              hint="Nothing enters the patient — but the probe face warms, because the electrical and mechanical losses inside the transducer have nowhere to go."
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
              question="You switch from B-mode to pulsed Doppler over the same spot. Heating potential…?"
              options={['Rises substantially', 'Is unchanged', 'Falls']}
              correct={0}
              explanation={
                <>
                  It <b>rises substantially</b>. Pulsed Doppler uses longer pulses, higher power and
                  keeps insonating the <b>same scan line</b> instead of sweeping across the field, so
                  the energy is concentrated in one place. B-mode is the gentlest of the common
                  modes; colour sits between the two.
                </>
              }
            />
          </div>

          <div className="us-panel">
            <h3>
              <UsIcon name="shield" size={13} />
              Where the indices stand
            </h3>
            <Readout
              items={[
                {
                  label: 'MI status',
                  value: derived.inertial ? 'Inertial cavitation possible' : derived.mi >= 0.3 ? 'Above the neonatal-lung caution' : 'Low',
                  tone: derived.inertial ? 'red' : derived.mi >= 0.3 ? 'amber' : 'green',
                },
                {
                  label: 'TI status',
                  value: obstetricStop
                    ? 'Do not scan (obstetric)'
                    : derived.ti > 0.7
                      ? 'Restrict exposure time'
                      : 'No time restriction indicated',
                  tone: obstetricStop ? 'red' : derived.ti > 0.7 ? 'amber' : 'green',
                },
              ]}
            />
            <p className="us-slider-hint">
              Never claim <strong>zero biological effect</strong>. There is no proven hazard at
              diagnostic levels, and the correct practice is still the <strong>lowest output and
              shortest exposure</strong> compatible with making the diagnosis.
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
                {MODE_LABEL[state.mode]} at <b>{state.frequencyMHz.toFixed(1)} MHz</b> and{' '}
                <b>{state.powerPercent}%</b> output into {TARGET_LABEL[state.target]} gives{' '}
                <b>MI {derived.mi.toFixed(2)}</b> and <b>{derived.variant.code} {derived.ti.toFixed(2)}</b>
                . {state.probeInAir
                  ? 'With the probe in air, nothing enters the patient — but the probe face is warming.'
                  : state.target === 'boneFocus' || state.target === 'boneSurface'
                    ? 'The peak temperature rise sits at the bone surface, not superficially.'
                    : 'The heat map peaks superficially, where the beam has been attenuated least.'}
              </>
            }
            why={
              <>
                Heating comes from <b>absorption</b>: energy removed from the beam is deposited as
                heat where it is removed. Bone absorbs so strongly that it dominates wherever it
                lies. Cavitation is a separate mechanism entirely — it depends on the{' '}
                <b>peak negative pressure</b> of the pulse, which is why the two indices move
                independently.
              </>
            }
            equation={
              showEquation
                ? `MI = p₋ / √f
   = ${derived.pressure.toFixed(2)} MPa / √${state.frequencyMHz.toFixed(1)} = ${derived.mi.toFixed(2)}
   thresholds: 0.3 neonatal lung · ${derived.cavThreshold.toFixed(1)} cavitation${state.contrast ? ' (contrast present)' : ''}

TI = acoustic power used / power modelled to raise tissue by 1 °C
   ${derived.variant.code} (${derived.variant.name}) = ${derived.ti.toFixed(2)}
   obstetric: restrict time above 0.7 · do not scan above 3.0

Temperature rise (educational model)
   dwell ${state.dwellMin.toFixed(1)} min → ${derived.tempRise.toFixed(1)} °C
   4 °C sustained for 5 min = potentially hazardous`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                {obstetricStop
                  ? 'This combination must not be used for obstetric scanning. Drop the output, come out of Doppler, or shorten the study.'
                  : derived.inertial
                    ? 'Cavitation is a live concern at this MI — especially with contrast present. Reduce output or raise the frequency, and limit scan time.'
                    : derived.ti > 0.7
                      ? 'Restrict how long the beam sits in one place. Sweep rather than dwell, and come out of Doppler between measurements.'
                      : 'These are unremarkable diagnostic settings. Keep optimising gain and focus before touching output power.'}
              </>
            }
            trap={
              showTrap ? (
                <>
                  “<b>B-mode is potentially more dangerous than Doppler</b>” is <b>FALSE</b> — pulsed
                  Doppler has the higher acoustic output. And “<b>TI is the increase in temperature
                  by 2 degrees</b>” is <b>FALSE</b>: TI is a ratio of powers, not a temperature.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the two mechanisms, and the numbers that go with them">
            <p>
              <strong>MI = p₋ / √f.</strong> It estimates the potential for <em>non-thermal</em>{' '}
              effects. It rises with peak rarefactional pressure and <strong>falls as frequency
              rises</strong>. It says nothing at all about heating.
            </p>
            <p>
              <strong>MI 0.7</strong> is the cavitation caution, and it matters most when gas bodies
              or microbubble contrast are present. <strong>MI above 0.3</strong> carries an increased
              risk of mechanical damage to <strong>neonatal lung</strong>. Neither figure is a cliff
              edge at which damage suddenly starts.
            </p>
            <p>
              <strong>TI is an index, not a thermometer.</strong> It is the ratio of the acoustic
              power being used to the power modelled to raise the tissue by <strong>1 °C</strong> in
              a worst case. <strong>TIS</strong> is the soft-tissue model, <strong>TIB</strong> bone
              at or near the focus, <strong>TIC</strong> bone at the surface for transcranial work.
            </p>
            <p>
              <strong>Heating rises</strong> with output power, with frequency (absorption rises with
              it), with PRF, with dwell time in one place, and dramatically when <strong>bone</strong>{' '}
              lies in the beam. It is <strong>reduced by perfusion</strong>, which carries heat away —
              so heating is <em>less</em>, not more, in a well-perfused tissue.
            </p>
            <p>
              <strong>Where the energy goes.</strong> Only a tiny fraction of the transmitted beam
              returns as detectable echoes. Everything else is absorbed and ends up as{' '}
              <strong>heat in the patient</strong>, which is why thermal bioeffects are a genuine
              consideration rather than a theoretical one.
            </p>
            <p>
              <strong>Probe self-heating.</strong> A probe left running in air gets warm because the{' '}
              <strong>electrical and mechanical losses inside the transducer</strong> have nowhere to
              go without tissue or gel contact. It is not friction, and it is not simply a matter of
              higher drive voltage.
            </p>
            <p>
              <strong>Gain is free; power is not.</strong> Turning up the receiver gain brightens the
              image and amplifies the noise with it, but the acoustic exposure is unchanged. Optimise
              gain, TGC, frequency, focus, depth and probe position <em>before</em> reaching for
              output power.
            </p>

            <TrapNote>
              Two wordings to reject on sight. “<em>Temperature rise is greater in highly perfused
              tissues</em>” is <strong>FALSE</strong> — blood flow removes heat. And{' '}
              “<em>MI can be calculated indirectly from tissue heating</em>” is{' '}
              <strong>FALSE</strong> — that describes the thermal index, a different risk entirely.
            </TrapNote>

            <SourceNote>
              The QBank marks “limited by practitioners under <b>ALARA</b>” FALSE on the grounds that
              ALARA is the ionising-radiation term and ultrasound practice is expressed as{' '}
              <b>ALARP</b> and the lowest-output principle (QBank Q235, high-yield recall). The
              underlying rule is identical — lowest output, shortest exposure — and many textbooks do
              use ALARA for ultrasound. Know the distinction the examiner is drawing, and never
              claim ultrasound has no biological effect at all.
            </SourceNote>

            <SourceNote title="Source clarification — the obstetric numbers">
              QBank Q32 and Q323 (high-yield recall) give <b>3.0</b> as the obstetric ceiling and
              place the start of time restriction at <b>TI 0.7</b> rather than 0.5. Published
              guidance actually gives <em>graded</em> maximum scanning times that shorten as TI rises
              above 0.7, rather than a single number. The two figures the sources emphasise are the
              examinable ones.
            </SourceNote>

            <SourceNote title="Source clarification — where the heating peaks">
              QBank Q383 states that heating is greatest <b>superficially</b>. That holds for{' '}
              <em>uniform soft tissue</em>, where the beam has been attenuated least near the
              surface. When <b>bone</b> lies in the beam the peak moves to the bone surface however
              deep it is, because absorption there is so much higher (QBank Q323, Q287). Both
              statements are examinable and they are not in conflict — select the presets above and
              watch the hot spot move.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The heat map is computed from the same absorption model the rest of the laboratory uses,
            so the <em>distribution</em> of heating and the way it moves to bone are faithful. The
            thermal index here is a teaching estimate: on a real machine TI is calculated by the
            manufacturer to a defined standard. The temperature curve illustrates the <em>shape</em>{' '}
            of thermal accumulation towards a plateau — it is not a prediction of real tissue
            temperature in any individual patient.
          </ModelNote>
        </>
      }
    />
  )
}
