/**
 * MRI Core Physics — the concepts that come BEFORE the sequence laboratory.
 *
 * The laboratory pages start at net magnetisation, which is already several
 * ideas in. This module is the run-up: why hydrogen, what spin is, why a
 * proton precesses at all, where the net magnetisation vector comes from, what
 * resonance does to it, and how the two independent recoveries (T1 and T2)
 * become image contrast through TR and TE. It closes on the hardware — the
 * four coils and the superconducting magnet that make the field in the first
 * place.
 *
 * Same lesson player as the CT and nuclear medicine modules: one concept per
 * screen, an original procedural diagram, and Next.
 */

import { C, rgba, clamp } from '../home/fx'
import { LessonPage, type LessonStep } from './lesson'
import { nextInChain } from './seq/shared'

const ACC = '#A99EDB'
const INK = C.ink
const BLUE = '#6ea8ff'
const PINK = '#ff7ad1'
const ORANGE = '#ffab5e'
const PURPLE = '#b18cff'
const YELLOW = '#ffe14d'

const ease = (v: number) => { const c = clamp(v); return c * c * (3 - 2 * c) }

/* ---------- shared drawing helpers ---------- */

/** A spinning proton: a sphere with a spin axis and a curl of rotation. */
function proton(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, tilt: number, alpha = 1, colour = ACC) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.translate(x, y)
  ctx.rotate(tilt)
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 0, 0, 0, r)
  g.addColorStop(0, rgba(colour, 0.55))
  g.addColorStop(1, rgba(colour, 0.12))
  ctx.fillStyle = g
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill()
  ctx.strokeStyle = rgba(colour, 0.75)
  ctx.lineWidth = 1.2
  ctx.stroke()
  // spin axis arrow through the sphere
  ctx.strokeStyle = rgba(colour, 0.95)
  ctx.lineWidth = 1.8
  ctx.beginPath(); ctx.moveTo(0, r * 1.5); ctx.lineTo(0, -r * 1.6); ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(-r * 0.34, -r * 1.15); ctx.lineTo(0, -r * 1.65); ctx.lineTo(r * 0.34, -r * 1.15)
  ctx.stroke()
  ctx.restore()
}

/** The B0 field axis with its label. */
function b0Axis(ctx: CanvasRenderingContext2D, x: number, top: number, bottom: number, alpha = 1) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = rgba(INK, 0.32)
  ctx.lineWidth = 1
  ctx.setLineDash([4, 5])
  ctx.beginPath(); ctx.moveTo(x, bottom); ctx.lineTo(x, top); ctx.stroke()
  ctx.setLineDash([])
  ctx.beginPath()
  ctx.moveTo(x - 5, top + 9); ctx.lineTo(x, top); ctx.lineTo(x + 5, top + 9)
  ctx.stroke()
  ctx.font = '600 11px Inter, system-ui, sans-serif'
  ctx.fillStyle = rgba(INK, 0.6)
  ctx.textAlign = 'left'
  ctx.fillText('B₀', x + 8, top + 12)
  ctx.restore()
}

/** A precession cone: the vector sweeping a circle about the field axis. */
function precessionCone(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number, len: number, phase: number, alpha: number) {
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.strokeStyle = rgba(ACC, 0.3)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.ellipse(cx, cy - len, rx, ry, 0, 0, Math.PI * 2); ctx.stroke()
  const tipX = cx + Math.cos(phase) * rx
  const tipY = cy - len + Math.sin(phase) * ry
  ctx.strokeStyle = rgba(ACC, 0.9)
  ctx.lineWidth = 2.2
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(tipX, tipY); ctx.stroke()
  ctx.fillStyle = rgba(ACC, 1)
  ctx.beginPath(); ctx.arc(tipX, tipY, 3.4, 0, Math.PI * 2); ctx.fill()
  ctx.restore()
}

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, alpha: number, colour = INK, align: CanvasTextAlign = 'left', size = 11) {
  if (alpha <= 0.02) return
  ctx.save()
  ctx.globalAlpha = alpha
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`
  ctx.fillStyle = rgba(colour, 0.85)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

/* ---------- the module ---------- */

const STEPS: LessonStep[] = [
  {
    id: 'hydrogen',
    title: 'Hydrogen is what MRI listens to',
    body: 'MRI generates its signal from **hydrogen**. Two facts make it the only realistic choice: hydrogen is by far the **most abundant** atom with non-zero spin in the body — it is in every water and fat molecule — and it has the **largest magnetic moment** of the candidates. Carbon-13, oxygen-17, fluorine-19 and phosphorus-31 all have non-zero spin, but none combines abundance and moment the way ¹H does.',
    numbers: 'Gyromagnetic ratio γ: **¹H 42.6**, ¹⁹F 40, ³¹P 17.2, ¹³C 10.7, ¹⁷O 5.8 MHz/T.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.32, cy = h / 2
      const r = Math.min(w, h) * 0.11
      proton(ctx, cx, cy, r, 0, p)
      label(ctx, 'HYDROGEN  ¹H', cx, cy + r * 2.6, p, ACC, 'center', 12)
      label(ctx, 'most abundant · largest magnetic moment', cx, cy + r * 2.6 + 18, p * 0.8, INK, 'center', 10.5)
      // the gyromagnetic ratio table
      const rows: [string, number][] = [['¹H', 42.6], ['¹⁹F', 40], ['³¹P', 17.2], ['¹³C', 10.7], ['¹⁷O', 5.8]]
      const tx = w * 0.62, ty = cy - rows.length * 11
      label(ctx, 'γ (MHz/T)', tx, ty - 20, p, INK, 'left', 11)
      rows.forEach(([name, v], i) => {
        const a = ease((p - i * 0.08) / 0.5)
        const y = ty + i * 26
        const barW = (v / 42.6) * w * 0.22
        ctx.save()
        ctx.globalAlpha = a
        ctx.fillStyle = rgba(i === 0 ? ACC : INK, i === 0 ? 0.5 : 0.16)
        ctx.fillRect(tx + 34, y - 6, barW, 12)
        ctx.restore()
        label(ctx, name, tx, y, a, i === 0 ? ACC : INK, 'left', 11)
        label(ctx, String(v), tx + 40 + barW, y, a, i === 0 ? ACC : INK, 'left', 10.5)
      })
    },
  },
  {
    id: 'spin',
    title: 'Spin is why a proton behaves like a tiny magnet',
    body: '**Spin** is a quantum property — an intrinsic angular momentum that a particle simply has, like charge or mass. The hydrogen proton has a spin of **½**. Because it is both **charged and spinning**, it carries a **magnetic moment**, and anything with a magnetic moment will respond to an external magnetic field. Atoms whose spin sums to zero have no moment and are invisible to MRI.',
    trap: 'Spin is not a proton physically rotating like a top — that is only the picture we draw. It is an intrinsic quantum property, and the value for ¹H is ½.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h / 2
      const r = Math.min(w, h) * 0.13
      proton(ctx, cx, cy, r, 0, p)
      // curl of rotation around it
      ctx.save()
      ctx.globalAlpha = p * 0.8
      ctx.strokeStyle = rgba(ACC, 0.6)
      ctx.lineWidth = 1.6
      const sweep = (t * 1.4) % (Math.PI * 2)
      ctx.beginPath(); ctx.ellipse(cx, cy, r * 1.55, r * 0.5, 0, sweep, sweep + Math.PI * 1.5); ctx.stroke()
      ctx.restore()
      label(ctx, 'spin = ½', cx, cy - r * 2.3, p, ACC, 'center', 13)
      label(ctx, 'charge + spin  →  magnetic moment  μ', cx, cy + r * 2.5, p, INK, 'center', 12)
      label(ctx, 'μ = γ × spin', cx, cy + r * 2.5 + 20, p * 0.85, ACC, 'center', 11)
    },
  },
  {
    id: 'align',
    title: 'In a field, spins align — and slightly more point up',
    body: 'Put hydrogen in a strong external field (**B₀**) and the moments take one of two orientations: **parallel** with the field (**spin-up**, lower energy) or **anti-parallel** against it (**spin-down**, higher energy). They almost cancel — but there is a **slight excess in the lower-energy spin-up state**. That tiny surplus, a few spins per million, is the entire source of the MRI signal.',
    numbers: 'The excess is roughly **a few protons per million** at clinical field strengths — everything else cancels out.',
    draw: (ctx, w, h, p) => {
      b0Axis(ctx, w * 0.1, h * 0.2, h * 0.8, p)
      const up = 7, down = 5
      const r = Math.min(w, h) * 0.033
      for (let i = 0; i < up; i++) {
        const a = ease((p - i * 0.05) / 0.5)
        proton(ctx, w * (0.3 + (i % 4) * 0.12), h * (0.36 + Math.floor(i / 4) * 0.16), r, 0, a, ACC)
      }
      for (let i = 0; i < down; i++) {
        const a = ease((p - 0.2 - i * 0.05) / 0.5)
        proton(ctx, w * (0.34 + (i % 3) * 0.12), h * (0.68 + Math.floor(i / 3) * 0.14), r, Math.PI, a, BLUE)
      }
      label(ctx, `SPIN-UP  ·  parallel  ·  lower energy  ·  ${up}`, w * 0.3, h * 0.24, p, ACC, 'left', 11)
      label(ctx, `SPIN-DOWN  ·  anti-parallel  ·  higher energy  ·  ${down}`, w * 0.3, h * 0.9, p, BLUE, 'left', 11)
      label(ctx, 'the small excess is the signal', w * 0.72, h * 0.5, ease((p - 0.5) / 0.5), ACC, 'center', 12)
    },
  },
  {
    id: 'larmor',
    title: 'Aligned spins precess at the Larmor frequency',
    body: 'A spin in a field does not sit still — it **precesses**, sweeping a cone around the field axis like a wobbling gyroscope. The rate is the **Larmor frequency**, and it is set by just two things: the **gyromagnetic ratio** of the nucleus and the **strength of the field**. Raise B₀ and every proton precesses faster. This frequency is what the scanner must match to talk to the spins at all.',
    numbers: 'f₀ = γ B₀. For ¹H: **42.6 MHz per tesla** — so **63.9 MHz at 1.5 T**, **127.8 MHz at 3 T**.',
    loop: true,
    draw: (ctx, w, h, p, t) => {
      const cx = w * 0.38, cy = h * 0.74
      const len = h * 0.34
      b0Axis(ctx, cx, h * 0.24, h * 0.82, p)
      precessionCone(ctx, cx, cy, w * 0.11, h * 0.045, len, t * 2.4, p)
      label(ctx, 'f₀ = γ B₀', w * 0.72, h * 0.4, p, ACC, 'center', 16)
      label(ctx, '1.5 T  →  63.9 MHz', w * 0.72, h * 0.52, ease((p - 0.3) / 0.6), INK, 'center', 12)
      label(ctx, '3.0 T  →  127.8 MHz', w * 0.72, h * 0.62, ease((p - 0.45) / 0.6), INK, 'center', 12)
    },
  },
  {
    id: 'nmv',
    title: 'All those moments add up to one vector',
    body: 'We never track individual protons. The moments in a voxel **sum** into a single **net magnetisation vector (NMV)** — the thing every MRI diagram actually shows. At rest it lies **along B₀** (longitudinal, the z-axis) because that is where the spin-up excess points. There is no signal yet: a vector sitting still along the field induces nothing in a receiver coil.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.3, cy = h * 0.78
      b0Axis(ctx, cx, h * 0.16, h * 0.86, p)
      for (let i = 0; i < 9; i++) {
        const a = ease((p - i * 0.04) / 0.4) * 0.5
        const ox = (i % 3 - 1) * w * 0.05
        const oy = Math.floor(i / 3) * h * 0.07
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = rgba(ACC, 0.5); ctx.lineWidth = 1.4
        ctx.beginPath(); ctx.moveTo(cx + ox - w * 0.16, cy - oy); ctx.lineTo(cx + ox - w * 0.16, cy - oy - h * 0.09); ctx.stroke()
        ctx.restore()
      }
      label(ctx, 'individual moments', cx - w * 0.16, h * 0.92, p, INK, 'center', 10.5)
      const a2 = ease((p - 0.4) / 0.6)
      ctx.save(); ctx.globalAlpha = a2
      ctx.strokeStyle = rgba(ACC, 1); ctx.lineWidth = 3.4
      ctx.beginPath(); ctx.moveTo(cx + w * 0.16, cy); ctx.lineTo(cx + w * 0.16, cy - h * 0.44); ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(cx + w * 0.16 - 7, cy - h * 0.44 + 11); ctx.lineTo(cx + w * 0.16, cy - h * 0.44); ctx.lineTo(cx + w * 0.16 + 7, cy - h * 0.44 + 11)
      ctx.stroke(); ctx.restore()
      label(ctx, 'NET MAGNETISATION', cx + w * 0.16, h * 0.92, a2, ACC, 'center', 11)
      label(ctx, 'longitudinal · along B₀ · no signal yet', w * 0.78, h * 0.5, ease((p - 0.6) / 0.4), INK, 'center', 11.5)
    },
  },
  {
    id: 'resonance',
    title: 'A matched RF pulse tips it into the transverse plane',
    body: 'Transmit a **radiofrequency pulse perpendicular to B₀** at exactly the **Larmor frequency** and the spins **resonate** — this is nuclear magnetic resonance. Energy is absorbed, and the net magnetisation vector **flips out of the longitudinal axis into the transverse plane**. Only now is there signal: a vector rotating in the transverse plane sweeps past the receiver coil and induces a current.',
    trap: 'The pulse only works if its frequency matches the Larmor frequency — that is what "resonance" means. Off-resonance spins are untouched, and this is exactly what slice selection later exploits.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.66
      b0Axis(ctx, cx, h * 0.14, h * 0.8, p)
      // RF pulse coming in from the left
      const a1 = ease(p / 0.5)
      ctx.save(); ctx.globalAlpha = a1
      ctx.strokeStyle = rgba(YELLOW, 0.85); ctx.lineWidth = 1.8
      ctx.beginPath()
      for (let x = 0; x <= w * 0.3; x += 3) {
        const y = cy - h * 0.2 + Math.sin((x / 9) - t * 6) * 9
        x === 0 ? ctx.moveTo(w * 0.06 + x, y) : ctx.lineTo(w * 0.06 + x, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'RF at f₀ — perpendicular to B₀', w * 0.06, cy - h * 0.32, a1, YELLOW, 'left', 11)
      // the vector tipping from longitudinal to transverse
      const flip = ease((p - 0.35) / 0.6) * (Math.PI / 2)
      const len = h * 0.32
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(ACC, 1); ctx.lineWidth = 3.2
      const ex = cx + Math.sin(flip) * len, ey = cy - Math.cos(flip) * len
      ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(ex, ey); ctx.stroke()
      ctx.fillStyle = rgba(ACC, 1)
      ctx.beginPath(); ctx.arc(ex, ey, 4.2, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      label(ctx, 'transverse plane — signal', w * 0.94, cy, ease((p - 0.7) / 0.3), ACC, 'right', 11.5)
    },
  },
  {
    id: 'relax',
    title: 'Switch the pulse off and two things happen — independently',
    body: 'The moment the RF stops, **two separate processes** run at once, and keeping them apart is most of MRI physics. **Transverse magnetisation is lost** as spins dephase — they fall out of step with each other. **Longitudinal magnetisation recovers** as spins return to the original spin-up/spin-down balance. They are driven by different mechanisms and have different time constants.',
    numbers: 'Transverse loss = **T2 and T2-star** decay. Longitudinal recovery = **T1** relaxation. The time constant is the time to reach **63%** of the change.',
    loop: true,
    draw: (ctx, w, h, p, t) => {
      const gx = w * 0.1, gw = w * 0.36, gy = h * 0.22, gh = h * 0.56
      // T2 decay, left
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke()
      ctx.strokeStyle = rgba('#ff7ad1', 0.95); ctx.lineWidth = 2.4
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const y = gy + gh - gh * Math.exp(-f * 3.1)
        i === 0 ? ctx.moveTo(gx, gy) : ctx.lineTo(gx + f * gw, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'TRANSVERSE  lost  (T2)', gx, gy - 14, p, '#ff7ad1', 'left', 11)
      // T1 recovery, right
      const rx = w * 0.56
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.25); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(rx, gy); ctx.lineTo(rx, gy + gh); ctx.lineTo(rx + gw, gy + gh); ctx.stroke()
      ctx.strokeStyle = rgba(ACC, 0.95); ctx.lineWidth = 2.4
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const f = i / 60
        const y = gy + gh - gh * (1 - Math.exp(-f * 2.4))
        i === 0 ? ctx.moveTo(rx, gy + gh) : ctx.lineTo(rx + f * gw, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'LONGITUDINAL  recovers  (T1)', rx, gy - 14, p, ACC, 'left', 11)
      const pulse = 0.35 + 0.65 * Math.abs(Math.sin(t * 1.5))
      label(ctx, 'independent processes', w / 2, h * 0.93, p * pulse, INK, 'center', 11)
    },
  },
  {
    id: 'fid',
    title: 'Dephasing: true T2, and the faster T2* you actually measure',
    body: 'Transverse signal dies because spins **lose phase coherence**. Two things cause it: **spin–spin interactions** within the tissue — that is true **T2** — and **inhomogeneity in the magnet itself**, which dephases spins further. The two together give the rapid decay you actually observe, called **free induction decay (FID)**, and its time constant is **T2-star**. A **180° refocusing pulse** cancels the inhomogeneity component and recovers the signal back up to the true T2 curve.',
    trap: 'T2* is always **faster** (shorter) than T2, because it contains an extra source of dephasing. Gradient echo has no 180° pulse, so it images T2*; spin echo has one, so it images true T2.',
    draw: (ctx, w, h, p, t) => {
      const cx = w / 2, cy = h * 0.42, r = Math.min(w, h) * 0.2
      ctx.save(); ctx.globalAlpha = p * 0.35
      ctx.strokeStyle = rgba(INK, 0.5); ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      const spread = ease(p) * 1.5
      for (let i = 0; i < 7; i++) {
        const off = (i - 3) * spread * 0.28
        const ang = t * 2 + off
        ctx.save(); ctx.globalAlpha = p * 0.9
        ctx.strokeStyle = rgba(i === 3 ? ACC : '#ff7ad1', i === 3 ? 0.95 : 0.55)
        ctx.lineWidth = i === 3 ? 2.4 : 1.5
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r); ctx.stroke()
        ctx.restore()
      }
      label(ctx, 'spins losing phase coherence', cx, cy + r + 26, p, INK, 'center', 11)
      label(ctx, 'T2  = spin–spin  ·  T2* = T2 + field inhomogeneity', cx, h * 0.86, ease((p - 0.4) / 0.6), ACC, 'center', 12)
    },
  },
  {
    id: 'tetr',
    title: 'TE and TR are the two dials that make contrast',
    body: 'Tissues differ in how fast they lose transverse signal and how fast they recover longitudinal signal. Two timing parameters convert those differences into image contrast. **TR (repetition time)** is the gap between excitations, and it controls how much **T1** difference is allowed to show. **TE (echo time)** is when you sample, and it controls how much **T2** difference has developed. Everything about weighting follows from those two sentences.',
    numbers: 'Short TR → **T1-weighted**. Long TE → **T2-weighted**. Long TR + short TE → **proton density**.',
    trap: 'Short TE with long TR gives high signal but very little of either contrast — that is proton-density weighting, where brightness mostly reflects how many protons are in the voxel.',
    draw: (ctx, w, h, p) => {
      const bx = w * 0.1, bw = w * 0.8, by = h * 0.3
      const rows: [string, string, string][] = [
        ['T1-weighted', 'short TR', 'short TE'],
        ['T2-weighted', 'long TR', 'long TE'],
        ['Proton density', 'long TR', 'short TE'],
      ]
      rows.forEach((row, i) => {
        const a = ease((p - i * 0.14) / 0.5)
        const y = by + i * h * 0.19
        ctx.save(); ctx.globalAlpha = a * 0.14
        ctx.fillStyle = rgba(ACC, 1); ctx.fillRect(bx, y - h * 0.06, bw, h * 0.13); ctx.restore()
        label(ctx, row[0], bx + 14, y, a, ACC, 'left', 13)
        label(ctx, row[1], bx + bw * 0.5, y, a, INK, 'center', 12)
        label(ctx, row[2], bx + bw * 0.82, y, a, INK, 'center', 12)
      })
      label(ctx, 'TR  →  T1 contrast', bx + bw * 0.5, by - h * 0.13, p, INK, 'center', 11)
      label(ctx, 'TE  →  T2 contrast', bx + bw * 0.82, by - h * 0.13, p, INK, 'center', 11)
    },
  },
  {
    id: 'hardware',
    title: 'The machine: four coils, and a magnet kept at 4 kelvin',
    body: 'From the outside in: the **main coil (blue)** creates B₀; **shim coils (pink and orange)** correct it until the field is homogeneous; **gradient coils (purple)** deliberately tilt the field across an axis so that position becomes frequency — this is what localises signal at all; and the **radiofrequency coils (yellow)** transmit the excitation pulse and receive the returning signal.\n\nThe main coil is bathed in **liquid helium**. Below its transition temperature the wire becomes **superconducting** — resistance falls to zero, so an enormous current can circulate and hold a huge field with no power input. Lose superconductivity and resistance returns, the wire heats, the helium boils and vents explosively: a **quench**.',
    numbers: 'Superconducting transition around **4 K**. Gradient coils localise signal; shim coils only improve homogeneity.',
    draw: (ctx, w, h, p) => {
      // A: nested coil cylinders, external to internal
      const cx = w * 0.27, cy = h * 0.5
      const rings: [string, number][] = [[BLUE, 1], [PINK, 0.82], [ORANGE, 0.7], [PURPLE, 0.56], [YELLOW, 0.4]]
      rings.forEach(([colour, scale], i) => {
        const a = ease((p - i * 0.09) / 0.5)
        const rx = w * 0.085 * scale, ry = h * 0.26 * scale
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = rgba(colour, 0.9); ctx.lineWidth = 2
        for (let k = -3; k <= 3; k++) {
          ctx.beginPath()
          ctx.ellipse(cx + k * w * 0.028, cy, rx * 0.34, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
        }
        ctx.restore()
      })
      label(ctx, 'A', w * 0.09, h * 0.16, p, PURPLE, 'left', 13)
      const legend: [string, string][] = [
        ['main coil', BLUE], ['shim coils', PINK], ['gradient coils', PURPLE], ['RF coils', YELLOW],
      ]
      legend.forEach(([name, colour], i) => {
        const a = ease((p - 0.3 - i * 0.07) / 0.5)
        label(ctx, `— ${name}`, w * 0.09, h * 0.72 + i * 16, a, colour, 'left', 10.5)
      })
      // B: resistance against temperature
      const gx = w * 0.56, gw = w * 0.34, gy = h * 0.26, gh = h * 0.42
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke(); ctx.restore()
      label(ctx, 'B', gx - 22, h * 0.16, p, PURPLE, 'left', 13)
      label(ctx, 'RESISTANCE', gx - 6, gy - 12, p, INK, 'left', 9.5)
      label(ctx, 'TEMPERATURE', gx + gw, gy + gh + 18, p, INK, 'right', 9.5)
      // non-superconductor: never reaches zero
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.55); ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 50; i++) {
        const f = i / 50
        const y = gy + gh - gh * (0.24 + f * f * 0.6)
        i === 0 ? ctx.moveTo(gx, y) : ctx.lineTo(gx + f * gw, y)
      }
      ctx.stroke()
      // superconductor: drops to zero below Tc
      ctx.strokeStyle = rgba(ACC, 0.95)
      ctx.beginPath()
      const tc = 0.16
      ctx.moveTo(gx + tc * gw, gy + gh)
      for (let i = 0; i <= 50; i++) {
        const f = tc + (i / 50) * (1 - tc)
        const y = gy + gh - gh * ((f - tc) * (f - tc) * 0.75)
        ctx.lineTo(gx + f * gw, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'non-superconductor', gx + gw, gy + 6, ease((p - 0.4) / 0.6), INK, 'right', 9.5)
      label(ctx, 'superconductor', gx + gw, gy + gh * 0.62, ease((p - 0.5) / 0.6), ACC, 'right', 9.5)
      label(ctx, '4 K  Tc', gx + tc * gw, gy + gh + 14, ease((p - 0.6) / 0.4), ACC, 'center', 10)
    },
  },
]

export default function MriCoreLesson() {
  return (
    <LessonPage
      meta={{
        title: 'MRI Core Physics',
        accent: ACC,
        kicker: 'MRI · before the sequences',
        intro:
          'Where the signal comes from, before any sequence exists: hydrogen and spin, precession and the Larmor frequency, the net magnetisation vector, resonance, the two relaxations, and the hardware that makes the field.',
        backTo: { label: 'MRI course', to: '/mri-lab/course' },
        next: nextInChain('/mri-lab/core'),
      }}
      steps={STEPS}
    />
  )
}
