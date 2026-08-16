/**
 * Module 3 — Reflection.
 *
 * The angle laboratory. One rule — the angle of reflection equals the angle of
 * incidence — and everything the question bank hangs off it: why brightness dies
 * as the probe tilts, why a rough surface is forgiving, why parenchyma looks
 * the same from every angle, and why a tendon fakes a tear the moment the beam
 * is off perpendicular.
 */

import { useCallback, useMemo, useState } from 'react'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
import { ControlGroup, Segmented, Slider, StageFlash, useFlash } from '../components/Controls'
import {
  GuidedCaption,
  GuidedTransport,
  Predict,
  useAnimationFrame,
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
import { ReflectionStage, type ReflectionPhase } from '../scenes/ReflectionStage'
import {
  clamp,
  impedance,
  medium,
  reflectionCoefficient,
  wavelengthMm,
  type MediumId,
} from '../engine'

type Mismatch = 'weak' | 'moderate' | 'strong'

type State = {
  angleDeg: number
  /** 0 = mirror smooth, 1 = rough. */
  roughness: number
  /** Reflector size relative to the wavelength. */
  sizeRel: number
  frequencyMHz: number
  mismatch: Mismatch
}

const DEFAULTS: State = {
  angleDeg: 0,
  roughness: 0,
  sizeRel: 10,
  frequencyMHz: 5,
  mismatch: 'moderate',
}

/** The impedance step behind each mismatch setting, computed from real media. */
const MISMATCH_PAIRS: Record<Mismatch, { a: MediumId; b: MediumId }> = {
  weak: { a: 'softTissue', b: 'liver' },
  moderate: { a: 'softTissue', b: 'fat' },
  strong: { a: 'muscle', b: 'bone' },
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'normal',
    title: 'Perpendicular incidence: the echo comes straight back',
    phase: 'normal',
    state: { angleDeg: 0, roughness: 0, sizeRel: 10, mismatch: 'moderate' },
    duration: 1.6,
    caption: (
      <>
        The beam strikes a large, smooth interface at <b>90°</b> — normal incidence. The reflected
        echo retraces the incident path and lands <b>back in the probe</b>. This is the geometry
        that gives the brightest, most reliable echo.
      </>
    ),
  },
  {
    id: 'oblique',
    title: 'Tilt the interface: θ incidence = θ reflection',
    phase: 'oblique',
    state: { angleDeg: 20, roughness: 0, sizeRel: 10 },
    duration: 1.6,
    caption: (state) => (
      <>
        The interface behaves like a <b>mirror</b>. At <b>{state.angleDeg.toFixed(0)}°</b> of tilt
        the reflected ray leaves at the same {state.angleDeg.toFixed(0)}° on the far side of the
        dashed <b>normal</b> — and it visibly <b>misses the probe</b>. The echo still exists; the
        probe just never hears it.
      </>
    ),
  },
  {
    id: 'brightness',
    title: 'Brightness depends on angle — not on impedance itself',
    phase: 'oblique',
    state: { angleDeg: 35, roughness: 0, sizeRel: 10 },
    caption: (
      <>
        Watch the small B-mode image: the interface <b>dims sharply</b> as the tilt grows, because
        less of the reflected energy re-enters the probe. Brightness tracks the{' '}
        <b>received echo intensity</b> — set by the impedance <b>difference</b> and the geometry —
        never by the impedance of either tissue on its own.
      </>
    ),
  },
  {
    id: 'diffuse',
    title: 'A rough surface scatters the echo into a fan',
    phase: 'specular-diffuse',
    state: { angleDeg: 25, roughness: 0.75, sizeRel: 10 },
    duration: 1.6,
    caption: (
      <>
        Roughen the interface and the single <b>specular</b> ray breaks into a <b>fan of weaker
        rays</b> — <b>diffuse</b> reflection. Each ray is dimmer, but some energy now returns over a
        range of angles, so a rough surface is far more forgiving of probe tilt.
      </>
    ),
  },
  {
    id: 'scatter',
    title: 'Structures smaller than the wavelength scatter in all directions',
    phase: 'scatter',
    state: { angleDeg: 0, roughness: 0, sizeRel: 0.3 },
    duration: 1.8,
    caption: (state) => (
      <>
        This target is only <b>{state.sizeRel.toFixed(1)}λ</b> across. It cannot reflect like a
        mirror — it <b>re-radiates wavelets in every direction</b>. Each echo is weak but almost{' '}
        <b>angle-independent</b>, which is why parenchyma looks the same however you tilt the probe.
        Interference between these wavelets is what creates <b>speckle</b>. <b>Red blood cells</b>{' '}
        are the classic sub-wavelength scatterers — and the reason Doppler gets any signal back from
        flowing blood.
      </>
    ),
  },
  {
    id: 'anisotropy',
    title: 'Anisotropy: a tendon goes dark off-perpendicular',
    phase: 'anisotropy',
    state: { angleDeg: 25, roughness: 0, sizeRel: 10, mismatch: 'moderate' },
    duration: 1.6,
    caption: (
      <>
        Tendon fibres are strong but fiercely <b>angle-dependent</b> reflectors. At 25° the echoes
        miss the probe and the tendon turns <b>falsely hypoechoic</b> — mimicking a tear. Press{' '}
        <b>Heel–toe correction</b> in the controls to rock the beam back to perpendicular and watch
        the fibrillar pattern return.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'The whole reflection story in one stage',
    phase: 'free',
    state: { angleDeg: 0, roughness: 0, sizeRel: 10 },
    caption: (
      <>
        <b>Specular</b> reflectors are bright but angle-critical. <b>Diffuse</b> surfaces trade
        brightness for tolerance. <b>Scatterers</b> are weak but see every angle equally. Enter the
        manual lab and drive the angle, roughness, size and mismatch yourself.
      </>
    ),
  },
]

export default function ReflectionPage() {
  const [state, setState] = useState<State>(DEFAULTS)
  const [showEquation, setShowEquation] = useState(true)
  const [showTrap, setShowTrap] = useState(true)
  const [revision, setRevision] = useState(false)
  const [detail, setDetail] = useState(false)
  const [heelToe, setHeelToe] = useState(false)
  const flash = useFlash()

  const patch = useCallback((next: Partial<State>) => setState((s) => ({ ...s, ...next })), [])
  const resetState = useCallback(() => {
    setState(DEFAULTS)
    setHeelToe(false)
    flash.clear()
  }, [flash])

  const api = useGuided<State>({ steps: STEPS, setState: patch, resetState })
  const clock = useClock(api.playing, 60, api.index)

  // Heel–toe correction: rock the probe smoothly back to perpendicular.
  useAnimationFrame((dt) => {
    const next = Math.max(0, state.angleDeg - dt * 42)
    patch({ angleDeg: next })
    if (next <= 0) setHeelToe(false)
  }, heelToe)

  const pair = MISMATCH_PAIRS[state.mismatch]
  const m1 = medium(pair.a)
  const m2 = medium(pair.b)

  const derived = useMemo(() => {
    const z1 = impedance(m1)
    const z2 = impedance(m2)
    const reflected = reflectionCoefficient(z1, z2)
    const lambda = wavelengthMm(m1.speed, state.frequencyMHz)
    // Display model: the probe only receives what still overlaps its aperture.
    // The received fraction falls roughly as cos of twice the tilt (the echo
    // walks off at 2θ), clamped before 90°.
    const angleFactor = Math.cos((clamp(state.angleDeg * 2, 0, 80) * Math.PI) / 180)
    // Sub-wavelength targets and rough surfaces return only weak backscatter.
    const sizeFactor = state.sizeRel >= 1 ? 1 : 0.05 + 0.1 * state.sizeRel
    const roughFactor = 1 - state.roughness * 0.7
    return {
      z1,
      z2,
      reflected,
      lambda,
      angleFactor,
      received: reflected * angleFactor * sizeFactor * roughFactor,
      reflectorMm: state.sizeRel * lambda,
    }
  }, [m1, m2, state.angleDeg, state.frequencyMHz, state.sizeRel, state.roughness])

  /* --- controls announce their consequence immediately ------------------- */

  const onAngle = (value: number) => {
    const up = value > state.angleDeg
    patch({ angleDeg: value })
    flash.fire([
      { text: up ? 'Beam tilted further off perpendicular' : 'Beam closer to perpendicular', dir: up ? 'warn' : 'up' },
      { text: 'Reflected ray leaves at the same angle', dir: 'flat' },
      { text: up ? 'Echo steered away from the probe' : 'Echo steered back towards the probe', dir: up ? 'down' : 'up' },
      { text: up ? 'Interface dims on the image' : 'Interface brightens on the image', dir: up ? 'down' : 'up' },
    ])
  }

  const onRoughness = (value: number) => {
    const up = value > state.roughness
    patch({ roughness: value })
    flash.fire([
      { text: up ? 'Surface roughened' : 'Surface smoothed', dir: 'flat' },
      { text: up ? 'Specular ray breaks into a fan' : 'Fan collapses to one specular ray', dir: up ? 'down' : 'up' },
      { text: up ? 'Each ray weaker' : 'Single ray stronger', dir: up ? 'down' : 'up' },
      { text: up ? 'Echo less angle-dependent' : 'Echo more angle-dependent', dir: up ? 'up' : 'warn' },
    ])
  }

  const onSize = (value: number) => {
    const up = value > state.sizeRel
    patch({ sizeRel: value })
    flash.fire([
      { text: up ? 'Reflector larger relative to λ' : 'Reflector smaller relative to λ', dir: up ? 'up' : 'down' },
      {
        text: value >= 1 ? 'Behaves as a specular reflector' : 'Behaves as a scatterer',
        dir: 'flat',
      },
      {
        text: value >= 1 ? 'Strong, angle-dependent echo' : 'Weak echo in all directions',
        dir: value >= 1 ? 'up' : 'down',
      },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Wavelength shortens' : 'Wavelength lengthens', dir: up ? 'down' : 'up' },
      {
        text: up
          ? 'More structures now larger than λ — more specular'
          : 'More structures now smaller than λ — more scatter',
        dir: 'flat',
      },
      { text: 'Reflection coefficient unchanged', dir: 'flat' },
    ])
  }

  const onMismatch = (value: Mismatch) => {
    const next = MISMATCH_PAIRS[value]
    const r = reflectionCoefficient(impedance(medium(next.a)), impedance(medium(next.b)))
    const up = r > derived.reflected
    patch({ mismatch: value })
    flash.fire([
      { text: `${medium(next.a).name} → ${medium(next.b).name}`, dir: 'flat' },
      { text: up ? 'Impedance mismatch larger' : 'Impedance mismatch smaller', dir: up ? 'up' : 'down' },
      { text: `${(r * 100).toFixed(r < 0.01 ? 3 : 1)}% reflected at the boundary`, dir: r > 0.3 ? 'warn' : 'flat' },
      { text: 'Angle rule unchanged: θi = θr', dir: 'flat' },
    ])
  }

  const onHeelToe = () => {
    if (state.angleDeg <= 0) {
      flash.fire([{ text: 'Already perpendicular — fibrils bright', dir: 'flat' }])
      return
    }
    setHeelToe(true)
    flash.fire([
      { text: 'Heel–toe rocking the probe', dir: 'flat' },
      { text: 'Beam returning to perpendicular', dir: 'up' },
      { text: 'Echoes steered back into the probe', dir: 'up' },
      { text: 'Fibrillar pattern returns — not a tear', dir: 'up' },
    ])
  }

  /* --- the B-mode consequence -------------------------------------------- */

  const scene: BModeScene = useMemo(() => {
    const baseEcho = { weak: 0.3, moderate: 0.55, strong: 0.95 }[state.mismatch]
    return {
      widthCm: 4,
      depthCm: 6,
      background: 0.3,
      backgroundAttenuation: 0.5,
      targets: [
        {
          x: 0,
          depthCm: 3.4,
          radiusCm: 0.12,
          halfWidthCm: 1.7,
          shape: 'box',
          // The interface dims as the probe tilts: cos(2θ), clamped.
          echogenicity: baseEcho * derived.angleFactor * (1 - state.roughness * 0.45),
          scatter: 0.25 + state.roughness * 0.5,
        },
      ],
    }
  }, [state.mismatch, state.roughness, derived.angleFactor])

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 34,
      dynamicRangeDb: 55,
      focusCm: [3.4],
      apertureMm: 12,
      cycles: 2,
    }),
    [state.frequencyMHz],
  )

  const deltas: Delta[] = [
    { label: 'θ incidence = θ reflection', dir: 'flat' },
    { label: 'tilt ↑ → echo received ↓', dir: 'down' },
    { label: '|ΔZ| ↑ → reflected fraction ↑', dir: 'up' },
    { label: 'roughness ↑ → angle dependence ↓', dir: 'down' },
    { label: 'size < λ → scatter in all directions', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/reflection"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Reflection stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="reflect" size={14} />
                <b>Stage</b> Angle of incidence laboratory
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
                <ReflectionStage
                  m1={m1}
                  m2={m2}
                  angleDeg={state.angleDeg}
                  roughness={state.roughness}
                  sizeRel={state.sizeRel}
                  frequencyMHz={state.frequencyMHz}
                  reflected={derived.reflected}
                  received={derived.received}
                  time={clock}
                  phase={api.phase as ReflectionPhase}
                />
              </div>
              <div
                className="us-canvas-wrap"
                style={{ flex: '0 0 168px', maxWidth: 168, minWidth: 120 }}
              >
                <BMode scene={scene} settings={settings} label={`tilt ${state.angleDeg.toFixed(0)}°`} />
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
              <b>Enter manual lab</b> to steer the angle, roughness and mismatch yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Angle of incidence', value: state.angleDeg.toFixed(0), unit: '°', tone: 'cyan' },
                { label: 'Angle of reflection', value: state.angleDeg.toFixed(0), unit: '°', tone: 'amber' },
                {
                  label: 'Reflected at boundary',
                  value: (derived.reflected * 100).toFixed(derived.reflected < 0.01 ? 3 : 1),
                  unit: '%',
                },
                {
                  label: 'Echo reaching probe',
                  value: derived.received < 0.0005 ? '≈0' : (derived.received * 100).toFixed(derived.received < 0.01 ? 3 : 1),
                  unit: '%',
                  tone: 'amber',
                },
                { label: 'Wavelength λ', value: derived.lambda.toFixed(2), unit: 'mm' },
                { label: 'Reflector size', value: derived.reflectorMm.toFixed(2), unit: 'mm' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Beam geometry" icon="reflect" defaultOpen>
            <Slider
              label="Angle of incidence"
              unit="°"
              value={state.angleDeg}
              min={0}
              max={60}
              step={1}
              onChange={onAngle}
              hint="0° is perpendicular. The reflected ray always leaves at the same angle on the other side of the normal."
              markers={[
                { value: 0, label: 'Perpendicular' },
                { value: 20, label: '20° tilt' },
              ]}
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
              hint="Frequency sets λ, and λ decides whether a structure reflects or scatters. It does not change the reflection coefficient."
            />
          </ControlGroup>

          <ControlGroup title="The interface" icon="layers" defaultOpen>
            <Segmented
              label="Impedance mismatch"
              value={state.mismatch}
              options={[
                { value: 'weak', label: 'Weak' },
                { value: 'moderate', label: 'Moderate' },
                { value: 'strong', label: 'Strong' },
              ]}
              onChange={onMismatch}
            />
            <p className="us-slider-hint">
              <strong>{m1.name} → {m2.name}</strong> — {(derived.reflected * 100).toFixed(derived.reflected < 0.01 ? 3 : 1)}%
              reflected at normal incidence. The mismatch sets <em>how much</em> reflects; the angle
              sets <em>where it goes</em>.
            </p>
            <Slider
              label="Interface roughness"
              value={Math.round(state.roughness * 100)}
              unit="%"
              min={0}
              max={100}
              step={5}
              onChange={(v) => onRoughness(v / 100)}
              hint="Smooth → one specular ray. Rough → a fan of weaker, less angle-dependent rays."
            />
            <Slider
              label="Reflector size relative to λ"
              unit="λ"
              value={state.sizeRel}
              min={0.2}
              max={10}
              step={0.1}
              decimals={1}
              onChange={onSize}
              hint="Below about 1λ the target stops reflecting and starts scattering in all directions."
            />
          </ControlGroup>

          <ControlGroup title="Anisotropy correction" icon="probe" defaultOpen={api.phase === 'anisotropy'}>
            <button type="button" className="us-btn" onClick={onHeelToe}>
              <UsIcon name="replay" size={13} />
              Heel–toe correction
            </button>
            <p className="us-slider-hint">
              Rocks the beam smoothly back to perpendicular. On a tendon this restores the bright
              fibrillar pattern — always do it before calling a tear.
            </p>
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
              question="You tilt the probe 20° off perpendicular to a vessel wall. What happens to the wall's brightness?"
              options={['It falls sharply', 'It rises', 'It is unchanged']}
              correct={0}
              explanation={
                <>
                  The wall is a <b>specular</b> reflector, so the echo leaves at 20° on the far side
                  of the normal — a full <b>40°</b> away from the returning path — and largely misses
                  the probe. The reflection still happens; the probe simply stops receiving it.
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
                The beam meets the {m1.lower} → {m2.lower} boundary at{' '}
                <b>{state.angleDeg.toFixed(0)}°</b> from perpendicular. The boundary reflects{' '}
                <b>{(derived.reflected * 100).toFixed(derived.reflected < 0.01 ? 3 : 1)}%</b>, but only{' '}
                <b>{derived.received < 0.0005 ? '≈0' : (derived.received * 100).toFixed(derived.received < 0.01 ? 3 : 1)}%</b>{' '}
                actually re-enters the probe.
              </>
            }
            why={
              <>
                A large smooth interface reflects like a mirror, so the echo leaves at exactly the
                incident angle on the far side of the normal. Perpendicular incidence sends it
                straight back; any tilt walks it away from the aperture. What the image shows is the{' '}
                <b>received</b> echo — geometry matters as much as the impedance step.
              </>
            }
            equation={
              showEquation
                ? `θ_incidence = θ_reflection = ${state.angleDeg.toFixed(0)}°

R = ((Z₂ − Z₁)/(Z₂ + Z₁))²
  = ((${derived.z2.toFixed(2)} − ${derived.z1.toFixed(2)})/(${(derived.z1 + derived.z2).toFixed(2)}))²
  = ${(derived.reflected * 100).toFixed(derived.reflected < 0.01 ? 3 : 1)} %

received ∝ R × cos(2θ)   (model, clamped)
         ≈ ${(derived.reflected * 100).toFixed(derived.reflected < 0.01 ? 3 : 1)}% × ${derived.angleFactor.toFixed(2)}`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Keep the beam <b>perpendicular</b> to a vessel wall, tendon, or the diaphragm to get
                the brightest, most reliable echo. When a tendon looks dark, <b>heel–toe</b> the
                probe before calling a tear — anisotropy is a geometry artefact, not pathology.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Image brightness is proportional to the acoustic impedance of the tissues” is{' '}
                  <b>FALSE</b> (QBank Q351). Brightness tracks the <b>echo intensity received</b>,
                  which comes from the impedance <b>difference</b> across the boundary and the
                  angle — not from either tissue's impedance on its own.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — specular, diffuse, scatter">
            <p>
              <strong>Specular</strong> reflection needs a smooth interface <em>larger than the
              wavelength</em> — diaphragm, vessel wall, bladder wall. It is strong and strongly
              angle-dependent: the whole echo goes one way, and the probe either catches it or it
              does not.
            </p>
            <p>
              <strong>Diffuse</strong> reflection comes from a rough surface. The energy spreads
              over a range of angles, so each direction gets less — but some of it returns to the
              probe from almost any approach.
            </p>
            <p>
              <strong>Scattering</strong> takes over when the structure is far <em>smaller than the
              wavelength</em>. The target re-radiates weak wavelets in all directions, which is why
              parenchyma keeps its brightness however the probe is angled — and why blood, whose
              cells are tiny compared with λ, scatters rather than reflects.
            </p>
            <p>
              <strong>Speckle</strong> is the interference pattern of those scattered wavelets
              within each resolution cell — constructive here, destructive there. It is a wave
              phenomenon, not a picture of tissue microstructure.
            </p>

            <TrapNote>
              “Speckle signal is due to diffuse reflection at tissue boundaries” is <b>FALSE</b>{' '}
              (QBank Q412). Speckle is <em>interference between scattered wavelets</em>, not
              reflection at boundaries. Keep the three mechanisms — specular, diffuse, scatter —
              separate and the stem falls apart.
            </TrapNote>

            <SourceNote>
              QBank Q351 also anchors the angle facts: the angle of reflection equals the angle of
              incidence, and B-mode brightness depends on the probe angle relative to the interface.
              Q320 and Q412 carry the specular-versus-scatter distinction. The anisotropy behaviour
              is standard physics, and the heel–toe manoeuvre is its standard correction.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The received-echo fraction on this stage falls as cos(2θ), clamped — a teaching model of
            the echo walking off the aperture, not a diffraction calculation. The reflection
            coefficient itself, and everything it depends on, is computed exactly from Z = ρc.
          </ModelNote>
        </>
      }
    />
  )
}
