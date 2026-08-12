/**
 * Module 4 — Refraction & Transmission.
 *
 * A Snell's law simulator. Two media, an adjustable angle, and the transmitted
 * beam bending exactly as sin θ₁/c₁ = sin θ₂/c₂ demands. The stage shows the
 * critical angle only when the physics permits one (c₂ > c₁), and the artefact
 * phase shows what the straight-line assumption does to a reflector that was
 * really reached along a bent path.
 */

import { useCallback, useMemo, useState } from 'react'

import { ControlGroup, Segmented, Select, Slider, StageFlash, useFlash } from '../components/Controls'
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
import { RefractionStage, type RefractionPhase } from '../scenes/RefractionStage'
import {
  bendDirection,
  criticalAngleDeg,
  INTERFACE_MEDIA,
  medium,
  refractionAngleDeg,
  type MediumId,
} from '../engine'

type State = {
  a: MediumId
  b: MediumId
  angleDeg: number
  shape: 'flat' | 'curved'
  beamWidthPx: number
}

const DEFAULTS: State = {
  a: 'fat',
  b: 'muscle',
  angleDeg: 20,
  shape: 'flat',
  beamWidthPx: 14,
}

const CHOICES = INTERFACE_MEDIA.map((id) => ({ value: id, label: medium(id).name }))

const STEPS: GuidedStep<State>[] = [
  {
    id: 'setup',
    title: 'Two media, two speeds',
    phase: 'setup',
    state: { a: 'fat', b: 'muscle', angleDeg: 20, shape: 'flat' },
    caption: (
      <>
        Refraction is decided by <b>propagation speed</b>, not impedance. Fat carries sound at{' '}
        <b>1450 m/s</b>, muscle at <b>1580 m/s</b>. That difference — and the angle — is all
        Snell&rsquo;s law needs.
      </>
    ),
  },
  {
    id: 'normal-incidence',
    title: 'Normal incidence: no bending, however different the media',
    phase: 'normal-incidence',
    state: { a: 'fat', b: 'muscle', angleDeg: 0, shape: 'flat' },
    duration: 1.6,
    caption: (
      <>
        At <b>0°</b> — straight down the normal — the beam crosses into the faster medium{' '}
        <b>without bending at all</b>. sin 0 = 0 on both sides of the equation. Refraction needs{' '}
        <b>both</b> a speed difference <b>and</b> oblique incidence.
      </>
    ),
  },
  {
    id: 'oblique',
    title: 'Tilt the beam: the bend appears',
    phase: 'oblique',
    state: { a: 'fat', b: 'muscle', angleDeg: 25, shape: 'flat' },
    duration: 1.6,
    caption: (state) => {
      const t2 = refractionAngleDeg(state.angleDeg, medium(state.a).speed, medium(state.b).speed)
      return (
        <>
          Now the beam arrives at <b>{state.angleDeg.toFixed(0)}°</b> and leaves at{' '}
          <b>{t2 === null ? '—' : `${t2.toFixed(1)}°`}</b>. The transmitted beam has changed
          direction — and the machine, which assumes straight lines, has no idea.
        </>
      )
    },
  },
  {
    id: 'faster',
    title: 'Into a faster medium: away from the normal',
    phase: 'faster',
    state: { a: 'fat', b: 'muscle', angleDeg: 30, shape: 'flat' },
    duration: 1.4,
    caption: (
      <>
        c₂ &gt; c₁, so sin θ₂ must be <b>larger</b> than sin θ₁: the beam bends <b>away from the
        normal</b>. Fat → muscle is the classic exam example — a small bend, but enough to misplace
        what lies beneath.
      </>
    ),
  },
  {
    id: 'slower',
    title: 'Into a slower medium: towards the normal',
    phase: 'slower',
    state: { a: 'muscle', b: 'fat', angleDeg: 30, shape: 'flat' },
    duration: 1.4,
    caption: (
      <>
        Swap the media and the bend reverses: entering the <b>slower</b> medium the beam bends{' '}
        <b>towards the normal</b>. Same equation, same angle — only the speed ratio flipped.
      </>
    ),
  },
  {
    id: 'critical',
    title: 'The critical angle — only into a faster medium',
    phase: 'critical',
    state: { a: 'softTissue', b: 'bone', angleDeg: 30, shape: 'flat' },
    duration: 1.6,
    caption: (
      <>
        Fat → muscle will not show this within reach of a probe: its critical angle sits at{' '}
        <b>≈67°</b>. Soft tissue → <b>bone</b> (1540 → 4080 m/s) reaches it at only <b>≈22°</b>.
        Beyond that angle sin θ₂ would exceed 1 — impossible — so the beam is{' '}
        <b>totally reflected</b> and nothing crosses the boundary.
      </>
    ),
  },
  {
    id: 'artefact',
    title: 'The artefact: the machine draws the straight line anyway',
    phase: 'artefact',
    state: { a: 'fat', b: 'muscle', angleDeg: 30, shape: 'flat' },
    duration: 1.6,
    caption: (
      <>
        The echo really travelled along the <b>bent green path</b> — but the scanner plots it along
        the <b>original straight line</b>. The reflector is displayed <b>sideways of where it truly
        sits</b>. Switch the interface to <b>curved</b> in the manual lab to see the edge-shadow
        version of the same physics.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Drive Snell’s law yourself',
    phase: 'free',
    caption: (
      <>
        Pick any pair of media and sweep the angle. <b>Predict first</b>: towards or away from the
        normal? The bend depends only on the <b>angle and the two speeds</b> — never on the
        transmit frequency.
      </>
    ),
  },
]

export default function RefractionPage() {
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

  const m1 = medium(state.a)
  const m2 = medium(state.b)

  const derived = useMemo(() => {
    const theta2 = refractionAngleDeg(state.angleDeg, m1.speed, m2.speed)
    const critical = criticalAngleDeg(m1.speed, m2.speed)
    const bend = bendDirection(m1.speed, m2.speed)
    const sin1 = Math.sin((state.angleDeg * Math.PI) / 180)
    return {
      theta2,
      critical,
      bend,
      sin1,
      sin2: theta2 === null ? null : Math.sin((theta2 * Math.PI) / 180),
      tir: theta2 === null,
    }
  }, [m1, m2, state.angleDeg])

  /* --- controls announce their consequence immediately ------------------- */

  const firePair = (a: MediumId, b: MediumId) => {
    const s1 = medium(a).speed
    const s2 = medium(b).speed
    const bend = bendDirection(s1, s2)
    const critical = criticalAngleDeg(s1, s2)
    flash.fire([
      { text: `${medium(a).name} (${s1} m/s) → ${medium(b).name} (${s2} m/s)`, dir: 'flat' },
      {
        text:
          bend === 'straight'
            ? 'Speeds match — no bending at any angle'
            : bend === 'away'
              ? 'Faster medium — bends AWAY from the normal'
              : 'Slower medium — bends TOWARDS the normal',
        dir: bend === 'straight' ? 'flat' : bend === 'away' ? 'up' : 'down',
      },
      critical === null
        ? { text: 'No critical angle exists (c₂ ≤ c₁)', dir: 'flat' }
        : { text: `Critical angle ${critical.toFixed(1)}°`, dir: 'warn' },
    ])
  }

  const onMedium1 = (v: MediumId) => {
    patch({ a: v })
    firePair(v, state.b)
  }
  const onMedium2 = (v: MediumId) => {
    patch({ b: v })
    firePair(state.a, v)
  }

  const onAngle = (value: number) => {
    const up = value > state.angleDeg
    const theta2 = refractionAngleDeg(value, m1.speed, m2.speed)
    patch({ angleDeg: value })
    flash.fire([
      { text: up ? 'Angle of incidence increased' : 'Angle of incidence decreased', dir: up ? 'up' : 'down' },
      theta2 === null
        ? { text: 'Beyond the critical angle — total internal reflection', dir: 'warn' }
        : { text: `Refracted at ${theta2.toFixed(1)}° from the normal`, dir: 'flat' },
      value === 0
        ? { text: 'Normal incidence — no bending at all', dir: 'flat' }
        : { text: up ? 'Bending increases' : 'Bending decreases', dir: up ? 'up' : 'down' },
      { text: 'Transmit frequency plays no part', dir: 'flat' },
    ])
  }

  const onShape = (value: 'flat' | 'curved') => {
    patch({ shape: value })
    flash.fire([
      { text: value === 'curved' ? 'Curved interface' : 'Flat interface', dir: 'flat' },
      value === 'curved'
        ? { text: 'Edge rays refract outward — edge shadow appears', dir: 'warn' }
        : { text: 'Single incidence angle across the beam', dir: 'flat' },
    ])
  }

  const onBeamWidth = (value: number) => {
    const up = value > state.beamWidthPx
    patch({ beamWidthPx: value })
    flash.fire([
      { text: up ? 'Beam widened' : 'Beam narrowed', dir: up ? 'up' : 'down' },
      { text: 'Every ray in the beam obeys the same Snell’s law', dir: 'flat' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'c₂ > c₁ → bends away from normal', dir: 'up' },
    { label: 'c₂ < c₁ → bends towards normal', dir: 'down' },
    { label: 'θ₁ = 0 → no bending', dir: 'flat' },
    { label: 'θ₁ ↑ → bending ↑', dir: 'up' },
    { label: 'frequency → no effect', dir: 'flat' },
  ]

  const bendLabel =
    derived.bend === 'straight'
      ? 'not bend — the speeds match'
      : derived.bend === 'away'
        ? 'bend away from the normal'
        : 'bend towards the normal'

  return (
    <UsLab
      path="/ultrasound-lab/refraction"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Refraction stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="refract" size={14} />
                <b>Stage</b> Snell&rsquo;s law simulator
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Incident
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Reflected
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Refracted
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                {/* The manual laboratory always draws the free stage. Left on the
                    guided step's phase, entering it from step 1 put the scene in
                    'setup' — which draws the two media and then returns — so the
                    angle, beam-width and curved-interface controls all moved with
                    nothing on the stage to move. */}
                <RefractionStage
                  m1={m1}
                  m2={m2}
                  angleDeg={state.angleDeg}
                  shape={state.shape}
                  beamWidth={state.beamWidthPx}
                  time={clock}
                  phase={api.mode === 'manual' ? 'free' : (api.phase as RefractionPhase)}
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
              <b>Enter manual lab</b> to choose any pair of media and sweep the angle.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'θ₁ incidence', value: state.angleDeg.toFixed(0), unit: '°', tone: 'cyan' },
                {
                  label: 'θ₂ refraction',
                  value: derived.theta2 === null ? 'TIR' : derived.theta2.toFixed(1),
                  unit: derived.theta2 === null ? undefined : '°',
                  tone: derived.theta2 === null ? 'red' : 'green',
                },
                { label: 'c₁', value: m1.speed, unit: 'm/s' },
                { label: 'c₂', value: m2.speed, unit: 'm/s' },
                {
                  label: 'Critical angle',
                  value: derived.critical === null ? 'none (c₂ ≤ c₁)' : derived.critical.toFixed(1),
                  unit: derived.critical === null ? undefined : '°',
                  tone: derived.critical === null ? undefined : 'red',
                },
                {
                  label: 'Bend direction',
                  value:
                    derived.bend === 'straight'
                      ? 'straight'
                      : derived.bend === 'away'
                        ? 'away from normal'
                        : 'towards normal',
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
              onChange={onMedium1}
            />
            <Select label="Medium 2" value={state.b} options={CHOICES} onChange={onMedium2} />
            <p className="us-slider-hint">
              {derived.critical === null ? (
                <>
                  c₂ ≤ c₁ here, so <strong>no critical angle exists</strong> — total internal
                  reflection is impossible in this direction.
                </>
              ) : (
                <>
                  c₂ &gt; c₁, so a critical angle exists at{' '}
                  <strong>{derived.critical.toFixed(1)}°</strong>. Beyond it, nothing is
                  transmitted.
                </>
              )}
            </p>
          </ControlGroup>

          <ControlGroup title="Beam geometry" icon="refract" defaultOpen>
            <Slider
              label="Angle of incidence"
              unit="°"
              value={state.angleDeg}
              min={0}
              max={60}
              step={1}
              onChange={onAngle}
              hint="At 0° there is no refraction, however different the media. Bending needs obliquity."
              markers={[
                { value: 0, label: 'Normal' },
                { value: 25, label: '25°' },
              ]}
            />
            <Segmented
              label="Interface shape"
              value={state.shape}
              options={[
                { value: 'flat', label: 'Flat' },
                { value: 'curved', label: 'Curved' },
              ]}
              onChange={onShape}
            />
            <Slider
              label="Beam width"
              unit="px"
              value={state.beamWidthPx}
              min={4}
              max={30}
              step={2}
              onChange={onBeamWidth}
              hint="A wider beam makes the band of refracted energy easier to see — the physics is identical for every ray."
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
              key={`${state.a}-${state.b}`}
              question={`The beam crosses obliquely from ${m1.lower} (${m1.speed} m/s) into ${m2.lower} (${m2.speed} m/s). Will it bend towards or away from the normal?`}
              options={['Towards the normal', 'Away from the normal', 'It will not bend']}
              correct={derived.bend === 'towards' ? 0 : derived.bend === 'away' ? 1 : 2}
              explanation={
                <>
                  With c₁ = {m1.speed} m/s and c₂ = {m2.speed} m/s the beam must{' '}
                  <b>{bendLabel}</b>. Snell&rsquo;s law keeps sin θ/c constant across the boundary,
                  so the faster side always carries the larger angle.
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
              derived.tir ? (
                <>
                  At <b>{state.angleDeg.toFixed(0)}°</b> the {m1.lower} → {m2.lower} boundary is
                  beyond its critical angle of <b>{derived.critical?.toFixed(1)}°</b>: the beam is{' '}
                  <b>totally reflected</b> and no energy crosses at all.
                </>
              ) : (
                <>
                  The beam crosses from {m1.lower} into {m2.lower} at{' '}
                  <b>{state.angleDeg.toFixed(0)}°</b> and is refracted to{' '}
                  <b>{derived.theta2?.toFixed(1)}°</b> — bending{' '}
                  <b>
                    {derived.bend === 'straight'
                      ? 'not at all'
                      : derived.bend === 'away'
                        ? 'away from the normal'
                        : 'towards the normal'}
                  </b>
                  .
                </>
              )
            }
            why={
              <>
                The wavefront cannot break as it crosses the boundary, so the side of the beam that
                enters the new medium first changes speed first — and the whole front pivots. A
                faster second medium swings it away from the normal; a slower one pulls it towards
                the normal. Reflection answers to <b>impedance</b>; refraction answers to{' '}
                <b>speed</b>.
              </>
            }
            equation={
              showEquation
                ? `sin θ₁ / c₁ = sin θ₂ / c₂

sin ${state.angleDeg.toFixed(0)}° / ${m1.speed} = ${derived.sin1.toFixed(3)} / ${m1.speed}
${
  derived.tir
    ? `sin θ₂ would need to be ${((derived.sin1 * m2.speed) / m1.speed).toFixed(3)} > 1  →  IMPOSSIBLE
θ_critical = arcsin(c₁/c₂) = arcsin(${m1.speed}/${m2.speed}) = ${derived.critical?.toFixed(1)}°`
    : `sin θ₂ = sin θ₁ × c₂/c₁ = ${derived.sin1.toFixed(3)} × ${(m2.speed / m1.speed).toFixed(3)} = ${derived.sin2?.toFixed(3)}
θ₂ = ${derived.theta2?.toFixed(1)}°`
}${
                    derived.critical !== null && !derived.tir
                      ? `\nθ_critical = arcsin(${m1.speed}/${m2.speed}) = ${derived.critical.toFixed(1)}°   (exists because c₂ > c₁)`
                      : derived.critical === null
                        ? '\nNo critical angle: c₂ ≤ c₁'
                        : ''
                  }`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Refraction at a muscle or fat edge <b>misplaces anatomy sideways</b> and can
                duplicate deep structures behind the rectus muscles. At a curved wall it produces
                the <b>edge shadow</b> beneath the margins of a cyst or vessel. Fix it by changing
                the <b>scanning window or angle</b> — not the frequency.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “Refraction artefacts can be reduced by reducing the transmit frequency” is{' '}
                  <b>FALSE</b> (QBank Q382). Bending depends only on the <b>angle and the two
                  speeds</b>. Reflection is impedance; refraction is speed — the exam loves swapping
                  them.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the conditions, the critical angle, the artefact">
            <p>
              <strong>Two conditions, both required.</strong> At normal incidence there is no
              refraction however different the media; and if the speeds match, the beam runs
              straight however oblique the angle. One without the other does nothing.
            </p>
            <p>
              <strong>The critical angle only exists one way round.</strong> It needs c₂ &gt; c₁,
              so that sin θ₂ reaches 1 before θ₁ reaches 90°. Soft tissue → bone reaches it at
              about <strong>22°</strong>; going from a fast medium into a slow one, no critical
              angle exists at all — a diagram that shows one for any pair of tissues is wrong.
            </p>
            <p>
              <strong>The artefact is the straight-line assumption breaking.</strong> The machine
              plots every echo along the direction the pulse was transmitted. When the true path
              bent at a boundary, the reflector is drawn displaced — and at a curved interface the
              diverging edge rays leave wedges that nothing insonated: the edge shadow.
            </p>

            <TrapNote>
              Keep the two boundary behaviours apart: the <em>reflected</em> fraction is set by the{' '}
              <em>impedance</em> mismatch; the <em>transmitted</em> beam&rsquo;s new direction is
              set by the <em>speed</em> ratio. A boundary can reflect almost nothing yet still bend
              the beam — fat → muscle does exactly that.
            </TrapNote>

            <SourceNote>
              QBank Q379 and Q382 carry the refraction stems: Snell&rsquo;s law, the requirement for
              oblique incidence plus a speed difference, and the frequency trap. The critical-angle
              condition (c₂ &gt; c₁ only) is standard physics, and this stage only ever draws a
              critical angle when the engine returns one.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The stage draws intensity qualitatively — the reflected ray is kept faint below the
            critical angle so the refracted geometry stays legible. The angles themselves, the
            critical angle and the bend direction are computed exactly from the published speeds.
          </ModelNote>
        </>
      }
    />
  )
}
