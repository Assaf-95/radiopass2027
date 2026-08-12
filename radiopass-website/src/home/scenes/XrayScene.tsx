// Pinned X-ray chapter: one continuous schematic — cathode, anode, filter,
// patient, detector — travelled left to right as the user scrolls. Ten
// short visual chapters, each anchored to the physical event it describes.

import { Link } from 'react-router-dom'
import {
  C, rgba, clamp, lerp, seg, smoothstep, easeIO, frac, mulberry32,
  usePinnedScene, applyFades, useElRegistry, sceneLabel, type Fade,
} from '../fx'

const CHAPTERS: [string, string][] = [
  ['Filament', 'The cathode filament heats until electrons can escape its surface.'],
  ['Thermionic emission', 'Electrons boil off the filament, forming a space-charge cloud.'],
  ['Tube potential', 'The kilovoltage accelerates electrons toward the anode.'],
  ['Bremsstrahlung', 'Electron deceleration at the target produces a continuous spectrum.'],
  ['Characteristic radiation', 'Inner-shell vacancies add discrete peaks to the spectrum.'],
  ['Filtration', 'Low-energy photons are removed — the beam hardens.'],
  ['The patient', 'Attenuation in tissue shapes the transmitted beam.'],
  ['Photoelectric effect', 'Complete photon absorption, most likely in high-Z tissue.'],
  ['Compton scatter', 'Partial energy transfer and a change of direction.'],
  ['Detection', 'The transmitted pattern becomes the image.'],
]

const BANDS: [number, number][] = [
  [0.0, 0.09], [0.09, 0.18], [0.18, 0.27], [0.27, 0.38], [0.38, 0.47],
  [0.47, 0.56], [0.56, 0.65], [0.65, 0.74], [0.74, 0.84], [0.84, 1],
]

const rnd = mulberry32(4211)
const BURST_DIRS = Array.from({ length: 18 }, () => rnd() * Math.PI * 2)
const EMISSION = Array.from({ length: 14 }, () => ({ a: rnd() * Math.PI * 2, r: rnd(), ph: rnd() * Math.PI * 2 }))

/* The patient is a chest. In the beam it is only a quiet thorax outline; the
   payoff is at the detector, where a realistic PA chest radiograph forms —
   rendered once, procedurally, on an offscreen canvas (no photograph, no
   patient data): lung fields with vascular markings, ribs, clavicles, the
   heart shadow, diaphragm domes, a gastric bubble, film grain and an R marker.
   Radiographic convention throughout: the patient's left is the viewer's
   right, so the heart bulges viewer-right and the bubble sits under the
   viewer-right dome. */

let RADIOGRAPH: HTMLCanvasElement | null = null

function radiograph(): HTMLCanvasElement {
  if (RADIOGRAPH) return RADIOGRAPH
  const W = 360
  const H = 440
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const g = c.getContext('2d')!
  const nx = (v: number) => v * W
  const ny = (v: number) => v * H
  const grey = (v: number, a: number) => `rgba(${v},${v + 6},${v + 12},${a})`
  const r = mulberry32(90210)

  // Film black.
  g.fillStyle = '#05070A'
  g.fillRect(0, 0, W, H)

  // Soft-tissue torso: shoulders sloping to axillae, flanks widening below.
  g.filter = 'blur(6px)'
  g.fillStyle = grey(150, 0.24)
  g.beginPath()
  g.moveTo(nx(0.36), ny(0.02))
  g.bezierCurveTo(nx(0.2), ny(0.08), nx(0.06), ny(0.16), nx(0.05), ny(0.3))
  g.lineTo(nx(0.03), ny(1))
  g.lineTo(nx(0.97), ny(1))
  g.lineTo(nx(0.95), ny(0.3))
  g.bezierCurveTo(nx(0.94), ny(0.16), nx(0.8), ny(0.08), nx(0.64), ny(0.02))
  g.closePath()
  g.fill()
  // The abdomen reads brighter than the aerated chest.
  g.fillStyle = grey(170, 0.22)
  g.fillRect(nx(0.05), ny(0.7), nx(0.9), ny(0.3))
  g.filter = 'none'

  // Lung fields: two dark wells inside the thorax.
  const lung = (cx: number, flip: number) => {
    g.filter = 'blur(4px)'
    g.fillStyle = 'rgba(4,6,9,0.62)'
    g.beginPath()
    g.moveTo(nx(cx), ny(0.1))
    g.bezierCurveTo(nx(cx + 0.17 * flip), ny(0.12), nx(cx + 0.21 * flip), ny(0.3), nx(cx + 0.19 * flip), ny(0.5))
    g.bezierCurveTo(nx(cx + 0.17 * flip), ny(0.63), nx(cx + 0.1 * flip), ny(0.7), nx(cx + 0.02 * flip), ny(0.7))
    g.bezierCurveTo(nx(cx - 0.03 * flip), ny(0.6), nx(cx - 0.04 * flip), ny(0.3), nx(cx), ny(0.1))
    g.closePath()
    g.fill()
    g.filter = 'none'
  }
  lung(0.43, -1) // viewer-left lung (patient's right)
  lung(0.57, 1) // viewer-right lung

  // Vascular markings fanning out from each hilum.
  g.lineCap = 'round'
  for (const [hx, dir] of [[0.44, -1], [0.56, 1]] as const) {
    for (let i = 0; i < 16; i++) {
      const a = (-0.85 + 1.7 * (i / 15)) + dir * 0.35
      let x = nx(hx)
      let y = ny(0.42 + (r() - 0.5) * 0.05)
      g.strokeStyle = grey(190, 0.05 + r() * 0.05)
      g.lineWidth = 1.6 - (i % 3) * 0.4
      g.beginPath()
      g.moveTo(x, y)
      for (let s = 0; s < 4; s++) {
        x += Math.cos(a + (r() - 0.5) * 0.7) * nx(0.045) * dir * (dir === 1 ? 1 : -1) * -dir
        x += dir * nx(0.02)
        y += Math.sin(a) * ny(0.02) + ny(0.028)
        g.lineTo(x, y)
      }
      g.stroke()
    }
  }

  // Trachea: a dark air column at the top of the mediastinum.
  g.filter = 'blur(2px)'
  g.fillStyle = 'rgba(6,8,11,0.5)'
  g.fillRect(nx(0.485), ny(0.04), nx(0.03), ny(0.16))
  g.filter = 'none'

  // Spine: bright central column with vertebral banding, fading inferiorly.
  g.filter = 'blur(2px)'
  const spine = g.createLinearGradient(0, ny(0.02), 0, ny(0.95))
  spine.addColorStop(0, grey(210, 0.4))
  spine.addColorStop(0.55, grey(200, 0.3))
  spine.addColorStop(1, grey(190, 0.14))
  g.fillStyle = spine
  g.fillRect(nx(0.455), ny(0.02), nx(0.09), ny(0.95))
  g.filter = 'none'
  g.fillStyle = 'rgba(5,7,10,0.16)'
  for (let i = 0; i < 16; i++) g.fillRect(nx(0.452), ny(0.055 + i * 0.058), nx(0.096), ny(0.012))

  // Heart shadow: bulging into the viewer-right chest, apex inferolateral.
  g.filter = 'blur(5px)'
  g.fillStyle = grey(185, 0.34)
  g.beginPath()
  g.moveTo(nx(0.47), ny(0.34))
  g.bezierCurveTo(nx(0.42), ny(0.48), nx(0.43), ny(0.62), nx(0.47), ny(0.7))
  g.bezierCurveTo(nx(0.56), ny(0.73), nx(0.68), ny(0.72), nx(0.71), ny(0.66))
  g.bezierCurveTo(nx(0.7), ny(0.52), nx(0.6), ny(0.38), nx(0.53), ny(0.34))
  g.closePath()
  g.fill()
  g.filter = 'none'

  // Posterior ribs: paired arcs sweeping down and laterally from the spine.
  g.filter = 'blur(0.8px)'
  for (let side = -1; side <= 1; side += 2) {
    for (let i = 0; i < 9; i++) {
      const yTop = 0.13 + i * 0.062
      g.strokeStyle = grey(205, 0.2 - i * 0.008)
      g.lineWidth = 4.6
      g.beginPath()
      g.moveTo(nx(0.5 + side * 0.03), ny(yTop))
      g.bezierCurveTo(
        nx(0.5 + side * 0.3), ny(yTop - 0.035),
        nx(0.5 + side * 0.44), ny(yTop + 0.03),
        nx(0.5 + side * 0.46), ny(yTop + 0.085),
      )
      g.stroke()
      // Anterior ribs: fainter, sloping down toward the midline.
      if (i > 0 && i < 8) {
        g.strokeStyle = grey(200, 0.08)
        g.lineWidth = 5
        g.beginPath()
        g.moveTo(nx(0.5 + side * 0.44), ny(yTop + 0.1))
        g.quadraticCurveTo(nx(0.5 + side * 0.26), ny(yTop + 0.16), nx(0.5 + side * 0.1), ny(yTop + 0.15))
        g.stroke()
      }
    }
  }
  g.filter = 'none'

  // Clavicles: bright gentle S-curves crossing the apices.
  g.filter = 'blur(0.6px)'
  g.strokeStyle = grey(220, 0.4)
  g.lineWidth = 5.4
  for (const side of [-1, 1]) {
    g.beginPath()
    g.moveTo(nx(0.5 + side * 0.05), ny(0.155))
    g.bezierCurveTo(nx(0.5 + side * 0.18), ny(0.175), nx(0.5 + side * 0.3), ny(0.125), nx(0.5 + side * 0.45), ny(0.135))
    g.stroke()
  }
  g.filter = 'none'

  // Diaphragm: the right dome (viewer left) rides higher than the left.
  const dome = (x0: number, x1: number, apexX: number, apexY: number, baseY: number) => {
    g.filter = 'blur(2px)'
    g.fillStyle = grey(180, 0.3)
    g.beginPath()
    g.moveTo(nx(x0), ny(baseY))
    g.quadraticCurveTo(nx(apexX), ny(apexY), nx(x1), ny(baseY))
    g.closePath()
    g.fill()
    g.strokeStyle = grey(215, 0.32)
    g.lineWidth = 2.4
    g.beginPath()
    g.moveTo(nx(x0), ny(baseY))
    g.quadraticCurveTo(nx(apexX), ny(apexY), nx(x1), ny(baseY))
    g.stroke()
    g.filter = 'none'
  }
  dome(0.06, 0.49, 0.27, 0.615, 0.73)
  dome(0.51, 0.95, 0.72, 0.655, 0.75)

  // Gastric air bubble beneath the viewer-right hemidiaphragm.
  g.filter = 'blur(3px)'
  g.fillStyle = 'rgba(5,7,10,0.5)'
  g.beginPath()
  g.ellipse(nx(0.63), ny(0.77), nx(0.052), ny(0.03), 0, 0, Math.PI * 2)
  g.fill()
  g.filter = 'none'

  // Film grain: two offset passes of a small noise tile.
  const tile = document.createElement('canvas')
  tile.width = 90
  tile.height = 110
  const tg = tile.getContext('2d')!
  const noise = tg.createImageData(90, 110)
  for (let i = 0; i < noise.data.length; i += 4) {
    const v = 128 + (r() - 0.5) * 255
    noise.data[i] = noise.data[i + 1] = noise.data[i + 2] = v
    noise.data[i + 3] = 255
  }
  tg.putImageData(noise, 0, 0)
  g.globalAlpha = 0.05
  g.drawImage(tile, 0, 0, W, H)
  g.globalAlpha = 0.035
  g.drawImage(tile, -20, -14, W + 40, H + 28)
  g.globalAlpha = 1

  // Collimation vignette.
  const vg = g.createRadialGradient(W / 2, H / 2, H * 0.32, W / 2, H / 2, H * 0.72)
  vg.addColorStop(0, 'rgba(0,0,0,0)')
  vg.addColorStop(1, 'rgba(0,0,0,0.42)')
  g.fillStyle = vg
  g.fillRect(0, 0, W, H)

  // Side marker.
  g.font = '600 22px Georgia, serif'
  g.fillStyle = grey(225, 0.7)
  g.fillText('R', nx(0.07), ny(0.1))

  RADIOGRAPH = c
  return c
}

/* The in-beam patient: a quiet thorax outline with the faintest lung hint —
   deliberately background, so the formed radiograph carries the realism. */
function drawPatient(ctx: CanvasRenderingContext2D, px: number, py: number, H: number) {
  const X = (v: number) => px + (v - 0.5) * H * 0.72
  const Y = (v: number) => py + (v - 0.5) * H
  ctx.save()
  ctx.lineCap = 'round'
  ctx.strokeStyle = rgba(C.xray, 0.34)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(X(0.4), Y(0.02))
  ctx.bezierCurveTo(X(0.24), Y(0.1), X(0.08), Y(0.18), X(0.07), Y(0.34))
  ctx.lineTo(X(0.05), Y(0.98))
  ctx.moveTo(X(0.6), Y(0.02))
  ctx.bezierCurveTo(X(0.76), Y(0.1), X(0.92), Y(0.18), X(0.93), Y(0.34))
  ctx.lineTo(X(0.95), Y(0.98))
  ctx.stroke()
  // Lung fields, barely there.
  ctx.strokeStyle = rgba(C.xray, 0.14)
  ctx.lineWidth = 1
  for (const side of [-1, 1]) {
    ctx.beginPath()
    ctx.moveTo(X(0.5 + side * 0.07), Y(0.14))
    ctx.bezierCurveTo(
      X(0.5 + side * 0.33), Y(0.18),
      X(0.5 + side * 0.38), Y(0.52),
      X(0.5 + side * 0.3), Y(0.78),
    )
    ctx.bezierCurveTo(X(0.5 + side * 0.16), Y(0.84), X(0.5 + side * 0.06), Y(0.7), X(0.5 + side * 0.06), Y(0.5))
    ctx.stroke()
  }
  // Spine hint.
  ctx.setLineDash([2.5, 5])
  ctx.strokeStyle = rgba(C.ink, 0.16)
  ctx.beginPath()
  ctx.moveTo(X(0.5), Y(0.06))
  ctx.lineTo(X(0.5), Y(0.96))
  ctx.stroke()
  ctx.setLineDash([])
  ctx.restore()
}

/* Ray fates: how far each fan ray travels, and what ends it. */
type Fate = 'filtered' | 'photoelectric' | 'compton' | 'soft' | 'bone'
const RAY_DEG = [-13, -8.5, -4, 0, 4, 8.5, 13]
const RAY_FATE: Fate[] = ['soft', 'filtered', 'compton', 'photoelectric', 'bone', 'filtered', 'soft']

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const mobile = w < 760
  const axisY = h * (mobile ? 0.36 : 0.44)
  const X = {
    fil: w * 0.135, foc: w * 0.283, filter: w * 0.40,
    patient: w * 0.585, det: w * 0.82,
  }
  const F = { x: X.foc, y: axisY }
  const patientRx = w * 0.075, patientRy = h * 0.21
  // The densest structures the beam meets: the carpal/metacarpal region.
  const bone = { x: X.patient - w * 0.004, y: axisY + h * 0.012, r: w * 0.018 }
  const line = (a: number) => rgba(C.ink, a)

  /* --- envelope + cathode + anode (revealed in chapter 1) --- */
  const build = smoothstep(seg(p, 0, 0.07))
  ctx.save()
  ctx.globalAlpha = build
  ctx.strokeStyle = line(0.3)
  ctx.lineWidth = 1
  const env = { x: w * 0.09, y: axisY - h * 0.17, w: w * 0.25, h: h * 0.34 }
  ctx.beginPath()
  ctx.roundRect(env.x, env.y, env.w, env.h, 26)
  ctx.stroke()
  // focusing cup
  ctx.strokeStyle = line(0.55)
  ctx.beginPath()
  ctx.moveTo(X.fil - w * 0.016, axisY - h * 0.045)
  ctx.lineTo(X.fil - w * 0.004, axisY - h * 0.035)
  ctx.lineTo(X.fil - w * 0.004, axisY + h * 0.035)
  ctx.lineTo(X.fil - w * 0.016, axisY + h * 0.045)
  ctx.stroke()
  // anode: angled tungsten face + body
  ctx.fillStyle = rgba('#3A4049', 0.9)
  ctx.beginPath()
  ctx.moveTo(X.foc + w * 0.017, axisY - h * 0.105)
  ctx.lineTo(X.foc - w * 0.005, axisY + h * 0.075)
  ctx.lineTo(X.foc + w * 0.05, axisY + h * 0.075)
  ctx.lineTo(X.foc + w * 0.05, axisY - h * 0.105)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = line(0.5)
  ctx.beginPath()
  ctx.moveTo(X.foc + w * 0.017, axisY - h * 0.105)
  ctx.lineTo(X.foc - w * 0.005, axisY + h * 0.075)
  ctx.stroke()
  ctx.restore()

  /* --- filament + heating glow --- */
  const heat = smoothstep(seg(p, 0.01, 0.07))
  const shimmer = 0.85 + 0.15 * Math.sin(t * 5.1)
  if (heat > 0) {
    const g = ctx.createRadialGradient(X.fil, axisY, 0, X.fil, axisY, h * 0.06)
    g.addColorStop(0, rgba(C.amber, 0.4 * heat * shimmer))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(X.fil - h * 0.06, axisY - h * 0.06, h * 0.12, h * 0.12)
  }
  ctx.strokeStyle = heat > 0.4 ? rgba(C.amber, 0.5 + 0.5 * heat * shimmer) : line(0.4 + build * 0.2)
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let i = 0; i <= 6; i++) {
    const y = axisY - h * 0.028 + (i / 6) * h * 0.056
    const x = X.fil + (i % 2 === 0 ? -2.6 : 2.6)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()

  /* --- thermionic emission cloud --- */
  const boil = smoothstep(seg(p, 0.09, 0.14)) * (1 - smoothstep(seg(p, 0.94, 1)))
  if (boil > 0) {
    ctx.fillStyle = rgba(C.xrayBright, 0.75 * boil)
    for (const e of EMISSION) {
      const wob = Math.sin(t * 1.7 + e.ph)
      const ex = X.fil + 4 + e.r * 9 + wob * 1.5
      const ey = axisY + Math.sin(e.a) * (h * 0.032) + Math.cos(t * 1.2 + e.ph) * 2
      ctx.beginPath(); ctx.arc(ex, ey, 1.4, 0, Math.PI * 2); ctx.fill()
    }
  }

  /* --- accelerated electron stream --- */
  const stream = smoothstep(seg(p, 0.18, 0.23)) * (1 - smoothstep(seg(p, 0.94, 1)))
  if (stream > 0) {
    for (let i = 0; i < 9; i++) {
      const f = frac(i * 0.618 + p * 11)
      const ex = lerp(X.fil + 10, F.x - 3, f)
      const spread = lerp(h * 0.03, h * 0.004, f)
      const ey = axisY + Math.sin(i * 2.4) * spread
      ctx.strokeStyle = rgba(C.xrayBright, 0.55 * stream * (0.4 + f * 0.6))
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(ex - 7 - f * 8, ey); ctx.lineTo(ex, ey); ctx.stroke()
    }
  }

  /* --- kVp accelerating field marker --- */
  const kv = smoothstep(seg(p, 0.185, 0.23)) * (1 - smoothstep(seg(p, 0.3, 0.37)))
  if (kv > 0) {
    const y = axisY - h * 0.125
    ctx.strokeStyle = rgba(C.amber, 0.65 * kv)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(X.fil + 8, y); ctx.lineTo(F.x - 8, y); ctx.stroke()
    for (const [x, sign] of [[X.fil + 8, 1], [F.x - 8, -1]] as const) {
      ctx.beginPath()
      ctx.moveTo(x + sign * 6, y - 3.5); ctx.lineTo(x, y); ctx.lineTo(x + sign * 6, y + 3.5)
      ctx.stroke()
    }
    sceneLabel(ctx, '− kVp +', (X.fil + F.x) / 2, y - 11, kv, { color: rgba(C.amber, 0.9), align: 'center' })
  }

  /* --- focal spot impact glow --- */
  const impact = smoothstep(seg(p, 0.27, 0.32)) * (1 - smoothstep(seg(p, 0.95, 1)))
  if (impact > 0) {
    const g = ctx.createRadialGradient(F.x, F.y, 0, F.x, F.y, h * 0.05)
    g.addColorStop(0, rgba(C.xrayBright, 0.55 * impact * (0.85 + 0.15 * Math.sin(t * 7))))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(F.x - h * 0.05, F.y - h * 0.05, h * 0.1, h * 0.1)
  }

  /* --- bremsstrahlung burst: photons leave in all directions --- */
  const burst = smoothstep(seg(p, 0.27, 0.31)) * (1 - smoothstep(seg(p, 0.4, 0.47)))
  if (burst > 0) {
    ctx.lineWidth = 1
    for (let i = 0; i < BURST_DIRS.length; i++) {
      const a = BURST_DIRS[i]
      const len = (w * 0.02 + (i % 3) * w * 0.012) * burst
      ctx.strokeStyle = rgba(C.xray, 0.4 * burst)
      ctx.beginPath()
      ctx.moveTo(F.x + Math.cos(a) * 6, F.y + Math.sin(a) * 6)
      ctx.lineTo(F.x + Math.cos(a) * (6 + len), F.y + Math.sin(a) * (6 + len))
      ctx.stroke()
    }
  }

  /* --- filter, patient, detector (progressive illumination) --- */
  const filterA = smoothstep(seg(p, 0.43, 0.49))
  if (filterA > 0) {
    ctx.fillStyle = rgba('#5A6470', 0.75 * filterA)
    ctx.fillRect(X.filter - 3, axisY - h * 0.115, 6, h * 0.23)
  }
  const patientA = smoothstep(seg(p, 0.52, 0.58))
  if (patientA > 0) {
    ctx.save()
    ctx.globalAlpha = patientA
    drawPatient(ctx, X.patient, axisY, h * 0.46)
    ctx.restore()
  }
  const detA = smoothstep(seg(p, 0.78, 0.84))
  if (detA > 0) {
    ctx.strokeStyle = line(0.5 * detA)
    ctx.lineWidth = 1.2
    ctx.strokeRect(X.det - 4, axisY - h * 0.21, 12, h * 0.42)
  }

  /* --- the beam fan and every photon's fate --- */
  const q = easeIO(seg(p, 0.3, 0.94))
  const comptonKinkX = X.patient + w * 0.02

  if (q > 0) {
    for (let i = 0; i < RAY_DEG.length; i++) {
      const a = (RAY_DEG[i] * Math.PI) / 180
      const dx = Math.cos(a), dy = Math.sin(a)
      const fate = RAY_FATE[i]
      const sFull = (X.det + w * 0.02 - F.x) / dx
      let sTerm = sFull
      if (fate === 'filtered') sTerm = (X.filter - F.x) / dx
      if (fate === 'photoelectric') sTerm = (bone.x - bone.r * 0.4 - F.x) / dx
      const sKink = (comptonKinkX - F.x) / dx
      const s = q * sFull

      ctx.lineWidth = 1.3
      if (fate === 'compton') {
        const s1 = Math.min(s, sKink)
        ctx.strokeStyle = rgba(C.xray, 0.6)
        ctx.beginPath(); ctx.moveTo(F.x + 4, F.y); ctx.lineTo(F.x + dx * s1, F.y + dy * s1); ctx.stroke()
        if (s > sKink) {
          const ka = a + (34 * Math.PI) / 180
          const s2 = Math.min(s - sKink, w * 0.2)
          const kx = F.x + dx * sKink, ky = F.y + dy * sKink
          ctx.setLineDash([5, 5])
          ctx.strokeStyle = rgba(C.xray, 0.38)
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(ka) * s2, ky + Math.sin(ka) * s2); ctx.stroke()
          ctx.setLineDash([])
          // recoil electron
          const ea = a - (38 * Math.PI) / 180
          const se = Math.min((s - sKink) * 0.4, w * 0.03)
          ctx.strokeStyle = rgba(C.amber, 0.6)
          ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + Math.cos(ea) * se, ky + Math.sin(ea) * se); ctx.stroke()
          const comptonA = smoothstep(seg(p, 0.75, 0.8)) * (1 - smoothstep(seg(p, 0.9, 0.96)))
          sceneLabel(ctx, 'scattered — lower energy', kx + 30, ky + 26, comptonA, { color: rgba(C.xray, 0.8) })
          sceneLabel(ctx, 'e⁻', kx + Math.cos(ea) * (se + 6), ky + Math.sin(ea) * (se + 6), comptonA, { color: rgba(C.amber, 0.85), align: 'center' })
        }
        continue
      }

      const sDraw = Math.min(s, sTerm)
      const throughBone = fate === 'bone'
      ctx.strokeStyle = rgba(C.xray, fate === 'filtered' ? 0.45 : 0.6)
      ctx.beginPath(); ctx.moveTo(F.x + 4, F.y); ctx.lineTo(F.x + dx * sDraw, F.y + dy * sDraw); ctx.stroke()

      if (fate === 'filtered' && s > sTerm) {
        const tx = F.x + dx * sTerm, ty = F.y + dy * sTerm
        ctx.strokeStyle = rgba(C.mut, 0.7)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(tx - 3.4, ty - 3.4); ctx.lineTo(tx + 3.4, ty + 3.4)
        ctx.moveTo(tx + 3.4, ty - 3.4); ctx.lineTo(tx - 3.4, ty + 3.4)
        ctx.stroke()
      }
      if (fate === 'photoelectric' && s > sTerm) {
        const px = F.x + dx * sTerm, py = F.y + dy * sTerm
        const lp = seg(p, 0.65, 0.71)
        if (lp > 0 && lp < 1) {
          ctx.strokeStyle = rgba(C.xrayBright, (1 - lp) * 0.85)
          ctx.beginPath(); ctx.arc(px, py, 3 + (1 - lp) * 9, 0, Math.PI * 2); ctx.stroke()
        }
        const ej = smoothstep(seg(p, 0.67, 0.76))
        if (ej > 0) {
          ctx.strokeStyle = rgba(C.amber, 0.7 * (1 - seg(p, 0.9, 0.98) * 0.6))
          ctx.beginPath()
          ctx.moveTo(px, py)
          ctx.lineTo(px + ej * w * 0.022, py - ej * w * 0.014)
          ctx.stroke()
          sceneLabel(ctx, 'photoelectron', px + w * 0.024, py - w * 0.018,
            smoothstep(seg(p, 0.68, 0.73)) * (1 - smoothstep(seg(p, 0.82, 0.88))), { color: rgba(C.amber, 0.85) })
        }
        // absorbed marker
        ctx.fillStyle = rgba(C.xrayBright, 0.8)
        ctx.beginPath(); ctx.arc(px, py, 2, 0, Math.PI * 2); ctx.fill()
      }
      if ((fate === 'soft' || throughBone) && sDraw >= sFull - 1) {
        // faint continuation dimmer beyond patient for attenuation feel
        ctx.strokeStyle = rgba(C.xrayBright, throughBone ? 0.2 : 0.5)
        ctx.beginPath()
        const sp = (X.patient + patientRx - F.x) / dx
        ctx.moveTo(F.x + dx * sp, F.y + dy * sp)
        ctx.lineTo(F.x + dx * sFull, F.y + dy * sFull)
        ctx.stroke()
      }
    }
  }

  /* --- the radiograph forms behind the detector --- */
  const imgA = smoothstep(seg(p, 0.85, 0.93))
  if (imgA > 0) {
    // A portrait film in the chest radiograph's own aspect ratio, kept quiet:
    // the image is the result of the physics, not the star of the scene.
    const panelH = h * 0.42
    const panelW = Math.min(panelH * (360 / 440), w - X.det - 24)
    const panelX = X.det + 12
    const panelY = axisY - panelH / 2
    ctx.save()
    ctx.globalAlpha = imgA
    ctx.fillStyle = rgba('#04070B', 0.94)
    ctx.strokeStyle = line(0.3)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH, 4); ctx.fill(); ctx.stroke()
    // The image sweeps in as the transmitted pattern is read out.
    const reveal = seg(p, 0.86, 0.97)
    if (reveal > 0) {
      ctx.beginPath(); ctx.roundRect(panelX, panelY, panelW, panelH * reveal, 4); ctx.clip()
      ctx.globalAlpha = imgA * 0.92
      ctx.drawImage(radiograph(), panelX, panelY, panelW, panelH)
    }
    ctx.restore()
  }

  /* --- inset: the live beam spectrum --- */
  const insetA = smoothstep(seg(p, 0.29, 0.35))
  if (insetA > 0 && !mobile) {
    const ix = w * 0.05, iy = h * 0.7, iw = w * 0.22, ih = h * 0.2
    ctx.save()
    ctx.globalAlpha = insetA
    ctx.strokeStyle = line(0.35)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ix, iy); ctx.lineTo(ix, iy + ih); ctx.lineTo(ix + iw, iy + ih)
    ctx.stroke()
    const filt = 0.12 + smoothstep(seg(p, 0.47, 0.56)) * 0.55
    const charA = smoothstep(seg(p, 0.385, 0.44))
    const spectrum = (e: number) => {
      if (e <= 0.02 || e >= 1) return 0
      const brems = ((1 - e) / e) * Math.exp(-filt / Math.pow(e * 2.4, 3))
      const k1 = charA * 1.15 * Math.exp(-Math.pow((e - 0.62) / 0.014, 2))
      const k2 = charA * 0.7 * Math.exp(-Math.pow((e - 0.72) / 0.014, 2))
      return brems + k1 + k2
    }
    let norm = 0
    for (let e = 0.05; e < 1; e += 0.01) norm = Math.max(norm, ((1 - e) / e) * Math.exp(-0.12 / Math.pow(e * 2.4, 3)))
    ctx.beginPath()
    for (let e = 0.02; e <= 1.001; e += 0.008) {
      const x = ix + e * iw
      const y = iy + ih - clamp(spectrum(e) / norm) * ih * 0.92
      if (e <= 0.021) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.strokeStyle = rgba(C.xray, 0.85)
    ctx.lineWidth = 1.4
    ctx.stroke()
    sceneLabel(ctx, 'Beam spectrum', ix - 5, iy - 12, insetA, { color: rgba(C.ink, 0.6) })
    sceneLabel(ctx, 'photon energy →  (max = kVp)', ix + iw * 0.4, iy + ih + 13, insetA, { size: 10, color: rgba(C.mut, 0.9), align: 'center' })
    sceneLabel(ctx, 'characteristic lines', ix + iw * 0.67, iy + ih * 0.16,
      charA * (1 - smoothstep(seg(p, 0.5, 0.56))), { color: rgba(C.amber, 0.9), align: 'center', size: 10 })
    sceneLabel(ctx, 'low energies removed', ix + iw * 0.16, iy + ih * 0.42,
      smoothstep(seg(p, 0.49, 0.54)) * (1 - smoothstep(seg(p, 0.62, 0.68))), { color: rgba(C.amber, 0.9), align: 'center', size: 10 })
    ctx.restore()
  }

  /* --- component labels --- */
  const lbl = mobile ? [] as const : ([
    ['Filament', X.fil, axisY + h * 0.085, 0.02, 0.08, 0.24, 0.3],
    ['Anode (tungsten)', X.foc + w * 0.03, axisY - h * 0.13, 0.04, 0.1, 0.3, 0.38],
    ['Aluminium filter', X.filter, axisY - h * 0.15, 0.44, 0.5, 0.6, 0.66],
    ['Patient', X.patient, axisY - patientRy - 16, 0.53, 0.59, 0.72, 0.78],
    ['Detector', X.det + 4, axisY - h * 0.24, 0.79, 0.85, 1.2, 1.3],
  ] as const)
  for (const [text, x, y, a, b, c, d] of lbl) {
    sceneLabel(ctx, text, x, y, smoothstep(seg(p, a, b)) * (1 - smoothstep(seg(p, c, d))), { align: 'center', size: 10.5 })
  }
}

export default function XrayScene() {
  const { els, set } = useElRegistry()

  const scene = usePinnedScene(draw, p => {
    const fades: Fade[] = [
      { el: els.current.head, in: [0, 0.03], y: 20 },
      { el: els.current.cta, in: [0.86, 0.92], y: 16 },
    ]
    for (let i = 0; i < CHAPTERS.length; i++) {
      const [a, b] = BANDS[i]
      fades.push({
        el: els.current['ch' + i],
        in: [a + 0.004, a + 0.032],
        out: i === CHAPTERS.length - 1 ? undefined : [b - 0.022, b + 0.004],
        y: 22,
      })
    }
    applyFades(fades, p)
    for (let i = 0; i < CHAPTERS.length; i++) {
      const dot = els.current['dot' + i]
      if (dot) dot.className = p >= BANDS[i][0] && p < BANDS[i][1] ? 'on' : ''
    }
  }, { staticP: 0.9 })

  return (
    <section className={`hm-stage hm-stage-xray${scene.reduced ? ' is-rm' : ''}`} id="follow-the-photon" ref={scene.wrapRef} aria-labelledby="hm-xray-h">
      <div className="hm-pin">
        <canvas ref={scene.canvasRef} className="hm-canvas" aria-hidden="true" />
        <div className="hm-stage-copy">
          <div ref={set('head')} className="hm-fade hm-stage-head">
            <p className="hm-eyebrow hm-acc-xray">X-ray physics</p>
            <h2 id="hm-xray-h">Follow the photon.</h2>
            <p className="hm-stage-sub">From thermionic emission to image formation.</p>
          </div>
          <div className="hm-chapters">
            {CHAPTERS.map(([title, text], i) => (
              <div key={title} ref={set('ch' + i)} className="hm-chapter hm-fade">
                <span>{String(i + 1).padStart(2, '0')}</span>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
            ))}
          </div>
          <div ref={set('cta')} className="hm-stage-cta hm-fade">
            <Link className="hm-btn hm-btn-line" to="/visual-lab">Enter the X-ray Lab</Link>
          </div>
        </div>
        <div className="hm-rail" aria-hidden="true">
          {CHAPTERS.map((c, i) => <i key={c[0]} ref={set('dot' + i)} />)}
        </div>
      </div>
    </section>
  )
}
