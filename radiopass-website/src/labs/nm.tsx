/**
 * Nuclear medicine — a focused lesson: from the generator to PET, one
 * concept at a time. All diagrams are original procedural drawings.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel, mulberry32 } from '../home/fx'
import { FilmPage, type FilmScene } from './cinema'
import { LessonPage, lessonPing, type LessonStep } from './lesson'

const ACC = '#A8CBEA'
const INK = C.ink
const AMBER = '#D9A84E'

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

const rnd = mulberry32(777)
const FLOOD = Array.from({ length: 240 }, () => ({ x: rnd(), y: rnd(), a: 0.25 + rnd() * 0.5 }))

/* ---------- continuously animated mechanisms ----------
   Shared between the lesson steps (loop: true) and the film. */

/** SPECT: two heads orbit forever, ticking off the angles they have covered. */
const drawSpect = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
  const cx = w / 2, cy = h * 0.45, R = Math.min(w, h) * 0.32
  ctx.strokeStyle = rgba(INK, 0.18)
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
  // angles already collected — a tick per projection, building up as the heads pass
  const ang = t * 0.9
  const nTicks = 36
  for (let i = 0; i < nTicks; i++) {
    const a = (i / nTicks) * Math.PI * 2
    // with two opposed heads every angle is covered within half a rotation
    const done = ang >= a - Math.PI
    ctx.strokeStyle = rgba(ACC, done ? 0.4 : 0.08)
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * (R + 8), cy + Math.sin(a) * (R + 8))
    ctx.lineTo(cx + Math.cos(a) * (R + 14), cy + Math.sin(a) * (R + 14))
    ctx.stroke()
  }
  // patient with a hot spot
  ctx.strokeStyle = rgba(INK, 0.5)
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.34, R * 0.24, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.fillStyle = rgba(ACC, 0.8)
  ctx.beginPath(); ctx.arc(cx + R * 0.12, cy - R * 0.05, 4, 0, Math.PI * 2); ctx.fill()
  // two heads, orbiting continuously, each catching photons from the hot spot
  for (const off of [0, Math.PI]) {
    const a = ang + off
    const hx = cx + Math.cos(a) * R, hy = cy + Math.sin(a) * R
    ctx.save()
    ctx.translate(hx, hy)
    ctx.rotate(a + Math.PI / 2)
    ctx.fillStyle = rgba(INK, 0.55)
    ctx.fillRect(-R * 0.3, -6, R * 0.6, 12)
    ctx.restore()
    // a photon streaking to the head every so often
    const pf = (t * 1.4 + (off === 0 ? 0 : 0.5)) % 1
    if (pf < 0.35) {
      const f = pf / 0.35
      const sx = cx + R * 0.12, sy = cy - R * 0.05
      ctx.strokeStyle = rgba(ACC, 0.7 * (1 - f * 0.5))
      ctx.beginPath()
      ctx.moveTo(lerp(sx, hx, Math.max(0, f - 0.15)), lerp(sy, hy, Math.max(0, f - 0.15)))
      ctx.lineTo(lerp(sx, hx, f), lerp(sy, hy, f))
      ctx.stroke()
    }
  }
  lessonPing(`spect-${Math.floor(ang / (Math.PI / 2))}`, 900)
  sceneLabel(ctx, 'heads orbit — projections from every angle', cx, cy + R + 26, p, { align: 'center' })
  sceneLabel(ctx, 'contrast up · resolution unchanged', cx, h * 0.09, p, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
}

/** PET: annihilation events keep firing; their coincidence lines pile up and
 *  cross where the activity really is. */
const petRnd = mulberry32(4242)
const PET_EVENTS = Array.from({ length: 64 }, () => ({
  dx: (petRnd() - 0.5) * 0.34, dy: (petRnd() - 0.5) * 0.26, dir: petRnd() * Math.PI,
}))
const drawPet = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) => {
  const cx = w / 2, cy = h * 0.46, R = Math.min(w, h) * 0.34
  // detector ring
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * Math.PI * 2
    ctx.fillStyle = rgba(INK, 0.35)
    ctx.save()
    ctx.translate(cx + Math.cos(a) * R, cy + Math.sin(a) * R)
    ctx.rotate(a)
    ctx.fillRect(-3, -7, 6, 14)
    ctx.restore()
  }
  // patient
  ctx.strokeStyle = rgba(INK, 0.4)
  ctx.beginPath(); ctx.ellipse(cx, cy, R * 0.5, R * 0.36, 0, 0, Math.PI * 2); ctx.stroke()
  const EVERY = 1.15
  const evIdx = Math.floor(t / EVERY)
  // past events: their lines of response persist, faintly — crossing at the lesion
  for (let i = Math.max(0, evIdx - 14); i < evIdx; i++) {
    const ev = PET_EVENTS[i % PET_EVENTS.length]
    const ex = cx + ev.dx * R, ey = cy + ev.dy * R
    const age = evIdx - i
    ctx.strokeStyle = rgba(ACC, 0.3 * Math.max(0.25, 1 - age / 16))
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(ex - Math.cos(ev.dir) * R * 1.02, ey - Math.sin(ev.dir) * R * 1.02)
    ctx.lineTo(ex + Math.cos(ev.dir) * R * 1.02, ey + Math.sin(ev.dir) * R * 1.02)
    ctx.stroke()
  }
  // the live event: flash, then two photons flying ~180° apart
  const ev = PET_EVENTS[evIdx % PET_EVENTS.length]
  const ex = cx + ev.dx * R, ey = cy + ev.dy * R
  const f = smoothstep(clamp((t - evIdx * EVERY) / 0.55))
  ctx.fillStyle = rgba('#FFFFFF', 0.9 * (1 - f * 0.6))
  ctx.beginPath(); ctx.arc(ex, ey, 3.4, 0, Math.PI * 2); ctx.fill()
  for (const s of [1, -1]) {
    const reach = f * R * 1.02
    ctx.strokeStyle = rgba(ACC, 0.9)
    ctx.lineWidth = 1.5
    ctx.beginPath()
    ctx.moveTo(ex, ey)
    ctx.lineTo(ex + Math.cos(ev.dir) * reach * s, ey + Math.sin(ev.dir) * reach * s)
    ctx.stroke()
    if (f > 0.96) {
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath()
      ctx.arc(ex + Math.cos(ev.dir) * R * s, ey + Math.sin(ev.dir) * R * s, 5, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  if (f > 0.96) lessonPing(`pet-${evIdx}`, 1240)
  ctx.lineWidth = 1
  sceneLabel(ctx, 'two hits, one instant — the annihilation lies on this line', cx, cy + R + 26, p, { align: 'center' })
  sceneLabel(ctx, 'the lines pile up where the activity really is', cx, h * 0.08, p, { align: 'center', size: 11, color: rgba(ACC, 0.95) })
}

const STEPS: LessonStep[] = [
  {
    id: 'tc99m',
    title: 'Technetium-99m: the workhorse in three numbers',
    body: 'Tc-99m decays by **isomeric transition** — the nucleus simply sheds excess energy as a **single 140 keV gamma photon**, with **no particles**. Its **6-hour half-life** matches a working day, and its daughter, Tc-99, is so long-lived it is effectively stable inside a patient.',
    numbers: '**140 keV · 6 hours · pure gamma** — the trio to memorise.',
    draw: (ctx, w, h, p, t) => {
      const cx = w * 0.32, cy = h * 0.45
      // excited nucleus
      const wob = 1 + Math.sin(Math.min(t, 2) * 6) * 0.04 * (1 - seg(p, 0.5, 1))
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4
        const r = 16 * wob
        ctx.fillStyle = i % 2 ? rgba(AMBER, 0.85) : rgba('#9AA2AB', 0.8)
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, 6.5, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'Tc-99m — excited nucleus', cx, cy + 44, 1, { align: 'center' })
      // gamma leaving
      const g = smoothstep(seg(p, 0.35, 0.95))
      if (g > 0) {
        const gx = cx + 30 + g * w * 0.34
        ctx.strokeStyle = rgba(ACC, 0.9)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let i = 0; i <= 40; i++) {
          const f = i / 40
          const x = lerp(cx + 30, gx, f)
          const y = cy + Math.sin(f * 14) * 6 * Math.sin(f * Math.PI)
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.stroke()
        ctx.beginPath(); ctx.moveTo(gx + 8, cy); ctx.lineTo(gx, cy - 4); ctx.moveTo(gx + 8, cy); ctx.lineTo(gx, cy + 4); ctx.stroke()
        sceneLabel(ctx, 'one gamma — 140 keV, no particles', gx - 40, cy - 22, g, { color: rgba(ACC, 0.95) })
      }
      sceneLabel(ctx, 'isomeric transition: energy out, nucleus unchanged', w / 2, h * 0.8, seg(p, 0.6, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'generator',
    title: 'The generator: milking Tc-99m from Mo-99',
    body: 'Reactor-made **molybdenum-99** (half-life **66 hours**) sits on an alumina column and continuously decays into Tc-99m. Flushing saline through — **elution** — washes the technetium off while the parent stays bound. The activity **regrows between elutions**, so one generator serves a department for about a week.',
    trap: 'Tc-99m comes from a **generator, never a cyclotron** — cyclotrons make the proton-rich nuclides like F-18 and I-123.',
    draw: (ctx, w, h, p) => {
      // column
      const cx = w * 0.2, cy = h * 0.42
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - 22, cy - 55, 44, 110)
      ctx.fillStyle = rgba(AMBER, 0.25)
      ctx.fillRect(cx - 22, cy - 20, 44, 45)
      sceneLabel(ctx, 'Mo-99 on column', cx, cy + 72, 1, { align: 'center' })
      // saline in, eluate out
      const f = smoothstep(seg(p, 0.2, 0.7))
      ctx.strokeStyle = rgba(ACC, 0.7 * f)
      ctx.beginPath(); ctx.moveTo(cx - 8, cy - 75); ctx.lineTo(cx - 8, cy - 55); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(cx + 8, cy + 55); ctx.lineTo(cx + 8, cy + 62); ctx.stroke()
      sceneLabel(ctx, 'saline', cx - 14, cy - 82, f, { align: 'center', size: 10 })
      sceneLabel(ctx, 'Tc-99m eluate', cx + 46, cy + 62, f, { size: 10, color: rgba(ACC, 0.9) })
      // regrowth curve
      const gx = w * 0.44, gy = h * 0.2, gw = w * 0.44, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      const elutions = [0.33, 0.66]
      for (let i = 0; i <= 160 * p; i++) {
        const f2 = i / 160
        let tSince = f2
        for (const e of elutions) if (f2 >= e) tSince = f2 - e
        const v = 1 - Math.exp(-tSince * 9)
        const x = gx + f2 * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      elutions.forEach(e => sceneLabel(ctx, 'elute', gx + e * gw, gy + gh + 14, seg(p, e, e + 0.2), { align: 'center', size: 10, color: rgba(AMBER, 0.9) }))
      sceneLabel(ctx, 'activity regrows between elutions', gx + gw / 2, gy - 10, seg(p, 0.6, 1), { align: 'center' })
    },
  },
  {
    id: 'ideal',
    title: 'What makes a tracer ideal',
    body: 'A diagnostic radionuclide should emit **pure gamma** radiation (particles deposit dose but never reach the camera), at an energy the camera likes — **100–250 keV** — with a **half-life matched to the study**, and chemistry that binds it to the right pharmaceutical. The pharmaceutical decides **where** it goes; the nuclide only decides **how it is seen**.',
    draw: (ctx, w, h, p) => {
      // energy window on a spectrum axis
      const gx = w * 0.16, gy = h * 0.28, gw = w * 0.68, gh = h * 0.34
      axes(ctx, gx, gy, gw, gh)
      // ideal band
      const bx1 = gx + (100 / 400) * gw, bx2 = gx + (250 / 400) * gw
      ctx.fillStyle = rgba(ACC, 0.12 * p)
      ctx.fillRect(bx1, gy, bx2 - bx1, gh)
      ctx.strokeStyle = rgba(ACC, 0.6 * p)
      ctx.strokeRect(bx1, gy, bx2 - bx1, gh)
      sceneLabel(ctx, '100–250 keV — the camera’s sweet spot', (bx1 + bx2) / 2, gy - 12, p, { align: 'center', color: rgba(ACC, 0.95) })
      // markers
      const marks: [number, string, string][] = [[140, 'Tc-99m', ACC], [159, 'I-123', ACC], [364, 'I-131 — too hot', AMBER], [69, 'too soft — absorbed', AMBER]]
      marks.forEach(([e, name, colour], i) => {
        const x = gx + (e / 400) * gw
        const a = smoothstep(seg(p, 0.2 + i * 0.15, 0.4 + i * 0.15))
        ctx.strokeStyle = rgba(colour, 0.8 * a)
        ctx.beginPath(); ctx.moveTo(x, gy + gh); ctx.lineTo(x, gy + gh * 0.35); ctx.stroke()
        sceneLabel(ctx, name, x, gy + gh * 0.28, a, { align: 'center', size: 10, color: rgba(colour, 0.9) })
      })
      sceneLabel(ctx, 'keV →', gx + gw + 8, gy + gh, 1, { size: 10 })
      sceneLabel(ctx, 'no alpha, no beta: particles are dose without pictures', w / 2, h * 0.82, seg(p, 0.6, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'camera',
    title: 'The gamma camera, from patient to position',
    body: 'Photons leave the patient, pass the **collimator**, and flash inside a single large **NaI(Tl) crystal**. An array of **photomultiplier tubes** shares each flash; comparing their signals **triangulates the position** (Anger logic) while their sum gives the **energy**. Everything downstream is electronics.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, top = h * 0.16
      const layer = (y: number, hh: number, label: string, a: number, fill: number) => {
        ctx.fillStyle = rgba(INK, fill * a)
        ctx.strokeStyle = rgba(INK, 0.4 * a)
        ctx.fillRect(cx - w * 0.24, y, w * 0.48, hh)
        ctx.strokeRect(cx - w * 0.24, y, w * 0.48, hh)
        sceneLabel(ctx, label, cx + w * 0.27, y + hh / 2, a)
      }
      // patient dot below
      const py = h * 0.78
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(cx - w * 0.06, py, 5, 0, Math.PI * 2); ctx.fill()
      sceneLabel(ctx, 'activity in the patient', cx - w * 0.06, py + 20, 1, { align: 'center', size: 10.5 })
      // photon up
      const f = smoothstep(seg(p, 0.15, 0.55))
      ctx.strokeStyle = rgba(ACC, 0.8 * f)
      ctx.beginPath(); ctx.moveTo(cx - w * 0.06, py - 8); ctx.lineTo(cx - w * 0.06, lerp(py - 8, top + h * 0.31, f)); ctx.stroke()
      // layers stack (drawn top→down): PMTs, crystal, collimator
      const a1 = smoothstep(seg(p, 0, 0.35))
      for (let i = 0; i < 6; i++) {
        const px = cx - w * 0.2 + i * w * 0.068
        ctx.strokeStyle = rgba(INK, 0.5 * a1)
        ctx.strokeRect(px, top, w * 0.052, h * 0.1)
      }
      sceneLabel(ctx, 'photomultiplier tubes', cx + w * 0.27, top + h * 0.05, a1)
      layer(top + h * 0.12, h * 0.07, 'NaI(Tl) crystal', a1, 0.12)
      // collimator with slits
      const colY = top + h * 0.21
      ctx.fillStyle = rgba(INK, 0.35 * a1)
      for (let i = 0; i < 22; i++) {
        const px = cx - w * 0.24 + i * w * 0.022
        ctx.fillRect(px, colY, w * 0.008, h * 0.09)
      }
      sceneLabel(ctx, 'collimator', cx + w * 0.27, colY + h * 0.045, a1)
      // flash in crystal + PMT sharing
      const flashA = smoothstep(seg(p, 0.55, 0.8))
      if (flashA > 0) {
        const fx = cx - w * 0.06, fy = top + h * 0.155
        ctx.fillStyle = rgba('#FFFFFF', 0.85 * flashA)
        ctx.beginPath(); ctx.arc(fx, fy, 4.5, 0, Math.PI * 2); ctx.fill()
        for (let i = 0; i < 3; i++) {
          const px = cx - w * 0.2 + (i + 1.2) * w * 0.068
          ctx.strokeStyle = rgba(ACC, (0.55 - i * 0.14) * flashA)
          ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(px + w * 0.026, top + h * 0.1); ctx.stroke()
        }
        sceneLabel(ctx, 'several tubes share the flash — comparison locates it', cx, h * 0.9, flashA, { align: 'center', size: 11 })
      }
    },
  },
  {
    id: 'collimator',
    title: 'The collimator forms the image — and charges for it',
    body: 'Without a lens for gamma rays, the collimator is the imaging element: **parallel holes accept only photons travelling straight at the crystal** and absorb the rest in lead septa. That selectivity is bought with counts — **longer, narrower holes sharpen the image and starve it** — and resolution decays as the patient moves away from the face.',
    trap: 'Scatter rejection is the **pulse height analyser’s** job, not the collimator’s.',
    draw: (ctx, w, h, p) => {
      const cy = h * 0.34, colH = h * 0.16
      // collimator slab
      ctx.fillStyle = rgba(INK, 0.3)
      for (let i = 0; i < 26; i++) {
        const x = w * 0.14 + i * w * 0.028
        ctx.fillRect(x, cy, w * 0.009, colH)
      }
      // source below
      const sx = w * 0.42, sy = h * 0.78
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill()
      // rays: straight accepted, oblique stopped
      const rays: [number, boolean][] = [[0, true], [-0.35, false], [0.3, false], [0.12, false], [-0.12, false]]
      rays.forEach(([angle, ok], i) => {
        const a = smoothstep(seg(p, 0.15 + i * 0.12, 0.35 + i * 0.12))
        const dx = Math.sin(angle), dy = -Math.cos(angle)
        const reach = ok ? (sy - cy + 10) : (sy - (cy + colH) + 14) / Math.cos(angle)
        ctx.strokeStyle = rgba(ok ? ACC : AMBER, (ok ? 0.85 : 0.5) * a)
        ctx.setLineDash(ok ? [] : [4, 4])
        ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + dx * reach, sy + dy * reach); ctx.stroke()
        ctx.setLineDash([])
        if (!ok && a > 0.5) {
          const ex = sx + dx * reach, ey = sy + dy * reach
          ctx.strokeStyle = rgba(AMBER, 0.7 * a)
          ctx.beginPath(); ctx.moveTo(ex - 4, ey - 4); ctx.lineTo(ex + 4, ey + 4); ctx.moveTo(ex + 4, ey - 4); ctx.lineTo(ex - 4, ey + 4); ctx.stroke()
        }
      })
      sceneLabel(ctx, 'straight through — accepted', sx + 14, cy - 12, seg(p, 0.3, 0.6), { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'oblique — absorbed in the septa', w * 0.68, h * 0.62, seg(p, 0.5, 0.8), { color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'resolution ⇄ sensitivity: always a trade', w / 2, h * 0.92, seg(p, 0.7, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'pha',
    title: 'Pulse height analysis rejects the scatter',
    body: 'Every flash’s brightness reports the photon’s **energy**. Plot them and you get a spectrum: a **photopeak** at 140 keV from clean photons, and a smear of **lower-energy scattered** photons that would only fog the image. A **±10% window** around the photopeak keeps the good ones.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.2, gw = w * 0.68, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      // spectrum: scatter continuum + photopeak
      ctx.beginPath()
      for (let i = 0; i <= 120 * p; i++) {
        const f = i / 120
        const e = f * 180
        const scatter = Math.exp(-Math.pow((e - 90) / 55, 2)) * 0.45 + Math.exp(-e / 60) * 0.2
        const peak = Math.exp(-Math.pow((e - 140) / 7, 2)) * 0.95
        const v = scatter + peak
        const x = gx + f * gw
        const y = gy + gh - v * gh * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // window band
      const wx1 = gx + (126 / 180) * gw, wx2 = gx + (154 / 180) * gw
      const wa = smoothstep(seg(p, 0.6, 0.9))
      ctx.fillStyle = rgba(ACC, 0.1 * wa)
      ctx.fillRect(wx1, gy, wx2 - wx1, gh)
      ctx.strokeStyle = rgba(ACC, 0.5 * wa)
      ctx.strokeRect(wx1, gy, wx2 - wx1, gh)
      sceneLabel(ctx, 'window ±10%', (wx1 + wx2) / 2, gy - 10, wa, { align: 'center', color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'photopeak 140 keV', wx1 - 10, gy + gh * 0.16, seg(p, 0.5, 0.8), { align: 'right' })
      sceneLabel(ctx, 'scattered — lower energy, rejected', gx + gw * 0.28, gy + gh * 0.55, seg(p, 0.4, 0.7), { align: 'center', size: 10.5, color: rgba(AMBER, 0.85) })
      sceneLabel(ctx, 'keV →', gx + gw + 6, gy + gh, 1, { size: 10 })
    },
  },
  {
    id: 'performance',
    title: 'Resolution, sensitivity, uniformity',
    body: 'Intrinsic resolution (crystal + electronics) is **3–5 mm**, but through a collimator at clinical distances the **system resolution is realistically 10–15 mm** — so position the patient **close**. Daily **flood-field** images check uniformity; bars and line sources check resolution and linearity.',
    numbers: 'Intrinsic **3–5 mm** → system **10–15 mm**. Get the camera close.',
    draw: (ctx, w, h, p) => {
      // resolution vs distance curve
      const gx = w * 0.12, gy = h * 0.2, gw = w * 0.36, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      for (let i = 0; i <= 60 * p; i++) {
        const f = i / 60
        const v = 0.15 + f * 0.72
        const x = gx + f * gw
        const y = gy + gh - (1 - v) * gh * 0.9
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      sceneLabel(ctx, 'blur grows with distance from collimator', gx + gw / 2, gy + gh + 18, p, { align: 'center', size: 10.5 })
      sceneLabel(ctx, 'distance →', gx + gw, gy + gh + 34, 0, { size: 10 })
      // flood field
      const fx = w * 0.6, fy = h * 0.22, fs = Math.min(w, h) * 0.4
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(fx + fs / 2, fy + fs / 2, fs / 2, 0, Math.PI * 2); ctx.stroke()
      const fa = smoothstep(seg(p, 0.3, 0.8))
      ctx.save()
      ctx.beginPath(); ctx.arc(fx + fs / 2, fy + fs / 2, fs / 2 - 2, 0, Math.PI * 2); ctx.clip()
      FLOOD.forEach(pt => {
        ctx.fillStyle = rgba(ACC, pt.a * 0.5 * fa)
        ctx.fillRect(fx + pt.x * fs, fy + pt.y * fs, 2, 2)
      })
      ctx.restore()
      sceneLabel(ctx, 'daily flood — uniformity check', fx + fs / 2, fy + fs + 18, fa, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'modes',
    loop: true,
    title: 'Static, dynamic, gated',
    body: 'Three ways to acquire: **static** — one frame, counts simply accumulate; **dynamic** — frame after frame, giving **time–activity curves** (the renogram); and **gated** — the ECG slices each cardiac cycle into **8–16 bins**, and every heartbeat adds counts to its bins until an average beat emerges sharp enough to measure ejection fraction.',
    draw: (ctx, w, h, p, t) => {
      // static: accumulating counts patch
      const sx = w * 0.16, sy = h * 0.3, ss = Math.min(w, h) * 0.11
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.strokeRect(sx - ss, sy - ss, ss * 2, ss * 2)
      const fill = clamp((t % 6) / 5)
      ctx.fillStyle = rgba(ACC, 0.12 + fill * 0.45)
      ctx.fillRect(sx - ss + 2, sy - ss + 2, ss * 2 - 4, ss * 2 - 4)
      sceneLabel(ctx, 'static — counts accumulate', sx, sy + ss + 18, p, { align: 'center', size: 10.5 })
      // dynamic: time-activity curve drawing repeatedly
      const gx = w * 0.4, gy = sy - ss, gw = w * 0.2, gh = ss * 2
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke()
      const prog = (t % 6) / 6
      ctx.beginPath()
      for (let i = 0; i <= 80 * prog; i++) {
        const f = i / 80
        const v = Math.pow(f * 3.2, 1.6) * Math.exp(-f * 3.2)
        const x = gx + f * gw, y = gy + gh - v * gh * 1.4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'dynamic — time–activity curve', gx + gw / 2, sy + ss + 18, p, { align: 'center', size: 10.5 })
      // gated: ECG with cycling bins
      const ex = w * 0.7, ew = w * 0.22, ey = sy
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.beginPath()
      for (let i = 0; i <= 100; i++) {
        const f = i / 100
        const cyc = (f * 2) % 1
        let v = 0
        if (cyc > 0.1 && cyc < 0.14) v = -0.15
        else if (cyc >= 0.14 && cyc < 0.2) v = 1 - Math.abs(cyc - 0.17) / 0.03
        else if (cyc > 0.32 && cyc < 0.44) v = 0.25 * Math.sin(((cyc - 0.32) / 0.12) * Math.PI)
        const x = ex + f * ew, y = ey - v * 30
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      const bins = 8
      const active = Math.floor(((t * 2) % 1) * bins)
      for (let b = 0; b < bins; b++) {
        const bx = ex + (b / bins) * (ew / 2)
        ctx.fillStyle = b === active ? rgba(ACC, 0.8) : rgba(INK, 0.18)
        ctx.fillRect(bx, ey + 26, ew / 2 / bins - 2, 10)
      }
      sceneLabel(ctx, 'gated — 8–16 bins per cardiac cycle', ex + ew / 2, sy + ss + 18, p, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'spect',
    loop: true,
    title: 'SPECT: the camera goes tomographic',
    body: 'Rotate the heads around the patient, collect projections, reconstruct — and **overlying activity disappears**. The win is **contrast, not resolution**. The price: rotation invites its own artefacts (**centre-of-rotation errors**, patient motion), and CT-based **attenuation correction** is needed for honest quantification.',
    draw: drawSpect,
  },
  {
    id: 'spect-recon',
    title: 'SPECT reconstruction: filter it, or iterate it',
    body: 'Projections become slices the same two ways as CT. **Filtered back-projection** is fast but ugly at low counts. **Iterative reconstruction** guesses an image, computes what the camera *would* have seen, **compares, updates, repeats** — it models the physics and forgives poor statistics, which is why it has taken over.',
    draw: (ctx, w, h, p) => {
      // FBP path
      const cy = h * 0.32
      const box = (x: number, y: number, label: string, a: number, accent = false) => {
        ctx.strokeStyle = accent ? rgba(ACC, 0.8 * a) : rgba(INK, 0.4 * a)
        ctx.strokeRect(x - w * 0.085, y - 22, w * 0.17, 44)
        sceneLabel(ctx, label, x, y, a, { align: 'center', size: 10.5, color: accent ? rgba(ACC, 0.95) : undefined })
      }
      const arrow = (x1: number, x2: number, y: number, a: number, label?: string) => {
        ctx.strokeStyle = rgba(INK, 0.45 * a)
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x2 - 6, y - 4); ctx.lineTo(x2, y); ctx.lineTo(x2 - 6, y + 4); ctx.stroke()
        if (label) sceneLabel(ctx, label, (x1 + x2) / 2, y - 12, a, { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      }
      box(w * 0.2, cy, 'projections', smoothstep(seg(p, 0, 0.25)))
      arrow(w * 0.29, w * 0.4, cy, smoothstep(seg(p, 0.2, 0.4)), 'filter + smear')
      box(w * 0.49, cy, 'FBP image', smoothstep(seg(p, 0.35, 0.55)))
      sceneLabel(ctx, 'fast — noisy at low counts', w * 0.49, cy + 38, smoothstep(seg(p, 0.4, 0.6)), { align: 'center', size: 10 })
      // iterative loop
      const ly = h * 0.72, lx = w * 0.5, lr = Math.min(w, h) * 0.16
      const la = smoothstep(seg(p, 0.5, 0.9))
      ctx.strokeStyle = rgba(ACC, 0.7 * la)
      ctx.beginPath(); ctx.arc(lx, ly, lr, -0.4, Math.PI * 1.6); ctx.stroke()
      ctx.beginPath()
      const ea = Math.PI * 1.6
      ctx.moveTo(lx + Math.cos(ea) * lr - 6, ly + Math.sin(ea) * lr - 5)
      ctx.lineTo(lx + Math.cos(ea) * lr, ly + Math.sin(ea) * lr)
      ctx.lineTo(lx + Math.cos(ea) * lr - 7, ly + Math.sin(ea) * lr + 4)
      ctx.stroke()
      const items: [string, number][] = [['estimate', -Math.PI / 2], ['project', 0], ['compare', Math.PI / 2], ['update', Math.PI]]
      items.forEach(([name, a2], i) => {
        const aa = smoothstep(seg(p, 0.55 + i * 0.1, 0.7 + i * 0.1))
        sceneLabel(ctx, name, lx + Math.cos(a2) * (lr + 22), ly + Math.sin(a2) * (lr + 20), aa, { align: 'center', size: 11, color: rgba(ACC, 0.9) })
      })
      sceneLabel(ctx, 'iterative — repeat until it matches the measurement', lx, ly + lr + 34, la, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'attenuation',
    title: 'Attenuation correction: the deep counts are missing',
    body: 'A photon born at the **centre** of the patient must cross far more tissue than one born at the surface — so uncorrected SPECT and PET **under-count the deep structures**. Hybrid scanners fix it with the **CT attenuation map**: every voxel’s counts are scaled by the tissue its photons had to cross. Without it, quantification lies.',
    trap: 'This is why SPECT/**CT** and PET/**CT** exist — the CT is the attenuation map, not a bonus scan.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.3, cy = h * 0.42, Rp = Math.min(w, h) * 0.2
      ctx.strokeStyle = rgba(INK, 0.45)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      // two sources: deep and superficial
      const deep = { x: cx, y: cy }
      const shallow = { x: cx + Rp * 0.75, y: cy - Rp * 0.45 }
      for (const [s, alpha, label] of [[deep, 0.35, 'deep — heavily attenuated'], [shallow, 0.9, 'superficial — barely attenuated']] as const) {
        const f = smoothstep(seg(p, s === deep ? 0.1 : 0.3, s === deep ? 0.5 : 0.7))
        ctx.fillStyle = rgba(ACC, 0.9 * f)
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(ACC, alpha * f)
        ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(s.x + Rp * 1.45 - (s.x - cx), s.y); ctx.stroke()
        sceneLabel(ctx, label, s.x + 12, s.y - 12, f, { size: 10, color: rgba(ACC, 0.85) })
      }
      // bars: measured vs corrected
      const bx = w * 0.68, bw = w * 0.05, by = h * 0.66
      const bars: [string, number, number][] = [['deep', 0.35, 1], ['superficial', 0.85, 0.9]]
      bars.forEach(([name, meas, corr], i) => {
        const x = bx + i * w * 0.14
        const a = smoothstep(seg(p, 0.5 + i * 0.12, 0.75 + i * 0.12))
        ctx.fillStyle = rgba(INK, 0.35 * a)
        ctx.fillRect(x, by - meas * h * 0.28 * a, bw, meas * h * 0.28 * a)
        ctx.strokeStyle = rgba(ACC, 0.85 * a)
        ctx.strokeRect(x + bw + 6, by - corr * h * 0.28 * a, bw, corr * h * 0.28 * a)
        sceneLabel(ctx, name, x + bw, by + 14, a, { align: 'center', size: 10 })
      })
      sceneLabel(ctx, 'grey: measured · outline: after CT correction', bx + w * 0.09, by + 32, smoothstep(seg(p, 0.7, 1)), { align: 'center', size: 10 })
    },
  },
  {
    id: 'pet',
    loop: true,
    title: 'PET: coincidence replaces the collimator',
    body: 'A positron travels a millimetre or two, meets an electron, and **annihilates into two 511 keV photons flying ~180° apart**. A ring of detectors watches for **two hits at the same instant** — the **annihilation** must lie on the line between them (the decay itself happened a millimetre or two away: that positron range is part of PET\'s resolution floor). No collimator throws photons away, which is why **PET’s sensitivity crushes SPECT’s**.',
    numbers: 'Two photons · **511 keV** each · **~180°** apart · resolution **4–8 mm**.',
    draw: drawPet,
  },
  {
    id: 'pet-detail',
    title: 'Crystals, randoms and time of flight',
    body: 'Stopping 511 keV photons needs **dense, fast crystals**: BGO stops well but is slow; **LSO/LYSO** are the modern balance. **Random coincidences** (two unrelated photons inside the timing window) and scatter must be corrected. **Time-of-flight** timing localises each event along its line, buying effective SNR.',
    draw: (ctx, w, h, p) => {
      // bar chart: stopping power vs speed
      const gx = w * 0.16, gy = h * 0.2, gw2 = w * 0.28, gh = h * 0.44
      const bars: [string, number, number][] = [['NaI', 0.35, 0.75], ['BGO', 0.95, 0.25], ['LSO', 0.8, 0.85]]
      bars.forEach(([name, stop, speed], i) => {
        const x = gx + i * gw2 * 0.38
        const a = smoothstep(seg(p, i * 0.15, 0.3 + i * 0.15))
        ctx.fillStyle = rgba(ACC, 0.55 * a)
        ctx.fillRect(x, gy + gh - stop * gh * a, gw2 * 0.13, stop * gh * a)
        ctx.fillStyle = rgba(AMBER, 0.55 * a)
        ctx.fillRect(x + gw2 * 0.16, gy + gh - speed * gh * a, gw2 * 0.13, speed * gh * a)
        sceneLabel(ctx, name, x + gw2 * 0.14, gy + gh + 14, a, { align: 'center', size: 10.5 })
      })
      sceneLabel(ctx, 'stopping', gx, gy - 10, p, { size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'speed', gx + 70, gy - 10, p, { size: 10, color: rgba(AMBER, 0.9) })
      // TOF: line with localised probability bump
      const lx1 = w * 0.6, lx2 = w * 0.9, ly = h * 0.42
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.moveTo(lx1, ly); ctx.lineTo(lx2, ly); ctx.stroke()
      const ta = smoothstep(seg(p, 0.5, 0.9))
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const x = lerp(lx1, lx2, f)
        const v = Math.exp(-Math.pow((f - 0.62) / 0.1, 2))
        const y = ly - v * 40 * ta
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9 * ta)
      ctx.stroke()
      sceneLabel(ctx, 'time of flight — the event, localised on its line', (lx1 + lx2) / 2, ly + 22, ta, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'dose',
    title: 'The dose is committed at injection',
    body: 'Once the tracer is in, the dose depends on **physical half-life and biological clearance — nothing else**. Imaging longer adds **zero**. Encourage hydration and voiding to speed clearance; around PET patients, remember lead barely notices 511 keV — **distance and time** are the protections.',
    trap: 'A question offering “longer scanning increases patient dose” in nuclear medicine is always **false**.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.2, gw = w * 0.62, gh = h * 0.46
      axes(ctx, gx, gy, gw, gh)
      // activity decay
      ctx.beginPath()
      for (let i = 0; i <= 120 * p; i++) {
        const f = i / 120
        const v = Math.exp(-f * 3)
        const x = gx + f * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // shaded committed dose area
      const aa = smoothstep(seg(p, 0.5, 0.9))
      if (aa > 0) {
        ctx.fillStyle = rgba(ACC, 0.09 * aa)
        ctx.beginPath()
        ctx.moveTo(gx, gy + gh)
        for (let i = 0; i <= 120; i++) {
          const f = i / 120
          ctx.lineTo(gx + f * gw, gy + gh - Math.exp(-f * 3) * gh * 0.85)
        }
        ctx.lineTo(gx + gw, gy + gh)
        ctx.closePath()
        ctx.fill()
      }
      // camera markers add nothing
      sceneLabel(ctx, 'inject', gx, gy + gh + 16, p, { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'image now… or later — same dose', gx + gw * 0.55, gy + gh + 16, seg(p, 0.6, 1), { align: 'center', size: 10 })
      sceneLabel(ctx, 'the whole area is committed the moment you inject', gx + gw / 2, gy - 10, aa, { align: 'center' })
    },
  },
]

export default function NmLab() {
  return (
    <LessonPage
      meta={{
        title: 'Nuclear Medicine',
        kicker: 'Gamma imaging & PET',
        accent: ACC,
        intro: 'From the generator to the PET ring: the **fourteen ideas** nuclear medicine questions are built from — each one drawn.',
        /* Practice and facts arrive through the course spine. */
        next: [],
        backTo: { label: 'Physics course', to: '/physics' },
        film: { label: 'Watch the film', to: '/nm-lab/film' },
        synthesis: {
          headline: 'The patient is the source.',
          bigPicture:
            'Everything inverts: the camera never fires a photon, it only **collects what decays**. Tc-99m earns its place with a 6-hour half-life, a clean 140 keV gamma and a generator on every site. The collimator buys geometry by **throwing most photons away**; SPECT adds rotation, PET replaces collimation with **coincidence**. And because the tracer is injected, the dose is **committed at that moment** — scanning longer never doses more.',
        },
      }}
      steps={STEPS}
    />
  )
}

/* ================================================================== *
 * Nuclear medicine — the film. Continuously animated scenes, all
 * original procedural drawings, played through like a video.
 * ================================================================== */

const FILM_SCENES: FilmScene[] = [
  {
    id: 'decay',
    title: 'Isomeric transition',
    caption: 'The Tc-99m nucleus sheds its excess energy as one 140 keV gamma photon — no particles, every 6 hours half of them gone.',
    dur: 8,
    draw: (ctx, w, h, _p, t) => {
      const cx = w * 0.34, cy = h * 0.46
      const EVERY = 1.6
      const cyc = t % EVERY
      const wob = 1 + Math.sin(t * 6) * 0.04 * (1 - smoothstep(cyc / 0.4))
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2 + 0.4
        const r = 16 * wob
        ctx.fillStyle = i % 2 ? rgba(AMBER, 0.85) : rgba('#9AA2AB', 0.8)
        ctx.beginPath(); ctx.arc(cx + Math.cos(a) * r * 0.7, cy + Math.sin(a) * r * 0.7, 6.5, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'Tc-99m — excited nucleus', cx, cy + 44, 1, { align: 'center' })
      // one gamma per cycle, wriggling away
      const g = smoothstep(clamp(cyc / 1.1))
      const gx = cx + 30 + g * w * 0.36
      ctx.strokeStyle = rgba(ACC, 0.9 * (1 - smoothstep((cyc - 1.2) / 0.4)))
      ctx.lineWidth = 1.6
      ctx.beginPath()
      for (let i = 0; i <= 40; i++) {
        const f = i / 40
        const x = lerp(cx + 30, gx, f)
        const y = cy + Math.sin(f * 14 + t * 3) * 6 * Math.sin(f * Math.PI)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke()
      ctx.lineWidth = 1
      if (g > 0.9) lessonPing(`decay-${Math.floor(t / EVERY)}`, 1400)
      sceneLabel(ctx, 'one gamma — 140 keV', cx + w * 0.3, cy - 24, 1, { color: rgba(ACC, 0.95) })
      sceneLabel(ctx, '140 keV · 6 hours · pure gamma', w / 2, h * 0.84, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'generator',
    title: 'The generator',
    caption: 'Mo-99 decays on the column; saline elutes the Tc-99m off, and the activity regrows for tomorrow.',
    dur: 10,
    draw: (ctx, w, h, _p, t) => {
      const cx = w * 0.2, cy = h * 0.42
      const CYCLE = 3.2
      const phase = (t % CYCLE) / CYCLE
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      ctx.strokeRect(cx - 22, cy - 55, 44, 110)
      ctx.fillStyle = rgba(AMBER, 0.25)
      ctx.fillRect(cx - 22, cy - 20, 44, 45)
      sceneLabel(ctx, 'Mo-99 on column', cx, cy + 72, 1, { align: 'center' })
      // periodic elution: saline drips through and eluate drops out
      const eluting = phase < 0.25
      if (eluting) {
        const f = phase / 0.25
        ctx.strokeStyle = rgba(ACC, 0.8)
        ctx.beginPath(); ctx.moveTo(cx - 8, cy - 75); ctx.lineTo(cx - 8, lerp(cy - 75, cy + 55, f)); ctx.stroke()
        ctx.fillStyle = rgba(ACC, 0.9)
        ctx.beginPath(); ctx.arc(cx + 8, cy + 60 + f * 10, 2.5, 0, Math.PI * 2); ctx.fill()
        lessonPing(`elute-${Math.floor(t / CYCLE)}`, 820)
      }
      sceneLabel(ctx, 'saline', cx - 14, cy - 82, 1, { align: 'center', size: 10 })
      sceneLabel(ctx, 'Tc-99m eluate', cx + 46, cy + 62, eluting ? 1 : 0.4, { size: 10, color: rgba(ACC, 0.9) })
      // live regrowth curve: activity climbs, drops at each elution
      const gx = w * 0.44, gy = h * 0.2, gw = w * 0.44, gh = h * 0.44
      axes(ctx, gx, gy, gw, gh)
      const span = CYCLE * 3
      const t0 = Math.max(0, t - span)
      ctx.beginPath()
      for (let i = 0; i <= 160; i++) {
        const tt = t0 + (i / 160) * (t - t0)
        const sinceElution = tt % CYCLE
        const v = 1 - Math.exp(-sinceElution * 1.1)
        const x = gx + ((tt - t0) / span) * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'activity regrows between elutions', gx + gw / 2, gy - 10, 1, { align: 'center' })
      sceneLabel(ctx, 'Mo-99: 66 h · Tc-99m: 6 h', gx + gw / 2, gy + gh + 18, 1, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'collimator',
    title: 'The collimator',
    caption: 'Only photons travelling straight at the crystal get through — the septa quietly absorb everything oblique.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cy = h * 0.3, colH = h * 0.16
      ctx.fillStyle = rgba(INK, 0.3)
      for (let i = 0; i < 26; i++) {
        const x = w * 0.14 + i * w * 0.028
        ctx.fillRect(x, cy, w * 0.009, colH)
      }
      sceneLabel(ctx, 'crystal above', w / 2, cy - 14, 1, { align: 'center', size: 10.5 })
      // source wandering slowly, spraying photons
      const sx = w * 0.42 + Math.sin(t * 0.35) * w * 0.1, sy = h * 0.78
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(sx, sy, 5, 0, Math.PI * 2); ctx.fill()
      // photons: one every beat, angle cycles; straight ones pass, oblique die
      const EVERY = 0.55
      for (let k = 0; k < 4; k++) {
        const idx = Math.floor(t / EVERY) - k
        if (idx < 0) continue
        const f = clamp((t - idx * EVERY) / (EVERY * 2.2))
        const angle = Math.sin(idx * 2.6) * 0.42
        const ok = Math.abs(angle) < 0.07
        const dx = Math.sin(angle), dy = -Math.cos(angle)
        const maxReach = ok ? (sy - cy + 10) : (sy - (cy + colH) + 14) / Math.cos(angle)
        const reach = maxReach * smoothstep(f)
        ctx.strokeStyle = rgba(ok ? ACC : AMBER, (ok ? 0.85 : 0.5) * (1 - f * 0.4))
        ctx.setLineDash(ok ? [] : [4, 4])
        ctx.beginPath()
        ctx.moveTo(sx + dx * Math.max(0, reach - 30), sy + dy * Math.max(0, reach - 30))
        ctx.lineTo(sx + dx * reach, sy + dy * reach)
        ctx.stroke()
        ctx.setLineDash([])
        if (!ok && reach >= maxReach - 1) {
          const exx = sx + dx * maxReach, eyy = sy + dy * maxReach
          ctx.strokeStyle = rgba(AMBER, 0.7)
          ctx.beginPath(); ctx.moveTo(exx - 4, eyy - 4); ctx.lineTo(exx + 4, eyy + 4); ctx.moveTo(exx + 4, eyy - 4); ctx.lineTo(exx - 4, eyy + 4); ctx.stroke()
        }
        if (ok && reach >= maxReach - 1) lessonPing(`col-${idx}`, 1100)
      }
      sceneLabel(ctx, 'straight — accepted', w * 0.78, cy + colH + 18, 1, { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'oblique — absorbed in the septa', w * 0.78, cy + colH + 36, 1, { color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'no lens exists for gamma rays — selection is the only optics', w / 2, h * 0.93, 1, { align: 'center', size: 11 })
    },
  },
  {
    id: 'anger',
    title: 'Anger logic',
    caption: 'Each flash is shared by several tubes; comparing their signals triangulates the position, their sum is the energy.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cx = w / 2, top = h * 0.16
      // PMTs
      const nP = 6
      const EVERY = 1.3
      const idx = Math.floor(t / EVERY)
      const f = clamp((t - idx * EVERY) / 0.9)
      const hitX = cx - w * 0.18 + ((idx * 2.7) % 5.3) / 5.3 * w * 0.36
      for (let i = 0; i < nP; i++) {
        const px = cx - w * 0.2 + i * w * 0.068
        const centre = px + w * 0.026
        const share = Math.exp(-Math.pow((centre - hitX) / (w * 0.06), 2))
        ctx.strokeStyle = rgba(INK, 0.5)
        ctx.strokeRect(px, top, w * 0.052, h * 0.1)
        // tube signal bar above, proportional to its share of the flash
        const bh = share * h * 0.09 * smoothstep(f)
        ctx.fillStyle = rgba(ACC, 0.7)
        ctx.fillRect(px + w * 0.014, top - 6 - bh, w * 0.024, bh)
      }
      sceneLabel(ctx, 'each tube’s signal', cx - w * 0.27, top - 16, 1, { align: 'center', size: 10 })
      // crystal
      ctx.fillStyle = rgba(INK, 0.12)
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.fillRect(cx - w * 0.24, top + h * 0.12, w * 0.48, h * 0.07)
      ctx.strokeRect(cx - w * 0.24, top + h * 0.12, w * 0.48, h * 0.07)
      sceneLabel(ctx, 'NaI(Tl) crystal', cx + w * 0.27, top + h * 0.155, 1)
      // collimator
      const colY = top + h * 0.21
      ctx.fillStyle = rgba(INK, 0.35)
      for (let i = 0; i < 22; i++) {
        const px = cx - w * 0.24 + i * w * 0.022
        ctx.fillRect(px, colY, w * 0.008, h * 0.09)
      }
      // photon rising to the flash point
      const py = h * 0.78
      ctx.strokeStyle = rgba(ACC, 0.8 * (1 - f * 0.4))
      ctx.beginPath(); ctx.moveTo(hitX, py); ctx.lineTo(hitX, lerp(py, top + h * 0.155, smoothstep(clamp(f / 0.55)))); ctx.stroke()
      ctx.fillStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(hitX, py, 4, 0, Math.PI * 2); ctx.fill()
      // the flash
      if (f > 0.55) {
        const fl = smoothstep((f - 0.55) / 0.45)
        ctx.fillStyle = rgba('#FFFFFF', 0.9 * (1 - fl * 0.5))
        ctx.beginPath(); ctx.arc(hitX, top + h * 0.155, 4.5 + fl * 3, 0, Math.PI * 2); ctx.fill()
        lessonPing(`anger-${idx}`, 1150)
      }
      // the located event, plotted on an image strip
      const iy = h * 0.92
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(cx - w * 0.24, iy); ctx.lineTo(cx + w * 0.24, iy); ctx.stroke()
      for (let k = 0; k <= idx; k++) {
        const hx = cx - w * 0.18 + ((k * 2.7) % 5.3) / 5.3 * w * 0.36
        ctx.fillStyle = rgba(ACC, 0.55)
        ctx.beginPath(); ctx.arc(hx, iy, 2, 0, Math.PI * 2); ctx.fill()
      }
      sceneLabel(ctx, 'the image, event by event', cx + w * 0.27, iy, 1, { size: 10 })
    },
  },
  {
    id: 'spect',
    title: 'SPECT',
    caption: 'The heads orbit, a projection per angle — reconstruction removes everything that overlies the lesion.',
    dur: 9,
    draw: drawSpect,
  },
  {
    id: 'pet',
    title: 'PET',
    caption: 'Every annihilation fires two 511 keV photons back-to-back; coincidence lines pile up where the activity is.',
    dur: 11,
    draw: drawPet,
  },
]

export function NmFilm() {
  return (
    <FilmPage
      meta={{
        title: 'Nuclear Medicine — the film',
        kicker: 'Gamma imaging & PET',
        accent: ACC,
        backTo: { label: 'NM lesson', to: '/nm-lab' },
      }}
      scenes={FILM_SCENES}
    />
  )
}
