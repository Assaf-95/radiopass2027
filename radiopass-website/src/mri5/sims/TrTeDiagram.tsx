/**
 * 5.4 — the TR / TE pulse-sequence diagram.
 *
 * Two panels driven by the same two numbers, because TR and TE differ by a
 * factor of ten to a hundred and no single time axis can show both honestly.
 *
 *   Top    a fixed 0–2400 ms ruler carrying however many whole repetitions the
 *          current TR allows — eight at TR = 300 ms, one at TR = 2000 ms, and
 *          the panel title counts them rather than asserting a number.
 *          TR is the distance between successive 90° pulses, so dragging TR
 *          visibly slides the next repetition along a ruler that does not move
 *          underneath it. The long stretch between the echo and the next 90° is
 *          shaded: nothing is measured there, and that is exactly what TR buys.
 *
 *   Bottom one repetition expanded to fill the width, where TE is legible.
 *          TE runs from the centre of the 90° pulse to the CENTRE OF THE ECHO,
 *          and the 180° sits at TE/2 — both drawn from the same numbers, so the
 *          180° cannot drift away from the midpoint however TE is set.
 *
 * The gradient rows are optional and are drawn to real proportions: the
 * slice-select rephasing lobe carries half the area of the slice-select lobe,
 * and the readout dephasing lobe carries the same area as the first half of the
 * readout lobe, which is why the echo lands at the centre of the readout. They
 * are named here and explained in 5.6–5.9.
 *
 * Echo and FID shapes use a nominal T2* of 10 ms, and the echo is drawn at
 * exp(−TE/T2) of the FID's starting height for a nominal T2 of 100 ms — the two
 * quantities here that are stand-ins rather than controls, since this diagram is
 * about timing. They are not decoration: without the second one, dragging TE
 * would cost nothing on screen, and TE would read as free.
 */

import { useMemo, useState } from 'react'

import { C, rgba } from '../../home/fx'
import { Choice, Readout, Sim, Slider, type SimDraw, type SimFrame, type SimStep } from '../Sim'

const INK = C.ink
const MUT = C.mut
const MRI = C.mri
const FIELD = C.xray
const WARN = C.amber

/** Fixed ruler for the repetition view, in milliseconds. */
const AXIS = 2400
const DURATION = 12
/** Nominal T2*, ms — sets the drawn width of the FID and of the echo. */
const T2STAR_NOM = 10
/** Nominal true T2, ms — sets the drawn HEIGHT of the echo, e^(−TE/T2). */
const T2_NOM = 100
/** A conventional 256 × 256 acquisition, one line per TR. */
const PHASE_STEPS = 256

const tickStep = (span: number) => {
  for (const s of [2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000]) if (span / s <= 8) return s
  return 1000
}

const mmss = (ms: number) => {
  const total = Math.round(ms / 1000)
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

export function TrTeDiagram() {
  const [tr, setTr] = useState(1000)   // ms
  const [te, setTe] = useState(80)     // ms
  const [grads, setGrads] = useState<'off' | 'on'>('off')

  const showGrads = grads === 'on'
  const detailHi = Math.max(te * 1.7, 34)
  const scanMs = tr * PHASE_STEPS
  /** What the echo is worth relative to the transverse magnetisation the 90° made. */
  const echoFrac = Math.exp(-te / T2_NOM)

  const steps = useMemo<SimStep[]>(() => {
    const w = (ms: number) => (ms / AXIS) * DURATION
    return [
      { id: 'excite', label: '90° pulse — the repetition starts here', at: 0 },
      { id: 'refocus', label: `180° refocusing pulse at TE/2 = ${(te / 2).toFixed(0)} ms`, at: w(te / 2) },
      { id: 'echo', label: `Echo at TE = ${te} ms — one line of data`, at: w(te) },
      { id: 'wait', label: 'Nothing measured — longitudinal magnetisation recovers', at: w(te + (tr - te) / 2) },
      { id: 'next', label: `Next 90° at TR = ${tr} ms`, at: w(tr) },
      { id: 'again', label: 'Same timings, same echo — one more line', at: w(tr + te) },
    ]
  }, [te, tr])

  const draw = useMemo<SimDraw>(() => (ctx, w, h, frame) => {
    // Reduced motion parks on the second echo, where both TR and TE are visible
    // as measured intervals rather than promises.
    const tMs = frame.still ? tr + te : (frame.t / DURATION) * AXIS

    ctx.font = '500 10px Inter, system-ui, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'

    const padL = 62
    const padR = 14
    // The host draws a step chip over the top-left of the stage; the panel title
    // and the first TR bracket start below it.
    const padT = 46
    const padB = 12
    const plotW = Math.max(80, w - padL - padR)

    // Both panels lead slightly before zero so the 90° pulse is not cut in half.
    const aLo = -AXIS * 0.02
    const bLo = -detailHi * 0.07
    const xA = (ms: number) => padL + ((ms - aLo) / (AXIS - aLo)) * plotW
    const xB = (ms: number) => padL + ((ms - bLo) / (detailHi - bLo)) * plotW

    const total = h - padT - padB
    const gapPanels = 14
    // With the gradient rows showing, the detail panel needs the room more.
    const hA = Math.max(96, total * (showGrads ? 0.34 : 0.44))
    const hB = Math.max(120, total - hA - gapPanels)

    const rowLabel = (text: string, y: number, colour = rgba(MUT, 0.75)) => {
      ctx.fillStyle = colour
      ctx.textAlign = 'right'
      ctx.fillText(text, padL - 8, y)
    }

    const ruler = (span: number, xOf: (ms: number) => number, y: number, top: number) => {
      const st = tickStep(span)
      ctx.textAlign = 'center'
      for (let ms = 0; ms <= span + 0.001; ms += st) {
        const x = xOf(ms)
        if (x > padL + plotW + 1) break
        ctx.strokeStyle = rgba(INK, 0.05)
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(x, top)
        ctx.lineTo(x, y)
        ctx.stroke()
        ctx.fillStyle = rgba(MUT, 0.5)
        ctx.fillText(String(Math.round(ms)), x, y + 8)
      }
      ctx.textAlign = 'right'
      ctx.fillStyle = rgba(MUT, 0.5)
      ctx.fillText('ms', padL + plotW, y + 8)
    }

    /** An RF burst. Flip angle follows the area under B₁, so 180° is twice as tall. */
    const rfPulse = (x: number, base: number, amp: number, halfW: number, text: string) => {
      ctx.strokeStyle = rgba(MRI, 0.95)
      ctx.lineWidth = 1.5
      ctx.beginPath()
      for (let i = 0; i <= 44; i += 1) {
        const u = -1 + (i / 44) * 2
        const env = Math.pow(Math.cos((u * Math.PI) / 2), 2)
        const osc = Math.cos(u * Math.PI * 2.2)
        const y = base - amp * env * (osc > 0 ? osc : osc * 0.45)
        const px = x + u * halfW
        if (i === 0) ctx.moveTo(px, y)
        else ctx.lineTo(px, y)
      }
      ctx.stroke()
      ctx.fillStyle = rgba(MRI, 0.95)
      ctx.textAlign = 'center'
      ctx.fillText(text, x, base - amp - 8)
    }

    /**
     * FID: coherence lost at the nominal T2*, and stopped at the 180° pulse —
     * the free induction period ends there, and at short TE the untruncated
     * curve ran straight through the echo it is supposed to be distinct from.
     */
    const fid = (atMs: number, mid: number, amp: number, xOf: (ms: number) => number, forMs: number) => {
      ctx.strokeStyle = rgba(INK, 0.5)
      ctx.lineWidth = 1.3
      for (const sign of [1, -1]) {
        ctx.beginPath()
        for (let i = 0; i <= 40; i += 1) {
          const dt = (i / 40) * forMs
          const x = xOf(atMs + dt)
          const y = mid - sign * amp * Math.exp(-dt / T2STAR_NOM)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    /** The echo: coherence rebuilt and lost again about its centre. */
    const echo = (atMs: number, mid: number, amp: number, xOf: (ms: number) => number, bright: boolean) => {
      ctx.strokeStyle = rgba(bright ? INK : MUT, bright ? 0.95 : 0.5)
      ctx.lineWidth = 1.6
      for (const sign of [1, -1]) {
        ctx.beginPath()
        for (let i = 0; i <= 64; i += 1) {
          const dt = -T2STAR_NOM * 4 + (i / 64) * T2STAR_NOM * 8
          const x = xOf(atMs + dt)
          const y = mid - sign * amp * Math.exp(-Math.abs(dt) / T2STAR_NOM)
          if (i === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
    }

    const bracket = (x0: number, x1: number, y: number, text: string, colour: string) => {
      const tw = ctx.measureText(text).width
      const mid = (x0 + x1) / 2
      // The label sits inside a gap in the bracket line rather than above it,
      // where it would land on the ruler numbers.
      const inline = x1 - x0 > tw + 24
      ctx.strokeStyle = colour
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x0, y - 5); ctx.lineTo(x0, y + 5)
      ctx.moveTo(x1, y - 5); ctx.lineTo(x1, y + 5)
      if (inline) {
        ctx.moveTo(x0, y); ctx.lineTo(mid - tw / 2 - 7, y)
        ctx.moveTo(mid + tw / 2 + 7, y); ctx.lineTo(x1, y)
      } else {
        ctx.moveTo(x0, y); ctx.lineTo(x1, y)
      }
      ctx.moveTo(x0 + 4, y - 3); ctx.lineTo(x0, y); ctx.lineTo(x0 + 4, y + 3)
      ctx.moveTo(x1 - 4, y - 3); ctx.lineTo(x1, y); ctx.lineTo(x1 - 4, y + 3)
      ctx.stroke()
      ctx.fillStyle = colour
      if (inline) {
        ctx.textAlign = 'center'
        ctx.fillText(text, mid, y)
      } else {
        ctx.textAlign = 'left'
        ctx.fillText(text, Math.min(x1 + 6, padL + plotW - tw), y)
      }
    }

    // Half-width of an RF pulse, in milliseconds. Both panels need it, and the
    // FID has to stop where the 180° starts.
    const bHalfMs = Math.max(0.6, te * 0.05)
    const fidMs = Math.max(1, Math.min(T2STAR_NOM * 4, te / 2 - bHalfMs))

    /* ================= panel A — the repetition view ================= */
    const aTop = padT
    // Counted, not asserted: TR = 300 ms puts eight whole repetitions on this
    // ruler and TR = 2000 ms puts one.
    const nReps = Math.floor(AXIS / tr)
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.textAlign = 'left'
    ctx.fillText(
      `${nReps} REPETITION${nReps === 1 ? '' : 'S'} ON A FIXED RULER — TR IS THE GAP BETWEEN 90° PULSES`,
      padL,
      aTop + 5,
    )

    const aBracketY = aTop + 26
    const aRowsTop = aTop + 38
    const aRulerY = aTop + hA - 12
    const aRowH = Math.max(22, (aRulerY - aRowsTop) / 2)
    const aRfBase = aRowsTop + aRowH
    const aSigMid = aRowsTop + aRowH + aRowH / 2

    // The dead time TR buys: shaded so it reads as duration, not as a caption.
    for (let n = 0; n * tr <= AXIS; n += 1) {
      const from = xA(n * tr + te)
      const to = xA(Math.min((n + 1) * tr, AXIS))
      if (to <= from) continue
      ctx.fillStyle = rgba(FIELD, 0.05)
      ctx.fillRect(from, aRowsTop, to - from, aRowH * 2)
    }

    ruler(AXIS, xA, aRulerY, aRowsTop)

    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(padL, aRfBase); ctx.lineTo(padL + plotW, aRfBase)
    ctx.moveTo(padL, aSigMid); ctx.lineTo(padL + plotW, aSigMid)
    ctx.stroke()
    rowLabel('RF', aRfBase - 8)
    rowLabel('Signal', aSigMid)

    const aRfAmp = Math.max(7, aRowH * 0.3)
    const aSigAmp = Math.max(6, aRowH * 0.32)
    const aHalfW = Math.max(2.5, plotW * 0.004)

    for (let n = 0; n * tr <= AXIS; n += 1) {
      const t0 = n * tr
      rfPulse(xA(t0), aRfBase, aRfAmp, aHalfW, '90°')
      if (t0 + te / 2 <= AXIS) rfPulse(xA(t0 + te / 2), aRfBase, aRfAmp * 2, aHalfW, '180°')
      fid(t0, aSigMid, aSigAmp, xA, fidMs)
      // In the steady state every repetition returns the same echo, so they are
      // drawn the same height as each other — but that height is e^(−TE/T2) of
      // the FID beside it, not the whole of it.
      if (t0 + te <= AXIS) echo(t0 + te, aSigMid, aSigAmp * echoFrac, xA, tMs >= t0 + te)
    }

    // TR brackets. Two are enough to establish that the interval repeats; more
    // than that is a row of overlapping labels.
    for (let n = 0; n < 2 && (n + 1) * tr <= AXIS; n += 1) {
      bracket(xA(n * tr), xA((n + 1) * tr), aBracketY, n === 0 ? `TR = ${tr} ms` : 'TR again', rgba(FIELD, 0.9))
    }

    // Name the shaded stretch once, in the middle of the first one.
    const dead0 = xA(te)
    const dead1 = xA(Math.min(tr, AXIS))
    const deadText = `${(tr - te).toFixed(0)} ms with no measurement — M_z recovers`
    const dtw = ctx.measureText(deadText).width
    if (dead1 - dead0 > dtw + 14) {
      ctx.fillStyle = rgba(FIELD, 0.75)
      ctx.textAlign = 'center'
      ctx.fillText(deadText, (dead0 + dead1) / 2, aRowsTop + aRowH * 2 - 9)
    }

    /* ================= panel B — one repetition, expanded ================= */
    const bTop = aTop + hA + gapPanels
    ctx.fillStyle = rgba(MUT, 0.7)
    ctx.textAlign = 'left'
    ctx.fillText('ONE REPETITION, EXPANDED — TE IS 90° TO THE CENTRE OF THE ECHO', padL, bTop + 5)

    const bRowsTop = bTop + 15
    const bBracketH = 42
    const bRulerY = bTop + hB - bBracketH - 10
    const nRows = showGrads ? 5 : 2
    const bRowH = Math.max(18, (bRulerY - bRowsTop) / nRows)

    // vertical guides at 0, TE/2 and TE
    for (const [ms, colour] of [[0, rgba(MRI, 0.28)], [te / 2, rgba(MRI, 0.28)], [te, rgba(MRI, 0.45)]] as [number, string][]) {
      ctx.strokeStyle = colour
      ctx.lineWidth = 1
      ctx.setLineDash([2, 4])
      ctx.beginPath()
      ctx.moveTo(xB(ms), bRowsTop)
      ctx.lineTo(xB(ms), bRulerY + bBracketH)
      ctx.stroke()
      ctx.setLineDash([])
    }

    ruler(detailHi, xB, bRulerY, bRowsTop)

    let row = 0
    const rowBase = () => bRowsTop + (row + 1) * bRowH
    const rowMid = () => bRowsTop + row * bRowH + bRowH / 2

    // --- RF
    const bRfBase = rowBase()
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, bRfBase); ctx.lineTo(padL + plotW, bRfBase); ctx.stroke()
    rowLabel('RF', bRfBase - 8)
    const bRfAmp = Math.max(7, bRowH * 0.34)
    const bHalfW = Math.max(3, (bHalfMs / (detailHi - bLo)) * plotW)
    rfPulse(xB(0), bRfBase, bRfAmp, bHalfW, '90°')
    rfPulse(xB(te / 2), bRfBase, bRfAmp * 2, bHalfW, '180°')
    row += 1

    /**
     * A trapezoid gradient lobe. Its AREA is what the spins respond to, so the
     * ramp is a fixed FRACTION of the width: a pixel-constant ramp cost a narrow
     * lobe proportionally more area than a wide one, and the half-area rephaser
     * came out at 0.43 of the slice-select lobe instead of 0.50.
     */
    const lobe = (fromMs: number, toMs: number, mid: number, amp: number, colour: string) => {
      const x0 = xB(fromMs)
      const x1 = xB(toMs)
      const ramp = (x1 - x0) * 0.2
      ctx.beginPath()
      ctx.moveTo(x0, mid)
      ctx.lineTo(x0 + ramp, mid - amp)
      ctx.lineTo(x1 - ramp, mid - amp)
      ctx.lineTo(x1, mid)
      ctx.closePath()
      ctx.fillStyle = rgba(colour, 0.16)
      ctx.fill()
      ctx.strokeStyle = rgba(colour, 0.9)
      ctx.lineWidth = 1.3
      ctx.stroke()
    }

    const rw = te * 0.16

    if (showGrads) {
      // --- slice select
      const gsMid = rowMid()
      const gsAmp = Math.max(6, bRowH * 0.3)
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.beginPath(); ctx.moveTo(padL, gsMid); ctx.lineTo(padL + plotW, gsMid); ctx.stroke()
      rowLabel('G slice', gsMid, rgba(FIELD, 0.75))
      lobe(-bHalfMs, bHalfMs, gsMid, gsAmp, FIELD)
      // Half the area, opposite sign: it cancels the phase spread the first lobe
      // created across the thickness of the slice.
      lobe(bHalfMs + te * 0.01, bHalfMs * 2 + te * 0.01, gsMid, -gsAmp, FIELD)
      lobe(te / 2 - bHalfMs, te / 2 + bHalfMs, gsMid, gsAmp, FIELD)
      row += 1

      // --- phase encode
      const gpMid = rowMid()
      const gpAmp = Math.max(6, bRowH * 0.3)
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.beginPath(); ctx.moveTo(padL, gpMid); ctx.lineTo(padL + plotW, gpMid); ctx.stroke()
      rowLabel('G phase', gpMid, rgba(FIELD, 0.75))
      // One amplitude per repetition — the ladder is why there are 256 of them.
      for (let k = -2; k <= 2; k += 1) {
        lobe(te * 0.2, te * 0.36, gpMid, (gpAmp * k) / 2, FIELD)
      }
      row += 1

      // --- readout
      const grMid = rowMid()
      const grAmp = Math.max(6, bRowH * 0.3)
      ctx.strokeStyle = rgba(INK, 0.1)
      ctx.beginPath(); ctx.moveTo(padL, grMid); ctx.lineTo(padL + plotW, grMid); ctx.stroke()
      rowLabel('G read', grMid, rgba(FIELD, 0.75))
      // Equal and opposite to the first half of the readout lobe, so the two
      // areas cancel exactly at the centre of the readout — which is TE.
      lobe(te / 2 + bHalfMs * 1.6, te / 2 + bHalfMs * 1.6 + rw, grMid, -grAmp, FIELD)
      lobe(te - rw, te + rw, grMid, grAmp, FIELD)
      ctx.fillStyle = rgba(FIELD, 0.7)
      ctx.textAlign = 'center'
      ctx.fillText('areas cancel at TE', xB(te), grMid - grAmp - 9)
      row += 1
    }

    // --- signal
    const bSigMid = rowMid()
    ctx.strokeStyle = rgba(INK, 0.12)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(padL, bSigMid); ctx.lineTo(padL + plotW, bSigMid); ctx.stroke()
    rowLabel('Signal', bSigMid)
    const bSigAmp = Math.max(6, bRowH * 0.34)
    fid(0, bSigMid, bSigAmp, xB, fidMs)
    echo(te, bSigMid, bSigAmp * echoFrac, xB, true)
    ctx.textAlign = 'center'
    // The shrinking echo is only readable as physics if the rule is written next
    // to it; otherwise it looks like an arbitrary drawing choice.
    const echoText = plotW > 320 ? `echo — e^(−TE/T2) = ${(echoFrac * 100).toFixed(0)}%` : 'echo'
    const etw = ctx.measureText(echoText).width
    const etx = Math.max(padL + etw / 2, Math.min(xB(te), padL + plotW - etw / 2 - 2))
    // At the short end of the TE range the FID caption would otherwise land to
    // the RIGHT of the echo it precedes, and then collide with its label.
    const ftx = Math.min(xB(T2STAR_NOM * 1.2), xB(te / 2) - 14)
    const clash = Math.abs(etx - ftx) < etw / 2 + ctx.measureText('FID').width / 2 + 6
    ctx.fillStyle = rgba(MUT, 0.75)
    ctx.fillText('FID', ftx, bSigMid - bSigAmp - 9 - (clash ? 12 : 0))
    ctx.fillStyle = rgba(INK, 0.9)
    ctx.fillText(echoText, etx, bSigMid - bSigAmp * echoFrac - 9)

    bracket(xB(0), xB(te / 2), bRulerY + 18, `TE/2 = ${(te / 2).toFixed(0)} ms`, rgba(WARN, 0.9))
    bracket(xB(0), xB(te), bRulerY + 34, `TE = ${te} ms`, rgba(MRI, 0.95))

    /* ================= the playhead ================= */
    const pxA = xA(Math.min(tMs, AXIS))
    ctx.strokeStyle = rgba(INK, 0.3)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(pxA, aRowsTop)
    ctx.lineTo(pxA, aRulerY)
    ctx.stroke()

    // Panel B shows whichever repetition the playhead is inside, so the reader
    // watches the same detail happen twice.
    const inRep = tMs >= tr ? tMs - Math.floor(tMs / tr) * tr : tMs
    if (inRep <= detailHi) {
      const pxB = xB(inRep)
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath()
      ctx.moveTo(pxB, bRowsTop)
      ctx.lineTo(pxB, bRulerY)
      ctx.stroke()
    }
  }, [tr, te, detailHi, showGrads, echoFrac])

  const caption = useMemo(() => (frame: SimFrame) => {
    const tMs = frame.still ? tr + te : (frame.t / DURATION) * AXIS
    const n = Math.floor(tMs / tr)
    const inRep = tMs - n * tr
    // A short TR fits eight repetitions on the ruler, and the caption is the
    // screen reader's only account of which one it is looking at.
    const which = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth'][n] ?? `number ${n + 1}`
    if (inRep < te / 2) {
      return `${tMs.toFixed(0)} ms — ${inRep.toFixed(0)} ms into the ${which} repetition. The 90° pulse has fired; the FID is already fading, and the 180° comes at ${(te / 2).toFixed(0)} ms.`
    }
    if (inRep < te) {
      return `${tMs.toFixed(0)} ms — the 180° pulse has been played at TE/2 = ${(te / 2).toFixed(0)} ms. The echo will peak at TE = ${te} ms, halfway again.`
    }
    if (inRep < te + T2STAR_NOM * 4) {
      return `Echo at ${(n * tr + te).toFixed(0)} ms — TE = ${te} ms after this repetition's 90° pulse. One line of data is collected here, at e^(−TE/T2) = ${(echoFrac * 100).toFixed(0)}% of the height the FID started from, for a tissue with T2 = ${T2_NOM} ms.`
    }
    return `${tMs.toFixed(0)} ms — nothing is being measured. The scanner waits out the rest of TR = ${tr} ms while longitudinal magnetisation recovers, then fires the next 90°. ${PHASE_STEPS} repetitions of this take ${mmss(scanMs)}.`
  }, [tr, te, scanMs, echoFrac])

  return (
    <Sim
      label="Spin echo pulse-sequence diagram: two repetitions on a fixed millisecond ruler, and one repetition expanded to show TE and the 180 pulse at TE over 2"
      draw={draw}
      duration={DURATION}
      steps={steps}
      size="tall"
      caption={caption}
      readouts={
        <>
          <Readout name="TR" value={`${tr} ms`} tone="xy" />
          <Readout name="TE" value={`${te} ms`} tone="rf" />
          <Readout name="180° at" value={`${(te / 2).toFixed(0)} ms`} tone="rf" />
          <Readout name={`Echo, T2 ${T2_NOM} ms`} value={`${(echoFrac * 100).toFixed(0)}%`} tone="plain" />
          <Readout name="Idle each TR" value={`${(tr - te).toFixed(0)} ms`} tone="plain" />
          <Readout name={`Scan, ${PHASE_STEPS} lines`} value={mmss(scanMs)} tone="z" />
        </>
      }
      controls={
        <>
          <Slider
            label="TR — repetition time" value={tr} min={300} max={2000} step={50} unit="ms"
            onChange={setTr}
            hint="The gap between successive 90° pulses. Scan time is TR × the number of phase-encoding steps."
          />
          <Slider
            label="TE — echo time" value={te} min={10} max={150} step={5} unit="ms"
            onChange={setTe}
            hint="90° pulse to the centre of the echo. The 180° tracks it, staying at TE/2."
          />
          <Choice
            label="Gradient rows"
            value={grads}
            options={[{ value: 'off', label: 'hide' }, { value: 'on', label: 'show' }]}
            onChange={setGrads}
          />
        </>
      }
    />
  )
}
