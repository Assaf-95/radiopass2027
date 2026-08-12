/**
 * Module 5 — Attenuation.
 *
 * The decay laboratory. A beam crosses a stack of tissues the learner chooses,
 * losing a fixed fraction per centimetre; the graph shows why decibels turn
 * that exponential into a straight line; and a B-mode panel with three
 * identical targets shows what the loss does to an image — and what TGC can
 * honestly do about it.
 */

import { useCallback, useMemo, useState } from 'react'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
import {
  ControlGroup,
  Segmented,
  Select,
  Slider,
  StageFlash,
  TgcSliders,
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
import { AttenuationStage, type AttenuationPhase } from '../scenes/AttenuationStage'
import {
  attenuationProfile,
  dbPerCmToMu,
  halfValueLayerCm,
  medium,
  type Layer,
  type MediumId,
} from '../engine'

type State = {
  frequencyMHz: number
  layer1: MediumId
  layer2: MediumId
  layer3: MediumId
  thickness1: number
  thickness2: number
  thickness3: number
  /** Relative output power, 0-1. */
  power: number
  gainDb: number
  tgc: number[]
}

const FLAT_TGC = [0, 0, 0, 0, 0, 0]

const DEFAULTS: State = {
  frequencyMHz: 5,
  layer1: 'fat',
  layer2: 'softTissue',
  layer3: 'muscle',
  thickness1: 2,
  thickness2: 4,
  thickness3: 4,
  power: 0.7,
  gainDb: 34,
  tgc: FLAT_TGC,
}

const LAYER_CHOICES: MediumId[] = ['fat', 'water', 'softTissue', 'liver', 'kidney', 'muscle', 'blood', 'bone']
const CHOICES = LAYER_CHOICES.map((id) => ({ value: id, label: medium(id).name }))

const STEPS: GuidedStep<State>[] = [
  {
    id: 'beam',
    title: 'The beam dims as it travels',
    phase: 'beam',
    state: { ...DEFAULTS },
    duration: 1.8,
    caption: (
      <>
        Watch the beam cross the stack: it grows <b>dimmer and thinner</b> with every centimetre.
        Attenuation is the progressive loss of intensity with depth — the single reason deep
        imaging is hard.
      </>
    ),
  },
  {
    id: 'mechanisms',
    title: 'Where the energy goes',
    phase: 'mechanisms',
    duration: 1.6,
    caption: (
      <>
        Three drains: <b>absorption</b> converts the beam to <b>heat</b> and dominates in soft
        tissue; <b>scatter</b> redirects energy off the beam; <b>reflection</b> at each boundary
        sends some back. The exam trap is thinking reflection and scatter dominate — they do not.
      </>
    ),
  },
  {
    id: 'exponential',
    title: 'Exponential decay — a fixed fraction per centimetre',
    phase: 'exponential',
    duration: 1.4,
    caption: (
      <>
        The curve on the linear axis is an <b>exponential</b>: the beam loses the <b>same relative
        amount</b> in every centimetre, never the same absolute amount. Expressed in <b>decibels</b>{' '}
        the same loss becomes a <b>straight line</b> — which is why everyone works in dB.
      </>
    ),
  },
  {
    id: 'frequency',
    title: 'Raise the frequency: the decay steepens',
    phase: 'frequency',
    state: { frequencyMHz: 10 },
    duration: 1.6,
    caption: (state) => (
      <>
        At <b>{state.frequencyMHz} MHz</b> the loss per centimetre has grown in proportion — the
        dashed curve shows the gentler decay at half the frequency. dB = α × f × x: <b>double the
        frequency, double the loss</b>, halve the penetration.
      </>
    ),
  },
  {
    id: 'echoes',
    title: 'What the image sees: identical targets, darker with depth',
    phase: 'echoes',
    state: { tgc: FLAT_TGC, frequencyMHz: 5 },
    duration: 1.6,
    caption: (
      <>
        The B-mode panel holds <b>three identical reflectors</b> at 2, 5 and 9 cm. With no
        compensation the deep one is dimmest — not because it reflects less, but because its echo
        made the longest, most attenuated round trip.
      </>
    ),
  },
  {
    id: 'tgc',
    hands: true,
    title: 'TGC: amplify the late echoes until the targets match',
    phase: 'tgc',
    caption: (
      <>
        Drag the <b>TGC sliders</b> — more gain for the deeper bands — until the three targets look
        equally bright. TGC is a <b>receive-side</b> correction: it amplifies late echoes and their
        noise, and it changes <b>nothing</b> about what enters the patient.
      </>
    ),
  },
  {
    id: 'gain-vs-power',
    title: 'Gain and power are different levers',
    phase: 'gain-vs-power',
    duration: 1.2,
    caption: (
      <>
        <b>Receiver gain</b> and TGC brighten echo <b>and noise</b> after the fact — exposure
        unchanged. <b>Output power</b> puts more energy into the patient and raises <b>MI and
        TI</b>. Optimise gain, TGC, frequency and focus <b>before</b> reaching for power.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Build your own stack',
    phase: 'free',
    caption: (
      <>
        Swap layers, stretch them, sweep the frequency. Put <b>bone</b> in the path and watch the
        beam die; put <b>water</b> in and watch it sail through — the reason a full bladder is such
        a good acoustic window.
      </>
    ),
  },
]

export default function AttenuationPage() {
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

  const layers: Layer[] = useMemo(
    () => [
      { id: state.layer1, thicknessCm: state.thickness1 },
      { id: state.layer2, thicknessCm: state.thickness2 },
      { id: state.layer3, thicknessCm: state.thickness3 },
    ],
    [state.layer1, state.layer2, state.layer3, state.thickness1, state.thickness2, state.thickness3],
  )

  const derived = useMemo(() => {
    const profile = attenuationProfile(layers, state.frequencyMHz)
    const totalCm = layers.reduce((sum, layer) => sum + layer.thicknessCm, 0)
    // Thickness-weighted mean coefficient of the stack, for the summary numbers.
    const meanAlpha = layers.reduce((sum, layer) => sum + medium(layer.id).attenuation * layer.thicknessCm, 0) / totalCm
    const dbPerCm = meanAlpha * state.frequencyMHz
    return {
      profile,
      totalCm,
      meanAlpha,
      dbPerCm,
      mu: dbPerCmToMu(dbPerCm),
      hvl: halfValueLayerCm(meanAlpha, state.frequencyMHz),
    }
  }, [layers, state.frequencyMHz])

  /* --- controls announce their consequence immediately ------------------- */

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Attenuation per cm rises' : 'Attenuation per cm falls', dir: up ? 'warn' : 'down' },
      { text: up ? 'Penetration falls' : 'Penetration rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Axial resolution improves' : 'Axial resolution worsens', dir: up ? 'up' : 'down' },
      { text: 'Attenuation coefficient α unchanged', dir: 'flat' },
    ])
  }

  const onLayer = (slot: 1 | 2 | 3) => (value: MediumId) => {
    const previous = medium([state.layer1, state.layer2, state.layer3][slot - 1])
    const next = medium(value)
    const up = next.attenuation > previous.attenuation
    patch({ [`layer${slot}`]: value } as Partial<State>)
    flash.fire([
      { text: `Layer ${slot}: ${next.name}`, dir: 'flat' },
      { text: `α = ${next.attenuation} dB/cm/MHz`, dir: 'flat' },
      { text: up ? 'More of the beam lost in this layer' : 'Less of the beam lost in this layer', dir: up ? 'warn' : 'up' },
      { text: up ? 'Everything beyond it darkens' : 'Everything beyond it brightens', dir: up ? 'down' : 'up' },
    ])
  }

  const onThickness = (slot: 1 | 2 | 3) => (value: number) => {
    const previous = [state.thickness1, state.thickness2, state.thickness3][slot - 1]
    const up = value > previous
    patch({ [`thickness${slot}`]: value } as Partial<State>)
    flash.fire([
      { text: `Layer ${slot} now ${value.toFixed(1)} cm`, dir: 'flat' },
      { text: up ? 'Longer path — more dB lost' : 'Shorter path — fewer dB lost', dir: up ? 'warn' : 'up' },
      { text: 'Loss is linear in dB, exponential in intensity', dir: 'flat' },
    ])
  }

  const onPower = (value: number) => {
    const up = value > state.power
    patch({ power: value })
    flash.fire([
      { text: up ? 'Output power increased' : 'Output power decreased', dir: up ? 'warn' : 'down' },
      { text: up ? 'More energy enters the patient' : 'Less energy enters the patient', dir: up ? 'warn' : 'up' },
      { text: up ? 'MI and TI rise' : 'MI and TI fall', dir: up ? 'warn' : 'up' },
      { text: 'Attenuation per cm unchanged', dir: 'flat' },
    ])
  }

  const onGain = (value: number) => {
    const up = value > state.gainDb
    patch({ gainDb: value })
    flash.fire([
      { text: up ? 'Receiver gain increased' : 'Receiver gain decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Echoes AND noise amplified' : 'Echoes and noise reduced', dir: up ? 'warn' : 'flat' },
      { text: 'Patient exposure unchanged', dir: 'flat' },
    ])
  }

  const onTgc = (values: number[]) => {
    const rising = values[values.length - 1] > values[0]
    patch({ tgc: values })
    flash.fire([
      { text: 'TGC adjusted', dir: 'flat' },
      { text: rising ? 'Deeper echoes amplified more' : 'Deeper bands not yet boosted', dir: rising ? 'up' : 'flat' },
      { text: 'Receive-side only — exposure unchanged', dir: 'flat' },
      { text: 'Noise in those bands amplified too', dir: 'warn' },
    ])
  }

  /* --- the B-mode consequence -------------------------------------------- */

  const scene: BModeScene = useMemo(
    () => ({
      widthCm: 5,
      depthCm: 10,
      background: 0.38,
      backgroundAttenuation: derived.meanAlpha,
      targets: [
        // Three identical point targets at 2, 5 and 9 cm.
        { x: -0.5, depthCm: 2, radiusCm: 0.14, echogenicity: 0.9, scatter: 0.2 },
        { x: -0.5, depthCm: 5, radiusCm: 0.14, echogenicity: 0.9, scatter: 0.2 },
        { x: -0.5, depthCm: 9, radiusCm: 0.14, echogenicity: 0.9, scatter: 0.2 },
        // A low-attenuation cyst: posterior enhancement emerges by itself.
        { x: 0.45, depthCm: 3.2, radiusCm: 0.8, echogenicity: 0.02, attenuation: 0.02, scatter: 0.1 },
        // A stone-like target: high attenuation and a bright rim — shadow emerges.
        { x: 0.45, depthCm: 7, radiusCm: 0.35, echogenicity: 0.75, attenuation: 14, scatter: 0.3, rim: 0.9 },
      ],
    }),
    [derived.meanAlpha],
  )

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: state.gainDb,
      dynamicRangeDb: 55,
      tgc: state.tgc,
      focusCm: [5],
      apertureMm: 12,
      cycles: 2,
      power: state.power,
    }),
    [state.frequencyMHz, state.gainDb, state.tgc, state.power],
  )

  const deltas: Delta[] = [
    { label: 'depth ↑ → attenuation ↑', dir: 'up' },
    { label: 'f ↑ → attenuation ↑, penetration ↓', dir: 'up' },
    { label: 'TGC ↑ → deep echoes brighter, exposure =', dir: 'flat' },
    { label: 'power ↑ → exposure ↑ (MI, TI)', dir: 'warn' },
    { label: 'attenuation ⟂ impedance', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/attenuation"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Attenuation chamber">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="decay" size={14} />
                <b>Stage</b> Attenuation chamber
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Beam / linear intensity
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Loss in dB
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <AttenuationStage
                  layers={layers}
                  frequencyMHz={state.frequencyMHz}
                  profile={derived.profile}
                  time={clock}
                  phase={api.phase as AttenuationPhase}
                />
              </div>
              <div
                className="us-canvas-wrap"
                style={{ flex: '0 0 190px', maxWidth: 190, minWidth: 130 }}
              >
                <BMode
                  scene={scene}
                  settings={settings}
                  label={`${state.frequencyMHz} MHz · gain ${state.gainDb} dB`}
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
              <b>Enter manual lab</b> to build the tissue stack and drive the console yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'One-way loss', value: derived.profile.totalDb.toFixed(1), unit: 'dB', tone: 'amber' },
                {
                  label: 'Intensity remaining',
                  value: (derived.profile.remaining * 100).toPrecision(2),
                  unit: '%',
                  tone: 'cyan',
                },
                { label: 'Mean α (stack)', value: derived.meanAlpha.toFixed(2), unit: 'dB/cm/MHz' },
                { label: 'Loss per cm', value: derived.dbPerCm.toFixed(2), unit: 'dB/cm' },
                { label: 'µ (exponential)', value: derived.mu.toFixed(3), unit: 'cm⁻¹' },
                { label: 'Half-value layer', value: derived.hvl.toFixed(2), unit: 'cm', tone: 'green' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Beam" icon="wave" defaultOpen>
            <Slider
              label="Transmit frequency"
              unit="MHz"
              value={state.frequencyMHz}
              min={1}
              max={15}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint="dB = α × f × x. Frequency multiplies the loss in every centimetre — the whole penetration trade-off."
              markers={[
                { value: 3, label: '3 (deep)' },
                { value: 10, label: '10 (superficial)' },
              ]}
            />
          </ControlGroup>

          <ControlGroup title="Tissue stack" icon="layers" defaultOpen>
            <Select label="Layer 1 (shallow)" value={state.layer1} options={CHOICES} onChange={onLayer(1)} />
            <Slider
              label="Layer 1 thickness"
              unit="cm"
              value={state.thickness1}
              min={0.5}
              max={5}
              step={0.5}
              decimals={1}
              onChange={onThickness(1)}
            />
            <Select label="Layer 2" value={state.layer2} options={CHOICES} onChange={onLayer(2)} />
            <Slider
              label="Layer 2 thickness"
              unit="cm"
              value={state.thickness2}
              min={0.5}
              max={6}
              step={0.5}
              decimals={1}
              onChange={onThickness(2)}
            />
            <Select label="Layer 3 (deep)" value={state.layer3} options={CHOICES} onChange={onLayer(3)} />
            <Slider
              label="Layer 3 thickness"
              unit="cm"
              value={state.thickness3}
              min={0.5}
              max={6}
              step={0.5}
              decimals={1}
              onChange={onThickness(3)}
            />
          </ControlGroup>

          <ControlGroup title="Console" icon="sliders" defaultOpen={api.index >= 4}>
            <Slider
              label="Output power"
              unit="%"
              value={Math.round(state.power * 100)}
              min={10}
              max={100}
              step={5}
              onChange={(v) => onPower(v / 100)}
              hint="Transmit-side. More energy into the patient: MI and TI rise. The last lever to reach for."
            />
            <Slider
              label="Overall gain"
              unit="dB"
              value={state.gainDb}
              min={15}
              max={55}
              step={1}
              onChange={onGain}
              hint="Receive-side. Brightens echoes and noise equally at every depth; exposure unchanged."
            />
            <TgcSliders values={state.tgc} onChange={onTgc} />
            <p className="us-slider-hint">
              Aim: drag the deeper bands up until the three point targets on the image match. The
              stack needs roughly {derived.dbPerCm.toFixed(1)} dB of extra gain per cm of depth
              (two-way: ×2).
            </p>
          </ControlGroup>

          <ControlGroup title="Display" icon="eye">
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
              question="You double the transmit frequency with everything else fixed. What happens to the depth at which half the intensity is gone?"
              options={['It halves', 'It doubles', 'It is unchanged']}
              correct={0}
              explanation={
                <>
                  Loss in dB is α × <b>f</b> × x, so doubling f doubles the loss in every
                  centimetre — the half-value depth <b>halves</b>. That is the entire
                  resolution-versus-penetration bargain in one number.
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
                The {state.frequencyMHz} MHz beam loses <b>{derived.profile.totalDb.toFixed(1)} dB</b>{' '}
                crossing {derived.totalCm.toFixed(1)} cm of {medium(state.layer1).lower},{' '}
                {medium(state.layer2).lower} and {medium(state.layer3).lower} — only{' '}
                <b>{(derived.profile.remaining * 100).toPrecision(2)}%</b> of the intensity reaches
                the far side, one-way.
              </>
            }
            why={
              <>
                Each centimetre removes the same <b>fraction</b> of whatever arrives — mostly by{' '}
                <b>absorption to heat</b>, plus scatter and boundary reflections. A constant
                fraction per centimetre is exactly what an exponential is, and taking logarithms
                (decibels) straightens it into a line you can add up layer by layer.
              </>
            }
            equation={
              showEquation
                ? `dB = α × f × x        (α per MHz — only then does f multiply)
   = ${derived.meanAlpha.toFixed(2)} × ${state.frequencyMHz} × ${derived.totalCm.toFixed(1)} ≈ ${(derived.meanAlpha * state.frequencyMHz * derived.totalCm).toFixed(1)} dB (uniform-stack estimate)
   engine total incl. boundary losses = ${derived.profile.totalDb.toFixed(1)} dB

I = I₀ e^(−µx)         µ = ${derived.mu.toFixed(3)} cm⁻¹
I/I₀ after ${derived.totalCm.toFixed(1)} cm = ${(derived.profile.remaining * 100).toPrecision(3)} %
HVL = 3.01 dB ÷ (α·f) = ${derived.hvl.toFixed(2)} cm`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Choose the <b>highest frequency that still reaches the target</b>, then equalise the
                image with TGC. Fluid barely attenuates — hence <b>posterior enhancement</b> behind
                a cyst; bone and stone gut the beam — hence the <b>shadow</b>. Both are visible on
                the panel right now, and neither was drawn in by hand.
              </>
            }
            trap={
              showTrap ? (
                <>
                  Two recurring false stems: “attenuation is <b>mainly reflection and scatter</b>”
                  (FALSE — absorption dominates, QBank Q410, Q320) and “attenuation is{' '}
                  <b>proportional to acoustic impedance</b>” (FALSE — they are independent
                  properties, QBank Q410). Water: impedance close to tissue, attenuation near zero.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the numbers, TGC, and gain versus power">
            <p>
              <strong>The coefficient.</strong> Soft tissue attenuates at roughly{' '}
              <strong>0.5–1.0 dB/cm/MHz</strong>; the QBank quotes 0.8 as a typical single figure,
              and <strong>1 dB/cm/MHz</strong> is the common rule of thumb for the round trip. The
              frequency multiplier only applies when the coefficient is stated <em>per MHz</em> —
              “0.8 dB/cm at 1 MHz” is the same quantity written differently.
            </p>
            <p>
              <strong>The extremes.</strong> Lung and bone attenuate savagely — aerated lung as
              countless gas interfaces, bone by absorption. Water and simple fluid attenuate almost
              nothing, which is why a full bladder is an acoustic window and why enhancement appears
              behind anything fluid-filled.
            </p>
            <p>
              <strong>TGC</strong> applies depth-dependent receive amplification so identical
              reflectors match at every depth. It can also be used the other way — to suppress the
              over-bright band behind a fluid structure. It never changes what happens in the
              tissue.
            </p>
            <p>
              <strong>Gain versus power is a safety question.</strong> Gain and TGC are
              receive-side: exposure unchanged, noise amplified with signal. Output power is
              transmit-side: exposure, MI and TI all rise. Nearly all of the transmitted energy ends
              its life as <strong>heat in the patient</strong> — only a tiny fraction ever returns
              as echoes.
            </p>

            <TrapNote>
              “Turn up the brightness” hides two different levers. If asked which control raises
              patient exposure, the answer is <em>output power</em> — never receiver gain, never
              TGC. If asked what limits penetration at high frequency, the answer is attenuation,
              not impedance.
            </TrapNote>

            <SourceNote>
              QBank Q320 and Q410 carry the attenuation stems (exponential decay, absorption
              dominance, the 0.5–1.0 dB/cm/MHz range, no relationship to impedance); Q239 ranks
              lung and bone against water; Q379 covers TGC. The boundary-loss contribution in the
              profile comes from the same reflection coefficients as the Impedance stage.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The beam is drawn with width and brightness proportional to the remaining intensity —
            a visual encoding, not a beam-profile calculation. Every number on the stage (dB
            totals, ratios, HVL) comes from the engine&rsquo;s attenuation model, including the
            energy removed by reflection at each boundary.
          </ModelNote>
        </>
      }
    />
  )
}
