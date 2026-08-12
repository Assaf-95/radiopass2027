/**
 * Module 6 — Pulse–Echo Imaging.
 *
 * The ten events between an electrical pulse and a B-mode pixel, one guided
 * step each, then the three ideas that frame them: the machine's working
 * assumptions, the A/B/M-mode family, and the PRF ceiling that depth imposes
 * on frame rate.
 */

import { useCallback, useMemo, useState } from 'react'

import { ControlGroup, Segmented, Slider, StageFlash, useFlash } from '../components/Controls'
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
import { PulseEchoStage, type PulseEchoPhase } from '../scenes/PulseEchoStage'
import {
  depthFromTimeMm,
  frameRate,
  linesPerFrame,
  maxPrfHz,
  pulseRepetitionPeriodUs,
  timeFromDepthUs,
} from '../engine'

type State = {
  depth1Cm: number
  depth2Cm: number
  imagingDepthCm: number
  prfHz: number
  sectorDeg: number
  linesPerDegree: number
  focalZones: number
}

const DEFAULTS: State = {
  depth1Cm: 4,
  depth2Cm: 8,
  imagingDepthCm: 12,
  prfHz: 4000,
  sectorDeg: 60,
  linesPerDegree: 2,
  focalZones: 1,
}

const STEPS: GuidedStep<State>[] = [
  {
    id: 'electrical',
    title: '1 · An electrical pulse reaches the transducer',
    phase: 'electrical',
    state: { ...DEFAULTS },
    duration: 1.4,
    caption: (
      <>
        Everything starts in the scanner: a short <b>electrical pulse</b> runs down the cable to
        the probe. Nothing acoustic has happened yet — this is voltage, not sound.
      </>
    ),
  },
  {
    id: 'vibrate',
    title: '2 · The piezoelectric element vibrates',
    phase: 'vibrate',
    duration: 1.8,
    caption: (
      <>
        The voltage deforms the <b>piezoelectric element</b>, which rings at its resonant frequency
        — the <b>reverse piezoelectric effect</b>. Electrical energy has become <b>mechanical</b>{' '}
        vibration at the probe face.
      </>
    ),
  },
  {
    id: 'enter',
    title: '3 · The pulse enters the tissue',
    phase: 'enter',
    duration: 1.5,
    caption: (
      <>
        Coupled through the gel, the vibration launches a short <b>pressure pulse</b> into the
        patient. From here on the probe falls silent and <b>listens</b> — imaging is mostly
        listening.
      </>
    ),
  },
  {
    id: 'interface',
    title: '4 · The pulse reaches an interface',
    phase: 'interface',
    duration: 1.6,
    caption: (state) => (
      <>
        At <b>{state.depth1Cm.toFixed(1)} cm</b> the pulse meets a boundary where the{' '}
        <b>acoustic impedance changes</b>. The size of that mismatch — nothing else — decides how
        much of the pulse will come back.
      </>
    ),
  },
  {
    id: 'reflect',
    title: '5 · Part of the pulse reflects',
    phase: 'reflect',
    duration: 1.6,
    caption: (
      <>
        The boundary splits the pulse: a fraction returns as an <b>echo</b>, the remainder carries
        on to deeper structures. That is why one pulse can image many interfaces down a single
        line.
      </>
    ),
  },
  {
    id: 'return',
    title: '6 · The echo travels back to the probe',
    phase: 'return',
    duration: 1.6,
    caption: (
      <>
        The echo retraces the path to the probe while the transmitted remnant pushes on. The
        machine is timing this journey with microsecond precision — the clock <b>is</b> the depth
        measurement.
      </>
    ),
  },
  {
    id: 'convert',
    title: '7 · Crystal deformation becomes an electrical signal',
    phase: 'convert',
    duration: 1.4,
    caption: (
      <>
        The returning pressure wave <b>deforms the crystal</b>, and the <b>direct piezoelectric
        effect</b> turns that deformation into a small voltage. The same element transmits and
        receives — in both directions it is the same physics.
      </>
    ),
  },
  {
    id: 'depth',
    title: '8 · Return time becomes depth: depth = c t / 2',
    phase: 'depth',
    caption: (state) => {
      const echoUs = timeFromDepthUs(state.depth1Cm * 10)
      return (
        <>
          The echo took <b>{echoUs.toFixed(0)} µs</b> to go out and back. Assuming 1540 m/s, depth
          = c×t/2 = <b>{(depthFromTimeMm(echoUs) / 10).toFixed(1)} cm</b>. The division by two is
          the round trip, and <b>≈13 µs per centimetre</b> is the number to carry into the exam.
        </>
      )
    },
  },
  {
    id: 'amode',
    title: '9 · Amplitude becomes pixel brightness',
    phase: 'amode',
    duration: 1.6,
    caption: (
      <>
        On the <b>A-mode</b> trace each echo is a spike: position from time, height from amplitude.
        B-mode simply converts that spike height into <b>pixel brightness</b> at that depth — one
        scan line of the image.
      </>
    ),
  },
  {
    id: 'bmode-sweep',
    title: '10 · Repeated scan lines build the B-mode frame',
    phase: 'bmode-sweep',
    duration: 1.8,
    caption: (
      <>
        The beam steps across the field of view, <b>one pulse per scan line</b>, and the lines
        stack into a two-dimensional frame — then it all starts again, in real time. Watch the
        active line sweep across the strip.
      </>
    ),
  },
  {
    id: 'assumptions',
    title: 'The four assumptions the machine makes',
    phase: 'assumptions',
    duration: 1.8,
    caption: (
      <>
        The image is built on four working assumptions: <b>1540 m/s</b>, <b>straight lines</b>,{' '}
        <b>main-beam echoes</b> and <b>uniform attenuation</b>. Each one is usually true enough —
        and every classic artefact is one of them being violated.
      </>
    ),
  },
  {
    id: 'modes',
    title: 'A-mode, B-mode, M-mode: one dataset, three displays',
    phase: 'modes',
    duration: 1.4,
    caption: (
      <>
        <b>A-mode</b> plots amplitude against depth on one line. <b>B-mode</b> turns amplitude into
        brightness and sweeps many lines into an image. <b>M-mode</b> repeats a single line over
        time, so a moving reflector draws its own motion trace.
      </>
    ),
  },
  {
    id: 'prf',
    title: 'Depth caps PRF, and PRF caps frame rate',
    phase: 'prf',
    caption: (state) => {
      const cap = maxPrfHz(state.imagingDepthCm * 10)
      return (
        <>
          Echoes from <b>{state.imagingDepthCm} cm</b> need{' '}
          <b>{timeFromDepthUs(state.imagingDepthCm * 10).toFixed(0)} µs</b> to get home, so PRF
          cannot exceed <b>{Math.floor(cap)} Hz</b> without <b>range ambiguity</b>. Deeper imaging →
          longer listening → lower PRF → lower frame rate. Try pushing the PRF slider past the cap.
        </>
      )
    },
  },
]

export default function PulseEchoPage() {
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
    const prfCap = maxPrfHz(state.imagingDepthCm * 10)
    const effectivePrf = Math.min(state.prfHz, prfCap)
    const lines = linesPerFrame(state.sectorDeg, state.linesPerDegree)
    return {
      prfCap,
      effectivePrf,
      lines,
      fps: frameRate(effectivePrf, lines, state.focalZones),
      echo1Us: timeFromDepthUs(state.depth1Cm * 10),
      echo2Us: timeFromDepthUs(state.depth2Cm * 10),
      listenUs: timeFromDepthUs(state.imagingDepthCm * 10),
      prpUs: pulseRepetitionPeriodUs(effectivePrf),
    }
  }, [state])

  /* --- controls announce their consequence immediately ------------------- */

  const onDepth1 = (value: number) => {
    const capped = Math.min(value, state.depth2Cm - 0.5)
    patch({ depth1Cm: capped })
    flash.fire([
      { text: `Reflector 1 at ${capped.toFixed(1)} cm`, dir: 'flat' },
      { text: `Echo returns after ${timeFromDepthUs(capped * 10).toFixed(0)} µs`, dir: 'flat' },
      { text: '≈13 µs per cm of depth', dir: 'flat' },
    ])
  }

  const onDepth2 = (value: number) => {
    const capped = Math.max(value, state.depth1Cm + 0.5)
    patch({ depth2Cm: capped })
    flash.fire([
      { text: `Reflector 2 at ${capped.toFixed(1)} cm`, dir: 'flat' },
      { text: `Echo returns after ${timeFromDepthUs(capped * 10).toFixed(0)} µs`, dir: 'flat' },
      { text: 'Deeper echo — weaker and later', dir: 'down' },
    ])
  }

  const onImagingDepth = (value: number) => {
    const up = value > state.imagingDepthCm
    const cap = maxPrfHz(value * 10)
    const clampedPrf = Math.min(state.prfHz, Math.floor(cap))
    patch({ imagingDepthCm: value, prfHz: clampedPrf })
    flash.fire([
      { text: up ? 'Imaging depth increased' : 'Imaging depth decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Listening time lengthens' : 'Listening time shortens', dir: up ? 'up' : 'down' },
      { text: `Max PRF now ${Math.floor(cap)} Hz`, dir: up ? 'down' : 'up' },
      ...(clampedPrf < state.prfHz
        ? [{ text: 'PRF clamped to avoid range ambiguity', dir: 'warn' as const }]
        : []),
      { text: up ? 'Frame rate falls' : 'Frame rate rises', dir: up ? 'down' : 'up' },
    ])
  }

  const onPrf = (value: number) => {
    const cap = Math.floor(derived.prfCap)
    if (value > cap) {
      patch({ prfHz: cap })
      flash.fire([
        { text: `PRF capped at ${cap} Hz for ${state.imagingDepthCm} cm`, dir: 'warn' },
        { text: 'Any higher: echoes from the previous pulse still returning', dir: 'warn' },
        { text: 'Deep echoes would be mapped shallow — range ambiguity', dir: 'warn' },
        { text: 'Reduce the depth to unlock a higher PRF', dir: 'flat' },
      ])
      return
    }
    const up = value > state.prfHz
    patch({ prfHz: value })
    flash.fire([
      { text: up ? 'PRF increased' : 'PRF decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'More scan lines per second' : 'Fewer scan lines per second', dir: up ? 'up' : 'down' },
      { text: up ? 'Frame rate rises' : 'Frame rate falls', dir: up ? 'up' : 'down' },
      { text: `PRP now ${pulseRepetitionPeriodUs(value).toFixed(0)} µs`, dir: 'flat' },
    ])
  }

  const onSector = (value: number) => {
    const up = value > state.sectorDeg
    patch({ sectorDeg: value })
    flash.fire([
      { text: up ? 'Sector widened' : 'Sector narrowed', dir: up ? 'up' : 'down' },
      { text: up ? 'More scan lines per frame' : 'Fewer scan lines per frame', dir: up ? 'up' : 'down' },
      { text: up ? 'Frame rate falls' : 'Frame rate rises', dir: up ? 'down' : 'up' },
    ])
  }

  const onLineDensity = (value: number) => {
    const up = value > state.linesPerDegree
    patch({ linesPerDegree: value })
    flash.fire([
      { text: up ? 'Line density increased' : 'Line density decreased', dir: up ? 'up' : 'down' },
      { text: up ? 'Lateral detail improves' : 'Lateral detail worsens', dir: up ? 'up' : 'down' },
      { text: up ? 'Frame rate falls' : 'Frame rate rises', dir: up ? 'down' : 'up' },
    ])
  }

  const onFocalZones = (value: number) => {
    const up = value > state.focalZones
    patch({ focalZones: value })
    flash.fire([
      { text: `${value} focal zone${value > 1 ? 's' : ''}`, dir: 'flat' },
      { text: up ? 'Several pulses now needed per line' : 'Fewer pulses per line', dir: up ? 'up' : 'down' },
      { text: up ? 'Frame rate falls' : 'Frame rate rises', dir: up ? 'down' : 'up' },
      { text: up ? 'Sharper focus over a longer depth range' : 'Focus confined to one depth', dir: up ? 'up' : 'flat' },
    ])
  }

  const deltas: Delta[] = [
    { label: 'depth ↑ → listening time ↑', dir: 'up' },
    { label: 'depth ↑ → PRF max ↓ → frame rate ↓', dir: 'down' },
    { label: 'sector width ↓ → frame rate ↑', dir: 'up' },
    { label: 'focal zones ↑ → frame rate ↓', dir: 'down' },
    { label: 'amplitude → brightness; time → depth', dir: 'flat' },
  ]

  return (
    <UsLab
      path="/ultrasound-lab/pulse-echo"
      mode={api.mode}
      onModeChange={api.setMode}
      onReset={api.reset}
      focus={api.mode === 'guided' && !detail && !api.step.hands}
      stage={
        <>
          <section className="us-stage" aria-label="Pulse–echo stage">
            <div className="us-stage-head">
              <h2>
                <UsIcon name="pulse" size={14} />
                <b>Stage</b> From pulse to pixel
              </h2>
              <div className="us-legend">
                <span>
                  <i style={{ background: 'var(--us-cyan)' }} /> Transmitted pulse
                </span>
                <span>
                  <i style={{ background: 'var(--us-amber)' }} /> Echo / signal
                </span>
              </div>
            </div>

            <div className="us-stage-body">
              <div className="us-canvas-wrap">
                <StageFlash flash={flash} />
                <PulseEchoStage
                  depth1Cm={state.depth1Cm}
                  depth2Cm={state.depth2Cm}
                  imagingDepthCm={state.imagingDepthCm}
                  prfHz={state.prfHz}
                  time={clock}
                  t={api.t}
                  phase={api.phase as PulseEchoPhase}
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
              One event at a time. <b>Show the numbers</b> for the readouts and full analysis, or{' '}
              <b>Enter manual lab</b> to drive the depths, PRF and frame-rate levers yourself.
            </p>
          </section>

          <FocusHide>
            <Readout
              items={[
                { label: 'Echo time — reflector 1', value: derived.echo1Us.toFixed(0), unit: 'µs', tone: 'amber' },
                { label: 'Echo time — reflector 2', value: derived.echo2Us.toFixed(0), unit: 'µs' },
                { label: 'Listening time (full depth)', value: derived.listenUs.toFixed(0), unit: 'µs' },
                { label: 'Max PRF at this depth', value: Math.floor(derived.prfCap), unit: 'Hz', tone: 'cyan' },
                { label: 'PRP', value: derived.prpUs.toFixed(0), unit: 'µs' },
                { label: 'Lines per frame', value: derived.lines },
                { label: 'Frame rate', value: derived.fps.toFixed(1), unit: 'fps', tone: 'green' },
              ]}
            />
          </FocusHide>
        </>
      }
      controls={
        <>
          <ControlGroup title="Reflectors and depth" icon="target" defaultOpen>
            <Slider
              label="Reflector 1 depth"
              unit="cm"
              value={state.depth1Cm}
              min={1}
              max={10}
              step={0.5}
              decimals={1}
              onChange={onDepth1}
              hint="Its echo returns after about 13 µs per cm — read the exact figure off the readouts."
            />
            <Slider
              label="Reflector 2 depth"
              unit="cm"
              value={state.depth2Cm}
              min={2}
              max={16}
              step={0.5}
              decimals={1}
              onChange={onDepth2}
            />
            <Slider
              label="Imaging depth"
              unit="cm"
              value={state.imagingDepthCm}
              min={4}
              max={20}
              step={1}
              onChange={onImagingDepth}
              hint="The machine must listen until echoes from this depth are home before the next pulse."
            />
          </ControlGroup>

          <ControlGroup title="Frame-rate levers" icon="sliders" defaultOpen={api.index >= 9}>
            <Slider
              label="Pulse repetition frequency"
              unit="Hz"
              value={state.prfHz}
              min={500}
              max={20000}
              step={250}
              onChange={onPrf}
              hint={`Capped at ${Math.floor(derived.prfCap)} Hz for ${state.imagingDepthCm} cm — push past it and the stage explains range ambiguity.`}
            />
            <Slider
              label="Sector width"
              unit="°"
              value={state.sectorDeg}
              min={30}
              max={90}
              step={5}
              onChange={onSector}
              hint="Narrowing the sector is the free frame-rate boost: fewer lines per frame."
            />
            <Slider
              label="Line density"
              unit="lines/°"
              value={state.linesPerDegree}
              min={1}
              max={4}
              step={0.5}
              decimals={1}
              onChange={onLineDensity}
            />
            <Slider
              label="Focal zones"
              value={state.focalZones}
              min={1}
              max={4}
              step={1}
              onChange={onFocalZones}
              hint="Each extra zone repeats every line with a different transmit focus — quality bought with time."
            />
            <Readout
              items={[
                { label: 'Frame rate', value: derived.fps.toFixed(1), unit: 'fps', tone: 'green' },
                { label: 'Lines × zones per frame', value: derived.lines * state.focalZones },
              ]}
            />
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
              question="You increase the imaging depth from 5 cm to 15 cm. What happens to the maximum achievable frame rate?"
              options={['It falls to about a third', 'It is unchanged', 'It triples']}
              correct={0}
              explanation={
                <>
                  Trebling the depth trebles the listening time per line, so the maximum PRF —
                  and with it the frame rate — falls to about <b>a third</b>. Depth, PRF and frame
                  rate are one chain, and depth is the ceiling.
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
                A pulse fired into a {state.imagingDepthCm} cm field meets reflectors at{' '}
                <b>{state.depth1Cm.toFixed(1)}</b> and <b>{state.depth2Cm.toFixed(1)} cm</b>; their
                echoes return after <b>{derived.echo1Us.toFixed(0)}</b> and{' '}
                <b>{derived.echo2Us.toFixed(0)} µs</b>, and the frame refreshes at{' '}
                <b>{derived.fps.toFixed(1)} fps</b>.
              </>
            }
            why={
              <>
                Every pixel is two measurements on one echo: the <b>return time</b> places it in
                depth (assuming 1540 m/s and a straight path) and the <b>amplitude</b> sets its
                brightness. Everything else — A-mode, B-mode, M-mode, the frame-rate bargain — is
                bookkeeping around those two numbers.
              </>
            }
            equation={
              showEquation
                ? `depth = c t / 2      ≈ 13 µs per cm
  reflector 1: t = ${derived.echo1Us.toFixed(0)} µs → ${(depthFromTimeMm(derived.echo1Us) / 10).toFixed(1)} cm

PRF_max = c / (2 × depth) = ${Math.floor(derived.prfCap)} Hz  (for ${state.imagingDepthCm} cm)

frame rate = PRF / (lines × focal zones)
           = ${Math.round(derived.effectivePrf)} / (${derived.lines} × ${state.focalZones}) = ${derived.fps.toFixed(1)} fps`
                : undefined
            }
            deltas={deltas}
            clinical={
              <>
                PRF, frame rate and focal zones are all <b>operator controls</b>. For a moving
                target — a fetal heart, a restless patient — narrow the sector, cut the depth to
                what you need and drop to one focal zone: temporal resolution is bought with scan
                lines.
              </>
            }
            trap={
              showTrap ? (
                <>
                  Forgetting the <b>÷2</b> in depth = ct/2 doubles every depth on the image — the
                  measured time is the journey <b>out and back</b> (QBank Q351). And “B-mode sends
                  one pulse per scan line” is only true for a <b>single-focus</b> frame: extra focal
                  zones repeat each line, which is exactly why they cost frame rate.
                </>
              ) : undefined
            }
          />

          <MoreDetail title="More detail — assumptions, modes, and the frame-rate chain">
            <p>
              <strong>The four assumptions.</strong> Constant <strong>1540 m/s</strong>,{' '}
              <strong>straight-line</strong> travel, echoes from the <strong>main beam</strong>{' '}
              only, and <strong>uniform attenuation</strong>. Each maps to its own artefact when
              violated: speed-displacement error, refraction artefact, side-lobe artefact, and
              shadowing or enhancement. Learn the pairs — the exam asks them from both ends.
            </p>
            <p>
              <strong>One dataset, three displays.</strong> A-mode is the raw amplitude-versus-time
              trace of one line. B-mode maps amplitude to brightness and sweeps many lines into a
              frame. M-mode keeps a single line and scrolls it in time, so motion draws itself —
              still the highest temporal resolution display on the machine.
            </p>
            <p>
              <strong>The frame-rate chain.</strong> The next pulse must wait for the deepest echo:
              PRF_max = c/(2 × depth). A frame needs one pulse–listen cycle per line{' '}
              <em>per focal zone</em>, so frame rate = PRF ÷ (lines × zones). Depth, sector width,
              line density and focal zones are the four levers — and all four are in the
              operator&rsquo;s hands.
            </p>

            <TrapNote>
              Exceeding the depth-limited PRF does not crash the machine — it produces{' '}
              <em>range ambiguity</em>: late echoes from the previous pulse arrive during the next
              listening window and are plotted <em>shallow</em>. That is why the PRF slider on this
              page clamps, and why real scanners quietly do the same.
            </TrapNote>

            <SourceNote>
              QBank Q351 anchors depth = ct/2, amplitude → brightness and the one-pulse-per-line
              stem (with the multi-focal-zone caveat recorded in the fact bank&rsquo;s
              clarification). Q210 carries the PRF–depth limit, Q446 and Q289 the frame-rate
              levers, and Q289 — a high-yield recall item — the fact that PRF, frame rate and focal
              zone are operator-controlled.
            </SourceNote>
          </MoreDetail>

          <ModelNote>
            The travelling packet is slowed by an enormous factor — a real round trip to 4 cm takes
            52 µs. The A-mode spike heights use a simple depth-dependent weakening for legibility;
            every time, depth, PRF and frame-rate figure is computed exactly by the engine.
          </ModelNote>
        </>
      }
    />
  )
}
