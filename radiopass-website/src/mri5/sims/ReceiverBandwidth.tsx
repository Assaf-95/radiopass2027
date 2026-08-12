/**
 * 5.8 — receiver bandwidth.
 *
 * The readout gradient decides how many hertz a millimetre is worth, and the
 * receiver bandwidth is that same number expressed across the whole field of
 * view. One control therefore moves four things at once, and this simulation
 * exists so the reader sees all four move together instead of memorising them
 * as four separate facts.
 *
 * Everything drawn is computed from these, with nothing rounded for effect:
 *
 *   γ̄·G   = BW / FOV                   Hz per millimetre
 *   G      = BW / (γ̄ · FOV)            the gradient the bandwidth demands
 *   pixel bandwidth = BW / matrix      Hz per pixel
 *   dwell  = 1 / BW                    seconds per sample
 *   readout duration = matrix / BW
 *   fat–water separation = 3.5 ppm × γ̄·B₀   223 Hz at 1.5 T, 447 Hz at 3 T
 *   chemical-shift displacement = separation / (γ̄·G)   in millimetres
 *   SNR ∝ 1 / √BW
 *
 * Two things are scaled for the eye and nothing else is. The noise is drawn at
 * an exaggerated absolute level so a change of a few per cent is visible, but
 * its amplitude follows √BW exactly, so the ratio between any two bandwidths on
 * screen is the true ratio. The readout clock runs at 2 ms of scanner time per
 * second of animation, so a 16 ms readout genuinely takes eight times as long
 * to finish as a 2 ms one.
 *
 * The object is a slab of water with a rim of fat on each side. Fat resonates
 * lower than water, so the reconstruction places it lower down the frequency
 * axis — towards −x. On one side that pushes fat into the water and makes a
 * bright band; on the other it pulls fat away and leaves a dark one. That
 * asymmetry is the artefact's signature, and it falls out of the arithmetic
 * rather than being drawn in.
 *
 * The sequence panel is drawn in full rather than as a single lobe, because the
 * readout gradient is preceded by a prephaser of half its area and opposite
 * sign. The accumulated area therefore passes through zero at the centre of the
 * sampling window, and that is where the echo is. The echo drawn there is the
 * magnitude of the Fourier transform of the object — see ECHO_MM below — so it
 * is a narrow spike rather than the broad hump textbook diagrams draw. That is
 * the truth: for an object this wide, every column is in phase for only a small
 * fraction of the readout.
 */

import { useMemo, useState } from 'react'

import { C, clamp, mulberry32, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame } from '../Sim'
import { B0, GAMMA_BAR } from './SliceSelection'

const MRI = C.mri
const FIELD = C.xray
const INK = C.ink
const MUT = C.mut
const WARN = C.amber

/** Field of view along the readout direction, mm. */
const FOV_MM = 240
/** Frequency-encoding matrix. */
const MATRIX = 256
/** Fat resonates 3.5 ppm below water. */
const FAT_PPM = 3.5
/** The bandwidth the other numbers are quoted relative to, Hz. */
const REF_BW = 32000
/** Scanner milliseconds per second of animation. */
const MS_PER_SEC = 2
/**
 * Time axis of the sequence panel, ms.
 *
 * The widest case is the narrowest bandwidth: 16 kHz gives a 16 ms readout, and
 * the prephaser in front of it is half that again — 24 ms end to end.
 */
const T_AXIS = 24
const DURATION = 9

/** The zoomed window used for the profile, mm. */
const ZOOM_A = 20
const ZOOM_B = 100

/** A box with soft edges, so a profile looks like a profile and not a comb. */
const softBox = (x: number, a: number, b: number, s: number) =>
  clamp((x - a) / s) * clamp((b - x) / s)

/** Water fills the middle of the slab. */
const waterAt = (x: number) => 0.62 * softBox(x, -45, 45, 2.5)
/** Fat sits as a rim on both sides. */
const fatAt = (x: number) => softBox(x, 45, 85, 2.5) + softBox(x, -85, -45, 2.5)

/** Half-widths of the object, mm: water out to 45, fat out to 85. */
const WATER_MM = 45
const FAT_MM = 85

/**
 * The echo, as the magnitude of the transform of the object.
 *
 * The signal at time Δt from the centre of the readout is the transform of the
 * profile evaluated at k = γ̄·G·Δt cycles per millimetre. Treating the object as
 * three hard-edged boxes — water ±45 mm at 0.62, fat 45–85 mm and −85 to −45 mm
 * at 1.0 — the integral is exact and symmetric, so the imaginary part cancels:
 *
 *   S(k) = [ sin(2πk·85) − 0.38·sin(2πk·45) ] / (πk),   S(0) = 135.8 mm
 *
 * One consequence is worth noticing, because it is why this can be a constant
 * rather than a per-frame calculation: k at the edge of the sampling window is
 * γ̄·G · (readout/2) = (BW/FOV) · (matrix/2BW) = matrix / (2·FOV), which does not
 * contain the bandwidth at all. Widening the bandwidth steepens the gradient and
 * shortens the readout by exactly the same factor, so the echo keeps the same
 * shape within the window however fast you sample.
 */
const echoAt = (u: number) => {
  const k = (MATRIX / (2 * FOV_MM)) * u
  if (Math.abs(k) < 1e-9) return 1
  const s = (Math.sin(2 * Math.PI * k * FAT_MM) - 0.38 * Math.sin(2 * Math.PI * k * WATER_MM)) / (Math.PI * k)
  return Math.abs(s) / (2 * FAT_MM - 0.38 * 2 * WATER_MM)
}

export function ReceiverBandwidthSim() {
  const [bwKHz, setBwKHz] = useState(32)
  const [tesla, setTesla] = useState<'1.5' | '3'>('1.5')

  const bw = bwKHz * 1000
  const field = tesla === '3' ? 3 : B0
  /** Fat–water separation in Hz: 3.5 ppm of the Larmor frequency. */
  const fatHz = FAT_PPM * GAMMA_BAR * field
  const perMm = bw / FOV_MM
  const gReq = perMm / GAMMA_BAR
  const pixelHz = bw / MATRIX
  const dwellUs = 1e6 / bw
  const readoutMs = (MATRIX / bw) * 1000
  const shiftMm = fatHz / perMm
  const shiftPx = fatHz / pixelHz
  const relSnr = Math.sqrt(REF_BW / bw)
  /** Exaggerated absolute level; the √BW dependence is exact. */
  const noiseSd = 0.075 * Math.sqrt(bw / REF_BW)

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    const t = frame.still ? DURATION : frame.t
    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'

    const padL = 34
    const padR = 16
    const plotW = Math.max(80, w - padL - padR)

    const top = 8
    const stripTop = top + 13
    const stripH = 26
    const profTop = stripTop + stripH + 16
    // Deep enough for a bipolar waveform: prephaser below the line, readout
    // above it, then the echo and the sampling window under both.
    const timeH = 104
    const profH = Math.max(72, h - profTop - timeH - 22)
    const timeTop = profTop + profH + 16

    const xOfFov = (mm: number) => padL + ((mm + FOV_MM / 2) / FOV_MM) * plotW
    const xOfZoom = (mm: number) => padL + ((mm - ZOOM_A) / (ZOOM_B - ZOOM_A)) * plotW
    const xOfMs = (ms: number) => padL + (ms / T_AXIS) * plotW

    /** A label with a plate behind it, so text never sits on top of a trace. */
    const tag = (
      text: string, x: number, y: number, colour: string, alpha: number,
      align: CanvasTextAlign = 'left',
    ) => {
      const tw = ctx.measureText(text).width
      const x0 = align === 'right' ? x - tw - 4 : align === 'center' ? x - tw / 2 - 4 : x - 4
      ctx.fillStyle = rgba(C.bg, 0.82)
      ctx.fillRect(x0, y - 7, tw + 8, 14)
      ctx.textAlign = align
      ctx.fillStyle = rgba(colour, alpha)
      ctx.fillText(text, x, y)
    }

    // One noise realisation, refreshed a few times a second rather than every
    // frame, so the trace looks like noise instead of strobing.
    const rand = mulberry32(Math.floor(t * 5) * 7919 + 13)
    const noise = () => (rand() + rand() + rand() - 1.5) * 2 * noiseSd

    /* ---------------- the reconstructed image row ---------------- */
    tag(plotW > 380 ? 'THE IMAGE ROW ALONG THE FREQUENCY DIRECTION' : 'THE IMAGE ROW', padL, top + 5, MUT, 0.85)

    const stepPx = 2
    for (let px = 0; px < plotW; px += stepPx) {
      const mm = -FOV_MM / 2 + ((px + stepPx / 2) / plotW) * FOV_MM
      const v = clamp(waterAt(mm) + fatAt(mm + shiftMm) + noise(), 0, 1.7)
      ctx.fillStyle = rgba(MRI, clamp(v * 0.62, 0, 0.95))
      ctx.fillRect(padL + px, stripTop, stepPx, stripH)
    }
    ctx.strokeStyle = rgba(INK, 0.14)
    ctx.lineWidth = 1
    ctx.strokeRect(padL + 0.5, stripTop + 0.5, plotW - 1, stripH - 1)

    // The window magnified underneath.
    ctx.strokeStyle = rgba(FIELD, 0.6)
    ctx.setLineDash([3, 3])
    ctx.beginPath()
    ctx.rect(xOfFov(ZOOM_A), stripTop - 2, xOfFov(ZOOM_B) - xOfFov(ZOOM_A), stripH + 4)
    ctx.stroke()
    ctx.setLineDash([])

    /* ---------------- the profile through the fat–water edge ---------------- */
    const profBase = profTop + profH - 16
    const profTopY = profTop + 14
    // A magnitude image cannot be negative, so noise is folded rather than
    // allowed to run the trace out of the panel.
    const yOf = (v: number) => profBase - (clamp(v, 0, 1.95) / 2) * (profBase - profTopY)

    tag(
      plotW > 380 ? `DETAIL AT THE FAT–WATER EDGE — ${ZOOM_A} TO ${ZOOM_B} mm` : 'FAT–WATER EDGE',
      padL, profTop + 3, MUT, 0.85,
    )

    // The two consequences of the displacement, shaded before the traces.
    if (shiftMm > 0.25) {
      const pileX0 = xOfZoom(45 - shiftMm)
      const pileX1 = xOfZoom(45)
      ctx.fillStyle = rgba(WARN, 0.16)
      ctx.fillRect(pileX0, profTopY, Math.max(1.5, pileX1 - pileX0), profBase - profTopY)
      const voidX0 = xOfZoom(85 - shiftMm)
      const voidX1 = xOfZoom(85)
      ctx.fillStyle = rgba(FIELD, 0.13)
      ctx.fillRect(voidX0, profTopY, Math.max(1.5, voidX1 - voidX0), profBase - profTopY)
    }

    ctx.strokeStyle = rgba(INK, 0.13)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, profBase); ctx.lineTo(padL + plotW, profBase)
    ctx.moveTo(padL, profTopY); ctx.lineTo(padL, profBase)
    ctx.stroke()

    ctx.fillStyle = rgba(MUT, 0.55)
    for (const mm of [20, 40, 60, 80, 100]) {
      const x = xOfZoom(mm)
      ctx.strokeStyle = rgba(INK, 0.13)
      ctx.beginPath(); ctx.moveTo(x, profBase); ctx.lineTo(x, profBase + 4); ctx.stroke()
      // The end labels are pulled inside the plot or they fall off the canvas.
      ctx.textAlign = mm === 20 ? 'left' : mm === 100 ? 'right' : 'center'
      ctx.fillText(mm === 100 ? '100 mm' : `${mm}`, x, profBase + 11)
    }

    // Where the fat actually is.
    ctx.strokeStyle = rgba(MUT, 0.7)
    ctx.lineWidth = 1.3
    ctx.setLineDash([4, 4])
    ctx.beginPath()
    for (let i = 0; i <= 220; i += 1) {
      const mm = ZOOM_A + (i / 220) * (ZOOM_B - ZOOM_A)
      const x = xOfZoom(mm)
      const y = yOf(waterAt(mm) + fatAt(mm))
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.setLineDash([])

    // Where the scanner puts it.
    ctx.strokeStyle = rgba(MRI, 0.95)
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= 220; i += 1) {
      const mm = ZOOM_A + (i / 220) * (ZOOM_B - ZOOM_A)
      const x = xOfZoom(mm)
      const y = yOf(waterAt(mm) + fatAt(mm + shiftMm) + noise())
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // legend, laid out right to left so it cannot collide with the title
    if (plotW > 300) {
      let lx = padL + plotW - 2
      const items: [string, string, boolean][] = [
        ['measured', MRI, false],
        ['true object', MUT, true],
      ]
      for (const [text, colour, dash] of items) {
        const tw = ctx.measureText(text).width
        lx -= tw
        tag(text, lx, profTop + 3, colour, 0.85)
        lx -= 6
        ctx.strokeStyle = rgba(colour, 0.85)
        ctx.lineWidth = 1.8
        ctx.setLineDash(dash ? [3, 3] : [])
        ctx.beginPath(); ctx.moveTo(lx - 13, profTop + 3); ctx.lineTo(lx, profTop + 3); ctx.stroke()
        ctx.setLineDash([])
        lx -= 20
      }
    }

    if (shiftMm > 0.25 && plotW > 260) {
      tag('bright band', xOfZoom(45) + 4, profTopY + 8, WARN, 0.9)
      tag('signal void', xOfZoom(85) - 4, profTopY + 8, FIELD, 0.9, 'right')
    }

    /* ---------------- the readout, as a sequence fragment ---------------- */
    const gBase = timeTop + 40
    const gMax = 20
    // Right-aligned: the gradient's own label lives in the top left of this
    // panel and grows upwards as the lobe gets taller.
    tag(
      plotW > 520
        ? 'THE READOUT — PREPHASER, THEN G_x ON WHILE THE ECHO IS SAMPLED'
        : plotW > 380 ? 'THE READOUT — G_x ON WHILE THE ECHO IS SAMPLED' : 'THE READOUT',
      padL + plotW - 2, timeTop + 5, MUT, 0.85, 'right',
    )

    // The gradient lobe: as tall as the gradient the bandwidth demands, as wide
    // as the readout it has to cover. The prephaser in front of it is half that
    // area with the opposite sign — same height, half the width — so the
    // accumulated area passes through zero at the middle of the readout.
    const gH = (gReq / (100000 / FOV_MM / GAMMA_BAR)) * gMax
    const gW = Math.max(3, xOfMs(readoutMs) - padL)
    const preW = gW / 2
    const x0 = padL + preW
    const adcY = gBase + 34

    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, gBase); ctx.lineTo(padL + plotW, gBase); ctx.stroke()

    for (let ms = 0; ms <= T_AXIS; ms += 4) {
      const x = xOfMs(ms)
      ctx.strokeStyle = rgba(INK, 0.08)
      ctx.beginPath(); ctx.moveTo(x, gBase - gMax - 2); ctx.lineTo(x, gBase + gMax + 2); ctx.stroke()
      ctx.fillStyle = rgba(MUT, 0.5)
      ctx.textAlign = ms === 0 ? 'left' : ms === T_AXIS ? 'right' : 'center'
      ctx.fillText(ms === T_AXIS ? `${ms} ms` : `${ms}`, x, adcY + 20)
    }

    ctx.fillStyle = rgba(FIELD, 0.16)
    ctx.fillRect(padL, gBase, preW, gH)
    ctx.fillRect(x0, gBase - gH, gW, gH)
    ctx.strokeStyle = rgba(FIELD, 0.9)
    ctx.lineWidth = 1.6
    ctx.beginPath()
    ctx.moveTo(padL, gBase)
    ctx.lineTo(padL, gBase + gH)
    ctx.lineTo(x0, gBase + gH)
    ctx.lineTo(x0, gBase - gH)
    ctx.lineTo(x0 + gW, gBase - gH)
    ctx.lineTo(x0 + gW, gBase)
    ctx.lineTo(padL + plotW, gBase)
    ctx.stroke()
    tag(`G_x ${gReq.toFixed(2)} mT/m`, padL + 4, gBase - gH - 8, FIELD, 0.9)
    if (plotW > 380) {
      // Sits under the readout lobe, which is above the line — the space below
      // the line to the right of the prephaser is otherwise empty.
      tag('← prephaser: half the area, opposite sign', x0 + 6, gBase + 13, FIELD, 0.75)
    }

    // The echo, at the one instant when the accumulated area is zero and every
    // column is back in phase. Computed, not drawn in: see echoAt.
    const nEcho = Math.max(101, 2 * Math.ceil(gW) + 1)
    ctx.strokeStyle = rgba(MRI, 0.4)
    ctx.lineWidth = 1.2
    ctx.beginPath()
    for (let i = 0; i < nEcho; i += 1) {
      const u = (i / (nEcho - 1)) * 2 - 1
      const x = x0 + ((u + 1) / 2) * gW
      const y = adcY - echoAt(u) * 11
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.stroke()

    // The sampling window, and one dot for every sixteenth sample.
    ctx.strokeStyle = rgba(MRI, 0.85)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.moveTo(x0, adcY - 5); ctx.lineTo(x0, adcY + 5)
    ctx.moveTo(x0, adcY); ctx.lineTo(x0 + gW, adcY)
    ctx.moveTo(x0 + gW, adcY - 5); ctx.lineTo(x0 + gW, adcY + 5)
    ctx.stroke()

    const cursorMs = Math.min(readoutMs, t * MS_PER_SEC)
    for (let s = 8; s < MATRIX; s += 16) {
      const ms = (s / bw) * 1000
      const x = xOfMs(readoutMs / 2 + ms)
      ctx.fillStyle = rgba(MRI, ms <= cursorMs ? 0.95 : 0.28)
      ctx.beginPath(); ctx.arc(x, adcY, 2.2, 0, Math.PI * 2); ctx.fill()
    }
    const taken = Math.min(MATRIX, Math.floor((cursorMs / 1000) * bw))
    const cursorX = xOfMs(readoutMs / 2 + cursorMs)
    ctx.strokeStyle = rgba(INK, 0.4)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(cursorX, gBase - gH - 4); ctx.lineTo(cursorX, adcY + 7); ctx.stroke()
    tag(
      plotW > 320
        ? `ADC — ${taken} of ${MATRIX} samples, one every ${dwellUs.toFixed(1)} µs`
        : `${taken}/${MATRIX} samples`,
      Math.min(x0 + gW + 8, padL + plotW - 4), adcY,
      MRI, 0.85, x0 + gW + 8 > padL + plotW - 140 ? 'right' : 'left',
    )
  }, [bw, gReq, readoutMs, shiftMm, noiseSd, dwellUs])

  const caption = useMemo(() => (frame: SimFrame) => {
    const t = frame.still ? DURATION : frame.t
    const taken = Math.min(MATRIX, Math.floor(Math.min(readoutMs, t * MS_PER_SEC) / 1000 * bw))
    return `Receiver bandwidth ${bwKHz} kHz across a ${FOV_MM} mm field of view: ${perMm.toFixed(0)} Hz per millimetre, which needs a ${gReq.toFixed(2)} mT/m readout gradient and gives ${pixelHz.toFixed(0)} Hz per pixel. `
      + `At ${field} T fat sits ${fatHz.toFixed(0)} Hz below water, so it is reconstructed ${shiftMm.toFixed(2)} mm — ${shiftPx.toFixed(1)} pixels — towards the low-frequency end: a bright band where it piles into the water and a dark one where it has left. `
      + `The readout takes ${readoutMs.toFixed(1)} ms (${taken} of ${MATRIX} samples so far) and relative SNR is ${relSnr.toFixed(2)}× that of a 32 kHz acquisition.`
  }, [bwKHz, bw, perMm, gReq, pixelHz, field, fatHz, shiftMm, shiftPx, readoutMs, relSnr])

  return (
    <Sim
      label="A water slab with fat rims, its reconstructed image row, the fat–water edge in detail, and the readout gradient and sampling window that produced it"
      draw={draw}
      duration={DURATION}
      size="normal"
      caption={caption}
      readouts={
        <>
          <Readout name="Pixel bandwidth" value={`${pixelHz.toFixed(0)} Hz`} tone="xy" />
          <Readout name="Chemical shift" value={`${shiftPx.toFixed(1)} px · ${shiftMm.toFixed(2)} mm`} tone="rf" />
          <Readout name="Readout duration" value={`${readoutMs.toFixed(1)} ms`} tone="plain" />
          <Readout name="Relative SNR" value={`${relSnr.toFixed(2)}×`} tone="z" />
        </>
      }
      controls={
        <>
          <Slider
            label="Receiver bandwidth"
            value={bwKHz}
            min={16}
            max={100}
            step={2}
            unit="kHz"
            onChange={setBwKHz}
            hint="Widen it: faster sampling, shorter readout, smaller chemical shift — and more noise."
          />
          <Choice
            label="Field strength"
            value={tesla}
            options={[{ value: '1.5', label: '1.5 T' }, { value: '3', label: '3 T' }]}
            onChange={setTesla}
          />
        </>
      }
    />
  )
}
