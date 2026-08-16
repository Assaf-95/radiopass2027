/**
 * CT physics — a focused lesson: acquisition to dose, one concept at a time.
 * All diagrams are original procedural drawings in the site's line language.
 */

import { C, rgba, clamp, lerp, seg, smoothstep, sceneLabel } from '../home/fx'
import { FilmPage, type FilmScene } from './cinema'
import { LessonPage, lessonPing, type LessonStep, type StepDraw } from './lesson'

const easeIO = (v: number) => { const c = clamp(v); return c * c * (3 - 2 * c) }

const ACC = '#D9A84E'
const INK = C.ink

/** The tube, everywhere: a soft radial glow under a solid dot. */
function glowDot(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3.4)
  g.addColorStop(0, rgba(ACC, 0.3 * a))
  g.addColorStop(1, rgba(ACC, 0))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(x, y, r * 3.4, 0, Math.PI * 2); ctx.fill()
  ctx.fillStyle = rgba(ACC, 0.95 * a)
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
}

/** Beam fill that falls off with distance from the tube — X-rays attenuate. */
function fanGrad(ctx: CanvasRenderingContext2D, tx: number, ty: number, reach: number, peak: number) {
  const g = ctx.createRadialGradient(tx, ty, 0, tx, ty, reach)
  g.addColorStop(0, rgba(ACC, peak))
  g.addColorStop(1, rgba(ACC, peak * 0.18))
  return g
}

/* ---------- shared drawing helpers ---------- */

/** Axial patient section: body ellipse with two lungs and a spine. */
function patient(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = rgba(INK, 0.55)
  ctx.lineWidth = 1.3
  ctx.beginPath(); ctx.ellipse(x, y, s, s * 0.68, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = rgba(INK, 0.25)
  ctx.beginPath(); ctx.ellipse(x - s * 0.38, y - s * 0.04, s * 0.26, s * 0.4, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.beginPath(); ctx.ellipse(x + s * 0.38, y - s * 0.04, s * 0.26, s * 0.4, 0, 0, Math.PI * 2); ctx.stroke()
  ctx.strokeStyle = rgba(INK, 0.5)
  ctx.beginPath(); ctx.arc(x, y + s * 0.38, s * 0.12, 0, Math.PI * 2); ctx.stroke()
  ctx.restore()
}

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

/* ---------- steps ---------- */

const STEPS: LessonStep[] = [
  {
    id: 'gantry',
    title: 'A tube and an arc of detectors, spinning together',
    body: 'The X-ray tube and a curved bank of detectors sit opposite each other on a ring and **rotate around the patient together**. A **fan-shaped beam** crosses the patient; whatever survives the crossing is caught on the far side. One rotation takes a fraction of a second — modern gantries spin faster than **0.3 s per turn**.',
    numbers: 'Rotation ≈ **0.25–0.5 s**; fan beam across the whole patient width.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4
      // Ease-out spin: fast off the line, glides to rest — never a brake-slam.
      const spin = 1 - Math.pow(1 - clamp(t / 2.8), 3)
      const ang = -Math.PI / 2 + spin * 3.3
      ctx.strokeStyle = rgba(INK, 0.2)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      patient(ctx, cx, cy, R * 0.42, p)
      const tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R
      // fan beam — attenuating away from the tube
      ctx.fillStyle = fanGrad(ctx, tx, ty, R * 2, 0.16 * p)
      ctx.strokeStyle = rgba(ACC, 0.35 * p)
      const a1 = ang + Math.PI - 0.95, a2 = ang + Math.PI + 0.95
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R)
      ctx.arc(cx, cy, R, a1, a2)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // detector arc opposite
      ctx.strokeStyle = rgba(INK, 0.85 * p)
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2); ctx.stroke()
      ctx.lineWidth = 1
      // tube
      glowDot(ctx, tx, ty, 7, p)
      sceneLabel(ctx, 'tube', tx + 14, ty, p, { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'detector arc', cx + Math.cos(ang + Math.PI) * (R + 16), cy + Math.sin(ang + Math.PI) * (R + 16), p, { align: 'center' })
    },
  },
  {
    id: 'projection',
    title: 'Every angle records an attenuation profile',
    body: 'At each position the detectors record how much of the beam survived along every ray — an **attenuation profile** of the patient from that angle. One rotation collects **hundreds of profiles** from hundreds of angles. The scanner never “sees” an image: it sees these profiles, and everything else is computed.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.42, cy = h * 0.44, s = Math.min(w, h) * 0.19
      patient(ctx, cx, cy, s, 1)
      // parallel rays passing through
      const n = 9
      for (let i = 0; i < n; i++) {
        const y = cy - s * 0.7 + (i / (n - 1)) * s * 1.4
        const through = Math.abs(y - cy) < s * 0.66
        ctx.strokeStyle = rgba(ACC, (through ? 0.4 : 0.2) * p)
        ctx.lineWidth = 1
        ctx.beginPath(); ctx.moveTo(cx - s * 2.1, y); ctx.lineTo(cx + s * 1.55, y); ctx.stroke()
      }
      // profile graph on the right
      const gx = cx + s * 1.8, gy = cy - s * 0.85, gw = w * 0.2, gh = s * 1.7
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const y = gy + f * gh
        const d = Math.abs(f - 0.5)
        let v = d < 0.45 ? Math.cos(d * 6.3) * 0.75 : 0.02
        // the profile matches the section: air-filled lungs attenuate less…
        if (Math.abs(f - 0.38) < 0.16) v -= 0.18
        // …and the spine sits posteriorly, where it is actually drawn
        if (Math.abs(f - 0.77) < 0.07) v += 0.22
        const x = gx + clamp(v) * gw * p
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      sceneLabel(ctx, 'attenuation profile', gx + gw * 0.5, gy - 12, p, { align: 'center' })
      sceneLabel(ctx, 'one of hundreds of angles', cx, cy + s * 1.15, p * 0.8, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'gen1',
    loop: true,
    title: 'First generation: one beam, one detector, shot by shot',
    body: 'The first scanners had **one pencil beam and one detector**, rigidly linked. Measure, **translate one step**, measure again — dozens of shots across the patient — then **rotate a degree** and sweep again. Watch it work: this is why a single slice took minutes.',
    numbers: '**Translate–rotate** · pencil beam · ~**minutes per slice**.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.48, Rp = Math.min(w, h) * 0.2, R = Rp * 2.1
      const N = 9, dwell = 0.16, glide = 0.22, stepDur = dwell + glide, rotDur = 0.85
      const sweepDur = N * stepDur + rotDur
      const sweeps = 4
      const cyc = sweeps * sweepDur
      const tt = t % cyc
      const k = Math.floor(tt / sweepDur)
      const u = tt - k * sweepDur
      const D = (18 * Math.PI) / 180
      // the cycle fades out and back in — never a hard reset
      const env = Math.min(easeIO(tt / 0.4), easeIO((cyc - tt) / 0.5))

      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      ctx.save()
      ctx.globalAlpha = env

      const ray = (ang: number, off: number, alpha: number, width = 1) => {
        const ux = Math.cos(ang), uy = Math.sin(ang)
        const px = -uy * off, py = ux * off
        ctx.strokeStyle = rgba(ACC, alpha)
        ctx.lineWidth = width
        ctx.beginPath()
        ctx.moveTo(cx + px - ux * R, cy + py - uy * R)
        ctx.lineTo(cx + px + ux * R, cy + py + uy * R)
        ctx.stroke()
        ctx.lineWidth = 1
        return { tx: cx + px - ux * R, ty: cy + py - uy * R, dx: cx + px + ux * R, dy: cy + py + uy * R }
      }
      const off = (i: number) => ((i / (N - 1)) - 0.5) * Rp * 1.9
      // Every sweep travels the SAME direction — the machine never reverses.
      // During the rotation the assembly glides back to the start position
      // (a smooth carriage return) while the angle eases to the next step.

      // Where is the assembly right now, and is it shooting, moving or rotating?
      let angle = k * D
      let offNow: number
      let shotAlpha = 0
      let status: string
      let shotsDone: number
      if (u < N * stepDur) {
        const i = Math.min(N - 1, Math.floor(u / stepDur))
        const ph = (u - i * stepDur) / stepDur
        const here = off(i)
        if (ph < dwell / stepDur) {
          offNow = here
          // flash opens instantly, decays fully — extinguishes, never blinks off
          const dw = ph / (dwell / stepDur)
          shotAlpha = (1 - dw) * (1 - dw)
          status = 'shot'
          lessonPing(`g1-${k}-${i}`)
        } else {
          const g = easeIO((ph - dwell / stepDur) / (glide / stepDur))
          offNow = lerp(here, off(Math.min(N - 1, i + 1)), g)
          status = 'glide…'
        }
        shotsDone = i
      } else {
        const rp = easeIO((u - N * stepDur) / rotDur)
        angle = (k + rp) * D
        offNow = lerp(off(N - 1), off(0), rp)
        status = 'rotate — and return for the next sweep'
        shotsDone = N - 1
      }

      // History: every ray already measured stays as a faint trace.
      for (let k2 = 0; k2 <= k; k2++) {
        const last = k2 === k ? shotsDone : N - 1
        for (let i = 0; i <= last; i++) ray(k2 * D, off(i), 0.05)
      }
      // The live beam exists only during the shot; between shots the pair
      // just glides, dark.
      const ux = Math.cos(angle), uy = Math.sin(angle)
      const px = -uy * offNow, py = ux * offNow
      const tube = { x: cx + px - ux * R, y: cy + py - uy * R }
      const det = { x: cx + px + ux * R, y: cy + py + uy * R }
      if (shotAlpha > 0) ray(angle, offNow, 0.3 + 0.6 * shotAlpha, 1.6)
      // shot ping ring
      if (shotAlpha > 0.4) {
        ctx.strokeStyle = rgba(ACC, (shotAlpha - 0.4) * 1.2)
        ctx.beginPath(); ctx.arc(tube.x, tube.y, 8 + (1 - shotAlpha) * 14, 0, Math.PI * 2); ctx.stroke()
      }
      glowDot(ctx, tube.x, tube.y, 6)
      ctx.fillStyle = rgba(INK, 0.9)
      ctx.fillRect(det.x - 5, det.y - 5, 10, 10)
      sceneLabel(ctx, 'tube', tube.x - 10, tube.y - 10, p, { align: 'right', color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'detector', det.x + 10, det.y + 10, p)

      sceneLabel(ctx, status, cx, h * 0.09, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
      sceneLabel(ctx, `sweep ${k + 1} of ${sweeps} — the coverage builds ray by ray`, cx, h * 0.9, p, { align: 'center', size: 11 })
      ctx.restore()
    },
  },
  {
    id: 'gen2',
    loop: true,
    title: 'Second generation: a small fan, fewer sweeps',
    body: 'Give the tube a **narrow fan** and a **short row of detectors**, and every shot measures several rays at once. The scanner still **translates and rotates** — watch it — but each rotation can be a bigger jump, so **minutes become tens of seconds**.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.48, Rp = Math.min(w, h) * 0.2, R = Rp * 2.1
      const N = 5, dwell = 0.18, glide = 0.24, stepDur = dwell + glide, rotDur = 0.85
      const sweepDur = N * stepDur + rotDur
      const sweeps = 3
      const cyc = sweeps * sweepDur
      const tt = t % cyc
      const k = Math.floor(tt / sweepDur)
      const u = tt - k * sweepDur
      // rotate by the fan's own span — the next sweep tiles onto the last
      const D = (20 * Math.PI) / 180
      const fan = (10 * Math.PI) / 180
      const env = Math.min(easeIO(tt / 0.4), easeIO((cyc - tt) / 0.5))

      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      ctx.save()
      ctx.globalAlpha = env

      const fanShot = (ang: number, off: number, alpha: number) => {
        const ux = Math.cos(ang), uy = Math.sin(ang)
        const px = cx - uy * off, py = cy + ux * off
        const tx = px - ux * R, ty = py - uy * R
        if (alpha > 0) {
          for (let j = -2; j <= 2; j++) {
            const a2 = ang + (j / 2) * fan
            ctx.strokeStyle = rgba(ACC, alpha)
            ctx.beginPath()
            ctx.moveTo(tx, ty)
            ctx.lineTo(tx + Math.cos(a2) * R * 2, ty + Math.sin(a2) * R * 2)
            ctx.stroke()
          }
        }
        return { tx, ty }
      }
      const off = (i: number) => ((i / (N - 1)) - 0.5) * Rp * 1.7
      // Same rule as first generation: every sweep travels one direction,
      // and the carriage returns during the rotation.

      let angle = k * D
      let offNow: number
      let shotAlpha = 0
      let status: string
      let shotsDone: number
      if (u < N * stepDur) {
        const i = Math.min(N - 1, Math.floor(u / stepDur))
        const ph = (u - i * stepDur) / stepDur
        const here = off(i)
        if (ph < dwell / stepDur) {
          offNow = here
          const dw = ph / (dwell / stepDur)
          shotAlpha = (1 - dw) * (1 - dw)
          status = 'shot — several rays at once'
          lessonPing(`g2-${k}-${i}`, 900)
        } else {
          const g = easeIO((ph - dwell / stepDur) / (glide / stepDur))
          offNow = lerp(here, off(Math.min(N - 1, i + 1)), g)
          status = 'glide…'
        }
        shotsDone = i
      } else {
        const rp = easeIO((u - N * stepDur) / rotDur)
        angle = (k + rp) * D
        offNow = lerp(off(N - 1), off(0), rp)
        status = 'rotate — a bigger jump, and return'
        shotsDone = N - 1
      }

      for (let k2 = 0; k2 <= k; k2++) {
        const last = k2 === k ? shotsDone : N - 1
        for (let i = 0; i <= last; i++) fanShot(k2 * D, off(i), 0.04)
      }
      const pos = fanShot(angle, offNow, shotAlpha > 0 ? 0.15 + 0.35 * shotAlpha : 0)
      glowDot(ctx, pos.tx, pos.ty, 6)

      sceneLabel(ctx, status, cx, h * 0.09, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'still translate–rotate — but far fewer sweeps', cx, h * 0.9, p, { align: 'center', size: 11 })
      ctx.restore()
    },
  },
  {
    id: 'gen3',
    loop: true,
    title: 'Third generation: tube and detectors rotate together',
    body: 'Widen the fan until it covers the **whole patient** and pair it with a **curved detector arc** — and translation disappears entirely. **Tube and arc rotate together**, continuously. This rotate–rotate design is the geometry inside almost every scanner today.',
    trap: 'A faulty detector element in **this** geometry draws a **ring artefact** — the element sees the same radius all rotation long.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.48, Rp = Math.min(w, h) * 0.2, R = Rp * 2.1
      const ang = -Math.PI / 2 + t * 1.1
      ctx.strokeStyle = rgba(INK, 0.18)
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      const tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R
      // the beam fires in pulses — eased attack, full decay
      const pulseN = Math.floor(t * 2)
      const pp = (t * 2) % 1
      const pulse = pp < 0.07 ? easeIO(pp / 0.07) : pp < 0.4 ? 1 - easeIO((pp - 0.07) / 0.33) : 0
      lessonPing(`g3-${pulseN}`, 1000)
      // wide fan — wide enough to actually cover the whole patient
      ctx.fillStyle = fanGrad(ctx, tx, ty, R * 2, (0.08 + 0.1 * pulse))
      ctx.strokeStyle = rgba(ACC, 0.4 + 0.35 * pulse)
      const a1 = ang + Math.PI - 0.95, a2 = ang + Math.PI + 0.95
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R)
      ctx.arc(cx, cy, R, a1, a2)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // individual rays streak across while the pulse fires
      if (pulse > 0) {
        for (let j = -3; j <= 3; j++) {
          const a3 = ang + Math.PI + (j / 3) * 0.9
          ctx.strokeStyle = rgba(ACC, 0.35 * pulse)
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(cx + Math.cos(a3) * R, cy + Math.sin(a3) * R)
          ctx.stroke()
        }
      }
      // hardware
      ctx.strokeStyle = rgba(INK, 0.9)
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2); ctx.stroke()
      ctx.lineWidth = 1
      glowDot(ctx, tx, ty, 7 + pulse * 2)
      sceneLabel(ctx, 'no translation — just rotation', cx, h * 0.09, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'the fan covers the whole patient; the arc follows the tube', cx, h * 0.9, p, { align: 'center', size: 11 })
    },
  },
  {
    id: 'gen4',
    loop: true,
    title: 'Fourth generation: the detector ring stands still',
    body: 'Close the circle: a **complete, stationary ring of detectors**, and **only the tube rotates** inside it. Whatever detectors happen to face the fan do the measuring at that instant. Detector-hungry and now largely historical — but the exam loves this distinction.',
    trap: '“The detectors do not move” = **fourth generation**. If tube and detectors move together, that is third.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.48, Rp = Math.min(w, h) * 0.19, R = Rp * 2.2
      const ang = -Math.PI / 2 + t * 1.1
      // stationary ring of detector dots
      const nDet = 48
      for (let i = 0; i < nDet; i++) {
        const a = (i / nDet) * Math.PI * 2
        // detectors opposite the tube brighten and swell as the fan sweeps on
        const diff = Math.abs(((a - (ang + Math.PI)) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI)
        const litAmt = smoothstep(seg(1.25 - diff, 0, 0.35))
        const dx2 = cx + Math.cos(a) * R, dy2 = cy + Math.sin(a) * R
        ctx.fillStyle = rgba(INK, 0.35)
        ctx.beginPath(); ctx.arc(dx2, dy2, 3, 0, Math.PI * 2); ctx.fill()
        if (litAmt > 0) {
          ctx.fillStyle = rgba(ACC, 0.95 * litAmt)
          ctx.beginPath(); ctx.arc(dx2, dy2, 3 + litAmt, 0, Math.PI * 2); ctx.fill()
        }
      }
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(cx, cy, Rp, 0, Math.PI * 2); ctx.stroke()
      // tube inside the ring
      const Rt = R * 0.72
      const tx = cx + Math.cos(ang) * Rt, ty = cy + Math.sin(ang) * Rt
      // the beam fires in pulses — one projection per pulse
      const pulseN = Math.floor(t * 2)
      const pp = (t * 2) % 1
      const pulse = pp < 0.07 ? easeIO(pp / 0.07) : pp < 0.4 ? 1 - easeIO((pp - 0.07) / 0.33) : 0
      lessonPing(`g4-${pulseN}`, 880)
      // fan to the lit sector — wide enough to span the patient from inside
      ctx.fillStyle = fanGrad(ctx, tx, ty, R + Rt, (0.07 + 0.1 * pulse))
      ctx.strokeStyle = rgba(ACC, 0.35 + 0.35 * pulse)
      const a1 = ang + Math.PI - 1.15, a2 = ang + Math.PI + 1.15
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R)
      ctx.arc(cx, cy, R, a1, a2)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // individual rays streak across while the pulse fires
      if (pulse > 0) {
        for (let j = -3; j <= 3; j++) {
          const a3 = ang + Math.PI + (j / 3) * 1.1
          ctx.strokeStyle = rgba(ACC, 0.3 * pulse)
          ctx.beginPath()
          ctx.moveTo(tx, ty)
          ctx.lineTo(cx + Math.cos(a3) * R, cy + Math.sin(a3) * R)
          ctx.stroke()
        }
      }
      glowDot(ctx, tx, ty, 7 + pulse * 2)
      sceneLabel(ctx, 'the ring never moves — only the tube', cx, h * 0.09, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'whichever detectors face the fan are the ones measuring', cx, h * 0.9, p, { align: 'center', size: 11 })
    },
  },
  {
    id: 'reconstruction',
    title: 'Back-projection — and why it must be filtered',
    body: 'Smearing every profile back across the image plane rebuilds the object — but plain back-projection gives a **blurred** result (a 1/r haze). Convolving each profile with a **filter kernel** before smearing removes the blur: **filtered back-projection**. Modern scanners add **iterative reconstruction**, which models the noise and buys back dose.',
    trap: 'Reconstruction choices change image quality, never the dose already delivered.',
    draw: (ctx, w, h, p, t) => {
      const y = h * 0.48, r = Math.min(w, h) * 0.13
      // left: unfiltered smears
      const cx1 = w * 0.3
      const nProj = Math.floor(lerp(2, 14, smoothstep(seg(Math.min(t, 2.2), 0.2, 2))))
      for (let i = 0; i < nProj; i++) {
        const a = (i / 14) * Math.PI
        ctx.save()
        ctx.translate(cx1, y); ctx.rotate(a)
        // a back-projected profile is smeared uniformly along its ray
        ctx.fillStyle = rgba(ACC, 0.08)
        ctx.fillRect(-r * 0.5, -r * 2.4, r, r * 4.8)
        ctx.restore()
      }
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.beginPath(); ctx.arc(cx1, y, r * 0.5, 0, Math.PI * 2); ctx.stroke()
      sceneLabel(ctx, 'simple back-projection — blurred', cx1, y + r * 2.7, p, { align: 'center' })
      // right: filtered result (sharp disc)
      const cx2 = w * 0.7
      ctx.fillStyle = rgba(ACC, 0.55 * p)
      ctx.beginPath(); ctx.arc(cx2, y, r * 0.5, 0, Math.PI * 2); ctx.fill()
      ctx.strokeStyle = rgba(INK, 0.7 * p)
      ctx.lineWidth = 1.4
      ctx.beginPath(); ctx.arc(cx2, y, r * 0.5, 0, Math.PI * 2); ctx.stroke()
      sceneLabel(ctx, 'filtered back-projection — sharp', cx2, y + r * 3.15, p, { align: 'center' })
      // arrow
      ctx.strokeStyle = rgba(INK, 0.4 * p)
      ctx.beginPath(); ctx.moveTo(w * 0.44, y); ctx.lineTo(w * 0.55, y); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(w * 0.55 - 7, y - 4); ctx.lineTo(w * 0.55, y); ctx.lineTo(w * 0.55 - 7, y + 4); ctx.stroke()
      sceneLabel(ctx, 'kernel', w * 0.495, y - 12, p, { color: rgba(ACC, 0.9), align: 'center' })
    },
  },
  {
    id: 'rows',
    title: 'Multi-detector CT: rows along the patient',
    body: 'Behind the fan, the detector is not one row but a **stack of rows along the patient axis** — 64, 128, 320. Each rotation covers a slab, not a slice, and rows can be **binned electronically** into thicker reconstructed slices. More rows: more coverage per rotation, faster studies, and — with wide cones — **cone-beam artefact** at the edges.',
    draw: (ctx, w, h, p) => {
      const cx = w / 2, cy = h * 0.42
      // side view: tube above, rows below
      const tx = cx, ty = cy - h * 0.26
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill()
      const rows = 16, rw = w * 0.026, top = cy + h * 0.2
      for (let i = 0; i < rows; i++) {
        const x = cx - (rows / 2) * rw + i * rw
        const on = i / rows <= p
        ctx.fillStyle = rgba(INK, on ? 0.6 : 0.15)
        ctx.fillRect(x + 1.5, top, rw - 3, 12)
        if (on) {
          ctx.strokeStyle = rgba(ACC, 0.16)
          ctx.beginPath(); ctx.moveTo(tx, ty + 8); ctx.lineTo(x + rw / 2, top); ctx.stroke()
        }
      }
      // z axis with patient outline
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(w * 0.14, top + 40); ctx.lineTo(w * 0.86, top + 40); ctx.stroke()
      sceneLabel(ctx, 'patient axis (z)', w * 0.86, top + 40, p, { align: 'right' })
      sceneLabel(ctx, 'detector rows — a slab per rotation', cx, top + 62, p, { align: 'center' })
      // binning bracket
      const bx = cx - 2 * rw, bw2 = 4 * rw
      ctx.strokeStyle = rgba(ACC, 0.7 * p)
      ctx.beginPath()
      ctx.moveTo(bx, top - 10); ctx.lineTo(bx, top - 16); ctx.lineTo(bx + bw2, top - 16); ctx.lineTo(bx + bw2, top - 10)
      ctx.stroke()
      sceneLabel(ctx, 'binned → one thicker slice', cx, top - 28, p, { color: rgba(ACC, 0.9), align: 'center' })
    },
  },
  {
    id: 'pitch',
    title: 'Helical scanning and pitch',
    body: 'The table moves **while** the gantry spins, so the beam traces a **helix** around the patient. **Pitch = table travel per rotation ÷ beam width.** Push pitch above 1 and the helix stretches: **faster scan, lower dose**, gaps interpolated. Below 1 the turns overlap: more dose, more data.',
    numbers: 'Pitch is **dimensionless**; typical body scanning uses ~**1–1.5**.',
    draw: (ctx, w, h, p, t) => {
      const y = h * 0.45, len = w * 0.62, x0 = w * 0.19
      // body cylinder
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(x0, y - 34); ctx.lineTo(x0 + len, y - 34); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x0, y + 34); ctx.lineTo(x0 + len, y + 34); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(x0, y, 12, 34, 0, 0, Math.PI * 2); ctx.stroke()
      // helix — two passes (back dim, front bright); canvas honours one
      // alpha per stroke, so per-vertex globalAlpha can never draw depth
      const turns = 7, prog = smoothstep(seg(Math.min(t, 2.4), 0.15, 2.2))
      ctx.lineWidth = 1.6
      for (const frontPass of [false, true]) {
        ctx.strokeStyle = rgba(ACC, frontPass ? 0.9 : 0.28)
        ctx.beginPath()
        let pen = false
        for (let i = 0; i <= 240 * prog; i++) {
          const f = i / 240
          const x = x0 + f * len
          const yy = y + Math.sin(f * turns * Math.PI * 2) * 34
          const front = Math.cos(f * turns * Math.PI * 2) > 0
          if (front === frontPass) {
            pen ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)
            pen = true
          } else pen = false
        }
        ctx.stroke()
      }
      sceneLabel(ctx, 'table travel →', x0 + len / 2, y + 58, p, { align: 'center' })
      sceneLabel(ctx, 'pitch = table travel per rotation ÷ beam width', w / 2, h * 0.82, p, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'hu',
    title: 'The Hounsfield scale is anchored to water',
    body: 'Each voxel’s attenuation is expressed **relative to water**: HU = 1000 × (μ − μwater) / μwater. **Water sits at 0 by definition and air at −1000.** The scale is a comparison, not an absolute measurement — and because μ depends on beam energy, measured HU shift slightly with kVp.',
    numbers: 'Air **−1000** · fat ≈ **−100** · water **0** · soft tissue **+20 to +50** · cortical bone **+1000+**.',
    draw: (ctx, w, h, p) => {
      const x0 = w * 0.12, x1 = w * 0.88, y = h * 0.44
      const pos = (hu: number) => lerp(x0, x1, (hu + 1000) / 2200)
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(lerp(x0, x1, p), y); ctx.stroke()
      // soft tissue sits 40 HU from water — a second label row keeps the
      // two from colliding at any stage width
      const stops: [number, string, number][] = [[-1000, 'air', 0], [-100, 'fat', 0], [0, 'water', 0], [40, 'soft tissue', 1], [1000, 'bone', 0]]
      stops.forEach(([hu, name, row], i) => {
        const x = pos(hu)
        const a = smoothstep(seg(p, 0.15 + i * 0.15, 0.35 + i * 0.15))
        ctx.strokeStyle = hu === 0 ? rgba(ACC, 0.9 * a) : rgba(INK, 0.6 * a)
        ctx.lineWidth = hu === 0 ? 2 : 1.2
        const stretch = row ? 14 : 0
        ctx.beginPath(); ctx.moveTo(x, y - 14 - stretch); ctx.lineTo(x, y + 14 + stretch); ctx.stroke()
        sceneLabel(ctx, `${hu > 0 ? '+' : ''}${hu}`, x, y - 26 - stretch, a, { align: 'center', size: 12, color: hu === 0 ? rgba(ACC, 0.95) : undefined })
        sceneLabel(ctx, name, x, y + 30 + stretch, a, { align: 'center' })
      })
      sceneLabel(ctx, 'relative to water — not absolute', w / 2, h * 0.78, seg(p, 0.7, 1), { align: 'center', size: 12 })
    },
  },
  {
    id: 'window',
    title: 'Windowing spends the grey scale where you need it',
    body: 'The display maps a chosen band of HU — the **window** — across the available grey levels. **Width controls contrast** (narrow = high contrast), **level sets the centre**. It is pure display: **the reconstructed numbers never change**, which is why one dataset serves brain, lung and bone settings.',
    trap: 'Narrowing the width makes small HU differences **more** visible, not less.',
    draw: (ctx, w, h, p) => {
      const x0 = w * 0.12, x1 = w * 0.88, yTop = h * 0.24, yBot = h * 0.66
      // HU axis
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(x0, yBot); ctx.lineTo(x1, yBot); ctx.stroke()
      sceneLabel(ctx, '−1000', x0, yBot + 16, 1, { align: 'center', size: 10 })
      sceneLabel(ctx, '+1000', x1, yBot + 16, 1, { align: 'center', size: 10 })
      // two windows: narrow (brain) and wide (lung-ish)
      const win = (
        centre: number, width: number, colour: string, label: string, a: number,
        lx: number, ly: number, align: 'left' | 'center' | 'right',
      ) => {
        const cxp = lerp(x0, x1, (centre + 1000) / 2000)
        // half the window width, mapped onto the 2000-HU axis
        const half = (width / 2 / 2000) * (x1 - x0)
        // ramp
        ctx.strokeStyle = rgba(colour, 0.9 * a)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(x0, yBot)
        ctx.lineTo(cxp - half, yBot)
        ctx.lineTo(cxp + half, yTop)
        ctx.lineTo(x1, yTop)
        ctx.stroke()
        sceneLabel(ctx, label, lx, ly, a, { align, color: rgba(colour, 0.95) })
      }
      // Explicit, well-separated label spots — the two ramps share the plot,
      // so centring both labels on their window centres makes them collide.
      win(35, 160, ACC, 'narrow window — high contrast (brain)', smoothstep(seg(p, 0.1, 0.5)),
        lerp(x0, x1, 1035 / 2000), yTop - 12, 'center')
      win(-300, 1400, '#8FB8C9', 'wide window — bone / lung', smoothstep(seg(p, 0.4, 0.9)),
        x0 + 8, lerp(yBot, yTop, 0.42), 'left')
      sceneLabel(ctx, 'black', x0 - 4, yBot - 6, 1, { align: 'right', size: 10 })
      sceneLabel(ctx, 'white', x0 - 4, yTop, 1, { align: 'right', size: 10 })
    },
  },
  {
    id: 'noise',
    title: 'Noise is a photon-counting problem',
    body: 'Every voxel is a photon count, and counting statistics rule it: **noise ∝ 1/√(photons per voxel)**. More mAs, thicker slices or a softer kernel mean more photons averaged — less mottle. A bigger matrix or thinner slices starve each voxel. **To halve the noise you must quadruple the dose.**',
    numbers: 'Noise ∝ **1/√mAs** — the square root is the whole exam point.',
    draw: (ctx, w, h, p) => {
      // two noise patches + curve
      const patch = (cx: number, count: number, label: string, a: number) => {
        const s = Math.min(w, h) * 0.14
        ctx.strokeStyle = rgba(INK, 0.3 * a)
        ctx.strokeRect(cx - s, h * 0.3 - s, s * 2, s * 2)
        let seed = 12345 + count
        const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
        const grains = count
        ctx.fillStyle = rgba(INK, 0.5 * a)
        for (let i = 0; i < grains; i++) {
          ctx.fillRect(cx - s + rnd() * s * 2, h * 0.3 - s + rnd() * s * 2, 1.6, 1.6)
        }
        sceneLabel(ctx, label, cx, h * 0.3 + s + 18, a, { align: 'center' })
      }
      patch(w * 0.3, 260, 'low dose — mottle', smoothstep(seg(p, 0, 0.4)))
      patch(w * 0.7, 2200, '4× dose — half the noise', smoothstep(seg(p, 0.3, 0.8)))
      sceneLabel(ctx, 'noise ∝ 1 / √dose', w / 2, h * 0.85, seg(p, 0.6, 1), { align: 'center', size: 13, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'artefacts',
    title: 'Beam hardening and partial volume',
    body: 'A polychromatic beam **hardens** as it crosses dense tissue: the soft photons vanish first, the survivors are more penetrating, and the centre of a dense object reads **falsely low** — cupping, and streaks beside bone. Separately, any object **smaller than a voxel** has its HU **averaged with its neighbours**: partial volume.',
    draw: (ctx, w, h, p) => {
      // left: cupping profile
      const gx = w * 0.12, gy = h * 0.22, gw = w * 0.3, gh = h * 0.4
      axes(ctx, gx, gy, gw, gh)
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const ideal = f > 0.15 && f < 0.85 ? 0.7 : 0.05
        const cup = ideal - (f > 0.15 && f < 0.85 ? Math.cos((f - 0.5) * 4.5) * 0.18 : 0)
        const x = gx + f * gw
        const y = gy + gh - cup * gh
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9 * p)
      ctx.lineWidth = 1.5
      ctx.stroke()
      // ideal dashed
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = rgba(INK, 0.35 * p)
      ctx.strokeRect(gx + gw * 0.15, gy + gh * 0.3, gw * 0.7, 0)
      ctx.setLineDash([])
      sceneLabel(ctx, 'measured HU across a uniform object — “cupping”', gx + gw / 2, gy + gh + 20, p, { align: 'center', size: 10.5 })
      // right: partial volume grid
      const px = w * 0.62, py = h * 0.24, cell = Math.min(w, h) * 0.06
      for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
        const inside = Math.hypot(c - 1.1, r - 1.4) < 1.15
        const edge = !inside && Math.hypot(c - 1.1, r - 1.4) < 1.9
        ctx.fillStyle = rgba(INK, inside ? 0.65 : edge ? 0.3 : 0.08)
        ctx.fillRect(px + c * cell, py + r * cell, cell - 2, cell - 2)
      }
      ctx.strokeStyle = rgba(ACC, 0.8 * p)
      ctx.beginPath(); ctx.arc(px + 1.35 * cell, py + 1.6 * cell, cell * 1.15, 0, Math.PI * 2); ctx.stroke()
      sceneLabel(ctx, 'small object → averaged voxels', px + 2 * cell, py + 4 * cell + 20, p, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'dose-metrics',
    title: 'CTDI, DLP and what they actually describe',
    body: '**CTDIvol (mGy)** describes the scanner’s output to a standard phantom — not your patient. Multiply by scan length and you get **DLP (mGy·cm)**; multiply DLP by a **body-region k-factor** and you estimate **effective dose (mSv)**. Size-specific estimates (SSDE) correct CTDIvol for the actual patient.',
    numbers: 'CT head ≈ **1–3 mSv** · abdomen/pelvis ≈ **5–10 mSv**.',
    draw: (ctx, w, h, p) => {
      const y = h * 0.42
      const box = (x: number, label: string, sub: string, a: number, accent = false) => {
        const bw = w * 0.2, bh = h * 0.3
        ctx.strokeStyle = accent ? rgba(ACC, 0.8 * a) : rgba(INK, 0.4 * a)
        ctx.lineWidth = 1.2
        ctx.strokeRect(x - bw / 2, y - bh / 2, bw, bh)
        sceneLabel(ctx, label, x, y - 8, a, { align: 'center', size: 13, color: accent ? rgba(ACC, 0.95) : undefined })
        sceneLabel(ctx, sub, x, y + 12, a * 0.9, { align: 'center', size: 10.5 })
      }
      const arrow = (x1: number, x2: number, label: string, a: number) => {
        ctx.strokeStyle = rgba(INK, 0.45 * a)
        ctx.beginPath(); ctx.moveTo(x1, y); ctx.lineTo(x2, y); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(x2 - 6, y - 4); ctx.lineTo(x2, y); ctx.lineTo(x2 - 6, y + 4); ctx.stroke()
        sceneLabel(ctx, label, (x1 + x2) / 2, y - 14, a, { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      }
      box(w * 0.18, 'CTDIvol', 'mGy — phantom', smoothstep(seg(p, 0, 0.3)))
      arrow(w * 0.29, w * 0.4, '× length', smoothstep(seg(p, 0.25, 0.5)))
      box(w * 0.5, 'DLP', 'mGy·cm', smoothstep(seg(p, 0.4, 0.65)))
      arrow(w * 0.61, w * 0.72, '× k-factor', smoothstep(seg(p, 0.6, 0.8)))
      box(w * 0.82, 'E (mSv)', 'effective dose', smoothstep(seg(p, 0.75, 1)), true)
    },
  },
  {
    id: 'modulation',
    title: 'Dose optimisation in practice',
    body: 'The scanner **modulates the tube current** as attenuation changes — less through the chest, more through the shoulders — and the **bow-tie filter** spares the thin periphery. Add **iterative reconstruction**, the right kVp, and paediatric protocols, and diagnostic quality survives at a fraction of the dose.',
    trap: 'Shielding placed **inside the scanned volume** creates artefact and misleads the modulation — it does not protect.',
    draw: (ctx, w, h, p) => {
      const x0 = w * 0.12, x1 = w * 0.88
      // body outline along z: shoulders wide, chest narrow, abdomen medium
      const width = (f: number) => 26 + 30 * Math.exp(-Math.pow((f - 0.12) / 0.09, 2)) + 16 * Math.exp(-Math.pow((f - 0.7) / 0.22, 2))
      const yMid = h * 0.34
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.beginPath()
      for (let i = 0; i <= 80; i++) { const f = i / 80; const x = lerp(x0, x1, f); i === 0 ? ctx.moveTo(x, yMid - width(f)) : ctx.lineTo(x, yMid - width(f)) }
      for (let i = 80; i >= 0; i--) { const f = i / 80; const x = lerp(x0, x1, f); ctx.lineTo(x, yMid + width(f)) }
      ctx.closePath(); ctx.stroke()
      // mA curve below tracking width
      const gy = h * 0.68, gh = h * 0.16
      axes(ctx, x0, gy - gh, x1 - x0, gh)
      ctx.beginPath()
      for (let i = 0; i <= 80 * p; i++) {
        const f = i / 80
        const x = lerp(x0, x1, f)
        const y = gy - ((width(f) - 26) / 46) * gh * 0.9 - 4
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      sceneLabel(ctx, 'tube current follows the anatomy', (x0 + x1) / 2, gy + 18, p, { align: 'center' })
      sceneLabel(ctx, 'shoulders', x0 + (x1 - x0) * 0.12, yMid - 62, p * 0.8, { align: 'center', size: 10 })
    },
  },
  {
    id: 'capabilities',
    title: 'Isotropic voxels, MPR and dual energy',
    body: 'When voxels are **perfect cubes**, coronal, sagittal and oblique reformats carry **no resolution penalty** — that is isotropy. Acquire at **two energies** and materials separate by their attenuation behaviour: **iodine maps and virtual non-contrast** images without a second scan.',
    draw: (ctx, w, h, p) => {
      // cube voxel
      const cx = w * 0.28, cy = h * 0.42, s = Math.min(w, h) * 0.11
      const iso = (dx: number, dy: number) => ({ x: cx + dx - dy * 0.5, y: cy + (dx + dy) * 0.28 })
      ctx.strokeStyle = rgba(INK, 0.6 * p)
      ctx.lineWidth = 1.2
      const a = iso(-s, -s), b = iso(s, -s), c = iso(s, s), d = iso(-s, s)
      const up = s * 0.9
      ;[[a, b], [b, c], [c, d], [d, a]].forEach(([p1, p2]) => { ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke() })
      ;[[a, b], [b, c], [c, d], [d, a]].forEach(([p1, p2]) => { ctx.beginPath(); ctx.moveTo(p1.x, p1.y - up); ctx.lineTo(p2.x, p2.y - up); ctx.stroke() })
      ;[a, b, c, d].forEach(pt => { ctx.beginPath(); ctx.moveTo(pt.x, pt.y); ctx.lineTo(pt.x, pt.y - up); ctx.stroke() })
      sceneLabel(ctx, 'isotropic voxel — reformats are lossless', cx, cy + s * 1.7, p, { align: 'center' })
      // dual energy: two spectra
      const gx = w * 0.58, gy = h * 0.24, gw = w * 0.3, gh = h * 0.38
      axes(ctx, gx, gy, gw, gh)
      const spec = (kv: number, colour: string, a2: number) => {
        ctx.beginPath()
        for (let i = 0; i <= 50; i++) {
          const f = i / 50
          const e = f * kv
          const v = e < 8 ? 0 : Math.max(0, (kv - e) / kv) * Math.exp(-30 / Math.max(e, 10))
          const x = gx + (e / 150) * gw
          const y = gy + gh - v * gh * 1.6
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rgba(colour, 0.9 * a2)
        ctx.lineWidth = 1.5
        ctx.stroke()
      }
      spec(80, '#8FB8C9', smoothstep(seg(p, 0.3, 0.6)))
      spec(140, ACC, smoothstep(seg(p, 0.5, 0.8)))
      sceneLabel(ctx, '80 kVp', gx + gw * 0.3, gy + 12, seg(p, 0.5, 0.8), { color: rgba('#8FB8C9', 0.9) })
      sceneLabel(ctx, '140 kVp', gx + gw * 0.72, gy + 12, seg(p, 0.6, 0.9), { color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'dual energy — materials separate', gx + gw / 2, gy + gh + 20, seg(p, 0.7, 1), { align: 'center' })
    },
  },
]

export default function CtLab() {
  return (
    <LessonPage
      meta={{
        title: 'CT Physics',
        kicker: 'Computed tomography',
        accent: ACC,
        intro: 'From a spinning tube to a dose report: the **sixteen ideas** CT questions are built from, each one drawn so you can see it.',
        /* Practice and facts arrive through the course spine. */
        next: [],
        backTo: { label: 'Physics course', to: '/physics' },
        film: { label: 'Watch the film', to: '/ct-lab/film' },
        story: { label: 'The scroll story', href: '/ct-story.html' },
        synthesis: {
          headline: 'A thousand shadows, one slice.',
          bigPicture:
            'CT is projection radiography asked from **every angle at once**: profiles in, filtered back-projection out, and the answer expressed in Hounsfield units **anchored to water**. The helix and the detector rows set how fast the volume is covered; **noise obeys 1/√mAs and reconstruction can never buy it back**; windowing spends the numbers on the display without touching the data. Dose lives in three names — CTDI, DLP, effective dose — and the exam expects all three.',
        },
      }}
      steps={STEPS}
    />
  )
}

/* ================================================================== *
 * CT — the film. Continuously animated scenes of the machinery, all
 * original procedural drawings, played through like a video.
 * ================================================================== */

/**
 * Replays a lesson diagram inside the film. A lesson step's diagram is optional
 * now that a step can host a live instrument instead, so this fails loudly
 * rather than handing the film an undefined draw function.
 */
const stepDraw = (id: string): StepDraw => {
  const draw = STEPS.find((s) => s.id === id)?.draw
  if (!draw) throw new Error(`CT film scene "${id}" has no lesson diagram to replay`)
  return draw
}

const FILM_SCENES: FilmScene[] = [
  {
    id: 'spin',
    title: 'The gantry',
    caption: 'Tube and detector arc rotate together; a fan beam crosses the patient every fraction of a second.',
    dur: 8,
    draw: (ctx, w, h, _p, t) => {
      // The lesson's gantry scene, but the rotation never stops.
      const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.4
      const ang = -Math.PI / 2 + t * 1.4
      ctx.strokeStyle = rgba(INK, 0.2)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      patient(ctx, cx, cy, R * 0.42, 1)
      const tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R
      ctx.fillStyle = fanGrad(ctx, tx, ty, R * 2, 0.14)
      ctx.strokeStyle = rgba(ACC, 0.35)
      const a1 = ang + Math.PI - 0.95, a2 = ang + Math.PI + 0.95
      ctx.beginPath()
      ctx.moveTo(tx, ty)
      ctx.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R)
      ctx.arc(cx, cy, R, a1, a2)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      ctx.strokeStyle = rgba(INK, 0.85)
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2); ctx.stroke()
      ctx.lineWidth = 1
      glowDot(ctx, tx, ty, 7)
      // the labels introduce the hardware, then step aside
      const labelA = clamp(1 - (t - 3.2) / 1.2)
      if (labelA > 0) {
        sceneLabel(ctx, 'tube', tx + 14, ty, labelA, { color: rgba(ACC, 0.9) })
        sceneLabel(ctx, 'detector arc', cx + Math.cos(ang + Math.PI) * (R + 16), cy + Math.sin(ang + Math.PI) * (R + 16), labelA, { align: 'center' })
      }
      lessonPing(`spin-${Math.floor((t * 1.4) / (Math.PI * 2))}`, 760)
    },
  },
  {
    id: 'gen1',
    title: 'First generation',
    caption: 'One pencil beam, one detector: shot, glide, shot — then rotate one degree while the carriage returns.',
    dur: 10,
    draw: stepDraw('gen1'),
  },
  {
    id: 'gen2',
    title: 'Second generation',
    caption: 'A small fan and a few detectors: still translate–rotate, but far fewer sweeps.',
    dur: 8.8,
    draw: stepDraw('gen2'),
  },
  {
    id: 'gen3',
    title: 'Third generation',
    caption: 'The fan covers the whole patient — tube and detector arc simply rotate together.',
    dur: 7,
    draw: stepDraw('gen3'),
  },
  {
    id: 'gen4',
    title: 'Fourth generation',
    caption: 'A full stationary ring of detectors; only the tube moves inside it.',
    dur: 8,
    draw: stepDraw('gen4'),
  },
  {
    id: 'bowtie',
    title: 'The bow-tie filter',
    caption: 'The patient is thin at the edges — the bow-tie compensates, so the detector sees a flat signal.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cx = w * 0.34, ty = h * 0.1, dy = h * 0.8
      const spread = Math.min(w, h) * 0.24
      // cone
      ctx.fillStyle = rgba(ACC, 0.05)
      ctx.strokeStyle = rgba(ACC, 0.3)
      ctx.beginPath()
      ctx.moveTo(cx, ty)
      ctx.lineTo(cx - spread, dy)
      ctx.lineTo(cx + spread, dy)
      ctx.closePath()
      ctx.fill(); ctx.stroke()
      // tube
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(cx, ty, 6, 0, Math.PI * 2); ctx.fill()
      // photons streaming down the cone
      for (let i = 0; i < 7; i++) {
        const fx2 = (i / 6) * 2 - 1
        const f = ((t * 0.55) + i * 0.13) % 1
        const x = cx + fx2 * spread * f
        const y = lerp(ty, dy, f)
        ctx.fillStyle = rgba(ACC, 0.5 * (1 - f * 0.5))
        ctx.beginPath(); ctx.arc(x, y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      // bow-tie filter — thick at the edges, thin in the middle
      const fy = ty + h * 0.14, fw = spread * 0.36, fh = 11
      ctx.fillStyle = rgba(INK, 0.55)
      ctx.beginPath()
      ctx.moveTo(cx - fw, fy - fh); ctx.lineTo(cx, fy - 2); ctx.lineTo(cx + fw, fy - fh)
      ctx.lineTo(cx + fw, fy + fh); ctx.lineTo(cx, fy + 2); ctx.lineTo(cx - fw, fy + fh)
      ctx.closePath(); ctx.fill()
      sceneLabel(ctx, 'bow-tie filter', cx + fw + 12, fy, 1)
      // patient
      patient(ctx, cx, h * 0.52, Math.min(w, h) * 0.15, 1)
      // detector
      ctx.fillStyle = rgba(INK, 0.7)
      ctx.fillRect(cx - spread - 4, dy + 4, spread * 2 + 8, 6)
      sceneLabel(ctx, 'detector', cx + spread + 14, dy + 8, 1)
      // right: the detector signal, morphing without ↔ with the filter
      const gx = w * 0.66, gy = h * 0.22, gw = w * 0.26, gh = h * 0.42
      axes(ctx, gx, gy, gw, gh)
      const blend = smoothstep((Math.sin(t * 0.75 - Math.PI / 2) + 1) / 2)
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const centreDip = Math.exp(-Math.pow((f - 0.5) / 0.24, 2))
        const without = 0.85 - centreDip * 0.55   // centre heavily attenuated by the body
        const withF = 0.42                         // bow-tie equalises the profile
        const v = lerp(without, withF, blend)
        const x = gx + f * gw
        const y = gy + gh - v * gh
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      sceneLabel(ctx, blend > 0.5 ? 'with the bow-tie — flat' : 'without — centre starved', gx + gw / 2, gy - 12, 1, { align: 'center', color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'signal across the detector', gx + gw / 2, gy + gh + 18, 1, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'array',
    title: 'The multi-slice detector',
    caption: 'In-plane it is a fan; along the patient it is rows — open the collimator and one rotation covers a slab.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      // left: in-plane view (x–y)
      const lx = w * 0.27, ty = h * 0.14, by = h * 0.72
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(lx, ty, 5, 0, Math.PI * 2); ctx.fill()
      const half = Math.min(w, h) * 0.2
      ctx.fillStyle = rgba(ACC, 0.06)
      ctx.beginPath(); ctx.moveTo(lx, ty); ctx.lineTo(lx - half, by); ctx.lineTo(lx + half, by); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = rgba(ACC, 0.3)
      ctx.beginPath(); ctx.moveTo(lx, ty); ctx.lineTo(lx - half, by); ctx.moveTo(lx, ty); ctx.lineTo(lx + half, by); ctx.stroke()
      patient(ctx, lx, h * 0.45, Math.min(w, h) * 0.13, 1)
      // curved detector
      ctx.strokeStyle = rgba(INK, 0.75)
      ctx.lineWidth = 5
      ctx.beginPath(); ctx.arc(lx, ty, by - ty + 8, Math.PI / 2 - 0.38, Math.PI / 2 + 0.38); ctx.stroke()
      ctx.lineWidth = 1
      sceneLabel(ctx, 'in-plane: a fan', lx, by + 40, 1, { align: 'center' })
      // right: side view (y–z) with rows and a breathing beam width
      const rx = w * 0.71, rty = h * 0.14, rby = h * 0.62
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(rx, rty, 5, 0, Math.PI * 2); ctx.fill()
      const rows = 16, rw = Math.min(w, h) * 0.032
      // continuous width for the beam geometry; rows snap on/off discretely
      const litF = lerp(4, rows, (Math.sin(t * 0.7 - Math.PI / 2) + 1) / 2)
      const lit = Math.round(litF)
      const litHalf = (litF / 2) * rw
      ctx.fillStyle = rgba(ACC, 0.06)
      ctx.beginPath(); ctx.moveTo(rx, rty); ctx.lineTo(rx - litHalf, rby); ctx.lineTo(rx + litHalf, rby); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = rgba(ACC, 0.35)
      ctx.beginPath(); ctx.moveTo(rx, rty); ctx.lineTo(rx - litHalf, rby); ctx.moveTo(rx, rty); ctx.lineTo(rx + litHalf, rby); ctx.stroke()
      for (let i = 0; i < rows; i++) {
        const x = rx - (rows / 2) * rw + i * rw
        const on = Math.abs(x + rw / 2 - rx) < litHalf
        ctx.fillStyle = rgba(INK, on ? 0.7 : 0.16)
        ctx.fillRect(x + 1.5, rby, rw - 3, 11)
      }
      // beam-width bracket
      ctx.strokeStyle = rgba(ACC, 0.75)
      ctx.beginPath()
      ctx.moveTo(rx - litHalf, rby + 20); ctx.lineTo(rx - litHalf, rby + 26)
      ctx.lineTo(rx + litHalf, rby + 26); ctx.lineTo(rx + litHalf, rby + 20)
      ctx.stroke()
      sceneLabel(ctx, `beam width — ${lit} rows`, rx, rby + 40, 1, { align: 'center', color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'side view: rows along z', rx, rby + 58, 1, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'helical',
    title: 'Helical scanning',
    caption: 'The table moves while the gantry spins, so the beam traces a helix along the patient.',
    dur: 10,
    draw: (ctx, w, h, _p, t) => {
      const y = h * 0.44, len = w * 0.6, x0 = w * 0.2
      const cycle = Math.floor(t / 8)
      const frac = (t / 8) % 1
      const turns = 6
      // table
      ctx.strokeStyle = rgba(INK, 0.25)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x0 - 24, y + 52); ctx.lineTo(x0 + len + 30, y + 52); ctx.stroke()
      // body cylinder, head to the right
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.moveTo(x0, y - 34); ctx.lineTo(x0 + len, y - 34); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x0, y + 34); ctx.lineTo(x0 + len, y + 34); ctx.stroke()
      ctx.beginPath(); ctx.ellipse(x0 + len, y, 12, 34, 0, 0, Math.PI * 2); ctx.stroke()
      // the moving parts fade out and back in at the cycle wrap — no teleport
      const tc = t % 8
      const env = Math.min(easeIO(tc / 0.45), easeIO((8 - tc) / 0.55))
      ctx.save()
      ctx.globalAlpha = env
      // the helix traced so far — two passes, back segments dim, front bright
      ctx.lineWidth = 1.6
      const nPts = Math.floor(240 * frac)
      for (const frontPass of [false, true]) {
        ctx.strokeStyle = rgba(ACC, frontPass ? 0.9 : 0.25)
        ctx.beginPath()
        let pen = false
        for (let i = 0; i <= nPts; i++) {
          const f = i / 240
          const ph2 = f * turns * Math.PI * 2
          const front = Math.cos(ph2) > 0
          if (front === frontPass) {
            const x = x0 + f * len
            const yy = y + Math.sin(ph2) * 34
            pen ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy)
            pen = true
          } else pen = false
        }
        ctx.stroke()
      }
      // the gantry ring, sweeping the volume — in the scanner it is the
      // table that slides; the relative motion is identical
      const rx = x0 + frac * len
      ctx.strokeStyle = rgba(INK, 0.55)
      ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.ellipse(rx, y, 11, 46, 0, 0, Math.PI * 2); ctx.stroke()
      // the tube on the ring
      const ph = frac * turns * Math.PI * 2
      const dotX = rx + Math.cos(ph) * 11
      const dotY = y + Math.sin(ph) * 46
      glowDot(ctx, dotX, dotY, 5, Math.cos(ph) > 0 ? 1 : 0.45)
      ctx.restore()
      lessonPing(`hel-${cycle}-${Math.floor(frac * turns)}`, 980)
      // z arrow
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.beginPath(); ctx.moveTo(x0 + len * 0.32, y + 74); ctx.lineTo(x0 + len * 0.68, y + 74); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(x0 + len * 0.68 - 7, y + 70); ctx.lineTo(x0 + len * 0.68, y + 74); ctx.lineTo(x0 + len * 0.68 - 7, y + 78); ctx.stroke()
      sceneLabel(ctx, 'relative table travel (z) — the scan advances', x0 + len / 2, y + 92, 1, { align: 'center' })
      sceneLabel(ctx, 'pitch = table travel per rotation ÷ beam width', w / 2, h * 0.1, 1, { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'backprojection',
    title: 'Back-projection',
    caption: 'Each profile is smeared back across the image; many angles rebuild the object — the kernel removes the blur.',
    dur: 11,
    draw: (ctx, w, h, _p, t) => {
      const cy = h * 0.46, r = Math.min(w, h) * 0.15
      const cycle = t % 11
      const cx = w * 0.5
      const total = 16
      const done = Math.min(total, Math.floor((cycle / 6.5) * total))
      // accumulated smears
      for (let i = 0; i < done; i++) {
        const a = (i / total) * Math.PI
        ctx.save()
        ctx.translate(cx, cy); ctx.rotate(a)
        // uniform along the ray — that is what back-projection is
        ctx.fillStyle = rgba(ACC, 0.07)
        ctx.fillRect(-r * 0.5, -r * 2.4, r, r * 4.8)
        ctx.restore()
      }
      // the smear arriving right now
      if (done < total) {
        const a = (done / total) * Math.PI
        ctx.save()
        ctx.translate(cx, cy); ctx.rotate(a)
        ctx.strokeStyle = rgba(ACC, 0.6)
        ctx.lineWidth = 1
        ctx.strokeRect(-r * 0.5, -r * 2.4, r, r * 4.8)
        ctx.restore()
        lessonPing(`bp-${Math.floor(t / 11)}-${done}`, 1150)
      }
      // the object outline
      ctx.strokeStyle = rgba(INK, 0.4)
      ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke()
      // after all angles: the kernel sharpens the disc
      const sharpen = smoothstep(seg(cycle, 7.2, 9))
      if (sharpen > 0) {
        ctx.fillStyle = rgba(ACC, 0.55 * sharpen)
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(INK, 0.7 * sharpen)
        ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2); ctx.stroke()
      }
      sceneLabel(
        ctx,
        sharpen > 0.5 ? 'filtered back-projection — sharp' : `smearing profile ${Math.min(done + 1, total)} of ${total}`,
        cx, cy + r * 2.8, 1,
        { align: 'center', color: sharpen > 0.5 ? rgba(ACC, 0.95) : undefined },
      )
    },
  },
  {
    id: 'ring',
    title: 'The ring artefact',
    caption: 'A faulty detector sits at the same distance from the centre at every angle — its error draws a ring.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cx = w / 2, cy = h * 0.48, R = Math.min(w, h) * 0.38
      const ang = -Math.PI / 2 + t * 1.5
      ctx.strokeStyle = rgba(INK, 0.2)
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke()
      patient(ctx, cx, cy, R * 0.42, 1)
      // tube
      const tx = cx + Math.cos(ang) * R, ty = cy + Math.sin(ang) * R
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(tx, ty, 6, 0, Math.PI * 2); ctx.fill()
      // detector arc opposite, with one dead channel
      const centreA = ang + Math.PI
      const segs = 13
      const deadIdx = 4 // off-centre — its ray passes the isocentre at a fixed distance
      for (let i = 0; i < segs; i++) {
        const a1 = centreA - 0.5 + (i / segs)
        const a2 = a1 + 1 / segs - 0.012
        const dead = i === deadIdx
        ctx.strokeStyle = dead ? rgba('#C25B4A', 0.9) : rgba(INK, 0.8)
        ctx.lineWidth = 5
        ctx.beginPath(); ctx.arc(cx, cy, R, a1, a2); ctx.stroke()
      }
      ctx.lineWidth = 1
      // the dead channel's ray, at this angle
      const deadA = centreA - 0.5 + ((deadIdx + 0.5) / segs)
      const dx = cx + Math.cos(deadA) * R, dyy = cy + Math.sin(deadA) * R
      ctx.strokeStyle = rgba('#C25B4A', 0.4)
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(dx, dyy); ctx.stroke()
      // its distance from the isocentre never changes → a ring accumulates
      const nx = dx - tx, ny = dyy - ty
      const len2 = Math.hypot(nx, ny)
      const dist = Math.abs((cx - tx) * (ny / len2) - (cy - ty) * (nx / len2))
      // the payoff arrives while there is still time to look at it
      const ringA = Math.min(0.8, t * 0.16)
      ctx.strokeStyle = rgba('#C25B4A', ringA)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.arc(cx, cy, dist, 0, Math.PI * 2); ctx.stroke()
      ctx.lineWidth = 1
      // label only while the channel rides the upper half — never over the caption
      if (dyy < cy - 10) {
        sceneLabel(ctx, 'faulty channel', dx + Math.cos(deadA) * 18, dyy + Math.sin(deadA) * 18, 1, { align: 'center', color: rgba('#C25B4A', 0.9) })
      }
      sceneLabel(ctx, 'same radius at every angle → a ring', cx, h * 0.93, 1, { align: 'center', size: 11 })
    },
  },
  {
    id: 'conebeam',
    title: 'The cone-beam effect',
    caption: 'Away from the centre rows the rays are tilted — the “slice” each edge row reconstructs is not flat.',
    dur: 9,
    draw: (ctx, w, h, _p, t) => {
      const cx = w / 2, fy = h * 0.82, ry = h * 0.16
      const rows = 8, rw = Math.min(w, h) * 0.055
      const left = cx - (rows / 2) * rw
      // detector cells on top
      for (let i = 0; i < rows; i++) {
        ctx.strokeStyle = rgba(INK, 0.5)
        ctx.strokeRect(left + i * rw, ry - 12, rw, 12)
      }
      // focus
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(cx, fy, 5, 0, Math.PI * 2); ctx.fill()
      sceneLabel(ctx, 'X-ray focus', cx, fy + 20, 1, { align: 'center' })
      // all ray boundaries, faint
      for (let i = 0; i <= rows; i++) {
        const x = left + i * rw
        ctx.strokeStyle = rgba(INK, 0.15)
        ctx.beginPath(); ctx.moveTo(cx, fy); ctx.lineTo(x, ry); ctx.stroke()
      }
      // z-axis through the middle
      const zy = (fy + ry) / 2
      ctx.strokeStyle = rgba(INK, 0.35)
      ctx.beginPath(); ctx.moveTo(w * 0.1, zy); ctx.lineTo(w * 0.9, zy); ctx.stroke()
      sceneLabel(ctx, 'z-axis', w * 0.9, zy - 10, 1, { align: 'right', size: 10.5 })
      // the highlighted row GLIDES from centre to edge and back — continuous,
      // never quantised to a row jump
      const sweep = (Math.sin(t * 0.6 - Math.PI / 2) + 1) / 2
      const jF = lerp(rows / 2 - 0.5, 0, sweep)
      const x1 = left + jF * rw, x2 = x1 + rw
      ctx.fillStyle = rgba(ACC, 0.14)
      ctx.beginPath(); ctx.moveTo(cx, fy); ctx.lineTo(x1, ry); ctx.lineTo(x2, ry); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = rgba(ACC, 0.6)
      ctx.beginPath(); ctx.moveTo(cx, fy); ctx.lineTo(x1, ry); ctx.moveTo(cx, fy); ctx.lineTo(x2, ry); ctx.stroke()
      // the plane this row "believes" it measured — a vertical dashed slab
      const mid = (x1 + x2) / 2
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = rgba(INK, 0.6)
      ctx.beginPath(); ctx.moveTo(mid - rw * 0.4, zy - 34); ctx.lineTo(mid - rw * 0.4, zy + 34); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(mid + rw * 0.4, zy - 34); ctx.lineTo(mid + rw * 0.4, zy + 34); ctx.stroke()
      ctx.setLineDash([])
      // the two readings crossfade instead of hard-swapping
      const off = Math.abs(mid - cx) / ((rows / 2) * rw)
      const edgeA = smoothstep(seg(off, 0.15, 0.4))
      sceneLabel(ctx, 'centre row — the beam matches the slice', cx, h * 0.94, 1 - edgeA, { align: 'center', size: 11 })
      sceneLabel(ctx, 'edge row — the beam is tilted through the slice', cx, h * 0.94, edgeA, { align: 'center', size: 11, color: rgba(ACC, 0.95) })
    },
  },
]

export function CtFilm() {
  return (
    <FilmPage
      meta={{
        title: 'CT — the film',
        kicker: 'Computed tomography',
        accent: ACC,
        backTo: { label: 'CT lesson', to: '/ct-lab' },
      }}
      scenes={FILM_SCENES}
    />
  )
}
