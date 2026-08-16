/**
 * Module 8 — Beam Geometry.
 *
 * The beam laboratory: near field, natural focus, far field, electronic
 * focusing, multiple focal zones and their frame-rate price, side and grating
 * lobes, and the elevation-plane slice thickness. A B-mode panel with a column
 * of point targets shows lateral blur following the computed beam width at
 * every depth, so moving the focus visibly sharpens one band of the image.
 */

import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { BMode, type BModeScene, type BModeSettings } from '../components/BMode'
import { ControlGroup, Segmented, Slider, StageFlash, Toggle, useFlash } from '../components/Controls'
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
import { BeamStage, type BeamPhase } from '../scenes/BeamStage'
import {
  divergenceAngleDeg,
  elevationalThicknessMm,
  focusedBeamWidthMm,
  frameRate,
  maxPrfHz,
  nearFieldLengthMm,
  unfocusedBeamWidthMm,
  wavelengthMm,
} from '../engine'

const MAX_DEPTH_MM = 160
const LINES_PER_FRAME = 128
const ELEV_APERTURE_MM = 10

type State = {
  apertureMm: number
  frequencyMHz: number
  focusDepthMm: number
  zones: number
  gratingLobes: boolean
  elevationFocusMm: number
}

const DEFAULTS: State = {
  apertureMm: 12,
  frequencyMHz: 5,
  focusDepthMm: 60,
  zones: 1,
  gratingLobes: false,
  elevationFocusMm: 50,
}

/** The transmit focal depths implied by the zone count, spread around the focus. */
function zoneDepths(focusMm: number, zones: number): number[] {
  if (zones <= 1) return [focusMm]
  if (zones === 2) return [focusMm, Math.min(focusMm + 40, 150)]
  return [Math.max(focusMm - 30, 15), focusMm, Math.min(focusMm + 40, 150)]
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'anatomy',
    title: 'A beam has anatomy: near field, waist, far field',
    phase: 'anatomy',
    state: { apertureMm: 12, frequencyMHz: 5, zones: 1, gratingLobes: false },
    caption: (
      <>
        The beam is not a cone from the probe face. It first <b>converges</b> — the{' '}
        <b>Fresnel (near) field</b> — narrows to a waist at the <b>natural focus</b>, then{' '}
        <b>diverges</b> in the <b>Fraunhofer (far) field</b>. The green bracket marks the
        near-field length N.
      </>
    ),
  },
  {
    id: 'aperture',
    title: 'Aperture: N grows as the SQUARE of the diameter',
    phase: 'aperture',
    state: { apertureMm: 24, frequencyMHz: 5 },
    duration: 1.6,
    caption: (state) => {
      const lambda = wavelengthMm(1540, state.frequencyMHz)
      return (
        <>
          Doubling the aperture to <b>{state.apertureMm} mm</b> makes N ={' '}
          <b>{(nearFieldLengthMm(state.apertureMm, lambda) / 10).toFixed(1)} cm</b> — four times
          longer, because N = D²/4λ. The far-field divergence falls at the same time: sin θ =
          1.22 λ/D, now <b>{divergenceAngleDeg(state.apertureMm, lambda).toFixed(1)}°</b>.
        </>
      )
    },
  },
  {
    id: 'frequency',
    title: 'Frequency: shorter λ also lengthens the near field',
    phase: 'frequency',
    state: { apertureMm: 12, frequencyMHz: 10 },
    duration: 1.6,
    caption: (state) => {
      const lambda = wavelengthMm(1540, state.frequencyMHz)
      return (
        <>
          Back at 12 mm but at <b>{state.frequencyMHz} MHz</b>, λ falls to{' '}
          <b>{lambda.toFixed(2)} mm</b>, so N = D²/4λ stretches to{' '}
          <b>{(nearFieldLengthMm(state.apertureMm, lambda) / 10).toFixed(1)} cm</b> and divergence
          drops to <b>{divergenceAngleDeg(state.apertureMm, lambda).toFixed(1)}°</b>. Higher
          frequency narrows the beam — it never widens it.
        </>
      )
    },
  },
  {
    id: 'focus',
    title: 'Electronic focus pulls the waist to a chosen depth',
    phase: 'focus',
    state: { apertureMm: 12, frequencyMHz: 5, focusDepthMm: 60, zones: 1 },
    duration: 1.6,
    caption: (state) => (
      <>
        Timing delays across the array move the waist to <b>{(state.focusDepthMm / 10).toFixed(1)} cm</b>.
        The waist width goes as <b>λ·F/D</b> — a lower <b>f-number</b> (F/D ={' '}
        {(state.focusDepthMm / state.apertureMm).toFixed(1)}) means a tighter focus. Watch the
        B-mode targets at that depth sharpen while the others stay blurred.
      </>
    ),
  },
  {
    id: 'multi-focus',
    title: 'More focal zones: a narrow beam over depth — at a price',
    phase: 'multi-focus',
    state: { zones: 3 },
    duration: 1.6,
    caption: (state) => {
      const fr = frameRate(maxPrfHz(MAX_DEPTH_MM), LINES_PER_FRAME, state.zones)
      return (
        <>
          Three transmit zones give a composite beam that stays narrow across the image — but
          every zone needs <b>another pulse down every line</b>, so the frame rate falls to{' '}
          <b>{fr.toFixed(0)} fps</b>. Lateral resolution over depth is bought with temporal
          resolution.
        </>
      )
    },
  },
  {
    id: 'lobes',
    title: 'Side lobes and grating lobes: energy off the axis',
    phase: 'lobes',
    state: { zones: 1, gratingLobes: true },
    duration: 1.4,
    caption: (
      <>
        Weak <b>side lobes</b> flank every beam. An array's regular element spacing adds stronger{' '}
        <b>grating lobes</b> at larger angles. Anything they strike is displayed{' '}
        <b>as if it lay on the main beam</b> — the side-lobe artefact that puts false echoes
        inside cysts and ducts.
      </>
    ),
  },
  {
    id: 'elevation',
    title: 'The third dimension: slice thickness',
    phase: 'elevation',
    state: { gratingLobes: false },
    caption: (state) => (
      <>
        The image is a <b>slice with thickness</b>. A fixed acoustic lens focuses the elevation
        plane at <b>{(state.elevationFocusMm / 10).toFixed(0)} cm</b> — slice{' '}
        <b>
          {elevationalThicknessMm(state.elevationFocusMm, ELEV_APERTURE_MM, state.elevationFocusMm).toFixed(1)}{' '}
          mm
        </b>{' '}
        there, thicker everywhere else. You cannot adjust it from the console, and it is usually
        the worst of the three spatial resolutions.
      </>
    ),
  },
  {
    id: 'free',
    title: 'Your beam bench',
    phase: 'free',
    caption: (
      <>
        Everything is now live: aperture, frequency, focus, zones, lobes and the elevation lens.
        Try the exam pairings — double the aperture and read N off the bracket; push the focus
        deep and watch the f-number and the waist both grow.
      </>
    ),
  },
]

export default function BeamPage() {
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
  const phase = api.phase as BeamPhase
  const focused = phase === 'focus' || phase === 'multi-focus' || phase === 'free' || api.mode === 'manual'

  const derived = useMemo(() => {
    const lambda = wavelengthMm(1540, state.frequencyMHz)
    const zonesArr = zoneDepths(state.focusDepthMm, state.zones)
    const prf = maxPrfHz(MAX_DEPTH_MM)
    return {
      lambda,
      nearField: nearFieldLengthMm(state.apertureMm, lambda),
      theta: divergenceAngleDeg(state.apertureMm, lambda),
      zonesArr,
      waist: focusedBeamWidthMm(state.focusDepthMm, state.apertureMm, lambda, state.focusDepthMm),
      natural: unfocusedBeamWidthMm(state.focusDepthMm, state.apertureMm, lambda),
      fNumber: state.focusDepthMm / state.apertureMm,
      prf,
      fps: frameRate(prf, LINES_PER_FRAME, state.zones),
      slice: elevationalThicknessMm(state.elevationFocusMm, ELEV_APERTURE_MM, state.elevationFocusMm),
    }
  }, [state])

  /* --- controls announce their consequence immediately ------------------- */

  const onAperture = (value: number) => {
    const up = value > state.apertureMm
    patch({ apertureMm: value })
    flash.fire([
      { text: up ? 'Aperture widened' : 'Aperture narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'Near field lengthens (∝ D²)' : 'Near field shortens (∝ D²)', dir: up ? 'up' : 'down' },
      { text: up ? 'Divergence falls' : 'Divergence rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Focal waist tightens' : 'Focal waist widens', dir: up ? 'up' : 'down' },
      { text: 'Axial resolution unchanged', dir: 'flat' },
    ])
  }

  const onFrequency = (value: number) => {
    const up = value > state.frequencyMHz
    patch({ frequencyMHz: value })
    flash.fire([
      { text: up ? 'Frequency increased' : 'Frequency decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Wavelength shortens' : 'Wavelength lengthens', dir: up ? 'down' : 'up' },
      { text: up ? 'Near field lengthens' : 'Near field shortens', dir: up ? 'up' : 'down' },
      { text: up ? 'Divergence falls' : 'Divergence rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Attenuation rises' : 'Attenuation falls', dir: up ? 'warn' : 'up' },
    ])
  }

  const onFocusDepth = (value: number) => {
    const up = value > state.focusDepthMm
    patch({ focusDepthMm: value })
    flash.fire([
      { text: up ? 'Focus moved deeper' : 'Focus moved shallower', dir: 'flat' },
      { text: up ? 'f-number rises, waist widens' : 'f-number falls, waist tightens', dir: up ? 'down' : 'up' },
      { text: 'Lateral resolution best AT the focus', dir: 'flat' },
    ])
  }

  const onZones = (value: number) => {
    const up = value > state.zones
    patch({ zones: value })
    flash.fire([
      { text: `${value} focal zone${value > 1 ? 's' : ''}`, dir: 'flat' },
      { text: up ? 'Narrow beam over more depth' : 'Narrow beam at fewer depths', dir: up ? 'up' : 'down' },
      { text: up ? 'Frame rate falls' : 'Frame rate recovers', dir: up ? 'warn' : 'up' },
    ])
  }

  const onGrating = (value: boolean) => {
    patch({ gratingLobes: value })
    flash.fire([
      { text: value ? 'Grating lobes shown' : 'Grating lobes hidden', dir: value ? 'warn' : 'flat' },
      { text: 'Off-axis energy → misplaced echoes', dir: value ? 'warn' : 'flat' },
    ])
  }

  const onElevationFocus = (value: number) => {
    const up = value > state.elevationFocusMm
    patch({ elevationFocusMm: value })
    flash.fire([
      { text: up ? 'Lens focus deeper' : 'Lens focus shallower', dir: 'flat' },
      { text: 'Slice thinnest at the lens focus', dir: 'flat' },
      { text: 'Fixed by the lens — not a console control', dir: 'warn' },
    ])
  }

  /* --- teaching content --------------------------------------------------- */

  const deltas: Delta[] = [
    { label: 'aperture ↑ → N ↑ (∝ D²)', dir: 'up' },
    { label: 'aperture ↑ → divergence ↓', dir: 'down' },
    { label: 'frequency ↑ → N ↑, divergence ↓', dir: 'up' },
    { label: 'focus at target → lateral resolution ↑', dir: 'up' },
    { label: 'focal zones ↑ → frame rate ↓', dir: 'warn' },
  ]

  const scene: BModeScene = useMemo(
    () => ({
      widthCm: 4,
      depthCm: 14,
      background: 0.3,
      backgroundAttenuation: 0.4,
      targets: [2, 4, 6, 8, 10, 12].map((depthCm) => ({
        x: 0,
        depthCm,
        radiusCm: 0.05,
        echogenicity: 0.95,
        scatter: 0.2,
      })),
    }),
    [],
  )

  const settings: BModeSettings = useMemo(
    () => ({
      frequencyMHz: state.frequencyMHz,
      gainDb: 38,
      dynamicRangeDb: 55,
      focusCm: focused ? derived.zonesArr.map((z) => z / 10) : [],
      apertureMm: state.apertureMm,
      cycles: 2,
    }),
    [state.frequencyMHz, state.apertureMm, focused, derived.zonesArr],
  )

  return (
    <UsLab
      path="/ultrasound-lab/beam"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Beam geometry stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="beam" size={14} />
                <b>Stage</b> Beam geometry
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Beam
                </span>
                <span>
                  <i style={{ background: 'var(--us-green)' }} /> Near field N
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Lobes / focus
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <BeamStage
                  apertureMm={state.apertureMm}
                  frequencyMHz={state.frequencyMHz}
                  zoneDepthsMm={focused ? derived.zonesArr : []}
                  gratingLobes={state.gratingLobes}
                  elevationFocusMm={state.elevationFocusMm}
                  time={clock}
                  phase={api.mode === 'manual' ? 'free' : phase}
                />
              </div>
              <div
                className="us-canvas-wrap"
                style={{ flex: '0 0 168px', maxWidth: 168, minWidth: 120 }}
              >
                <BMode
                  scene={scene}
                  settings={settings}
                  label={focused ? `focus ${(state.focusDepthMm / 10).toFixed(0)} cm` : 'unfocused'}
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
              <b>Enter manual lab</b> to shape the beam yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Wavelength λ', value: derived.lambda.toFixed(2), unit: 'mm' },
                { label: 'Near field N', value: (derived.nearField / 10).toFixed(1), unit: 'cm', tone: 'green' },
                { label: 'Divergence θ', value: derived.theta.toFixed(1), unit: '°', tone: 'amber' },
                { label: 'Waist at focus', value: derived.waist.toFixed(2), unit: 'mm', tone: 'cyan' },
                { label: 'f-number F/D', value: derived.fNumber.toFixed(1) },
                { label: 'Frame rate', value: derived.fps.toFixed(0), unit: 'fps', tone: state.zones > 1 ? 'amber' : 'green' },
                { label: 'Slice at lens focus', value: derived.slice.toFixed(1), unit: 'mm', tone: 'violet' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Aperture and frequency" icon="beam" defaultOpen>
            <Slider
              label="Aperture diameter D"
              unit="mm"
              value={state.apertureMm}
              min={4}
              max={30}
              step={1}
              onChange={onAperture}
              hint="N = D²/4λ — near-field length scales with the SQUARE of the diameter."
              markers={[
                { value: 6, label: '6' },
                { value: 12, label: '12' },
                { value: 24, label: '24' },
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
              hint="Raising f shortens λ, so N lengthens and the far field diverges less."
            />
          </ControlGroup>

          <ControlGroup title="Focusing" icon="target" defaultOpen={api.index >= 3}>
            <Slider
              label="Electronic focus depth"
              unit="mm"
              value={state.focusDepthMm}
              min={20}
              max={140}
              step={5}
              onChange={onFocusDepth}
              hint="Place the focus at or just below the region of interest. Watch that band of B-mode targets sharpen."
            />
            <Slider
              label="Transmit focal zones"
              value={state.zones}
              min={1}
              max={3}
              step={1}
              onChange={onZones}
              hint="Each extra zone is another pulse down every scan line."
            />
            <Readout
              items={[
                { label: 'PRF at 16 cm', value: derived.prf.toFixed(0), unit: 'Hz' },
                { label: 'Frame rate', value: derived.fps.toFixed(0), unit: 'fps', tone: state.zones > 1 ? 'amber' : 'green' },
              ]}
            />
          </ControlGroup>

          <ControlGroup title="Lobes and elevation" icon="layers">
            <Toggle
              label="Show grating lobes"
              checked={state.gratingLobes}
              onChange={onGrating}
              hint="Periodic off-axis repeats produced by an array's regular element spacing."
            />
            <Slider
              label="Elevation lens focus"
              unit="mm"
              value={state.elevationFocusMm}
              min={20}
              max={100}
              step={5}
              onChange={onElevationFocus}
              hint="Fixed at manufacture. The slice is thinnest here and thicker at every other depth."
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
              question="You double the aperture diameter. What happens to the near-field length?"
              options={['It doubles', 'It quadruples', 'It is unchanged']}
              correct={1}
              explanation={
                <>
                  N = D²/4λ — the <b>square</b> of the diameter. Doubling D <b>quadruples</b> the
                  near field, and at the same time halves the far-field divergence (sin θ =
                  1.22 λ/D). Small aperture changes matter a lot.
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
                A <b>{state.apertureMm} mm</b> aperture at <b>{state.frequencyMHz} MHz</b> gives a
                near field of <b>{(derived.nearField / 10).toFixed(1)} cm</b> and far-field
                divergence of <b>{derived.theta.toFixed(1)}°</b>.{' '}
                {focused ? (
                  <>
                    Electronic focus at <b>{(state.focusDepthMm / 10).toFixed(1)} cm</b> narrows
                    the waist to <b>{derived.waist.toFixed(2)} mm</b>.
                  </>
                ) : (
                  <>The natural waist sits at the end of the near field.</>
                )}
              </>
            }
            why={
              <>
                Every point on the aperture radiates, and the beam is their interference pattern.
                Close in, the contributions are still organising — the collimated near field.
                Beyond N they settle into a diverging pattern whose angle depends on λ/D. A bigger
                aperture or a shorter wavelength postpones that transition and reduces the spread.
              </>
            }
            equation={
              showEquation
                ? `N = a²/λ = D²/4λ = ${state.apertureMm}² / (4 × ${derived.lambda.toFixed(2)}) = ${derived.nearField.toFixed(0)} mm = ${(derived.nearField / 10).toFixed(1)} cm
sin θ = 0.61 λ/a = 1.22 λ/D = 1.22 × ${derived.lambda.toFixed(2)} / ${state.apertureMm}  →  θ = ${derived.theta.toFixed(1)}°
waist ≈ λ F / D = ${derived.lambda.toFixed(2)} × ${state.focusDepthMm} / ${state.apertureMm} = ${derived.waist.toFixed(2)} mm      f-number = F/D = ${derived.fNumber.toFixed(1)}
frame rate = PRF / (lines × zones) = ${derived.prf.toFixed(0)} / (${LINES_PER_FRAME} × ${state.zones}) = ${derived.fps.toFixed(0)} fps`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                Lateral resolution is best <b>on the central axis, at the focus</b> — so put the
                focus at the lesion. If you need detail over a range of depths, add zones and
                accept the frame-rate cost, or accept one sharp band when motion matters.
              </>
            }
            trap={
              showTrap ? (
                <>
                  “A higher frequency makes the beam spread more” is <b>FALSE</b>. Higher
                  frequency means shorter λ, a <b>longer</b> near field and <b>less</b>{' '}
                  divergence. The question bank repeatedly tests that resolution is best on the
                  central axis at the focal zone (QBank Q239, Q382).
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — what shapes the beam">
            <p>
              <strong>Near field, then far field.</strong> The Fresnel zone is roughly collimated
              and narrows to the natural focus at N = D²/4λ; the Fraunhofer zone diverges at
              sin θ = 1.22 λ/D. Both equations reward a large aperture and a high frequency with
              a longer, narrower beam.
            </p>
            <p>
              <strong>Electronic focusing does not create energy.</strong> Timing delays pull the
              waist to a chosen depth; the waist width goes as λ·F/D, so a deep focus (high
              f-number) is always a wider one. On reception, <em>dynamic receive focusing</em>{' '}
              tracks the echoes continuously as they arrive — and unlike transmit zones it costs
              no frame rate at all.
            </p>
            <p>
              <strong>Extra transmit zones cost time.</strong> Each zone needs its own pulse down
              every line: frame rate = PRF / (lines × zones). Two zones roughly halve it. The
              recall bank lists PRF, frame rate and focal zone as operator-controlled for exactly
              this reason (QBank Q289).
            </p>
            <p>
              <strong>Side lobes, grating lobes and the slice.</strong> Off-axis lobes place
              echoes where no anatomy is — false debris in cysts. And the elevation plane gives
              the image a thickness set by a fixed lens: the slice-thickness artefact belongs to
              the <Link to="/ultrasound-lab/resolution">Resolution Laboratory</Link>.
            </p>

            <TrapNote>
              N depends on the <em>square</em> of the aperture but only the first power of λ —
              and focusing changes <em>lateral</em> resolution only. Axial resolution never
              appears in either beam equation, however tempting the distractor.
            </TrapNote>

            <SourceNote>
              The near-field and divergence formulae are standard physics for an unfocused
              circular aperture; real focused arrays behave differently either side of the focus,
              which is what the focused waist model shows. QBank Q239 and Q382 (high-yield)
              test that resolution is best on the central axis at the focus, and QBank Q289 and
              Q446 supply the frame-rate arithmetic used here.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The beam's vertical scale is exaggerated so a millimetre-scale waist remains visible
            beside a 16 cm depth axis, and lobe sizes are indicative. Every labelled number — N,
            θ, waist, f-number, frame rate, slice thickness — is computed from the engine.
          </ModelNote>
        </>
      }
    />
  )
}
