/**
 * Fluoroscopy — a focused lesson: real-time imaging and the price it pays
 * in dose. Original procedural diagrams throughout.
 */

import { C, rgba, lerp, seg, smoothstep, sceneLabel } from '../home/fx'
import { LessonPage, type LessonStep } from './lesson'

const ACC = '#E0955A'
const INK = C.ink
const BLUE = '#A8CBEA'

const STEPS: LessonStep[] = [
  {
    id: 'chain',
    title: 'A live chain: tube, patient, detector, display',
    body: 'Fluoroscopy is radiography running continuously: an **under-couch tube**, the patient, and a receptor — historically an **image intensifier**, now usually a **flat panel** — feeding a live display. Everything about the design balances a watchable image against a **dose rate that never stops accumulating**.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2
      const items: [string, number][] = [
        ['X-ray tube (under couch)', h * 0.78],
        ['patient on couch', h * 0.55],
        ['receptor above', h * 0.32],
        ['live display', h * 0.12],
      ]
      items.forEach(([name, y], i) => {
        const a = smoothstep(seg(p, i * 0.18, 0.3 + i * 0.18))
        if (i === 0) {
          ctx.fillStyle = rgba(ACC, 0.9 * a)
          ctx.beginPath(); ctx.arc(cx, y, 7, 0, Math.PI * 2); ctx.fill()
        } else if (i === 1) {
          ctx.strokeStyle = rgba(INK, 0.5 * a)
          ctx.lineWidth = 1.4
          ctx.beginPath(); ctx.ellipse(cx, y, w * 0.16, 16, 0, 0, Math.PI * 2); ctx.stroke()
          ctx.beginPath(); ctx.moveTo(cx - w * 0.22, y + 22); ctx.lineTo(cx + w * 0.22, y + 22); ctx.stroke()
        } else if (i === 2) {
          ctx.strokeStyle = rgba(INK, 0.7 * a)
          ctx.lineWidth = 3
          ctx.beginPath(); ctx.moveTo(cx - w * 0.13, y); ctx.lineTo(cx + w * 0.13, y); ctx.stroke()
          ctx.lineWidth = 1
        } else {
          ctx.strokeStyle = rgba(BLUE, 0.7 * a)
          ctx.strokeRect(cx - 30, y - 12, 60, 40)
        }
        sceneLabel(ctx, name, cx + w * 0.26, y, a)
      })
      // beam
      const ba = smoothstep(seg(p, 0.3, 0.7))
      ctx.fillStyle = rgba(ACC, 0.07 * ba)
      ctx.strokeStyle = rgba(ACC, 0.3 * ba)
      ctx.beginPath()
      ctx.moveTo(cx, h * 0.76)
      ctx.lineTo(cx - w * 0.12, h * 0.33)
      ctx.lineTo(cx + w * 0.12, h * 0.33)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
    },
  },
  {
    id: 'ii',
    title: 'Inside the image intensifier',
    body: 'X-rays strike a **CsI input phosphor** and become light; a **photocathode** turns the light into electrons; **~25–30 kV** accelerates them across the vacuum onto a small output phosphor. Acceleration plus **minification** give a brightness gain in the thousands — enough to watch in real time at a low dose rate.',
    trap: 'The focusing is done by **electrostatic lenses** — photomultiplier tubes belong to gamma cameras and CR readers.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.16, bot = h * 0.72
      // envelope (tapering)
      ctx.strokeStyle = rgba(INK, 0.45)
      ctx.lineWidth = 1.3
      ctx.beginPath()
      ctx.moveTo(cx - w * 0.2, bot)
      ctx.lineTo(cx - w * 0.05, top)
      ctx.lineTo(cx + w * 0.05, top)
      ctx.lineTo(cx + w * 0.2, bot)
      ctx.closePath()
      ctx.stroke()
      // input phosphor / photocathode
      ctx.strokeStyle = rgba(ACC, 0.85)
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(cx - w * 0.19, bot - 4); ctx.lineTo(cx + w * 0.19, bot - 4); ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'CsI input + photocathode', cx + w * 0.22, bot - 4, p)
      // output phosphor
      ctx.strokeStyle = rgba(BLUE, 0.9)
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(cx - w * 0.045, top + 3); ctx.lineTo(cx + w * 0.045, top + 3); ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'small output phosphor', cx + w * 0.09, top + 6, p)
      // electron paths converging
      const f = smoothstep(seg(p, 0.25, 0.75))
      for (let i = 0; i < 5; i++) {
        const fx = lerp(cx - w * 0.15, cx + w * 0.15, i / 4)
        ctx.strokeStyle = rgba(ACC, 0.55 * f)
        ctx.beginPath()
        ctx.moveTo(fx, bot - 8)
        ctx.quadraticCurveTo(lerp(fx, cx, 0.5), lerp(bot, top, 0.55), lerp(cx - w * 0.03, cx + w * 0.03, i / 4), top + 6)
        ctx.stroke()
      }
      sceneLabel(ctx, 'electrons accelerated at 25–30 kV', cx - w * 0.24, (top + bot) / 2, seg(p, 0.4, 0.8), { align: 'right' })
      sceneLabel(ctx, 'gain = acceleration × minification', cx, h * 0.88, seg(p, 0.6, 1), { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'distortion',
    title: 'What the electron optics cost',
    body: 'Bending electrons through a vacuum has consequences: straight lines bow outward (**pincushion distortion**), external magnetic fields skew the paths into an **S-shape**, and the periphery arrives dimmer (**vignetting**). A rigid **flat panel has none of these** — no electron optics, nothing to distort.',
    draw: (ctx, w, h, p) => {
      const grid = (cx: number, warp: number, label: string, a: number) => {
        const s = Math.min(w, h) * 0.15
        ctx.strokeStyle = rgba(INK, 0.5 * a)
        ctx.lineWidth = 1
        for (let i = -2; i <= 2; i++) {
          // vertical curves
          ctx.beginPath()
          for (let j = 0; j <= 20; j++) {
            const fy = (j / 20) * 2 - 1
            const bow = warp * (i / 2) * (1 - fy * fy) * s * 0.22
            const x = cx + (i / 2) * s + bow
            const y = h * 0.42 + fy * s
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
          // horizontal curves
          ctx.beginPath()
          for (let j = 0; j <= 20; j++) {
            const fx = (j / 20) * 2 - 1
            const bow = warp * (i / 2) * (1 - fx * fx) * s * 0.22
            const x = cx + fx * s
            const y = h * 0.42 + (i / 2) * s + bow
            j === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
          }
          ctx.stroke()
        }
        sceneLabel(ctx, label, cx, h * 0.42 + s + 22, a, { align: 'center', size: 11 })
      }
      grid(w * 0.28, 1, 'image intensifier — pincushion', smoothstep(seg(p, 0, 0.45)))
      grid(w * 0.72, 0, 'flat panel — geometrically true', smoothstep(seg(p, 0.35, 0.8)))
      sceneLabel(ctx, 'vignetting also darkens the II periphery', w * 0.28, h * 0.14, seg(p, 0.5, 0.9), { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
    },
  },
  {
    id: 'abc',
    title: 'Automatic brightness control',
    body: 'A sensor watches the image brightness; when the view moves over thicker tissue the feedback loop **raises kV and/or mA** to hold the display steady. The picture never changes — but the **dose rate silently does**. Panning across a dense region is a dose decision, whether you noticed or not.',
    draw: (ctx, w, h, p, t) => {
      const gx = w * 0.14, gw = w * 0.7
      // patient thickness profile
      const thick = (f: number) => 0.35 + 0.4 * Math.exp(-Math.pow((f - 0.62) / 0.16, 2))
      const yT = h * 0.3
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) {
        const f = i / 80
        const x = gx + f * gw
        const y = yT - thick(f) * h * 0.14
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.25)
      ctx.beginPath(); ctx.moveTo(gx, yT); ctx.lineTo(gx + gw, yT); ctx.stroke()
      sceneLabel(ctx, 'patient thickness along the pan', gx + gw / 2, yT + 16, p, { align: 'center', size: 10.5 })
      // scanning position
      const pos = clampf(Math.min(t / 2.4, 1))
      const px = gx + pos * gw
      ctx.strokeStyle = rgba(ACC, 0.8)
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(px, yT - h * 0.12); ctx.lineTo(px, h * 0.72); ctx.stroke()
      ctx.setLineDash([])
      // dose rate curve follows thickness
      const gy = h * 0.66, gh2 = h * 0.16
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy - gh2); ctx.moveTo(gx, gy); ctx.lineTo(gx + gw, gy); ctx.stroke()
      ctx.beginPath()
      for (let i = 0; i <= 80 * pos; i++) {
        const f = i / 80
        const x = gx + f * gw
        const y = gy - ((thick(f) - 0.35) / 0.4) * gh2 * 0.9 - 4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'dose rate — rises silently over dense tissue', gx + gw / 2, gy + 18, p, { align: 'center', size: 10.5, color: rgba(ACC, 0.9) })
      void p
    },
  },
  {
    id: 'pulsed',
    title: 'Pulsed fluoroscopy and last image hold',
    body: 'The eye needs far fewer frames than continuous exposure provides. **Pulse the beam** — 15, 7.5, even 3 pulses per second — and the dose falls roughly with the frame rate, with **last image hold** keeping a picture on screen between looks. It is the single easiest dose saving in the room.',
    numbers: 'Typical entrance dose rate **10–50 mGy/min** — minutes add up fast.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.14, gw = w * 0.72
      const row = (y: number, label: string, duty: number, n: number, a: number) => {
        ctx.strokeStyle = rgba(INK, 0.3 * a)
        ctx.beginPath(); ctx.moveTo(gx, y); ctx.lineTo(gx + gw, y); ctx.stroke()
        ctx.fillStyle = rgba(ACC, 0.65 * a)
        for (let i = 0; i < n; i++) {
          const x = gx + (i / n) * gw
          ctx.fillRect(x, y - 14, (gw / n) * duty, 14)
        }
        sceneLabel(ctx, label, gx + gw + 10, y - 7, a)
      }
      row(h * 0.26, 'continuous', 1, 1, smoothstep(seg(p, 0, 0.35)))
      row(h * 0.46, '15 p/s', 0.35, 15, smoothstep(seg(p, 0.25, 0.6)))
      row(h * 0.66, '3 p/s', 0.35, 3, smoothstep(seg(p, 0.5, 0.85)))
      sceneLabel(ctx, 'less beam-on time — same usable view', gx + gw / 2, h * 0.82, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'skin',
    title: 'Skin dose is the interventional hazard',
    body: 'Long procedures put deterministic injuries in reach — erythema needs only **2–5 Gy** at one skin patch. The defences are geometric: **collimate**, keep the **detector close** and the tube far, avoid magnification, and **vary the beam entry angle** so no patch takes the whole burden.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.5, cy = h * 0.45
      // patient cross-section
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.14, h * 0.2, 0, 0, Math.PI * 2); ctx.stroke()
      // beams from several angles
      const angles = [-0.5, 0, 0.55]
      angles.forEach((a, i) => {
        const aa = smoothstep(seg(p, 0.15 + i * 0.2, 0.4 + i * 0.2))
        const sx = cx + Math.sin(a) * w * 0.32
        const sy = cy + Math.cos(a) * h * 0.42
        ctx.strokeStyle = rgba(ACC, 0.45 * aa)
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(cx, cy); ctx.stroke()
        // skin patch marker
        const px = cx + Math.sin(a) * w * 0.135
        const py = cy + Math.cos(a) * h * 0.19
        ctx.strokeStyle = rgba(ACC, 0.85 * aa)
        ctx.lineWidth = 3
        ctx.beginPath(); ctx.arc(px, py, 8, a + Math.PI / 2 - 0.5, a + Math.PI / 2 + 0.5); ctx.stroke()
        ctx.lineWidth = 1
      })
      sceneLabel(ctx, 'spread the entry — spread the dose', cx, cy + h * 0.3, seg(p, 0.6, 1), { align: 'center', size: 12 })
      sceneLabel(ctx, 'erythema threshold 2–5 Gy', cx, h * 0.1, seg(p, 0.7, 1), { align: 'center', size: 11, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'dsa',
    title: 'DSA: subtract everything that does not move',
    body: 'Take a **mask** before contrast, subtract it from every live frame, and bone and soft tissue vanish — **only the vessels remain**. Contrast resolution soars; but the noise of both frames **adds**, so SNR falls, and any patient movement between mask and run paints **misregistration artefact**.',
    trap: 'Spatial resolution is **unchanged** by subtraction — it lives in the detector, not the arithmetic.',
    draw: (ctx, w, h, p) => {
      const s = Math.min(w, h) * 0.16, y = h * 0.4
      const panel = (cx: number, label: string, a: number, mode: 'mask' | 'live' | 'sub') => {
        ctx.strokeStyle = rgba(INK, 0.35 * a)
        ctx.strokeRect(cx - s, y - s, s * 2, s * 2)
        if (mode !== 'sub') {
          // bone + tissue blobs
          ctx.strokeStyle = rgba(INK, 0.4 * a)
          ctx.beginPath(); ctx.ellipse(cx - s * 0.3, y, s * 0.32, s * 0.7, 0.15, 0, Math.PI * 2); ctx.stroke()
          ctx.strokeStyle = rgba(INK, 0.22 * a)
          ctx.beginPath(); ctx.ellipse(cx + s * 0.4, y + s * 0.2, s * 0.3, s * 0.4, -0.3, 0, Math.PI * 2); ctx.stroke()
        }
        if (mode !== 'mask') {
          // vessel tree
          ctx.strokeStyle = rgba(ACC, (mode === 'sub' ? 0.95 : 0.6) * a)
          ctx.lineWidth = mode === 'sub' ? 2 : 1.4
          ctx.beginPath()
          ctx.moveTo(cx, y - s * 0.85)
          ctx.quadraticCurveTo(cx + s * 0.1, y - s * 0.2, cx - s * 0.1, y + s * 0.3)
          ctx.moveTo(cx - s * 0.02, y - s * 0.25)
          ctx.lineTo(cx + s * 0.4, y + s * 0.1)
          ctx.moveTo(cx - s * 0.05, y + s * 0.05)
          ctx.lineTo(cx - s * 0.5, y + s * 0.5)
          ctx.stroke()
          ctx.lineWidth = 1
        }
        sceneLabel(ctx, label, cx, y + s + 18, a, { align: 'center', size: 11 })
      }
      panel(w * 0.2, 'mask', smoothstep(seg(p, 0, 0.3)), 'mask')
      panel(w * 0.5, 'contrast run', smoothstep(seg(p, 0.2, 0.5)), 'live')
      panel(w * 0.8, 'subtracted — vessels only', smoothstep(seg(p, 0.5, 0.85)), 'sub')
      // minus and equals signs
      sceneLabel(ctx, '−', w * 0.35, y, seg(p, 0.3, 0.5), { align: 'center', size: 22 })
      sceneLabel(ctx, '=', w * 0.65, y, seg(p, 0.5, 0.7), { align: 'center', size: 22 })
    },
  },
]

/** Local clamp so the ABC step can use a plain helper name. */
function clampf(v: number) { return Math.max(0, Math.min(1, v)) }

export default function FluoroLab() {
  return (
    <LessonPage
      meta={{
        title: 'Fluoroscopy',
        kicker: 'X-ray techniques',
        accent: ACC,
        intro: 'Real-time imaging and the price it pays in dose: **seven ideas**, from the image intensifier to DSA — each one drawn.',
        next: [
          { label: 'Practise X-ray questions', to: '/question-bank/xray' },
          { label: 'Fluoroscopy facts', to: '/fact-bank/fluoro' },
        ],
        backTo: { label: 'X-ray techniques', to: '/xray-lab' },
      }}
      steps={STEPS}
    />
  )
}
