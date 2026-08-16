/**
 * Module 2 — Acoustic Impedance.
 *
 * The interface laboratory. Two media, their densities and speeds, the impedance
 * that falls out of them, and the fraction of the beam that comes back. The
 * comparison strip lets the learner see the four classic interfaces ranked
 * against each other, which is what the recall questions actually test.
 */

import { useCallback, useMemo, useState } from 'react'

import { ControlGroup, Select, Slider, StageFlash, Toggle, useFlash } from '../components/Controls'
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
import { InterfaceStage, type InterfacePhase } from '../scenes/InterfaceStage'
import {
  INTERFACE_MEDIA,
  impedance,
  interfaceFor,
  medium,
  reflectionCoefficient,
  type Medium,
  type MediumId,
} from '../engine'

type State = {
  a: MediumId
  b: MediumId
  gel: boolean
  customDensity: number
  customSpeed: number
  useCustom: boolean
}

const DEFAULTS: State = {
  a: 'softTissue',
  b: 'muscle',
  gel: false,
  customDensity: 1050,
  customSpeed: 1540,
  useCustom: false,
}

const CHOICES = INTERFACE_MEDIA.map((id) => ({ value: id, label: medium(id).name }))

const CLASSIC: { a: MediumId; b: MediumId; label: string }[] = [
  { a: 'softTissue', b: 'water', label: 'Soft tissue → fluid' },
  { a: 'softTissue', b: 'muscle', label: 'Soft tissue → muscle' },
  { a: 'muscle', b: 'bone', label: 'Muscle → bone' },
  { a: 'softTissue', b: 'air', label: 'Soft tissue → air' },
]

const STEPS: GuidedStep<State>[] = [
  {
    id: 'setup',
    title: 'Two media, four numbers',
    phase: 'setup',
    state: { a: 'softTissue', b: 'muscle', gel: false, useCustom: false },
    caption: (
      <>
        Each medium has a <b>density</b> and a <b>propagation speed</b>. Multiply them and you get
        the <b>acoustic impedance</b>, Z = ρc, measured in <b>rayls</b> — not decibels.
      </>
    ),
  },
  {
    id: 'incident',
    title: 'A pulse arrives at the boundary',
    phase: 'incident',
    duration: 1.6,
    caption: (
      <>
        All of the transmitted energy travels through the first medium and reaches the interface.
        What happens next is decided entirely by <b>how different the two impedances are</b>.
      </>
    ),
  },
  {
    id: 'split',
    title: 'The beam splits',
    phase: 'split',
    duration: 1.6,
    caption: (state) => {
      const info = interfaceFor(state.a, state.b)
      return (
        <>
          Some energy returns as an echo, the rest carries on.{' '}
          <b style={{ color: 'var(--us-amber)' }}>
            {info.reflectedPercent.toFixed(info.reflected < 0.01 ? 3 : 1)}% reflected
          </b>
          ,{' '}
          <b style={{ color: 'var(--us-green)' }}>
            {info.transmittedPercent.toFixed(2)}% transmitted
          </b>
          . The arrow thickness is drawn from those numbers.
        </>
      )
    },
  },
  {
    id: 'similar',
    title: 'Similar impedances transmit almost everything',
    phase: 'compare',
    state: { a: 'softTissue', b: 'muscle' },
    caption: (
      <>
        Soft tissue and muscle differ by only about 0.09 MRayl, so barely{' '}
        <b>0.07%</b> comes back. That weak reflection is a <b>good thing</b>: it is why the beam
        still has energy left after crossing many soft-tissue boundaries.
      </>
    ),
  },
  {
    id: 'bone',
    title: 'A large mismatch reflects strongly',
    phase: 'compare',
    state: { a: 'muscle', b: 'bone' },
    duration: 1.4,
    caption: (
      <>
        Bone is denser <b>and</b> much faster, so Z is roughly five times that of soft tissue.
        Around <b>40%</b> comes straight back — a bright line — and what does get in is absorbed
        rapidly, giving the shadow beyond.
      </>
    ),
  },
  {
    id: 'air',
    title: 'Air is a different order of magnitude',
    phase: 'compare',
    state: { a: 'softTissue', b: 'air', gel: false },
    duration: 1.4,
    caption: (
      <>
        Air is both very light and very slow, so its impedance is about <b>four thousand times</b>{' '}
        lower than soft tissue. Over <b>99%</b> is reflected. This is why bowel gas and aerated lung
        end the image.
      </>
    ),
  },
  {
    id: 'gel',
    title: 'Gel removes the air layer',
    phase: 'free',
    state: { a: 'softTissue', b: 'softTissue', gel: true },
    caption: (
      <>
        Coupling gel is formulated with an impedance close to skin. It does not amplify anything —
        it simply <b>displaces the air</b> that would otherwise reflect the whole beam before it
        ever entered the patient.
      </>
    ),
  },
]

function ComparisonStrip({
  onPick,
  active,
}: {
  onPick: (a: MediumId, b: MediumId) => void
  active: { a: MediumId; b: MediumId }
}) {
  const rows = CLASSIC.map((entry) => ({
    ...entry,
    r: reflectionCoefficient(impedance(medium(entry.a)), impedance(medium(entry.b))),
  }))
  const max = Math.max(...rows.map((row) => row.r))

  return (
    <div className="us-panel">
      <h3>
        <UsIcon name="layers" size={13} />
        The four interfaces worth knowing
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {rows.map((row) => {
          const isActive = row.a === active.a && row.b === active.b
          return (
            <button
              key={row.label}
              type="button"
              onClick={() => onPick(row.a, row.b)}
              className={isActive ? 'us-chip is-on' : 'us-chip'}
              style={{ justifyContent: 'space-between', width: '100%', borderRadius: 8 }}
            >
              <span style={{ flex: 1, textAlign: 'left' }}>{row.label}</span>
              <span
                aria-hidden="true"
                style={{
                  flex: '0 0 74px',
                  height: 5,
                  borderRadius: 3,
                  background: 'rgba(255,255,255,0.1)',
                  overflow: 'hidden',
                }}
              >
                <i
                  style={{
                    display: 'block',
                    height: '100%',
                    // Square-rooted so the sub-1% interfaces remain visible
                    // beside the 99% one.
                    width: `${Math.sqrt(row.r / max) * 100}%`,
                    background: 'var(--us-amber)',
                  }}
                />
              </span>
              <b style={{ flex: '0 0 58px', textAlign: 'right', color: 'var(--us-amber)' }}>
                {row.r < 0.01 ? `${(row.r * 100).toFixed(3)}%` : `${(row.r * 100).toFixed(1)}%`}
              </b>
            </button>
          )
        })}
      </div>
      <p className="us-slider-hint">
        Bars use a square-root scale so that a 0.07% interface is still visible beside a 99% one.
      </p>
    </div>
  )
}

export default function ImpedancePage() {
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

  const m1: Medium = medium(state.a)
  const m2: Medium = useMemo(() => {
    if (!state.useCustom) return medium(state.b)
    return {
      ...medium('softTissue'),
      id: 'custom' as MediumId,
      name: 'Custom material',
      lower: 'the custom material',
      density: state.customDensity,
      speed: state.customSpeed,
      colour: '#7ee8d8',
      note: undefined,
    }
  }, [state.b, state.useCustom, state.customDensity, state.customSpeed])

  const z1 = impedance(m1)
  const z2 = impedance(m2)
  const reflected = reflectionCoefficient(z1, z2)
  const transmitted = 1 - reflected

  const setPair = (a: MediumId, b: MediumId) => {
    const info = interfaceFor(a, b)
    const previous = reflected
    patch({ a, b, useCustom: false })
    flash.fire([
      { text: `${medium(a).name} → ${medium(b).name}`, dir: 'flat' },
      {
        text: `ΔZ = ${info.deltaZ.toFixed(info.deltaZ < 0.1 ? 3 : 2)} MRayl`,
        dir: 'flat',
      },
      {
        text: info.reflected > previous ? 'Reflection increases' : 'Reflection decreases',
        dir: info.reflected > previous ? 'up' : 'down',
      },
      {
        text: `${info.reflectedPercent.toFixed(info.reflected < 0.01 ? 3 : 1)}% comes back`,
        dir: info.reflected > 0.3 ? 'warn' : 'flat',
      },
    ])
  }

  const deltas: Delta[] = [
    { label: 'ρ ↑ → Z ↑', dir: 'up' },
    { label: 'c ↑ → Z ↑', dir: 'up' },
    { label: '|ΔZ| ↑ → reflection ↑', dir: 'up' },
    { label: '|ΔZ| ↑ → transmission ↓', dir: 'down' },
    { label: 'frequency → no effect on Z', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/impedance"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Interface stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="layers" size={14} />
                <b>Stage</b> Tissue interface
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Incident
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Reflected
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Transmitted
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                {/* The manual laboratory always draws the free stage. Left on the
                    guided step's phase, entering it from step 1 kept the scene in
                    'setup', which draws the two media, says "press Next" and
                    returns — so choosing an interface changed the numbers but
                    never the split the learner came to compare. */}
                <InterfaceStage
                  m1={m1}
                  m2={m2}
                  time={clock}
                  phase={api.mode === 'manual' ? 'free' : (api.phase as InterfacePhase)}
                  reflected={reflected}
                  showGel={state.gel}
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
              <b>Enter manual lab</b> to choose any pair of media yourself.
            </p>
          </section>

          <FocusHide>
          <Readout
            items={[
              { label: `Z₁ — ${m1.name}`, value: z1.toFixed(z1 < 0.1 ? 4 : 2), unit: 'MRayl', tone: 'cyan' },
              { label: `Z₂ — ${m2.name}`, value: z2.toFixed(z2 < 0.1 ? 4 : 2), unit: 'MRayl', tone: 'cyan' },
              {
                label: 'Impedance difference',
                value: Math.abs(z2 - z1).toFixed(Math.abs(z2 - z1) < 0.1 ? 4 : 2),
                unit: 'MRayl',
              },
              {
                label: 'Reflected',
                value: (reflected * 100).toFixed(reflected < 0.01 ? 3 : 1),
                unit: '%',
                tone: 'amber',
              },
              {
                label: 'Transmitted',
                value: (transmitted * 100).toFixed(transmitted < 0.999 ? 2 : 3),
                unit: '%',
                tone: 'green',
              },
            ]}
          />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Choose the interface" icon="layers" defaultOpen>
            <Select
              label="Medium 1 (beam arrives from here)"
              value={state.a}
              options={CHOICES}
              onChange={(v) => setPair(v, state.b)}
            />
            <Select
              label="Medium 2"
              value={state.b}
              options={CHOICES}
              onChange={(v) => setPair(state.a, v)}
            />
            <Toggle
              label="Coupling gel at the boundary"
              checked={state.gel}
              onChange={(v) => {
                patch({ gel: v })
                flash.fire([
                  { text: v ? 'Gel applied' : 'Gel removed', dir: v ? 'up' : 'warn' },
                  {
                    text: v ? 'Air layer displaced' : 'Air layer reflects >99%',
                    dir: v ? 'up' : 'warn',
                  },
                ])
              }}
              hint="Gel matches skin impedance closely. Its job is to remove the air gap, not to amplify the beam."
            />
          </ControlGroup>

          <ControlGroup title="Custom material" icon="sliders">
            <Toggle
              label="Use a custom second medium"
              checked={state.useCustom}
              onChange={(v) => patch({ useCustom: v })}
            />
            <Slider
              label="Density ρ"
              unit="kg/m³"
              value={state.customDensity}
              min={1}
              max={2200}
              step={10}
              onChange={(v) => {
                const up = v > state.customDensity
                patch({ customDensity: v, useCustom: true })
                flash.fire([
                  { text: up ? 'Density increased' : 'Density decreased', dir: up ? 'up' : 'down' },
                  { text: up ? 'Impedance rises' : 'Impedance falls', dir: up ? 'up' : 'down' },
                ])
              }}
              disabled={!state.useCustom}
              disabledReason="Switch on the custom medium to change these."
            />
            <Slider
              label="Propagation speed c"
              unit="m/s"
              value={state.customSpeed}
              min={300}
              max={4100}
              step={10}
              onChange={(v) => {
                const up = v > state.customSpeed
                patch({ customSpeed: v, useCustom: true })
                flash.fire([
                  { text: up ? 'Speed increased' : 'Speed decreased', dir: up ? 'up' : 'down' },
                  { text: up ? 'Impedance rises' : 'Impedance falls', dir: up ? 'up' : 'down' },
                ])
              }}
              disabled={!state.useCustom}
              disabledReason="Switch on the custom medium to change these."
            />
            <p className="us-slider-hint">
              Try matching the impedance of medium 1 using a <em>different</em> density and speed.
              Reflection falls to zero — proof that it is Z, not density alone, that matters.
            </p>
          </ControlGroup>

          <ComparisonStrip onPick={setPair} active={{ a: state.a, b: state.b }} />

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Which reflects more of the beam: soft tissue → bone, or soft tissue → air?"
              options={['Bone', 'Air', 'About the same']}
              correct={1}
              explanation={
                <>
                  Bone reflects roughly <b>43%</b> — a bright line and a dense shadow. Air reflects
                  over <b>99%</b>. Bone is dramatic on the image, but air is in a different league:
                  its impedance is about four thousand times lower than tissue.
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
                At the {m1.lower} → {m2.lower} boundary, Z changes from{' '}
                <b>{z1.toFixed(z1 < 0.1 ? 4 : 2)}</b> to <b>{z2.toFixed(z2 < 0.1 ? 4 : 2)} MRayl</b>.
                That mismatch sends <b>{(reflected * 100).toFixed(reflected < 0.01 ? 3 : 1)}%</b> of
                the intensity back as an echo.
              </>
            }
            why={
              <>
                Impedance measures how much a medium resists the passage of a pressure wave. When
                that resistance changes abruptly, part of the wave cannot continue and is reflected.
                The bigger the step, the bigger the echo — and the less energy is left to image
                anything deeper.
              </>
            }
            equation={
              showEquation
                ? `Z = ρ c
  Z₁ = ${m1.density} × ${m1.speed} = ${(z1 * 1e6).toExponential(3)} rayl = ${z1.toFixed(z1 < 0.1 ? 4 : 2)} MRayl
  Z₂ = ${m2.density} × ${m2.speed} = ${(z2 * 1e6).toExponential(3)} rayl = ${z2.toFixed(z2 < 0.1 ? 4 : 2)} MRayl

R = ((Z₂ − Z₁) / (Z₂ + Z₁))²
  = ((${z2.toFixed(3)} − ${z1.toFixed(3)}) / (${(z1 + z2).toFixed(3)}))²
  = ${reflected.toFixed(6)}  →  ${(reflected * 100).toFixed(reflected < 0.01 ? 3 : 1)} %

T ≈ 1 − R = ${(transmitted * 100).toFixed(2)} %`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                {reflected > 0.9
                  ? 'Nothing useful lies beyond this boundary. This is bowel gas, aerated lung, or a probe without gel.'
                  : reflected > 0.2
                    ? 'A bright interface followed by a shadow — bone, calcification or a stone. Image around it, not through it.'
                    : 'A weak boundary echo and almost total transmission. This is what lets the beam reach deep structures at all.'}
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Reflection occurs when there is a difference in tissue <b>densities</b>” is{' '}
                  <b>FALSE</b> (high-yield). It is a difference in <b>impedance</b>, which needs
                  speed as well. And impedance is measured in <b>rayls</b>, never decibels.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — why the mismatch is what matters">
            <p>
              <strong>Impedance is a property, reflection is an event.</strong> A single tissue has
              an impedance; only a <em>boundary</em> has a reflection coefficient. That is why the
              equation contains two Z values and takes their difference.
            </p>
            <p>
              <strong>The order does not matter.</strong> Swap Z₁ and Z₂ and R is unchanged, because
              the difference is squared. Going from bone into tissue reflects exactly as much as
              going from tissue into bone.
            </p>
            <p>
              <strong>Weak reflection is what makes imaging possible.</strong> If soft-tissue
              boundaries reflected strongly, the beam would be exhausted within a centimetre. The
              real echoes we image are typically well under 1% of the incident intensity — and the
              QBank confirms that reflections of 1% or less are easily detectable.
            </p>

            <TrapNote>
              Acoustic impedance is <em>not</em> affected by probe frequency, and it is <em>not</em>{' '}
              the sum of the attenuation of the tissues. Both appear as false stems in the
              question on what affects acoustic impedance. It is also intrinsic — it does not
              change because the tissue is moving.
            </TrapNote>

            <SourceNote>
              The question bank marks “15% of ultrasound is reflected at a soft tissue–fluid interface”{' '}
              <b>FALSE</b>. Working it through with Z ≈ 1.63 and 1.48 MRayl gives roughly{' '}
              <b>0.2%</b> — two orders of magnitude below the figure in the stem. Select soft tissue
              → water above and read the number off the stage.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Published impedance values differ in the second and third significant figures between
            textbooks, and vary widely for bone and lung. The relationships — and the orders of
            magnitude separating fluid, soft tissue, bone and air — are what this stage is built to
            teach.
          </ModelNote>
        </>
      }
    />
  )
}
