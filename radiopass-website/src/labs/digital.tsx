/**
 * Digital radiography — a focused lesson covering CR and DR: how the plate
 * and the panel actually work, and what "digital" costs and buys.
 * Original procedural diagrams throughout.
 */

import { C, rgba, lerp, seg, smoothstep, sceneLabel, mulberry32 } from '../home/fx'
import { LessonPage, type LessonStep } from './lesson'

const ACC = '#8FB8C9'
const INK = C.ink
const AMBER = '#D9A84E'
const RED = '#D9806E'
const BLUE = '#7FA8E8'

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

const rnd = mulberry32(4242)
const NOISE = Array.from({ length: 160 }, () => ({ x: rnd(), y: rnd() }))

const STEPS: LessonStep[] = [
  {
    id: 'cr-plate',
    title: 'CR: the plate remembers the exposure',
    body: 'A computed radiography plate is a **photostimulable phosphor** — barium fluorohalide. X-rays promote electrons into **metastable traps**, and that trapped pattern **is** the latent image. The plate is a continuous sheet: there are **no pixels until it is read**.',
    trap: 'Caesium iodide belongs to **indirect DR panels and image intensifiers** — not CR.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, py = h * 0.5
      // plate cross-section
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - w * 0.3, py - 16, w * 0.6, 32)
      sceneLabel(ctx, 'BaFBr phosphor layer', cx + w * 0.33, py, 1)
      // incoming x-rays
      const f = smoothstep(seg(p, 0.1, 0.5))
      for (let i = 0; i < 5; i++) {
        const x = cx - w * 0.22 + i * w * 0.11
        ctx.strokeStyle = rgba(ACC, 0.6 * f)
        ctx.beginPath(); ctx.moveTo(x, py - h * 0.3); ctx.lineTo(x, py - 18); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x - 3, py - 26); ctx.lineTo(x, py - 18); ctx.lineTo(x + 3, py - 26); ctx.stroke()
      }
      sceneLabel(ctx, 'exposure', cx, py - h * 0.34, f, { align: 'center', size: 10.5 })
      // trapped electrons appear
      const ta = smoothstep(seg(p, 0.4, 0.9))
      for (let i = 0; i < 12; i++) {
        const x = cx - w * 0.26 + (i / 11) * w * 0.52
        const strength = 0.3 + 0.6 * Math.exp(-Math.pow((i - 6) / 3, 2))
        ctx.fillStyle = rgba(AMBER, strength * ta)
        ctx.beginPath(); ctx.arc(x, py + (i % 2 ? 5 : -4), 2.6, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'trapped electrons — the latent image', cx, py + 40, ta, { align: 'center', color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'a continuous sheet — pixels exist only at readout', cx, h * 0.84, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'cr-read',
    title: 'Red laser in, blue light out',
    body: 'The reader rasters a **red laser** across the plate; each trapped electron it releases falls back and emits **blue light**, which a **photomultiplier tube** collects point by point. Read within hours (the traps slowly leak), then **flood the plate with bright light to erase it** — ready for thousands of reuses.',
    numbers: 'Read within **a few hours**; half a day to a week means severe fading.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, py = h * 0.56
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.strokeRect(cx - w * 0.3, py - 12, w * 0.6, 24)
      // scanning laser spot
      const scan = Math.min(t / 2.4, 1)
      const lx = cx - w * 0.28 + scan * w * 0.56
      ctx.strokeStyle = rgba(RED, 0.85)
      ctx.lineWidth = 1.6
      ctx.beginPath(); ctx.moveTo(lx, h * 0.18); ctx.lineTo(lx, py - 12); ctx.stroke()
      ctx.lineWidth = 1
      ctx.fillStyle = rgba(RED, 0.9)
      ctx.beginPath(); ctx.arc(lx, py - 12, 3, 0, Math.PI * 2); ctx.fill()
      sceneLabel(ctx, 'red laser scans', lx + 8, h * 0.2, 1, { color: rgba(RED, 0.9) })
      // blue emission to PMT
      const ba = smoothstep(seg(p, 0.3, 0.8))
      const pmx = cx + w * 0.34, pmy = h * 0.24
      ctx.strokeStyle = rgba(BLUE, 0.7 * ba)
      ctx.beginPath(); ctx.moveTo(lx + 3, py - 14); ctx.lineTo(pmx - 12, pmy + 10); ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.55 * ba)
      ctx.strokeRect(pmx - 12, pmy - 14, 42, 24)
      sceneLabel(ctx, 'PMT', pmx + 9, pmy - 2, ba, { align: 'center', size: 10.5 })
      sceneLabel(ctx, 'blue photostimulated light', lerp(lx, pmx, 0.5), lerp(py - 14, pmy, 0.5) - 12, ba, { align: 'center', size: 10, color: rgba(BLUE, 0.9) })
      sceneLabel(ctx, 'then erase with bright white light → reuse', cx, h * 0.86, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'dr-indirect',
    title: 'Indirect DR: scintillator over photodiodes',
    body: 'An indirect flat panel converts twice: a **CsI scintillator** turns X-rays into light, and a **photodiode/TFT array** underneath turns light into charge, read out row by row. CsI grows as **columnar needles** that guide the light down like fibre optics, limiting sideways spread.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.3
      // CsI needles
      const na = smoothstep(seg(p, 0.1, 0.5))
      for (let i = 0; i < 30; i++) {
        const x = cx - w * 0.28 + i * w * 0.019
        ctx.strokeStyle = rgba(ACC, 0.5 * na)
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x, top + h * 0.16); ctx.stroke()
      }
      ctx.lineWidth = 1
      sceneLabel(ctx, 'CsI columnar needles — light guided down', cx + w * 0.31, top + h * 0.08, na)
      // photodiode/TFT grid
      const ga = smoothstep(seg(p, 0.35, 0.75))
      for (let i = 0; i < 15; i++) {
        const x = cx - w * 0.28 + i * w * 0.038
        ctx.strokeStyle = rgba(INK, 0.45 * ga)
        ctx.strokeRect(x, top + h * 0.19, w * 0.032, h * 0.05)
      }
      sceneLabel(ctx, 'photodiodes + TFT switches', cx + w * 0.31, top + h * 0.215, ga)
      // photon → light burst
      const fa = smoothstep(seg(p, 0.5, 0.9))
      const fx = cx - w * 0.05
      ctx.strokeStyle = rgba(ACC, 0.8 * fa)
      ctx.beginPath(); ctx.moveTo(fx, top - h * 0.18); ctx.lineTo(fx, top + 6); ctx.stroke()
      ctx.fillStyle = rgba('#FFFFFF', 0.8 * fa)
      ctx.beginPath(); ctx.arc(fx, top + 10, 3.4, 0, Math.PI * 2); ctx.fill()
      sceneLabel(ctx, 'X-ray → light → charge: two conversions', cx, h * 0.78, fa, { align: 'center', size: 11 })
    },
  },
  {
    id: 'dr-direct',
    title: 'Direct DR: selenium skips the light step',
    body: 'A direct panel uses **amorphous selenium**: the X-ray creates charge **directly** in the photoconductor, and an applied field pulls it straight down to the pixel electrodes — **no light, no sideways spread**, which is why direct conversion is intrinsically sharp.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.3
      // selenium slab with field lines
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.strokeRect(cx - w * 0.28, top, w * 0.56, h * 0.18)
      sceneLabel(ctx, 'amorphous selenium', cx + w * 0.31, top + h * 0.09, 1)
      const fa = smoothstep(seg(p, 0.15, 0.5))
      for (let i = 0; i < 9; i++) {
        const x = cx - w * 0.24 + i * w * 0.06
        ctx.strokeStyle = rgba(INK, 0.18 * fa)
        ctx.beginPath(); ctx.moveTo(x, top + 4); ctx.lineTo(x, top + h * 0.18 - 4); ctx.stroke()
      }
      // photon → charge pair drifting straight down
      const ca = smoothstep(seg(p, 0.4, 0.9))
      const fx = cx - w * 0.03
      ctx.strokeStyle = rgba(ACC, 0.8 * ca)
      ctx.beginPath(); ctx.moveTo(fx, top - h * 0.18); ctx.lineTo(fx, top + 8); ctx.stroke()
      ctx.fillStyle = rgba(AMBER, 0.9 * ca)
      ctx.beginPath(); ctx.arc(fx, top + h * 0.06 + ca * h * 0.09, 3, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = rgba(AMBER, 0.5 * ca)
      ctx.setLineDash([2, 3])
      ctx.beginPath(); ctx.moveTo(fx, top + 10); ctx.lineTo(fx, top + h * 0.17); ctx.stroke()
      ctx.setLineDash([])
      // electrodes
      const ea = smoothstep(seg(p, 0.3, 0.7))
      for (let i = 0; i < 15; i++) {
        const x = cx - w * 0.28 + i * w * 0.038
        ctx.fillStyle = rgba(INK, 0.5 * ea)
        ctx.fillRect(x, top + h * 0.19, w * 0.032, 5)
      }
      sceneLabel(ctx, 'pixel electrodes', cx + w * 0.31, top + h * 0.2, ea)
      sceneLabel(ctx, 'charge drifts straight down — no light spread, sharp', cx, h * 0.78, ca, { align: 'center', size: 11 })
    },
  },
  {
    id: 'matrix',
    title: 'Matrix, pixels and the storage bill',
    body: 'Pixel size = **field of view ÷ matrix**, and spatial resolution can never beat the detector element. Storage scales with the **square** of the matrix side and linearly with **bit depth** (grey levels = 2^bits). Double the matrix side and the file **quadruples**.',
    numbers: 'One 512² image at 12 bits ≈ **400–500 kB**.',
    draw: (ctx, w, h, p) => {
      const grid = (cx: number, n: number, label: string, sub: string, a: number) => {
        const s = Math.min(w, h) * 0.15
        ctx.strokeStyle = rgba(INK, 0.4 * a)
        for (let i = 0; i <= n; i++) {
          const f = (i / n) * s * 2
          ctx.beginPath(); ctx.moveTo(cx - s + f, h * 0.42 - s); ctx.lineTo(cx - s + f, h * 0.42 + s); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx - s, h * 0.42 - s + f); ctx.lineTo(cx + s, h * 0.42 - s + f); ctx.stroke()
        }
        sceneLabel(ctx, label, cx, h * 0.42 + s + 18, a, { align: 'center', size: 11.5 })
        sceneLabel(ctx, sub, cx, h * 0.42 + s + 36, a * 0.9, { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
      }
      grid(w * 0.3, 6, 'matrix n', 'storage ∝ n²', smoothstep(seg(p, 0, 0.4)))
      grid(w * 0.7, 12, 'matrix 2n', 'storage ×4', smoothstep(seg(p, 0.3, 0.75)))
      sceneLabel(ctx, 'smaller pixels — but each catches fewer photons', w / 2, h * 0.12, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'dynamic-range',
    title: 'Wide dynamic range — and the dose-creep trap',
    body: 'Film had a narrow S-curve: miss the exposure and the image died. A digital detector responds **linearly across a huge range**, so processing rescues almost any exposure — which means **overexposure looks perfect**. The **exposure indicator** is the only witness; watch it, or dose creeps.',
    trap: 'AEC still matters in digital imaging — “the detector will cope” is how dose creep starts.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.16, gw = w * 0.62, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      // film S-curve
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const f = i / 80
        const v = 1 / (1 + Math.exp(-(f - 0.45) * 14))
        const x = gx + f * gw, y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(INK, 0.4 * p)
      ctx.stroke()
      // digital linear
      ctx.beginPath()
      for (let i = 0; i <= 80 * p; i++) {
        const f = i / 80
        const x = gx + f * gw, y = gy + gh - f * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'film — narrow latitude', gx + gw * 0.62, gy + gh * 0.6, p, { size: 10.5 })
      sceneLabel(ctx, 'digital — linear, forgiving, silent', gx + gw * 0.42, gy + gh * 0.18, p, { size: 10.5, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'log relative exposure →', gx + gw, gy + gh + 16, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'signal', gx - 6, gy - 10, p, { size: 10 })
    },
  },
  {
    id: 'mtf',
    title: 'MTF and DQE: quality as curves',
    body: 'The **MTF** says how much contrast survives at each spatial frequency — 1 is perfect, and every blur pulls it down. The **DQE** says how efficiently the detector uses the dose it is given. Between them they are the honest description of any detector.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.16, gw = w * 0.62, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      const curve = (drop: number, colour: string, a: number) => {
        ctx.beginPath()
        for (let i = 0; i <= 80 * a; i++) {
          const f = i / 80
          const v = Math.exp(-f * drop)
          const x = gx + f * gw, y = gy + gh - v * gh * 0.85
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rgba(colour, 0.9)
        ctx.lineWidth = 1.6
        ctx.stroke()
        ctx.lineWidth = 1
      }
      curve(2.2, ACC, smoothstep(seg(p, 0.1, 0.6)))
      curve(4.6, AMBER, smoothstep(seg(p, 0.3, 0.8)))
      sceneLabel(ctx, 'sharp system', gx + gw * 0.55, gy + gh * 0.28, seg(p, 0.4, 0.7), { color: rgba(ACC, 0.9), size: 10.5 })
      sceneLabel(ctx, 'blurred system — MTF falls early', gx + gw * 0.4, gy + gh * 0.62, seg(p, 0.5, 0.8), { color: rgba(AMBER, 0.9), size: 10.5 })
      sceneLabel(ctx, 'spatial frequency (lp/mm) →', gx + gw, gy + gh + 16, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'MTF', gx - 6, gy - 10, p, { size: 10 })
      sceneLabel(ctx, '1.0', gx - 8, gy + gh * 0.15, p, { align: 'right', size: 10 })
    },
  },
  {
    id: 'processing',
    title: 'Processing helps — but cannot invent photons',
    body: 'Windowing, edge enhancement and noise smoothing are **display-side**: they re-present the data, never improve it. An underexposed image keeps its **quantum mottle** whatever the processing does. And digital panels have their own artefacts — **dead pixels and ghosting** from earlier exposures.',
    draw: (ctx, w, h, p) => {
      const s = Math.min(w, h) * 0.15, y = h * 0.42
      const patch = (cx: number, label: string, a: number, enhanced: boolean) => {
        ctx.strokeStyle = rgba(INK, 0.35 * a)
        ctx.strokeRect(cx - s, y - s, s * 2, s * 2)
        // noisy content: same graininess in both
        ctx.fillStyle = rgba(INK, 0.5 * a)
        NOISE.forEach(pt => ctx.fillRect(cx - s + pt.x * s * 2, y - s + pt.y * s * 2, 1.6, 1.6))
        // a lesion circle, higher contrast if enhanced
        ctx.strokeStyle = rgba(ACC, (enhanced ? 0.95 : 0.45) * a)
        ctx.lineWidth = enhanced ? 2 : 1.2
        ctx.beginPath(); ctx.arc(cx + s * 0.2, y - s * 0.1, s * 0.35, 0, Math.PI * 2); ctx.stroke()
        ctx.lineWidth = 1
        sceneLabel(ctx, label, cx, y + s + 18, a, { align: 'center', size: 11 })
      }
      patch(w * 0.3, 'raw — noisy', smoothstep(seg(p, 0, 0.4)), false)
      patch(w * 0.7, 'processed — clearer, same mottle', smoothstep(seg(p, 0.35, 0.8)), true)
      sceneLabel(ctx, 'display changes; the photon count does not', w / 2, h * 0.12, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
]

export default function DigitalLab() {
  return (
    <LessonPage
      meta={{
        title: 'CR & Digital Radiography',
        kicker: 'X-ray techniques',
        accent: ACC,
        intro: 'How the plate and the panel actually work — **eight ideas** from the phosphor to the exposure indicator, each one drawn.',
        /* Practice and facts arrive through the course spine; the gate opens
           the digital section's own questions. (The old hand-authored facts
           link here pointed at /fact-bank/fluoro — the fluoroscopy topic —
           which is where the digital-imaging facts happen to live, but a
           button reading "Digital imaging facts" must not quietly change
           subject. The spine's facts binding names the topic honestly.) */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'Photon in, number out.',
          bigPicture:
            'Three roads from absorption to signal: the CR plate **stores** the image until a red laser asks for it back; the indirect panel converts to **light first**; the direct panel goes **straight to charge**. Once the image is numbers, processing can rescue brightness from almost any exposure — which is exactly why **a good-looking image proves nothing about dose**, and why the exposure indicator, not the display, is the honest witness.',
          controls: [
            { change: '**Pixel size** ↓ (fixed FOV, matrix ↑)', effect: 'spatial resolution potential ↑ · fewer photons per pixel → **SNR ↓**' },
            { change: '**Bit depth** ↑', effect: 'more grey levels per pixel — dynamic range representation, not resolution' },
            { change: '**Exposure** ↑ beyond need', effect: 'the image still looks fine — only the **exposure indicator** tells the truth (dose creep)' },
            { change: '**Processing**', effect: 'reshapes what was captured — it can never invent photons that were not' },
          ],
          confuse: [
            { a: '**CR** — photostimulable storage phosphor, read LATER by a red laser', b: '**DR** — immediate readout; CR is never caesium iodide' },
            { a: '**Indirect DR** — CsI scintillator → light → photodiode', b: '**Direct DR** — amorphous selenium → charge, no light step at all' },
            { a: '**MTF** — how faithfully detail transfers across spatial frequencies', b: '**DQE** — how efficiently X-ray information becomes signal versus noise' },
          ],
        },
      }}
      steps={STEPS}
    />
  )
}
