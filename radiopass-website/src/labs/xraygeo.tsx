/**
 * X-ray core physics — two focused lessons in the guided X-ray course:
 *
 *   XrayGeometryLesson (default)  — projection geometry: SOD/SDD/ODD,
 *     magnification M = SDD/SOD, focal-spot blur Ug = f × ODD/SOD.
 *   XrayInteractionsLesson        — what one photon does inside the patient:
 *     attenuation, μ, HVL, the photoelectric journey and Compton scatter.
 *
 * Geometry is taught on the built magnification simulator from /visuals — the
 * accurate one — hosted inside each concept and dressed down to the single
 * control that concept is about. Interactions splits: the beam-wide concepts
 * (attenuation, μ, HVL) keep their drawings, and the five single-interaction
 * concepts run on the built guided tour, walked to the exact frame each one is
 * about.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel } from '../home/fx'
import { LessonPage, lessonPing, type LessonStep } from './lesson'
import { SimFrame, type SimFrameProps } from './simframe'

const easeIO = (v: number) => { const c = clamp(v); return c * c * (3 - 2 * c) }

const ACC = C.xray            // the X-ray house blue — photons, beams
const WARM = C.amber          // energised electrons, absorbed energy
const INK = C.ink

/** A soft radial glow under a solid dot — a photon head, a point source. */
function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1, colour = ACC) {
  if (a <= 0.01) return
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.2)
  g.addColorStop(0, rgba(colour, 0.3 * a))
  g.addColorStop(1, rgba(colour, 0))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r * 3.2, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = rgba(colour, 0.95 * a)
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

/* ================================================================== *
 *  PROJECTION GEOMETRY
 * ================================================================== */

/* The geometry concepts are taught ON the built magnification simulator —
   the accurate one, with real boundary rays, a real penumbra construction and
   the live SOD-vs-M curve. Each concept hides the parts of it that concept has
   not earned yet, spotlights the one slider it is about, and arrives with the
   sliders already in the state the sentence describes. */
const MAG = '/visuals/radiographic-magnification.html'

/** Everything the simulator says for itself; the lesson says it instead. */
const PROSE = ['.header', '.scene-caption', '.scene-guide']
const GRAPH = '.graph-wrap'

/* The simulator drops to a single column below 1120px, which in a lesson-sized
   frame puts the very slider the concept names below the fold. Hold it in two
   columns so the scene and its controls are on screen together. */
const MAG_CSS = `
  /* Standalone, that page fills the window so it does not stop short of the
     fold. Hosted, that same rule makes it report the frame's own height back to
     SimFrame's measurement, which then never shrinks — a void inside the frame
     that no amount of grid tuning out here could reach. Neutralise it: in a
     lesson the page hugs its content and the frame hugs the page. */
  .page { min-height: 0 !important; }
  /* Two columns inside the frame, at any lesson width.
     Stacked, the scene is drawn half as large again — but the controls then sit
     below the fold of the frame, and every concept here asks the reader to drag
     one of them. A control you cannot reach beats a picture you can admire, so
     the columns stay. */
  @media (min-width: 620px) {
  .page { padding: 10px 12px !important; gap: 10px !important; }
  .layout { grid-template-columns: minmax(0, 1.6fr) minmax(238px, 0.85fr) !important; }
  .card { padding: 10px !important; }
  .section-title { font-size: 14px !important; margin: 0 0 6px !important; }
  }
`

const magStage = (p: Omit<SimFrameProps, 'src' | 'title'>) => (
  <SimFrame
    src={MAG}
    title="Radiographic magnification and geometric unsharpness simulator"
    css={MAG_CSS}
    {...p}
    hide={[...PROSE, ...(p.hide ?? [])]}
  />
)

/* The interactions lesson borrows the built guided tour for the five concepts
   it actually animates: the photoelectric sequence, Compton, and the
   probability curves. Attenuation, μ and HVL stay drawn — they describe a
   whole beam thinning through matter, not one photon meeting one atom, and the
   tour has no frame for them. */
const TOUR = '/visuals/xray-guided-interactions.html'

/* The tour is a full-page layout; compacted so an atom panel and, on the last
   concept, the probability graph fit the frame without scrolling. */
const TOUR_CSS = `
  @media (min-width: 620px) {
  .app { padding: 8px !important; gap: 8px !important; }
  .stage, .graph-card { padding: 8px !important; margin: 0 !important; }
  .panel { padding: 8px !important; }
  .atom-svg { max-height: 200px !important; }
  .graph { max-height: 190px !important; }
  .graph-grid { gap: 10px !important; }
  }
`

const tourStage = ({ to, only, graph }: { to: number; only?: 'photo' | 'compton'; graph?: boolean }) => (
  <SimFrame
    src={TOUR}
    title="Guided tour of photoelectric absorption and Compton scatter"
    css={TOUR_CSS}
    tall
    tour={{ badge: '#stepBadge', next: '#next', back: '#back', to }}
    hide={[
      '.hero', '.controls', '.toggles', '.details',
      ...(graph ? ['.compare', '.stage-head'] : ['.graph-card']),
      ...(only === 'photo' ? ['#comptonPanel'] : []),
      ...(only === 'compton' ? ['#photoPanel'] : []),
    ]}
    focus={graph ? ['#energy'] : undefined}
    set={graph ? { '#energy': 45 } : undefined}
    task={graph ? {
      ask: 'Drive the beam energy up past 80 keV and watch the two curves swap places.',
      notice: 'Photoelectric collapsed away while Compton barely moved. That crossover is why high kVp trades contrast for penetration.',
      watch: '#energy',
      above: 80,
    } : undefined}
  />
)

const GEO_STEPS: LessonStep[] = [
  {
    id: 'players',
    title: 'Source, object, detector',
    body: 'Every radiograph is a **shadow**. X-rays diverge from a nearly point **source** — the focal spot — cross the **object**, and whatever gets past lands on the **detector**. The whole of projection geometry is these three players and the distances between them.',
    why: 'There is no lens in this story. X-rays refract so weakly that nothing practical can focus them, so the only imaging geometry available is the straight-line shadow — which is why a handful of distance ratios governs everything about image size and sharpness.',
    stage: magStage({
      hide: ['.panel'],
      set: { '#sidSlider': 120, '#sodSlider': 90, '#focalSlider': 0.1 },
    }),
  },
  {
    id: 'sod',
    title: 'SOD — source to object',
    body: 'The first distance: **SOD**, from the focal spot to the anatomy you care about. **Drag the SOD slider** and watch the object slide along the beam. It is the **lever arm** the whole projection pivots on — it will sit in the denominator of every formula that follows.',
    stage: magStage({
      hide: [GRAPH],
      focus: ['#sodSlider'],
      set: { '#sidSlider': 120, '#sodSlider': 90, '#focalSlider': 0.1 },
      task: {
        ask: 'Drag SOD and watch the object slide along the beam.',
        notice: 'SOD is just where the object sits between tube and detector — nothing else on the machine moved.',
        watch: '#sodSlider',
        by: 10,
      },
    }),
  },
  {
    id: 'sdd',
    title: 'SDD — source to detector',
    body: '**SDD** spans the whole throw, source to detector — the simulator calls it **SID**, and **FFD** is the same distance again. It is the one distance the radiographer sets directly, and chest radiography deliberately makes it **long**. Drag it and the detector walks away from the tube.',
    numbers: 'Chest PA ≈ **180 cm** · most table work ≈ **100 cm**.',
    exam: 'The inverse square law rides on this distance: double the SDD and the intensity arriving at the detector falls to a quarter, so long-SDD techniques need more mAs to keep the detector exposure. The reward is a less divergent beam through the patient and less magnification.',
    stage: magStage({
      hide: [GRAPH],
      focus: ['#sidSlider'],
      set: { '#sidSlider': 150, '#sodSlider': 90, '#focalSlider': 0.1 },
      task: {
        ask: 'Push SID out past 170 cm — the chest-radiography distance.',
        notice: 'The detector walked away from the tube and the beam through the object grew straighter. That is why chest films are taken long.',
        watch: '#sidSlider',
        above: 170,
      },
    }),
  },
  {
    id: 'odd',
    title: 'Object–detector distance (ODD)',
    body: '**ODD = SDD − SOD**: the air between the object and the detector, drawn on the scene in its own colour. Every geometric penalty in radiography — magnification, focal-spot blur — **scales with this gap**. Close the gap and both penalties shrink together. The gap is what does the damage.',
    exam: 'ODD ÷ SOD = M − 1. Examiners love this substitution: it turns the unsharpness formula Ug = f × ODD/SOD into Ug = f × (M − 1), linking blur straight to magnification.',
    stage: magStage({
      hide: [GRAPH],
      focus: ['#sodSlider', '#sidSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 70, '#focalSlider': 0.1 },
      task: {
        ask: 'Close the gap: drag SOD up until ODD falls below about 30 cm.',
        notice: 'ODD is not a control — it is what is left of SID once SOD is set. Closing it shrank both penalties at once.',
        watch: '#sodSlider',
        above: 110,
      },
    }),
  },
  {
    id: 'mag',
    title: 'Magnification (M)',
    equation: 'M = SDD ÷ SOD',
    equationNote: 'Image size ÷ object size — similar triangles, set by **distances alone**.',
    predict: { q: 'Slide the patient toward the detector — what happens to magnification?', options: ['It falls', 'It rises', 'It stays the same'], answer: 0 },
    body: 'The diverging beam makes every shadow **larger than the object**: **M = SDD ÷ SOD**. Similar triangles, nothing more. **Drag SOD up** and the marker climbs the curve on the right: SOD grows toward SDD and **M sinks toward 1** — the shadow approaches honest size.',
    trap: 'M is set by **distances alone** — focal spot size, mA and kVp cannot touch it.',
    why: 'Draw the triangle from the source to the two ends of the object, then let the same two rays run on to the detector: the far triangle is the near one scaled by SDD/SOD. The image is the object, rescaled by how much further the rays travelled.',
    exam: 'M = SDD/SOD = 1 + ODD/SOD. An object pressed against the detector has ODD = 0, so M = 1 exactly — projection can magnify but never minify.',
    stage: magStage({
      tall: true,
      focus: ['#sodSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 60, '#focalSlider': 0.1 },
      task: {
        ask: 'Slide the object toward the detector and watch the marker climb the curve.',
        notice: 'M fell toward 1 as SOD grew toward SID. Distances alone decided it — you never touched the focal spot.',
        watch: '#sodSlider',
        above: 100,
      },
    }),
  },
  {
    id: 'toward',
    title: 'ODD near zero: magnification near 1',
    body: 'Radiography’s default position: anatomy **against the detector**. With ODD nearly zero, **M is nearly 1** and the shadow tells the truth — the projected image has shrunk back almost onto the object’s own size. The **PA chest** exists for exactly this reason: it lays the **heart**, an anterior structure, close to the detector.',
    stage: magStage({
      tall: true,
      focus: ['#sodSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 125, '#focalSlider': 0.6 },
    }),
  },
  {
    id: 'away',
    title: 'Raising ODD: magnification climbs',
    body: 'Now pull the object **away** from the detector — the shadow grows. An **AP chest magnifies the heart** — same heart, bigger gap. Done on purpose, with an **air gap**, magnification becomes a technique; done by accident, it becomes a misdiagnosis.',
    trap: 'The heart sits **anteriorly** — AP projection opens its ODD, so the cardiothoracic ratio is only honest on a **PA film**.',
    exam: 'The deliberate air gap earns a bonus: obliquely scattered photons from the patient miss a detector that stands well back, so an air gap also cleans up scatter — a grid substitute in chest and cervical spine technique.',
    stage: magStage({
      tall: true,
      focus: ['#sodSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 50, '#focalSlider': 0.6 },
      task: {
        ask: 'Pull the object back toward the tube — drag SOD below 45 cm.',
        notice: 'Same object, bigger shadow. An AP chest does exactly this to the heart, which is why the cardiothoracic ratio is only honest on a PA film.',
        watch: '#sodSlider',
        below: 45,
      },
    }),
  },
  {
    id: 'focal',
    title: 'The focal spot is not a point',
    body: 'Real focal spots are **millimetres across**, and every point of the spot casts its **own complete shadow**, each slightly shifted. **Widen the focal spot** and watch the detector: the dark core where all the shadows agree is the **umbra**; the shaded rim of disagreement around it is the **penumbra**.',
    why: 'Slide your eye along the focal spot: from the top of the spot the object’s shadow sits a little low, from the bottom a little high. Summing every viewpoint gives a solid centre and edges that fade linearly from black to nothing — blur, born purely from geometry.',
    stage: magStage({
      hide: [GRAPH],
      focus: ['#focalSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 70, '#focalSlider': 2 },
      task: {
        ask: 'Run the focal spot down to 0.2 mm, then back up.',
        notice: 'At 0.2 mm the edge is almost a line; wide open, the shaded penumbra returns. The shadow never changed size — only its edge.',
        watch: '#focalSlider',
        below: 0.3,
      },
    }),
  },
  {
    id: 'ug',
    title: 'Geometric unsharpness (Ug)',
    equation: 'Ug = f × ODD ÷ SOD',
    equationNote: 'f is the **focal spot size** — it multiplies the blur, and appears nowhere in M.',
    predict: { q: 'Double the focal spot — what changes?', options: ['Magnification', 'Edge blur', 'Both'], answer: 1 },
    body: 'The penumbra has a size: **Ug = focal spot × ODD ÷ SOD**. The focal spot multiplies the **blur** and nothing else — there is no f anywhere in M. Run the focal-spot slider end to end and read the two numbers: the image **keeps its size** while its edge dissolves.',
    numbers: 'Broad focus **1.0–1.2 mm** · fine focus **0.5–0.6 mm** · mammography magnification spot **0.1 mm**.',
    exam: 'Ug = f × ODD/SOD = f × (M − 1). Magnify by 2 and the blur equals the focal spot itself — which is why deliberate magnification views demand the 0.1 mm spot.',
    stage: magStage({
      hide: [GRAPH],
      focus: ['#focalSlider', '#sodSlider'],
      set: { '#sidSlider': 140, '#sodSlider': 70, '#focalSlider': 1.6 },
      task: {
        ask: 'Take the focal spot to its widest and read both numbers.',
        notice: 'Ug grew with f. M did not move at all — there is no f anywhere in M = SID ÷ SOD.',
        watch: '#focalSlider',
        above: 1.9,
      },
    }),
  },
  {
    id: 'recipe',
    title: 'The geometry recipe',
    body: 'One recipe makes sharp, honest radiographs: **object against the detector** — a small ODD collapses both M and Ug — a **long SDD**, and a **small focal spot**. **Nothing is held back now**: every control is yours. Set them badly, then set them well, and watch the shadow tighten.',
    trap: 'Magnification views need the **smallest** focal spot, not the biggest: Ug = f × (M − 1) grows with both.',
    stage: magStage({
      tall: true,
      set: { '#sidSlider': 180, '#sodSlider': 165, '#focalSlider': 0.3 },
    }),
  },
]

export default function XrayGeometryLesson() {
  return (
    <LessonPage
      meta={{
        title: 'Projection Geometry',
        kicker: 'X-ray physics',
        accent: ACC,
        intro: 'Three players and three distances decide the **size** and **sharpness** of every radiograph — before a single photon is absorbed.',
        /* The chain to Interactions comes from the course spine now. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'Two formulas, and who moved.',
          bigPicture:
            'Every geometry question is one of two formulas plus one discipline. **M = SDD ÷ SOD** sizes the shadow; **Ug = f × ODD ÷ SOD** blurs its edge. The discipline: never answer until you know **which of the three players physically moved** — the same “SID increased” means opposite things depending on whether the source stepped back or the object drifted forward. And the focal spot belongs to **unsharpness only**: it cannot magnify anything.',
          controls: [
            { change: 'Object moves **away from the detector** (ODD ↑, SDD fixed)', effect: 'SOD ↓ → **magnification ↑ and blur ↑** together' },
            { change: 'Source moves **further back** (SOD ↑, ODD fixed)', effect: 'M sinks toward 1 and Ug shrinks — the AP-portable problem in reverse' },
            { change: '**Focal spot** ↑', effect: '**Ug ↑ only** — the image keeps its size while its edge dissolves' },
            { change: 'Deliberate **air gap**', effect: 'magnification technique + scatter misses the standing-back detector' },
          ],
          confuse: [
            { a: '**Magnification** — size, from distances alone', b: '**Geometric unsharpness** — edge blur, the only place f appears' },
            { a: '**SOD** — source to object · **SDD** — source to detector', b: '**ODD = SDD − SOD** — the gap both penalties scale with' },
            { a: '**PA chest** — heart on the detector, honest ratio', b: '**AP chest** — anterior heart, open ODD, magnified silhouette' },
          ],
        },
      }}
      steps={GEO_STEPS}
    />
  )
}

/* ================================================================== *
 *  INTERACTIONS IN TISSUE
 * ================================================================== */

/** A slab of tissue: faint fill, quiet outline. */
function slab(ctx: CanvasRenderingContext2D, x: number, y: number, sw: number, sh: number, a: number) {
  if (a <= 0.01) return
  ctx.fillStyle = rgba(INK, 0.05 * a)
  ctx.fillRect(x, y, sw, sh)
  ctx.strokeStyle = rgba(INK, 0.35 * a)
  ctx.lineWidth = 1.2
  ctx.strokeRect(x, y, sw, sh)
  ctx.lineWidth = 1
}

/** A photon: a glowing head trailing a sine wave along its direction of travel. */
function photon(ctx: CanvasRenderingContext2D, hx: number, hy: number, ang: number, len: number, per: number, a: number, colour = ACC) {
  if (a <= 0.01) return
  const px = Math.cos(ang), py = Math.sin(ang)
  const nx = -py, ny = px
  ctx.strokeStyle = rgba(colour, 0.75 * a)
  ctx.lineWidth = 1.3
  ctx.beginPath()
  const NPT = 26
  for (let i = 0; i <= NPT; i++) {
    const d = (i / NPT) * len
    const off = Math.sin((d / per) * Math.PI * 2) * 3 * Math.min(1, d / 14)
    const x = hx - px * d + nx * off
    const y = hy - py * d + ny * off
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()
  ctx.lineWidth = 1
  glowDot(ctx, hx, hy, 3.2, a, colour)
}

/** The little ring flash of an interaction event. */
function burst(ctx: CanvasRenderingContext2D, x: number, y: number, phase: number, a: number, colour = ACC) {
  if (phase <= 0 || phase >= 1 || a <= 0.01) return
  ctx.strokeStyle = rgba(colour, (1 - phase) * 0.9 * a)
  ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.arc(x, y, 5 + phase * 16, 0, Math.PI * 2); ctx.stroke()
  ctx.lineWidth = 1
}


const INT_STEPS: LessonStep[] = [
  {
    id: 'enter',
    loop: true,
    title: 'A photon enters the patient',
    body: 'Every exposure fires **billions of photons** into tissue, and each one plays the same lottery, alone. The image is nothing but the **census of what reached the far side** — so all of image formation hides inside the fate of one photon.',
    draw: (ctx, w, h, p, t) => {
      const T = 3.4
      const tt = t % T
      const cyc = Math.floor(t / T)
      const env = Math.min(easeIO(tt / 0.3), easeIO((T - tt) / 0.4))
      const x0 = w * 0.4, sw = w * 0.38, y0 = h * 0.2, sh = h * 0.52
      slab(ctx, x0, y0, sw, sh, p)
      sceneLabel(ctx, 'tissue', x0 + sw / 2, y0 - 12, p, { align: 'center' })
      ctx.save()
      ctx.globalAlpha = env
      const cy = y0 + sh * 0.5
      const travel = easeIO(seg(tt, 0.1, 2.6))
      const hx = lerp(w * 0.08, x0 + sw * 0.75, travel)
      // inside the slab, the photon's survival grows less certain
      const inside = clamp((hx - x0) / sw)
      if (hx > x0 - 2 && hx < x0 + 8) lessonPing(`enter-${cyc}`, 1050)
      photon(ctx, hx, cy, 0, 60, 9, 1 - inside * 0.6)
      sceneLabel(ctx, 'one photon, one lottery ticket', w / 2, h * 0.86, p * 0.9, { align: 'center', size: 11 })
      ctx.restore()
    },
  },
  {
    id: 'fates',
    title: 'Three fates: transmit, absorb, scatter',
    body: '**Transmitted** photons pass untouched — they draw the image. **Absorbed** photons vanish inside — they buy contrast and pay in dose. **Scattered** photons change direction and survive — they fog the image. Every property of a radiograph traces back to this three-way split.',
    why: 'Contrast is differential transmission: bone transmits fewer photons than lung, so its shadow is brighter on the display. If every ray were transmitted there would be no contrast; if none were, no image. The radiograph lives between the fates.',
    draw: (ctx, w, h, p, t) => {
      const x0 = w * 0.36, sw = w * 0.3, y0 = h * 0.14, sh = h * 0.6
      const dx = w * 0.85
      slab(ctx, x0, y0, sw, sh, p)
      ctx.strokeStyle = rgba(INK, 0.7 * p)
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(dx, y0); ctx.lineTo(dx, y0 + sh); ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'detector', dx, y0 + sh + 16, p, { align: 'center' })
      const lanes = [y0 + sh * 0.22, y0 + sh * 0.5, y0 + sh * 0.78]
      // transmit — straight through to the detector
      const t1 = easeIO(seg(t, 0.2, 1.3))
      photon(ctx, lerp(w * 0.1, dx, t1), lanes[0], 0, 52, 9, p)
      if (t1 >= 1) { lessonPing('fate-t', 1150); burst(ctx, dx, lanes[0], seg(t, 1.3, 1.7), p) }
      sceneLabel(ctx, 'transmit — draws the image', dx - 8, lanes[0] - 16, p * smoothstep(seg(t1, 0.8, 1)), { align: 'right', size: 10.5, color: rgba(ACC, 0.9) })
      // absorb — dies mid-slab
      const ax = x0 + sw * 0.55
      const t2 = easeIO(seg(t, 1.0, 1.9))
      if (t2 < 1) photon(ctx, lerp(w * 0.1, ax, t2), lanes[1], 0, 52, 9, p)
      else { lessonPing('fate-a', 750); burst(ctx, ax, lanes[1], seg(t, 1.9, 2.4), p, WARM) }
      sceneLabel(ctx, 'absorb — contrast, and dose', ax, lanes[1] + 22, p * smoothstep(seg(t, 1.9, 2.3)), { align: 'center', size: 10.5, color: rgba(WARM, 0.9) })
      // scatter — kinks inside and leaves at an angle
      const kx = x0 + sw * 0.45, ky = lanes[2]
      const t3 = easeIO(seg(t, 1.8, 2.6))
      const t4 = easeIO(seg(t, 2.6, 3.5))
      if (t4 <= 0) photon(ctx, lerp(w * 0.1, kx, t3), ky, 0, 52, 9, p)
      else {
        lessonPing('fate-s', 900)
        burst(ctx, kx, ky, seg(t, 2.6, 3.0), p)
        const ang = -0.6
        const sReach = Math.min(w * 0.22, h * 0.5)
        photon(ctx, kx + Math.cos(ang) * t4 * sReach, ky + Math.sin(ang) * t4 * sReach, ang, 46, 13, p * 0.85)
      }
      sceneLabel(ctx, 'scatter — survives, misdirected', kx, ky + 24, p * smoothstep(seg(t, 2.7, 3.1)), { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'expo',
    title: 'Attenuation is exponential',
    body: 'Each centimetre removes the **same fraction** of whatever arrives — never the same number. A thousand photons become five hundred, then two-fifty, then one-two-five: **I = I₀ e^(−μx)**, a beam that thins forever and never quite reaches zero.',
    trap: 'Equal thickness removes an equal **fraction**, so no thickness of tissue ever stops the beam completely.',
    why: 'Each photon’s chance of clearing a layer is independent of what happened before — photons carry no memory, and one interaction removes them. A constant per-layer survival probability compounds into an exponential, exactly like radioactive decay in space instead of time.',
    draw: (ctx, w, h, p) => {
      const x0 = w * 0.24, x1 = w * 0.76, y = h * 0.42
      const layers = 3
      slab(ctx, x0, y - h * 0.24, x1 - x0, h * 0.48, p)
      for (let i = 1; i < layers; i++) {
        const lx = lerp(x0, x1, i / layers)
        ctx.setLineDash([4, 5])
        ctx.strokeStyle = rgba(INK, 0.3 * p)
        ctx.beginPath(); ctx.moveTo(lx, y - h * 0.24); ctx.lineTo(lx, y + h * 0.24); ctx.stroke()
        ctx.setLineDash([])
      }
      // the beam: a band whose thickness is the surviving intensity
      const rv = smoothstep(seg(p, 0.05, 0.9))
      const bx0 = w * 0.08, bx1 = lerp(bx0, w * 0.92, rv)
      const thick = (x: number) => {
        const u = clamp((x - x0) / (x1 - x0))
        return 26 * Math.pow(0.5, u * layers)
      }
      ctx.fillStyle = rgba(ACC, 0.3)
      ctx.beginPath()
      ctx.moveTo(bx0, y - thick(bx0))
      for (let x = bx0; x <= bx1; x += 4) ctx.lineTo(x, y - thick(x))
      for (let x = bx1; x >= bx0; x -= 4) ctx.lineTo(x, y + thick(x))
      ctx.closePath(); ctx.fill()
      const counts = ['1000', '500', '250', '125']
      counts.forEach((c, i) => {
        const cx = lerp(x0, x1, i / layers)
        const bf = (cx - bx0) / (w * 0.92 - bx0)
        const a = smoothstep(seg(rv, bf, bf + 0.08))
        if (a > 0.5) lessonPing(`expo-${i}`, 1100 - i * 90)
        sceneLabel(ctx, c, cx, y + h * 0.24 + 18, a, { align: 'center', size: 12, color: i === 0 ? undefined : rgba(ACC, 0.95) })
      })
      sceneLabel(ctx, 'same fraction per layer — never the same number', w / 2, h * 0.85, seg(p, 0.7, 1), { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'mu',
    title: 'μ — how greedy the tissue is',
    body: 'The fraction removed per centimetre is the **linear attenuation coefficient μ**, in per-cm. Dense, high-Z, easy-to-stop tissue has a **large μ**; and for any tissue, μ **falls as photon energy rises**. CT numbers are nothing but μ compared with water.',
    numbers: 'μ rises with **density and atomic number Z** · falls with **photon energy**.',
    exam: 'Divide by density and you get the mass attenuation coefficient μ/ρ (cm²/g), which strips patient compression and phase out of the physics. And HU = 1000 × (μ − μwater) ÷ μwater — the Hounsfield scale is a μ ruler anchored to water.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.14, gy = h * 0.16, gw = w * 0.52, gh = h * 0.54
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke()
      sceneLabel(ctx, 'depth', gx + gw, gy + gh + 14, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'intensity', gx - 6, gy - 10, p, { size: 10 })
      const curves: [number, string, string][] = [
        [0.55, 'air / lung — small μ', rgba(INK, 0.4)],
        [1.6, 'soft tissue', rgba(INK, 0.75)],
        [3.6, 'bone — large μ', rgba(ACC, 0.95)],
      ]
      curves.forEach(([k, label, colour], ci) => {
        const a = smoothstep(seg(p, 0.1 + ci * 0.2, 0.45 + ci * 0.2))
        if (a <= 0.01) return
        ctx.strokeStyle = colour
        ctx.globalAlpha = a
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let i = 0; i <= 60; i++) {
          const f = i / 60
          const x = gx + f * gw
          const y = gy + gh - Math.exp(-k * f) * gh * 0.92 - 2
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.globalAlpha = 1
        ctx.lineWidth = 1
        const endY = gy + gh - Math.exp(-k) * gh * 0.92 - 2
        sceneLabel(ctx, label, gx + gw + 8, endY, a, { size: 10.5, color: colour })
      })
      sceneLabel(ctx, 'one slab, three appetites', gx + gw / 2, h * 0.88, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'hvl',
    title: 'HVL — the half-value layer',
    predict: { q: 'After two half-value layers, how much beam is left?', options: ['Half', 'A quarter', 'None'], answer: 1 },
    body: 'The **HVL** is the thickness that cuts the beam to **half** — the working measure of beam quality, because a harder beam has a longer HVL. Halving compounds: two layers leave a **quarter**, three an eighth. In symbols, **HVL = 0.693 ÷ μ**.',
    numbers: 'HVL = **0.693/μ** · after n HVLs the beam is **(½)ⁿ** of what entered.',
    why: 'It is the exponential from two steps ago, rewritten as a thickness: e^(−μx) equals one half when x = ln 2 ÷ μ, and ln 2 is 0.693. A hard, penetrating beam has a small μ, so its halving thickness is long.',
    exam: 'Adding filtration removes the soft photons, so the mean energy and the HVL both rise — the beam hardens. The maximum energy never moves: only kVp sets that.',
    draw: (ctx, w, h, p) => {
      const y = h * 0.4
      const s0 = w * 0.3, sw = w * 0.13
      const rv = smoothstep(seg(p, 0.05, 0.9))
      // three HVL slabs
      for (let i = 0; i < 3; i++) {
        slab(ctx, s0 + i * sw, y - h * 0.2, sw, h * 0.4, p)
        sceneLabel(ctx, '1 HVL', s0 + i * sw + sw / 2, y + h * 0.2 + 14, p, { align: 'center', size: 10 })
      }
      // the beam, halving through each
      const bx0 = w * 0.08, bxEnd = lerp(bx0, w * 0.92, rv)
      const halfAt = (x: number) => {
        const n = clamp((x - s0) / sw, 0, 3)
        return 24 * Math.pow(0.5, n)
      }
      ctx.fillStyle = rgba(ACC, 0.32)
      ctx.beginPath()
      ctx.moveTo(bx0, y - halfAt(bx0))
      for (let x = bx0; x <= bxEnd; x += 3) ctx.lineTo(x, y - halfAt(x))
      for (let x = bxEnd; x >= bx0; x -= 3) ctx.lineTo(x, y + halfAt(x))
      ctx.closePath(); ctx.fill()
      // percentage labels: before the slabs, then above each slab boundary
      const marks = ['100 %', '50 %', '25 %', '12.5 %']
      marks.forEach((m2, i) => {
        const labelX = i === 0 ? (bx0 + s0) / 2 : i === 3 ? Math.min(s0 + 3 * sw + sw * 0.5, w * 0.9) : s0 + i * sw
        const bf = (labelX - bx0) / (w * 0.92 - bx0)
        const a = smoothstep(seg(rv, bf, bf + 0.08))
        if (a > 0.5) lessonPing(`hvl-${i}`, 1150 - i * 120)
        sceneLabel(ctx, m2, labelX, y - h * 0.2 - 12, a, { align: 'center', size: 11.5, color: i ? rgba(ACC, 0.95) : undefined })
      })
      sceneLabel(ctx, 'HVL = 0.693 / μ', w / 2, h * 0.85, seg(p, 0.7, 1), { align: 'center', size: 13, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'pe',
    loop: true,
    title: 'Photoelectric absorption: the photon vanishes',
    body: 'The photon dives past the outer shells and strikes an **inner-shell (K) electron**, handing over **everything**. The photon **ceases to exist**; the electron is ejected as a **photoelectron** carrying the energy left after its binding is paid. Nothing continues toward the detector.',
    why: 'A completely free electron cannot swallow a photon whole — energy and momentum cannot both balance. It takes a tightly bound electron, with the whole atom behind it to absorb the recoil, which is why the photoelectric effect favours inner shells and hates being far above the binding energy.',
    exam: 'The photon must exceed the shell binding energy, and the probability spikes just above it — the K-edge. Tissue K-edges sit below 1 keV; iodine’s sits at 33 keV, squarely inside the diagnostic beam, which is the whole trick of contrast media.',
    stage: tourStage({ to: 3, only: 'photo' }),
  },
  {
    id: 'cascade',
    loop: true,
    title: 'The vacancy, the cascade, and Z³',
    body: 'An outer electron **falls into the vacancy**, and the drop comes out as **characteristic radiation** — in tissue, soft enough to be absorbed on the spot. The whole event scales as **Z³ ÷ E³**: that is why bone is white, why iodine and barium work, and why photoelectric absorption is **contrast and dose in one**.',
    numbers: 'Probability ∝ **Z³/E³** · K-edges: iodine **33 keV** · barium **37 keV**.',
    trap: 'Photoelectric absorption sends **nothing** onward to the detector — no scattered photon, no fog.',
    stage: tourStage({ to: 6, only: 'photo' }),
  },
  {
    id: 'compton',
    loop: true,
    title: 'Compton scatter: the photon survives',
    body: 'Here the photon hits a **loosely bound outer electron**. The electron **recoils** with a share of the energy; the photon **survives** — cheaper, and **redirected**. Because the electron’s binding barely matters, Compton cares about **electron density**, not atomic number.',
    why: 'Next to a diagnostic photon’s energy, an outer electron’s few-eV binding is loose change — the collision is effectively photon versus free electron, pure billiard-ball kinematics. Z never enters; the number of electrons per cm³ is all that counts, and per gram that is nearly the same for every tissue.',
    exam: 'The energy handed to the electron grows with scattering angle: a 180° backscatter transfers the most, a forward graze almost nothing. And the fraction transferred grows with photon energy — high-energy beams make hotter recoil electrons.',
    stage: tourStage({ to: 8, only: 'compton' }),
  },
  {
    id: 'fog',
    title: 'Scatter reaches the detector from the wrong direction',
    body: 'A scattered photon still has energy enough to **cross the patient and strike the detector** — but its direction no longer points back at any anatomy. Scatter lays a **uniform grey veil** over the image and eats contrast; the photons that exit sideways become the **staff dose** in fluoroscopy.',
    trap: 'Scatter degrades **contrast**, not resolution — the veil is featureless and everywhere.',
    exam: 'The scattered fraction grows with field size, patient thickness and kVp — the three levers a stem will pull. At the detector face of a large abdominal field, scattered photons can outnumber primary ones several times over.',
    stage: tourStage({ to: 9, only: 'compton' }),
  },
  {
    id: 'versus',
    title: 'Photoelectric versus Compton',
    predict: { q: 'Raise the beam energy — which interaction fades faster?', options: ['Photoelectric', 'Compton', 'They fall together'], answer: 0 },
    body: '**Photoelectric**: total absorption, ∝ **Z³/E³** — the contrast maker, ruling at low energy and high Z. **Compton**: survival and redirection, ∝ **electron density**, nearly flat with energy — the fog maker, ruling most of the diagnostic range in soft tissue. Every kVp decision slides you along these two curves.',
    numbers: 'In soft tissue the two are equal near **25–30 keV**; above that, Compton rules.',
    trap: 'High kVp kills photoelectric contrast **and** feeds Compton fog — the classic low-contrast pairing.',
    exam: 'At mammographic energies photoelectric dominates and small Z differences shine — that is why breast imaging lives at 25–32 kVp. At CT energies soft-tissue contrast is nearly all Compton, so it tracks density; iodine still lights up because photons near its 33 keV K-edge remain in the spectrum.',
    stage: tourStage({ to: 10, graph: true }),
  },
]

export function XrayInteractionsLesson() {
  return (
    <LessonPage
      meta={{
        title: 'Interactions in Tissue',
        kicker: 'X-ray physics',
        accent: ACC,
        intro: 'Transmit, absorb or scatter: every pixel of contrast and every millisievert of dose comes down to **what one photon does inside the patient**.',
        /* Last lesson of the core: the spine hands over to the machines and
           the finish screen carries the module's practice gate. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'Where contrast, fog and dose are born.',
          bigPicture:
            'One photon, three fates. **Transmission** carries the image; **photoelectric absorption** creates contrast and deposits dose, falling away steeply with energy and rising with **Z³**; **Compton scatter** survives to fog the detector and barely cares about Z at all. Every choice of kV is a negotiation between those last two — and the crossover energy is where the negotiation tips.',
          controls: [
            { change: '**Photon energy (kV)** ↑', effect: 'photoelectric fraction falls steeply (∝ 1/E³) → **subject contrast ↓**, Compton takes over' },
            { change: '**Tissue Z** ↑ (bone, contrast agents)', effect: 'photoelectric ∝ **Z³** — the whole reason iodine and barium work' },
            { change: 'Thickness ↑', effect: 'exponential attenuation — each HVL halves what remains' },
          ],
          confuse: [
            { a: '**Photoelectric** — photon vanishes, inner shell, ∝ Z³/E³, contrast and dose', b: '**Compton** — photon survives, outer electron, ∝ electron density, scatter fog' },
            { a: '**Photoelectron** — ejected in photoelectric absorption', b: '**Recoil (Compton) electron** — set moving by scatter' },
            { a: '**Attenuation** — everything removed from the beam', b: '**Absorption** — only the part that stays in the patient' },
          ],
        },
      }}
      steps={INT_STEPS}
    />
  )
}
