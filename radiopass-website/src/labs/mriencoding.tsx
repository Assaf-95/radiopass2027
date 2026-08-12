/**
 * MRI Spatial Encoding — how a signal from the whole slice becomes a picture.
 *
 * The core-physics module ends with a signal that has no address: the receiver
 * coil hears one summed voltage from everything that was excited. This module
 * is the answer to "so where did each part of it come from" — the three
 * gradients in the order they are played, the Fourier transform that reads
 * them back, k-space as the place the measurements actually live, and the two
 * artefacts that fall straight out of the sampling (aliasing and chemical
 * shift).
 *
 * Same lesson player as CT, nuclear medicine and MRI core physics.
 */

import { C, rgba, clamp } from '../home/fx'
import { LessonPage, type LessonStep } from './lesson'
import { nextInChain } from './seq/shared'

const ACC = '#A99EDB'
const INK = C.ink
const BLUE = '#6ea8ff'
const PINK = '#ff7ad1'
const AMBER = '#ffab5e'

const ease = (v: number) => { const c = clamp(v); return c * c * (3 - 2 * c) }

function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, a: number, colour = INK, align: CanvasTextAlign = 'left', size = 11) {
  if (a <= 0.02) return
  ctx.save()
  ctx.globalAlpha = a
  ctx.font = `600 ${size}px Inter, system-ui, sans-serif`
  ctx.fillStyle = rgba(colour, 0.85)
  ctx.textAlign = align
  ctx.textBaseline = 'middle'
  ctx.fillText(text, x, y)
  ctx.restore()
}

/** A patient outline lying along z, drawn side-on. */
function body(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number) {
  ctx.save()
  ctx.globalAlpha = a
  ctx.strokeStyle = rgba(INK, 0.4)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2)
  ctx.stroke()
  ctx.restore()
}

/** A gradient ramp: field strength rising along an axis, drawn as a wedge. */
function gradientWedge(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, a: number, colour: string, vertical = false) {
  ctx.save()
  ctx.globalAlpha = a * 0.5
  const g = vertical
    ? ctx.createLinearGradient(0, y, 0, y + h)
    : ctx.createLinearGradient(x, 0, x + w, 0)
  g.addColorStop(0, rgba(colour, 0.05))
  g.addColorStop(1, rgba(colour, 0.55))
  ctx.fillStyle = g
  ctx.fillRect(x, y, w, h)
  ctx.restore()
}

const STEPS: LessonStep[] = [
  {
    id: 'problem',
    title: 'The receiver hears one voice, not a picture',
    body: 'After the RF pulse, every excited proton in the slice is precessing at the **same frequency and in phase**. The coil adds them all together into a **single voltage** — one number changing over time. Nothing in that signal says which part of the patient it came from.\n\nSpatial encoding is the fix: **deliberately make position change frequency and phase**, so that the one summed signal can be taken apart again afterwards.',
    draw: (ctx, w, h, p) => {
      body(ctx, w * 0.12, h * 0.3, w * 0.34, h * 0.4, p)
      for (let i = 0; i < 12; i++) {
        const a = ease((p - i * 0.03) / 0.4)
        const x = w * 0.16 + (i % 4) * w * 0.075
        const y = h * 0.38 + Math.floor(i / 4) * h * 0.1
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = rgba(ACC, 0.8); ctx.lineWidth = 1.8
        ctx.beginPath(); ctx.moveTo(x, y + 9); ctx.lineTo(x, y - 9); ctx.stroke(); ctx.restore()
      }
      label(ctx, 'all the same frequency · all in phase', w * 0.29, h * 0.78, p, INK, 'center', 11)
      // one summed trace out to the right
      const a2 = ease((p - 0.3) / 0.6)
      ctx.save(); ctx.globalAlpha = a2
      ctx.strokeStyle = rgba(BLUE, 0.9); ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 90; i++) {
        const t = i / 90
        const x = w * 0.56 + t * w * 0.36
        const y = h * 0.5 + Math.sin(t * 26) * h * 0.13 * Math.exp(-t * 1.6)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'ONE summed signal — no address', w * 0.74, h * 0.76, a2, BLUE, 'center', 12)
    },
  },
  {
    id: 'slice',
    title: 'Slice selection: a gradient makes only one plane resonate',
    body: 'Play a gradient along the patient\'s long axis (**Gz**) during the RF pulse. Field strength now varies **linearly along z**, so — since f₀ = γB₀ — the **precessional frequency varies linearly along z** too.\n\nResonance is fussy: only spins whose frequency **matches the frequencies in the RF pulse** absorb energy. So only one plane is excited. Everything above and below it is left alone.',
    numbers: 'Slice thickness = **transmit bandwidth ÷ gradient strength**. A steeper gradient or a narrower bandwidth gives a **thinner** slice.',
    trap: 'A second, equal and opposite rephasing lobe follows the slice-select gradient. Without it, spins across the thickness of the slice would be left with a spread of phase — and the signal you just excited would partly cancel itself.',
    draw: (ctx, w, h, p) => {
      gradientWedge(ctx, w * 0.12, h * 0.24, w * 0.62, h * 0.52, p, BLUE)
      body(ctx, w * 0.12, h * 0.24, w * 0.62, h * 0.52, p)
      label(ctx, 'Gz  — field rises along z →', w * 0.12, h * 0.17, p, BLUE, 'left', 11)
      // the excited slice
      const a2 = ease((p - 0.35) / 0.5)
      const sx = w * 0.46
      ctx.save(); ctx.globalAlpha = a2
      ctx.fillStyle = rgba(ACC, 0.3)
      ctx.fillRect(sx - w * 0.028, h * 0.24, w * 0.056, h * 0.52)
      ctx.strokeStyle = rgba(ACC, 0.95); ctx.lineWidth = 1.6
      ctx.strokeRect(sx - w * 0.028, h * 0.24, w * 0.056, h * 0.52)
      ctx.restore()
      label(ctx, 'only this plane matches the RF', sx, h * 0.83, a2, ACC, 'center', 11.5)
      label(ctx, 'lower f', w * 0.13, h * 0.87, p, INK, 'left', 10)
      label(ctx, 'higher f', w * 0.73, h * 0.87, p, INK, 'right', 10)
    },
  },
  {
    id: 'frequency',
    title: 'Frequency encoding: position along x becomes pitch',
    body: 'The slice is now a two-dimensional sheet, and both directions still need addresses. Play a second gradient (**Gx**) **during readout**, at the echo. Spins now precess at a frequency that depends on **where they sit along x**.\n\nThe returning signal is therefore a **chord, not a note** — many frequencies at once. A **Fourier transform** separates that chord back into its component frequencies and their amplitudes, and because frequency maps to position, that is a profile along x.',
    trap: 'Frequency encoding is applied **during** the echo readout — that is why the frequency-encoding direction is also called the readout direction.',
    draw: (ctx, w, h, p) => {
      gradientWedge(ctx, w * 0.1, h * 0.2, w * 0.5, h * 0.4, p, AMBER)
      label(ctx, 'Gx during readout', w * 0.1, h * 0.14, p, AMBER, 'left', 11)
      for (let i = 0; i < 5; i++) {
        const a = ease((p - i * 0.06) / 0.4)
        const x = w * 0.14 + i * w * 0.1
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = rgba(ACC, 0.9); ctx.lineWidth = 1.6
        ctx.beginPath()
        for (let k = 0; k <= 40; k++) {
          const t = k / 40
          const yy = h * 0.28 + t * h * 0.24
          const xx = x + Math.sin(t * (7 + i * 4) * Math.PI) * 5
          k === 0 ? ctx.moveTo(xx, yy) : ctx.lineTo(xx, yy)
        }
        ctx.stroke(); ctx.restore()
        label(ctx, `f${i + 1}`, x, h * 0.58, a, INK, 'center', 9.5)
      }
      label(ctx, 'each column its own frequency', w * 0.34, h * 0.68, p, INK, 'center', 11)
      // Fourier arrow to a profile
      const a3 = ease((p - 0.5) / 0.5)
      label(ctx, 'Fourier transform →', w * 0.64, h * 0.4, a3, PINK, 'left', 11.5)
      ctx.save(); ctx.globalAlpha = a3
      ctx.strokeStyle = rgba(PINK, 0.9); ctx.lineWidth = 2
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const t = i / 60
        const x = w * 0.64 + t * w * 0.28
        const peak = Math.exp(-Math.pow((t - 0.35) * 5, 2)) + 0.7 * Math.exp(-Math.pow((t - 0.7) * 6, 2))
        const y = h * 0.66 - peak * h * 0.14
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.stroke(); ctx.restore()
      label(ctx, 'a profile along x', w * 0.78, h * 0.74, a3, PINK, 'center', 11)
    },
  },
  {
    id: 'phase',
    title: 'Phase encoding: the slow axis, one line per TR',
    body: 'The third direction (**y**) cannot also use frequency — frequency is already spoken for. Instead a gradient (**Gy**) is switched on **briefly, before readout**. While it is on, spins along y precess at different rates; when it switches off they all return to the same frequency but are left **holding different phases**.\n\nOne phase-encoding strength gives one line of data. The sequence repeats with a **different Gy every TR** until enough lines exist to solve for y.',
    numbers: 'Number of phase-encoding steps sets **y-axis resolution** — and, because it costs one TR each, it is the main driver of **scan time**.',
    trap: 'This is why phase encoding is the slow axis, and why motion artefact smears along the phase-encoding direction: the lines were acquired seconds apart, so anything that moved between them is inconsistent.',
    draw: (ctx, w, h, p) => {
      gradientWedge(ctx, w * 0.14, h * 0.18, w * 0.34, h * 0.5, p, PINK, true)
      label(ctx, 'Gy, briefly, before readout', w * 0.14, h * 0.12, p, PINK, 'left', 11)
      for (let i = 0; i < 5; i++) {
        const a = ease((p - i * 0.07) / 0.4)
        const y = h * 0.24 + i * h * 0.1
        const ang = ease(p) * (i - 2) * 0.85
        ctx.save(); ctx.globalAlpha = a
        ctx.strokeStyle = rgba(ACC, 0.9); ctx.lineWidth = 1.9
        ctx.translate(w * 0.31, y); ctx.rotate(ang)
        ctx.beginPath(); ctx.moveTo(0, 10); ctx.lineTo(0, -10); ctx.stroke()
        ctx.restore()
      }
      label(ctx, 'same frequency, different phase', w * 0.31, h * 0.76, p, INK, 'center', 11)
      const a2 = ease((p - 0.45) / 0.5)
      label(ctx, 'one Gy  =  one line of data', w * 0.74, h * 0.36, a2, PINK, 'center', 12)
      label(ctx, 'repeat every TR', w * 0.74, h * 0.48, a2, INK, 'center', 11)
      label(ctx, 'more steps → finer y, longer scan', w * 0.74, h * 0.6, ease((p - 0.6) / 0.4), INK, 'center', 11)
    },
  },
  {
    id: 'kspace',
    title: 'k-space is where the measurements live — not the image',
    body: 'Every readout is stored as a row in **k-space**. k-space is **not a picture of the patient**, and this is the point most often got wrong: **each point in k-space holds information from every pixel in the image**, and **every pixel in the image is calculated from every point in k-space**. There is no one-to-one correspondence.\n\nA **2D Fourier transform** of the whole of k-space produces the image.',
    numbers: 'Centre of k-space = low phase-encode strength = **high amplitude, low spatial frequency** → **contrast**. Periphery = **edges and fine detail**.',
    trap: 'Do not say "the middle of k-space is the middle of the image". The centre carries image **contrast**; the periphery carries **resolution**. Every point contributes to every pixel.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.3, cy = h * 0.48, s = Math.min(w, h) * 0.3
      ctx.save(); ctx.globalAlpha = p
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, s)
      g.addColorStop(0, rgba(ACC, 0.85)); g.addColorStop(0.25, rgba(ACC, 0.22)); g.addColorStop(1, rgba(ACC, 0.03))
      ctx.fillStyle = g
      ctx.fillRect(cx - s, cy - s, s * 2, s * 2)
      ctx.strokeStyle = rgba(INK, 0.3); ctx.lineWidth = 1
      ctx.strokeRect(cx - s, cy - s, s * 2, s * 2)
      ctx.restore()
      label(ctx, 'k-SPACE', cx, cy - s - 16, p, ACC, 'center', 12)
      label(ctx, 'centre → contrast', cx, cy + s + 18, ease((p - 0.3) / 0.5), ACC, 'center', 11)
      label(ctx, 'periphery → detail', cx, cy + s + 36, ease((p - 0.45) / 0.5), INK, 'center', 11)
      const a2 = ease((p - 0.55) / 0.45)
      label(ctx, '2D Fourier transform', w * 0.62, cy - 22, a2, PINK, 'left', 12)
      label(ctx, '→', w * 0.62, cy, a2, PINK, 'left', 20)
      label(ctx, 'every point feeds every pixel', w * 0.62, cy + 26, a2, INK, 'left', 11)
    },
  },
  {
    id: 'aliasing',
    title: 'Aliasing: sampling too slowly wraps the outside in',
    body: 'The gradient spreads a range of frequencies across the field of view; the highest of them is the **Nyquist limit**. To record a frequency faithfully the signal must be sampled **at least twice per wavelength** — so the sampling rate must be **twice the Nyquist frequency**.\n\nTissue lying **outside the field of view** still sits on the gradient, so it produces frequencies **above** that limit. Undersampled, they are misread as **lower** frequencies — and are drawn back inside the image, wrapped round to the opposite side.',
    numbers: 'Fixes: **increase the field of view**, **oversample** in frequency or phase, **swap the encoding axes**, use **parallel imaging**, **anti-aliasing software**, or **pre-saturation bands** outside the field of view.',
    draw: (ctx, w, h, p) => {
      const fx = w * 0.2, fw = w * 0.36, fy = h * 0.26, fh = h * 0.46
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.45); ctx.lineWidth = 1.4
      ctx.strokeRect(fx, fy, fw, fh); ctx.restore()
      label(ctx, 'FIELD OF VIEW', fx + fw / 2, fy - 14, p, INK, 'center', 10.5)
      // tissue outside
      const a1 = ease((p - 0.2) / 0.4)
      ctx.save(); ctx.globalAlpha = a1
      ctx.fillStyle = rgba(AMBER, 0.5)
      ctx.beginPath(); ctx.ellipse(fx + fw + w * 0.05, fy + fh * 0.4, w * 0.035, h * 0.07, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      label(ctx, 'outside the FOV', fx + fw + w * 0.05, fy + fh * 0.4 + h * 0.13, a1, AMBER, 'center', 10)
      // wrapped copy inside, on the opposite edge
      const a2 = ease((p - 0.5) / 0.5)
      ctx.save(); ctx.globalAlpha = a2 * 0.8
      ctx.fillStyle = rgba(AMBER, 0.5)
      ctx.beginPath(); ctx.ellipse(fx + w * 0.03, fy + fh * 0.4, w * 0.035, h * 0.07, 0, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      label(ctx, 'wrapped in', fx + w * 0.03, fy + fh * 0.4 + h * 0.13, a2, AMBER, 'center', 10)
      label(ctx, 'sample ≥ 2× the Nyquist frequency', w * 0.72, h * 0.42, p, ACC, 'center', 12)
      label(ctx, 'undersampled → read as lower f', w * 0.72, h * 0.54, ease((p - 0.4) / 0.5), INK, 'center', 11)
    },
  },
  {
    id: 'chemshift',
    title: 'Chemical shift: fat and water disagree about frequency',
    body: 'Position is read off frequency — so anything else that changes frequency will be misread as position. At a molecular level, **electron shielding** means the local field in fat differs slightly from that in water, so **water protons precess slightly faster than fat protons in the same magnet**.\n\nThat difference is **chemical shift**: about **3.5 parts per million**, or 3.5 Hz per MHz. The scanner, knowing only frequency, places fat and water signal at **slightly different positions along the frequency-encoding axis** — a bright and a dark rim at fat–water borders.',
    numbers: 'Fat–water shift ≈ **3.5 ppm**. Larger at higher field. **Increasing the receiver bandwidth reduces** chemical-shift artefact.',
    trap: 'The misregistration is along the **frequency-encoding** axis only — swapping the encoding directions moves the artefact rather than removing it.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.3, cy = h * 0.48, r = Math.min(w, h) * 0.17
      ctx.save(); ctx.globalAlpha = p
      ctx.strokeStyle = rgba(INK, 0.4); ctx.lineWidth = 1.2
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke(); ctx.restore()
      // the two shifted copies
      const off = ease((p - 0.3) / 0.6) * r * 0.3
      ctx.save(); ctx.globalAlpha = p * 0.55
      ctx.fillStyle = rgba(BLUE, 0.5)
      ctx.beginPath(); ctx.arc(cx - off, cy, r * 0.92, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = rgba(AMBER, 0.5)
      ctx.beginPath(); ctx.arc(cx + off, cy, r * 0.92, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      label(ctx, 'water', cx - r * 1.5, cy, p, BLUE, 'right', 11)
      label(ctx, 'fat', cx + r * 1.5, cy, p, AMBER, 'left', 11)
      label(ctx, 'shifted along the readout axis', cx, cy + r + 26, ease((p - 0.4) / 0.5), INK, 'center', 11)
      label(ctx, '≈ 3.5 ppm', w * 0.72, h * 0.4, p, ACC, 'center', 16)
      label(ctx, 'wider receiver bandwidth → less shift', w * 0.72, h * 0.54, ease((p - 0.5) / 0.5), INK, 'center', 11)
    },
  },
  {
    id: 'bandwidth',
    title: 'Receiver bandwidth: the trade you make to fix it',
    body: 'Receiver bandwidth is the **range of frequencies spread across the field of view** by the readout gradient. Widening it means each pixel covers more hertz, so a fixed chemical-shift difference displaces the signal by **fewer pixels** — the artefact shrinks.\n\nBut a wider bandwidth also means a **shorter sampling interval (dwell time)** and more noise admitted per pixel. **Signal-to-noise falls.** That is the whole trade: chemical shift and SNR pull in opposite directions.',
    numbers: 'Wider bandwidth → **less chemical shift**, **shorter dwell time**, **lower SNR**. Narrow bandwidth → the reverse.',
    draw: (ctx, w, h, p) => {
      const rows: [string, string, string][] = [
        ['Chemical shift', 'less', 'more'],
        ['Dwell time', 'shorter', 'longer'],
        ['Signal-to-noise', 'lower', 'higher'],
        ['Min TE', 'shorter', 'longer'],
      ]
      const bx = w * 0.14, bw = w * 0.72, by = h * 0.3
      label(ctx, 'WIDE bandwidth', bx + bw * 0.52, by - h * 0.12, p, ACC, 'center', 12)
      label(ctx, 'NARROW bandwidth', bx + bw * 0.84, by - h * 0.12, p, INK, 'center', 12)
      rows.forEach((r, i) => {
        const a = ease((p - i * 0.12) / 0.5)
        const y = by + i * h * 0.13
        ctx.save(); ctx.globalAlpha = a * 0.1
        ctx.fillStyle = rgba(ACC, 1); ctx.fillRect(bx, y - h * 0.045, bw, h * 0.095); ctx.restore()
        label(ctx, r[0], bx + 12, y, a, INK, 'left', 12)
        label(ctx, r[1], bx + bw * 0.52, y, a, ACC, 'center', 12)
        label(ctx, r[2], bx + bw * 0.84, y, a, INK, 'center', 12)
      })
    },
  },
]

export default function MriEncodingLesson() {
  return (
    <LessonPage
      meta={{
        title: 'MRI Spatial Encoding',
        accent: ACC,
        kicker: 'MRI · turning signal into a picture',
        intro:
          'Slice selection, frequency and phase encoding, k-space and the Fourier transform — and the two artefacts that fall straight out of how the signal is sampled: aliasing and chemical shift.',
        backTo: { label: 'MRI course', to: '/mri-lab/course' },
        // Derived from the declared course order, never hand-written. This link
        // used to call itself the next concept while pointing at the T1
        // *laboratory*, which dropped the learner into the full instrument
        // halfway through the course.
        next: nextInChain('/mri-lab/encoding'),
      }}
      steps={STEPS}
    />
  )
}
