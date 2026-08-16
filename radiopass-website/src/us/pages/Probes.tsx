/**
 * Module 18 — Probe Selection.
 *
 * The selection laboratory. A rack of six probes; picking one draws its
 * footprint and element arrangement, its field of view on a torso, its typical
 * frequency range on a 1–20 MHz axis, and the penetration and resolution the
 * engine computes at the chosen frequency.
 *
 * Two experiments run underneath it. The RIB-SPACE TEST shows that footprint is
 * an access criterion entirely separate from frequency: a linear array with far
 * better resolution simply cannot see between the ribs. The SAME-TARGET
 * COMPARISON images one mid-depth target with three probes, so resolution,
 * penetration and field of view are compared on the picture rather than in a
 * table.
 */

import { useCallback, useMemo, useState } from 'react'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
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
import { ProbeStage, type ProbeId, type ProbePhase, type ProbeShape } from '../scenes/ProbeStage'
import {
  axialResolutionMm,
  focusedBeamWidthMm,
  medium,
  nearFieldLengthMm,
  penetrationDepthCm,
  wavelengthMm,
} from '../engine'

/**
 * The rack.
 *
 * Frequency ranges are the typical ranges recorded in `engine/facts.ts`; every
 * one of them is labelled on screen as a typical range, because exact bandwidth
 * varies by manufacturer and probe. Footprints and active apertures are
 * representative dimensions used to drive the geometry — they are not
 * manufacturer specifications.
 */
type ProbeInfo = ProbeShape & {
  /** Active transmit aperture in mm — a sub-aperture, not the whole array. */
  apertureMm: number
  uses: string
  factId: string
  summary: string
}

const PROBES: ProbeInfo[] = [
  {
    id: 'linear',
    name: 'Linear array',
    footprintMm: 38,
    apertureMm: 12,
    elements: 24,
    curvature: 0,
    field: 'rect',
    sectorDeg: 0,
    minMHz: 5,
    maxMHz: 15,
    uses: 'Vascular, thyroid, breast, testis, musculoskeletal, procedural guidance',
    factId: 'us-linear-array',
    summary:
      'Scan lines leave at right angles to the face, so the field of view is a rectangle the width of the probe.',
  },
  {
    id: 'curvilinear',
    name: 'Curvilinear array',
    footprintMm: 58,
    apertureMm: 14,
    elements: 22,
    curvature: 1,
    field: 'sector',
    sectorDeg: 66,
    minMHz: 2,
    maxMHz: 5,
    uses: 'Abdomen, pelvis, obstetrics',
    factId: 'us-curvilinear',
    summary:
      'The curved face makes the scan lines diverge, giving a wide field at depth from a manageable footprint.',
  },
  {
    id: 'phased',
    name: 'Phased array',
    footprintMm: 16,
    apertureMm: 14,
    elements: 16,
    curvature: 0,
    field: 'apexSector',
    sectorDeg: 84,
    minMHz: 1,
    maxMHz: 5,
    uses: 'Cardiac, intercostal, FAST, transcranial',
    factId: 'us-phased-array',
    summary:
      'All elements fire for every line with graded delays, sweeping a wide sector from a very small aperture.',
  },
  {
    id: 'endocavitary',
    name: 'Endocavitary',
    footprintMm: 22,
    apertureMm: 8,
    elements: 18,
    curvature: 1,
    field: 'fan',
    sectorDeg: 120,
    minMHz: 6,
    maxMHz: 12,
    uses: 'Transvaginal, transrectal',
    factId: 'us-endocavitary',
    summary:
      'Being centimetres from the target removes the penetration constraint, so a high frequency becomes usable.',
  },
  {
    id: 'hockey',
    name: 'Hockey-stick',
    footprintMm: 20,
    apertureMm: 6,
    elements: 14,
    curvature: 0,
    field: 'rect',
    sectorDeg: 0,
    minMHz: 10,
    maxMHz: 20,
    uses: 'Fingers, tendons, small joints, paediatric structures, superficial procedures',
    factId: 'us-hockey-stick',
    summary: 'A very small footprint and a very high frequency, for very superficial work.',
  },
  {
    id: 'cw',
    name: 'CW pencil probe',
    footprintMm: 12,
    apertureMm: 8,
    elements: 2,
    curvature: 0,
    field: 'line',
    sectorDeg: 0,
    minMHz: 2,
    maxMHz: 8,
    uses: 'Very high cardiac velocities, obstetric fetal heart detection',
    factId: 'us-cw-pw',
    summary:
      'Separate transmitting and receiving elements, sampling continuously. No image, and no range resolution.',
  },
]

const PROBE_BY_ID = new Map(PROBES.map((p) => [p.id, p]))
const probeById = (id: ProbeId): ProbeInfo => PROBE_BY_ID.get(id) ?? PROBES[0]

const PROBE_CHOICES = PROBES.map((p) => ({ value: p.id, label: p.name }))

/** Typical intercostal window at the skin, in millimetres. */
const RIB_GAP_MM = 18

/**
 * The penetration model.
 *
 * `penetrationDepthCm` divides a usable dynamic range by the round-trip
 * attenuation. 60 dB is used here as the useful working range of a mid-range
 * scanner, which puts the resulting depths on the clinical scale a candidate
 * will recognise.
 */
const USABLE_DB = 60

/** Centre of a probe's typical range, used when the rack selection changes. */
const centreOf = (p: ProbeInfo) => Math.round(((p.minMHz + p.maxMHz) / 2) * 2) / 2

type State = {
  probeId: ProbeId
  frequencyMHz: number
  targetDepthCm: number
  ribWindow: boolean
}

const DEFAULTS: State = {
  probeId: 'linear',
  frequencyMHz: centreOf(probeById('linear')),
  targetDepthCm: 3,
  ribWindow: false,
}

/** The selection rule, applied: the highest frequency that still reaches. */
function recommendedProbe(targetDepthCm: number, ribWindow: boolean): ProbeInfo {
  if (ribWindow) return probeById('phased')
  if (targetDepthCm <= 2) return probeById('hockey')
  if (targetDepthCm <= 6) return probeById('linear')
  return probeById('curvilinear')
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'rule',
    title: 'The selection rule',
    phase: 'rule',
    state: { probeId: 'linear', frequencyMHz: 10, targetDepthCm: 3, ribWindow: false },
    caption: (
      <>
        Resolution and penetration pull in opposite directions, so probe choice is a compromise
        decided by <b>target depth</b>: use the <b>highest frequency that still reaches the
        target</b>. Then check <b>footprint</b> separately — acoustic access is a different problem
        from image quality.
      </>
    ),
    detail:
      'Two independent criteria. Frequency decides what the image looks like; footprint decides whether you can get the beam in at all.',
  },
  {
    id: 'linear',
    title: 'Linear array — a rectangle of superb superficial detail',
    phase: 'linear',
    state: { probeId: 'linear', frequencyMHz: 10, targetDepthCm: 3, ribWindow: false },
    duration: 1.4,
    caption: (
      <>
        Scan lines leave at <b>right angles</b> to a flat face, so the field of view is a{' '}
        <b>rectangle</b> as wide as the probe. Typically <b>5–15 MHz</b>: vascular, thyroid, breast,
        testis, musculoskeletal and procedural guidance.
      </>
    ),
  },
  {
    id: 'curvilinear',
    title: 'Curvilinear — a wide field at depth',
    phase: 'curvilinear',
    state: { probeId: 'curvilinear', frequencyMHz: 3.5, targetDepthCm: 12, ribWindow: false },
    duration: 1.4,
    caption: (
      <>
        The <b>curved face</b> makes the scan lines diverge, so a manageable footprint still gives a
        broad field deep in the abdomen. Typically <b>2–5 MHz</b>: abdomen, pelvis and obstetrics.
      </>
    ),
  },
  {
    id: 'phased',
    title: 'Phased array — the footprint that fits between ribs',
    phase: 'phased',
    state: { probeId: 'phased', frequencyMHz: 3, targetDepthCm: 12, ribWindow: true },
    duration: 1.6,
    caption: (state) => (
      <>
        All elements fire for every line with graded delays, sweeping a wide sector from a tiny
        aperture. Its <b>{probeById('phased').footprintMm} mm</b> face fits the{' '}
        <b>{RIB_GAP_MM} mm</b> rib space; the linear array’s{' '}
        <b>{probeById('linear').footprintMm} mm</b> face does not, and the beam is blocked by the rib
        shadows. Switch the probe chip back to <b>Linear</b> and watch it fail
        {state.ribWindow ? '' : ' with the rib window on'}.
      </>
    ),
  },
  {
    id: 'endocavitary',
    title: 'Endocavitary — high frequency because the probe is CLOSE',
    phase: 'endocavitary',
    state: { probeId: 'endocavitary', frequencyMHz: 9, targetDepthCm: 4, ribWindow: false },
    duration: 1.4,
    caption: (
      <>
        Being centimetres rather than tens of centimetres from the target <b>removes the penetration
        constraint</b>, so <b>6–12 MHz</b> becomes usable and resolution improves dramatically.
        Transvaginal and transrectal imaging. Nothing about the crystal changed — only the distance.
      </>
    ),
  },
  {
    id: 'hockey',
    title: 'Hockey-stick — very small, very high, very superficial',
    phase: 'hockey',
    state: { probeId: 'hockey', frequencyMHz: 15, targetDepthCm: 1.5, ribWindow: false },
    duration: 1.4,
    caption: (
      <>
        Typically <b>10–20 MHz</b> with a footprint of a centimetre or two: fingers, tendons, small
        joints, paediatric structures and superficial procedures. It <em>fits</em> almost anywhere —
        but push the target deeper and it runs out of penetration immediately.
      </>
    ),
  },
  {
    id: 'cw',
    title: 'CW pencil — velocity without an image',
    phase: 'cw',
    state: { probeId: 'cw', frequencyMHz: 4, targetDepthCm: 8, ribWindow: false },
    duration: 1.4,
    caption: (
      <>
        Separate transmitting and receiving elements, sampling <b>continuously</b>. It{' '}
        <b>cannot alias</b>, so very high cardiac velocities are measurable — but it records
        everything along the beam and has <b>no range resolution</b>, so it cannot say what depth the
        signal came from. It forms no image at all.
      </>
    ),
  },
  {
    id: 'summary',
    title: 'Footprint and frequency are separate criteria',
    phase: 'summary',
    state: { probeId: 'phased', frequencyMHz: 3, targetDepthCm: 14, ribWindow: true },
    caption: (
      <>
        <b>Frequency</b> decides resolution and penetration. <b>Footprint</b> decides whether you can
        reach the target at all. A linear probe may have far better resolution and still be useless
        if it cannot fit in the acoustic window.
      </>
    ),
  },
  {
    id: 'free',
    hands: true,
    title: 'Now choose for yourself',
    phase: 'free',
    caption: (
      <>
        Move the <b>target depth</b> slider and watch the recommended probe change, then check your
        choice against the penetration bar. Turn the <b>rib window</b> on and try every probe in the
        rack.
      </>
    ),
  },
]

/* ------------------------------------------------------------------ *
 * The same-target comparison
 * ------------------------------------------------------------------ */

const COMPARISON_IDS: ProbeId[] = ['linear', 'curvilinear', 'phased']

function ComparisonPanel({ targetDepthCm }: { targetDepthCm: number }) {
  const soft = medium('softTissue')
  // Memoised as a whole: each panel is a full B-mode computation, and the page
  // re-renders on every animation frame.
  const panels = useMemo(() => {
    const targets = [
      { x: 0, depthCm: targetDepthCm, radiusCm: 0.55, echogenicity: 0.03, attenuation: 0.03, scatter: 0.12 },
      { x: -0.45, depthCm: targetDepthCm, radiusCm: 0.05, echogenicity: 0.95, scatter: 0.2 },
      { x: 0.45, depthCm: targetDepthCm, radiusCm: 0.05, echogenicity: 0.95, scatter: 0.2 },
    ]
    return COMPARISON_IDS.map((id) => {
      const p = probeById(id)
      const f = centreOf(p)
      const scene: BModeScene = {
        widthCm: 6,
        depthCm: 16,
        background: 0.34,
        backgroundAttenuation: soft.attenuation,
        geometry: p.field === 'rect' ? 'linear' : 'sector',
        sectorDegrees: p.sectorDeg || 70,
        targets,
      }
      const settings: BModeSettings = {
        frequencyMHz: f,
        gainDb: 36,
        dynamicRangeDb: 55,
        focusCm: [targetDepthCm],
        apertureMm: p.apertureMm,
        cycles: 2,
      }
      return { id, name: p.name, label: `${f} MHz`, scene, settings }
    })
  }, [soft.attenuation, targetDepthCm])

  return (
    <div className="us-panel">
      <h3>
        <UsIcon name="probes" size={13} />
        The same target, three probes
      </h3>
      <div style={{ display: 'flex', gap: 6 }}>
        {panels.map((panel) => (
          <div key={panel.id} style={{ flex: 1, minWidth: 0 }}>
            <div className="us-canvas-wrap" style={{ height: 132 }}>
              <BMode
                scene={panel.scene}
                settings={panel.settings}
                label={panel.label}
                showRuler={false}
              />
            </div>
            {/* Which probe produced the image above it — a figure caption, so
                metadata size from the scale rather than an invented 10px. */}
            <small
              style={{
                display: 'block',
                textAlign: 'center',
                fontSize: 'var(--fs-meta)',
                color: 'var(--us-muted)',
                marginTop: 'var(--sp-1)',
              }}
            >
              {panel.name}
            </small>
          </div>
        ))}
      </div>
      <p className="us-slider-hint">
        One cyst with a wire either side, at <strong>{targetDepthCm.toFixed(0)} cm</strong>, imaged
        by each probe at its own centre frequency and its own field geometry. Resolution, penetration
        and field of view all change together — which is exactly why probe choice is a compromise.
      </p>
    </div>
  )
}

/* ------------------------------------------------------------------ */

export default function ProbesPage() {
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

  const probe = probeById(state.probeId)
  const soft = medium('softTissue')

  const derived = useMemo(() => {
    const lambda = wavelengthMm(soft.speed, state.frequencyMHz)
    const penetration = penetrationDepthCm(soft.attenuation, state.frequencyMHz, USABLE_DB)
    const nearField = nearFieldLengthMm(probe.apertureMm, lambda) / 10
    const lateral = focusedBeamWidthMm(
      state.targetDepthCm * 10,
      probe.apertureMm,
      lambda,
      state.targetDepthCm * 10,
    )
    return {
      lambda,
      penetration,
      nearField,
      lateral,
      axial: axialResolutionMm(2, lambda),
      fitsRib: probe.footprintMm <= RIB_GAP_MM,
      reaches: penetration >= state.targetDepthCm,
    }
  }, [probe, soft, state.frequencyMHz, state.targetDepthCm])

  const recommended = recommendedProbe(state.targetDepthCm, state.ribWindow)
  const blocked = state.ribWindow && !derived.fitsRib

  /* --- controls announce their consequence immediately -------------------- */

  const onProbe = (value: ProbeId) => {
    const next = probeById(value)
    const f = centreOf(next)
    const higher = f > state.frequencyMHz
    patch({ probeId: value, frequencyMHz: f })
    flash.fire([
      { text: `Probe: ${next.name}`, dir: 'flat' },
      { text: `Typical range ${next.minMHz}–${next.maxMHz} MHz`, dir: higher ? 'up' : 'down' },
      { text: higher ? 'Resolution improves' : 'Resolution worsens', dir: higher ? 'up' : 'down' },
      { text: higher ? 'Penetration falls' : 'Penetration rises', dir: higher ? 'down' : 'up' },
      {
        text:
          state.ribWindow && next.footprintMm > RIB_GAP_MM
            ? 'Footprint will not fit the rib space'
            : `Footprint ${next.footprintMm} mm`,
        dir: state.ribWindow && next.footprintMm > RIB_GAP_MM ? 'warn' : 'flat',
      },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Wavelength shortens' : 'Wavelength lengthens', dir: up ? 'down' : 'up' },
      { text: up ? 'Axial and lateral resolution improve' : 'Resolution worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Penetration falls' : 'Penetration rises', dir: up ? 'down' : 'up' },
      { text: 'Footprint unchanged — access is a separate problem', dir: 'flat' },
    ])
  }

  const onDepth = (value: number) => {
    const up = value > state.targetDepthCm
    const rec = recommendedProbe(value, state.ribWindow)
    patch({ targetDepthCm: value })
    flash.fire([
      { text: up ? 'Target is deeper' : 'Target is shallower', dir: up ? 'up' : 'down' },
      { text: up ? 'A lower frequency is needed' : 'A higher frequency becomes usable', dir: up ? 'down' : 'up' },
      { text: `Recommended: ${rec.name}`, dir: 'flat' },
    ])
  }

  const onRib = (value: boolean) => {
    patch({ ribWindow: value })
    flash.fire([
      { text: value ? 'Intercostal window in place' : 'Rib window removed', dir: 'flat' },
      {
        text: value
          ? `Only a footprint under ${RIB_GAP_MM} mm gets in`
          : 'Footprint no longer restricts access',
        dir: value ? 'warn' : 'up',
      },
      {
        text:
          value && probe.footprintMm > RIB_GAP_MM
            ? `${probe.name} is blocked by the rib shadows`
            : `${probe.name} fits`,
        dir: value && probe.footprintMm > RIB_GAP_MM ? 'warn' : 'up',
      },
      { text: 'Frequency is irrelevant to this test', dir: 'flat' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'target depth ↑ → frequency ↓', dir: 'down' },
    { label: 'frequency ↑ → resolution ↑', dir: 'up' },
    { label: 'frequency ↑ → penetration ↓', dir: 'down' },
    { label: 'probe closer to target → frequency ↑', dir: 'up' },
    { label: 'footprint ↓ → access ↑', dir: 'up' },
    { label: 'footprint → no effect on resolution', dir: 'flat' },
  ]

  const scene: BModeScene = useMemo(
    () => ({
      widthCm: 6,
      depthCm: 16,
      background: 0.34,
      backgroundAttenuation: soft.attenuation,
      geometry: probe.field === 'rect' ? 'linear' : 'sector',
      sectorDegrees: probe.sectorDeg || 70,
      targets: [
        { x: 0, depthCm: state.targetDepthCm, radiusCm: 0.55, echogenicity: 0.03, attenuation: 0.03, scatter: 0.12 },
        { x: -0.45, depthCm: state.targetDepthCm, radiusCm: 0.05, echogenicity: 0.95, scatter: 0.2 },
        { x: 0.45, depthCm: state.targetDepthCm, radiusCm: 0.05, echogenicity: 0.95, scatter: 0.2 },
      ],
    }),
    [soft.attenuation, probe.field, probe.sectorDeg, state.targetDepthCm],
  )

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 36,
      dynamicRangeDb: 55,
      focusCm: [state.targetDepthCm],
      apertureMm: probe.apertureMm,
      cycles: 2,
    }),
    [state.frequencyMHz, state.targetDepthCm, probe.apertureMm],
  )

  return (
    <UsLab
      path="/ultrasound-lab/probes"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Probe selection stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="probes" size={14} />
                <b>Stage</b> The probe rack
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Field of view
                </span>
                <span>
                  <i style={{ background: 'var(--us-violet)' }} /> Near field
                </span>
                <span>
                  <i className="is-dot" style={{ background: 'var(--us-green)' }} /> Target reached
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <ProbeStage
                  probe={probe}
                  frequencyMHz={state.frequencyMHz}
                  targetDepthCm={state.targetDepthCm}
                  ribWindow={state.ribWindow}
                  penetrationCm={derived.penetration}
                  nearFieldCm={derived.nearField}
                  lateralMm={derived.lateral}
                  axialMm={derived.axial}
                  fitsRibSpace={derived.fitsRib}
                  ribGapMm={RIB_GAP_MM}
                  time={clock}
                  phase={api.phase as ProbePhase}
                />
              </div>
              <div
                className="us-canvas-wrap"
                style={{ flex: '0 0 168px', maxWidth: 168, minWidth: 120 }}
              >
                <BMode
                  scene={scene}
                  settings={settings}
                  label={`${probe.name} · ${state.frequencyMHz.toFixed(1)} MHz`}
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
              <b>Enter manual lab</b> to pick any probe and any target depth yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Footprint', value: probe.footprintMm, unit: 'mm', tone: blocked ? 'red' : 'cyan' },
                { label: 'Typical range', value: `${probe.minMHz}–${probe.maxMHz}`, unit: 'MHz' },
                { label: 'Wavelength λ', value: derived.lambda.toFixed(2), unit: 'mm' },
                {
                  label: 'Penetration',
                  value: derived.penetration.toFixed(1),
                  unit: 'cm',
                  tone: derived.reaches ? 'green' : 'amber',
                },
                { label: 'Near-field length', value: derived.nearField.toFixed(1), unit: 'cm', tone: 'violet' },
                { label: 'Lateral res. at target', value: derived.lateral.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'Axial resolution', value: derived.axial.toFixed(2), unit: 'mm', tone: 'cyan' },
                {
                  label: 'Rib space',
                  value: state.ribWindow ? (derived.fitsRib ? 'Fits' : 'Blocked') : 'Not tested',
                  tone: state.ribWindow ? (derived.fitsRib ? 'green' : 'red') : undefined,
                },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="The probe rack" icon="probes" defaultOpen>
            <ChipRow label="Probe" value={state.probeId} options={PROBE_CHOICES} onChange={onProbe} />
            <p className="us-slider-hint">
              <strong>{probe.name}</strong> — {probe.summary}
            </p>
            <p className="us-slider-hint">
              <strong>Uses:</strong> {probe.uses}.
            </p>
            <Slider
              label="Frequency within the range"
              unit="MHz"
              value={state.frequencyMHz}
              min={probe.minMHz}
              max={probe.maxMHz}
              step={0.5}
              decimals={1}
              onChange={onFrequency}
              hint={`Typical range — exact bandwidth varies by manufacturer and probe.`}
              markers={[
                { value: probe.minMHz, label: `${probe.minMHz} (deepest)` },
                { value: probe.maxMHz, label: `${probe.maxMHz} (finest)` },
              ]}
            />
          </ControlGroup>

          <ControlGroup title="The target" icon="target" defaultOpen>
            <Slider
              label="Target depth"
              unit="cm"
              value={state.targetDepthCm}
              min={1}
              max={20}
              step={0.5}
              decimals={1}
              onChange={onDepth}
              hint="The one number that decides the frequency. Everything else follows from it."
            />
            <Readout
              items={[
                { label: 'Recommended probe', value: recommended.name, tone: recommended.id === probe.id ? 'green' : 'amber' },
                {
                  label: 'Does this probe reach it?',
                  value: blocked ? 'No — blocked' : derived.reaches ? 'Yes' : 'No — too deep',
                  tone: !blocked && derived.reaches ? 'green' : 'red',
                },
              ]}
            />
            <Toggle
              label="Intercostal (rib) window"
              checked={state.ribWindow}
              onChange={onRib}
              hint={`Only a footprint of about ${RIB_GAP_MM} mm or less gets between the ribs. This test has nothing to do with frequency.`}
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

          <ComparisonPanel targetDepthCm={state.targetDepthCm} />

          <div className="us-panel">
            <h3>
              <UsIcon name="lightbulb" size={13} />
              Check yourself
            </h3>
            <Predict
              question="Adult echocardiography needs which probe?"
              options={['Linear array', 'Curvilinear array', 'Phased array']}
              correct={2}
              explanation={
                <>
                  The <b>phased array</b>. Its very small footprint fits the <b>rib space</b>, and it
                  still sweeps a wide sector because the beam is steered electronically from that
                  tiny aperture. A linear probe has better resolution and is useless here — it cannot
                  get the beam in.
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
                A <b>{probe.name}</b> at <b>{state.frequencyMHz.toFixed(1)} MHz</b> gives λ ={' '}
                <b>{derived.lambda.toFixed(2)} mm</b>, an axial resolution of{' '}
                <b>{derived.axial.toFixed(2)} mm</b> and a usable penetration of{' '}
                <b>{derived.penetration.toFixed(1)} cm</b> — {derived.reaches ? 'enough' : 'not enough'} for a
                target at <b>{state.targetDepthCm.toFixed(1)} cm</b>.
                {state.ribWindow &&
                  (derived.fitsRib
                    ? ' Its footprint fits the rib space.'
                    : ' Its footprint is too wide for the rib space, so the beam is blocked.')}
              </>
            }
            why={
              <>
                A higher frequency shortens the pulse and narrows the beam, so both resolutions
                improve — but attenuation scales with frequency, so the deep echoes fall below the
                noise floor sooner. Footprint is a separate constraint entirely: it decides whether
                there is an acoustic window at all.
              </>
            }
            equation={
              showEquation
                ? `λ = c / f = ${soft.speed} / ${state.frequencyMHz.toFixed(1)} MHz = ${derived.lambda.toFixed(2)} mm
Axial resolution = SPL / 2 = ${derived.axial.toFixed(2)} mm  (2-cycle pulse)

Penetration ≈ usable dB / (α × f × 2)
            = ${USABLE_DB} / (${soft.attenuation} × ${state.frequencyMHz.toFixed(1)} × 2) = ${derived.penetration.toFixed(1)} cm

Near field N = a² / λ = ${derived.nearField.toFixed(1)} cm   (active aperture ${probe.apertureMm} mm)
Lateral (beam width) at ${state.targetDepthCm.toFixed(1)} cm = ${derived.lateral.toFixed(2)} mm

Footprint ${probe.footprintMm} mm vs rib space ${RIB_GAP_MM} mm → ${derived.fitsRib ? 'fits' : 'does NOT fit'}`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                {blocked
                  ? 'No image is obtainable through this window with this probe. Change the probe, not the settings.'
                  : recommended.id === probe.id
                    ? `${probe.name} is the appropriate choice for a target at ${state.targetDepthCm.toFixed(1)} cm${state.ribWindow ? ' through an intercostal window' : ''}.`
                    : `For a target at ${state.targetDepthCm.toFixed(1)} cm the ${recommended.name.toLowerCase()} is the better compromise here.`}
              </>
            }
            trap={
              showTrap ? (
                <>
                  Do not treat <b>footprint</b> and <b>frequency</b> as one criterion. A linear probe
                  may have far better resolution and still be useless if it cannot fit the acoustic
                  window — and a CW pencil probe has <b>no range resolution</b> at all, so it cannot
                  tell you what depth a signal came from.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — the rack, and what each probe is for">
            <p>
              <strong>Linear array.</strong> Flat face, elements fired in groups, scan lines at right
              angles to the face — a <strong>rectangular</strong> field the width of the probe.
              Typically <strong>5–15 MHz</strong> for vascular, thyroid, breast, testis,
              musculoskeletal and procedural work.
            </p>
            <p>
              <strong>Curvilinear array.</strong> The same firing pattern on a{' '}
              <strong>curved</strong> face, so the lines diverge and the field widens with depth.
              Typically <strong>2–5 MHz</strong>: the standard abdominal, pelvic and obstetric probe.
            </p>
            <p>
              <strong>Phased array.</strong> Every element fires for every line, with graded delays
              that steer and focus the beam electronically. That is what lets a sector as wide as a
              curvilinear’s come out of a footprint small enough for an{' '}
              <strong>intercostal or transcranial window</strong>. Typically <strong>1–5 MHz</strong>.
            </p>
            <p>
              <strong>Endocavitary.</strong> The frequency is high — <strong>6–12 MHz</strong> —
              because the probe is <em>close</em> to the anatomy, not because the crystal is
              different. Removing the penetration constraint is what buys the resolution.
            </p>
            <p>
              <strong>Hockey-stick.</strong> Typically <strong>10–20 MHz</strong> with a footprint of
              a centimetre or two, for fingers, tendons, small joints, paediatric structures and
              superficial procedures.
            </p>
            <p>
              <strong>CW pencil probe.</strong> Separate transmitting and receiving elements sampling
              continuously. It <strong>cannot alias</strong>, so very high velocities are measurable,
              but it has <strong>no range resolution</strong> and produces no image. Pulsed wave is
              the opposite trade: a sample volume at a chosen depth, at the price of a sampling
              limit.
            </p>
            <p>
              Every frequency range on this page is a <strong>typical range — exact bandwidth varies
              by manufacturer and probe</strong>. Modern broadband probes are usually specified as a
              band with a selectable operating frequency inside it, which is what the frequency
              slider here represents.
            </p>

            <TrapNote>
              “Higher frequency is always better” is the trap underneath every probe question. It
              improves resolution and <em>reduces</em> penetration, so it is only better while the
              beam still reaches the target. The correct rule is the{' '}
              <em>highest frequency that still reaches</em>.
            </TrapNote>

            <SourceNote>
              The probe descriptions here follow QBank Q412 and Q446, and the frequency
              trade-off is a high-yield concept tested repeatedly (QBank Q238, Q413). The
              published typical ranges differ slightly between textbooks, so each range is labelled
              on the stage as typical rather than absolute.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            Footprints, element counts and active apertures here are representative dimensions chosen
            to make the geometry legible — not manufacturer specifications. The{' '}
            <strong>{RIB_GAP_MM} mm</strong> rib space is a typical intercostal window at the skin
            and varies between patients and between spaces. Penetration is computed from the standard
            attenuation model at a 60 dB usable range, so it tracks frequency correctly even though
            any individual machine will differ.
          </ModelNote>
        </>
      }
    />
  )
}
