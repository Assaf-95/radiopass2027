/**
 * The pulse–echo stage — the ten events between an electrical pulse and a
 * B-mode pixel, one per guided step, plus the machine's assumptions, the
 * A/B/M-mode comparison and the PRF timing diagram.
 *
 * The tissue is drawn as a slab with receding rails and far-plane copies of
 * each reflector, so the pulse travels through a volume, not down a diagram.
 * The travelling packet's position comes from the guided step's entry progress
 * (`t`), which is what makes each event animate once and then freeze for
 * inspection.
 */

import { useEffect, useRef } from 'react'

import {
  drawArrowHead,
  drawDashedLine,
  drawLabel,
  prepareCanvas,
  UC,
  withAlpha,
} from '../components/theme'
import { depthFromTimeMm, pulseRepetitionPeriodUs, timeFromDepthUs } from '../engine'

export type PulseEchoPhase =
  | 'electrical'
  | 'vibrate'
  | 'enter'
  | 'interface'
  | 'reflect'
  | 'return'
  | 'convert'
  | 'depth'
  | 'amode'
  | 'bmode-sweep'
  | 'assumptions'
  | 'modes'
  | 'prf'
  | 'free'

/** Deterministic hash for the B-mode strip's stable speckle. */
function hash(x: number, y: number): number {
  let h = Math.imul(x + 1, 374761393) + Math.imul(y + 1, 668265263)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export function PulseEchoStage({
  depth1Cm,
  depth2Cm,
  imagingDepthCm,
  prfHz,
  time,
  t,
  phase,
}: {
  depth1Cm: number
  depth2Cm: number
  imagingDepthCm: number
  prfHz: number
  /** Free-running clock in seconds. */
  time: number
  /** Entry progress of the current guided step, 0 → 1 then frozen. */
  t: number
  phase: PulseEchoPhase
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    /* ==================================================================== *
     * Full-canvas diagram phases
     * ==================================================================== */

    if (phase === 'assumptions') {
      drawLabel(ctx, 'THE FOUR WORKING ASSUMPTIONS', width / 2, 26, {
        colour: UC.text,
        align: 'center',
        size: 12.5,
        weight: 700,
      })
      drawLabel(ctx, 'every classic artefact is one of these being violated', width / 2, 44, {
        colour: UC.muted,
        align: 'center',
        size: 10,
      })
      const rows: { rule: string; artefact: string }[] = [
        { rule: 'Sound travels at 1540 m/s everywhere', artefact: 'speed-displacement error' },
        { rule: 'The pulse travels in a straight line', artefact: 'refraction artefact' },
        { rule: 'Echoes come from the main beam only', artefact: 'side-lobe artefact' },
        { rule: 'Attenuation is uniform (or compensated)', artefact: 'shadowing & enhancement' },
      ]
      const rowH = (height - 80) / rows.length
      rows.forEach((row, i) => {
        const y = 66 + rowH * i + rowH / 2
        const appear = Math.min(1, Math.max(0, t * 4 - i))
        ctx.globalAlpha = appear
        ctx.fillStyle = withAlpha(UC.cyan, 0.07)
        ctx.beginPath()
        ctx.roundRect(20, y - rowH / 2 + 6, width - 40, rowH - 12, 8)
        ctx.fill()
        drawLabel(ctx, `${i + 1}.  ${row.rule}`, 34, y - 9, {
          colour: UC.cyan,
          size: 11.5,
          weight: 700,
        })
        drawLabel(ctx, 'when violated →', 52, y + 10, { colour: UC.muted, size: 9.5 })
        drawLabel(ctx, row.artefact.toUpperCase(), width - 38, y + 10, {
          colour: UC.amber,
          align: 'right',
          size: 10.5,
          weight: 700,
        })
        ctx.globalAlpha = 1
      })
      return
    }

    if (phase === 'modes') {
      const panelW = (width - 64) / 3
      const panelTop = 52
      const panelBottom = height - 34
      const panelH = panelBottom - panelTop
      const titles = ['A-MODE — amplitude', 'B-MODE — brightness', 'M-MODE — motion']
      const echoDepths = [0.3, 0.62]

      for (let p = 0; p < 3; p += 1) {
        const x0 = 16 + p * (panelW + 16)
        ctx.fillStyle = withAlpha(UC.panel2, 0.7)
        ctx.beginPath()
        ctx.roundRect(x0, panelTop, panelW, panelH, 6)
        ctx.fill()
        ctx.strokeStyle = withAlpha(UC.white, 0.14)
        ctx.lineWidth = 1
        ctx.stroke()
        drawLabel(ctx, titles[p], x0 + panelW / 2, panelTop - 12, {
          colour: p === 0 ? UC.cyan : p === 1 ? UC.text : UC.green,
          align: 'center',
          size: 10,
          weight: 700,
        })

        if (p === 0) {
          // A-mode: amplitude spikes against depth (vertical axis).
          const baseX = x0 + panelW * 0.3
          ctx.strokeStyle = withAlpha(UC.white, 0.25)
          ctx.beginPath()
          ctx.moveTo(baseX, panelTop + 10)
          ctx.lineTo(baseX, panelBottom - 10)
          ctx.stroke()
          ctx.strokeStyle = UC.cyan
          ctx.lineWidth = 1.8
          ctx.beginPath()
          ctx.moveTo(baseX, panelTop + 10)
          echoDepths.forEach((d, i) => {
            const y = panelTop + 10 + d * (panelH - 20)
            const amp = (panelW * 0.5) * (i === 0 ? 1 : 0.55)
            ctx.lineTo(baseX, y - 5)
            ctx.lineTo(baseX + amp, y)
            ctx.lineTo(baseX, y + 5)
          })
          ctx.lineTo(baseX, panelBottom - 10)
          ctx.stroke()
          drawLabel(ctx, 'depth ↓', x0 + 8, panelBottom - 16, { colour: UC.muted, size: 8.5 })
        } else if (p === 1) {
          // B-mode: the same line as brightness dots.
          const lineX = x0 + panelW / 2
          ctx.fillStyle = '#000'
          ctx.fillRect(x0 + panelW * 0.28, panelTop + 10, panelW * 0.44, panelH - 20)
          echoDepths.forEach((d, i) => {
            const y = panelTop + 10 + d * (panelH - 20)
            const level = i === 0 ? 235 : 150
            ctx.fillStyle = `rgb(${level},${level},${level})`
            ctx.beginPath()
            ctx.arc(lineX, y, 3.4, 0, Math.PI * 2)
            ctx.fill()
          })
          drawLabel(ctx, 'one scan line', lineX, panelBottom - 16, {
            colour: UC.muted,
            align: 'center',
            size: 8.5,
          })
        } else {
          // M-mode: one line repeated over time; one reflector moves.
          ctx.fillStyle = '#000'
          ctx.fillRect(x0 + 10, panelTop + 10, panelW - 20, panelH - 20)
          const cols = 46
          for (let cIdx = 0; cIdx < cols; cIdx += 1) {
            const cx = x0 + 10 + ((cIdx + 0.5) / cols) * (panelW - 20)
            // Static reflector.
            const yStatic = panelTop + 10 + 0.3 * (panelH - 20)
            ctx.fillStyle = 'rgb(220,220,220)'
            ctx.fillRect(cx - 1, yStatic - 1, 2, 2)
            // Moving reflector traces a sinusoid across time.
            const yMove =
              panelTop + 10 + (0.62 + 0.1 * Math.sin((cIdx / cols) * Math.PI * 4 + time)) * (panelH - 20)
            ctx.fillStyle = 'rgb(170,170,170)'
            ctx.fillRect(cx - 1, yMove - 1, 2, 2)
          }
          drawLabel(ctx, 'time →', x0 + panelW / 2, panelBottom - 16, {
            colour: UC.muted,
            align: 'center',
            size: 8.5,
          })
        }
      }
      drawLabel(
        ctx,
        'Same pulse–echo data, three displays: spike height → pixel brightness → brightness over time',
        width / 2,
        height - 14,
        { colour: UC.muted, align: 'center', size: 9.5 },
      )
      return
    }

    if (phase === 'prf') {
      const listenUs = timeFromDepthUs(imagingDepthCm * 10)
      const prpUs = pulseRepetitionPeriodUs(prfHz)
      const axisY = height * 0.4
      const left = 30
      const right = width - 30
      const spanUs = Math.max(prpUs * 2.4, listenUs * 2.4)
      const xFor = (us: number) => left + (us / spanUs) * (right - left)

      drawLabel(ctx, 'THE PRF / DEPTH BARGAIN', width / 2, 26, {
        colour: UC.text,
        align: 'center',
        size: 12.5,
        weight: 700,
      })

      ctx.strokeStyle = withAlpha(UC.white, 0.3)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(left, axisY)
      ctx.lineTo(right, axisY)
      ctx.stroke()
      drawLabel(ctx, 'time (µs) →', right, axisY + 14, { colour: UC.muted, align: 'right', size: 9 })

      const overrun = listenUs > prpUs
      for (let i = 0; i < 3; i += 1) {
        const startUs = i * prpUs
        if (startUs > spanUs) break
        // Listening window needed for the selected depth.
        const winEnd = Math.min(spanUs, startUs + listenUs)
        ctx.fillStyle = withAlpha(overrun ? UC.red : UC.green, 0.16)
        ctx.fillRect(xFor(startUs), axisY - 26, xFor(winEnd) - xFor(startUs), 26)
        // Transmit tick.
        ctx.strokeStyle = UC.cyan
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(xFor(startUs), axisY - 34)
        ctx.lineTo(xFor(startUs), axisY)
        ctx.stroke()
        if (i === 0) {
          drawLabel(ctx, 'transmit', xFor(startUs) + 4, axisY - 40, { colour: UC.cyan, size: 9, weight: 700 })
          drawLabel(
            ctx,
            `listen ${listenUs.toFixed(0)} µs (echoes from ${imagingDepthCm} cm)`,
            xFor(startUs + listenUs / 2),
            axisY - 33,
            { colour: overrun ? UC.red : UC.green, align: 'center', size: 9, background: true },
          )
        }
      }
      // PRP bracket.
      ctx.strokeStyle = withAlpha(UC.amber, 0.8)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(xFor(0), axisY + 20)
      ctx.lineTo(xFor(0), axisY + 26)
      ctx.moveTo(xFor(prpUs), axisY + 20)
      ctx.lineTo(xFor(prpUs), axisY + 26)
      ctx.moveTo(xFor(0), axisY + 23)
      ctx.lineTo(xFor(prpUs), axisY + 23)
      ctx.stroke()
      drawLabel(ctx, `PRP = 1/PRF = ${prpUs.toFixed(0)} µs`, xFor(prpUs / 2), axisY + 36, {
        colour: UC.amber,
        align: 'center',
        size: 10,
        weight: 700,
      })
      if (overrun) {
        drawLabel(
          ctx,
          'Next pulse fired before the deep echoes are home → RANGE AMBIGUITY',
          width / 2,
          axisY + 58,
          { colour: UC.red, align: 'center', size: 10.5, weight: 700, background: true },
        )
      }

      // The causal chain.
      const chain = ['depth ↑', 'listening time ↑', 'PRF max ↓', 'frame rate ↓']
      const chainY = height - 44
      const cw = (width - 60) / chain.length
      chain.forEach((label, i) => {
        const cx = 30 + cw * i + cw / 2
        ctx.fillStyle = withAlpha(UC.cyan, 0.09)
        ctx.beginPath()
        ctx.roundRect(cx - cw / 2 + 8, chainY - 15, cw - 16, 30, 7)
        ctx.fill()
        drawLabel(ctx, label, cx, chainY, { colour: UC.text, align: 'center', size: 10.5, weight: 700 })
        if (i < chain.length - 1) drawArrowHead(ctx, cx + cw / 2 + 2, chainY, 0, 7, UC.muted)
      })
      return
    }

    /* ==================================================================== *
     * The main pulse–echo scene
     * ==================================================================== */

    const tissueLeft = 16
    const tissueRight = width * 0.55
    const beamX = (tissueLeft + tissueRight) / 2
    const tissueTop = 66
    const tissueBottom = height - 22
    const yFor = (cm: number) => tissueTop + (cm / imagingDepthCm) * (tissueBottom - tissueTop)

    // Far-plane offset for the perspective slab.
    const fx = 20
    const fy = -12
    const fScale = 0.88

    /* --- tissue slab with receding rails ----------------------------------- */
    const grad = ctx.createLinearGradient(0, tissueTop, 0, tissueBottom)
    grad.addColorStop(0, withAlpha('#cbd5e1', 0.1))
    grad.addColorStop(1, withAlpha('#cbd5e1', 0.03))
    ctx.fillStyle = grad
    ctx.fillRect(tissueLeft, tissueTop, tissueRight - tissueLeft, tissueBottom - tissueTop)

    // Depth rails: front corners to far corners.
    const corners: [number, number][] = [
      [tissueLeft, tissueTop],
      [tissueRight, tissueTop],
      [tissueLeft, tissueBottom],
      [tissueRight, tissueBottom],
    ]
    ctx.strokeStyle = withAlpha(UC.cyan, 0.14)
    ctx.lineWidth = 1
    corners.forEach(([x, y]) => {
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.lineTo(x + fx, y + fy)
      ctx.stroke()
    })
    ctx.strokeStyle = withAlpha(UC.cyan, 0.1)
    ctx.strokeRect(tissueLeft + fx, tissueTop + fy, (tissueRight - tissueLeft) * fScale + 8, tissueBottom - tissueTop)
    ctx.strokeStyle = withAlpha(UC.cyan, 0.22)
    ctx.strokeRect(tissueLeft, tissueTop, tissueRight - tissueLeft, tissueBottom - tissueTop)

    // Depth ruler.
    const stepCm = imagingDepthCm > 12 ? 4 : 2
    for (let cm = stepCm; cm < imagingDepthCm; cm += stepCm) {
      const y = yFor(cm)
      ctx.strokeStyle = withAlpha(UC.white, 0.16)
      ctx.beginPath()
      ctx.moveTo(tissueLeft, y)
      ctx.lineTo(tissueLeft + 5, y)
      ctx.stroke()
      drawLabel(ctx, `${cm}`, tissueLeft + 8, y, { colour: UC.dim, size: 8.5 })
    }

    /* --- cable and probe ---------------------------------------------------- */
    const probeY = 30
    ctx.strokeStyle = withAlpha(UC.muted, 0.6)
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(4, probeY)
    ctx.lineTo(beamX - 32, probeY)
    ctx.stroke()
    drawLabel(ctx, 'to scanner', 6, probeY - 11, { colour: UC.dim, size: 8.5 })

    const vibrating = phase === 'vibrate'
    const faceWobble = vibrating ? Math.sin(time * 26) * 1.8 : 0
    ctx.fillStyle = withAlpha(UC.violet, phase === 'convert' ? 0.5 : 0.24)
    ctx.strokeStyle = withAlpha(UC.violet, 0.85)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    ctx.roundRect(beamX - 32, probeY - 12, 64, 26, 5)
    ctx.fill()
    ctx.stroke()
    // The piezoelectric element at the face.
    ctx.fillStyle = withAlpha(UC.amber, vibrating ? 0.85 : 0.4)
    ctx.fillRect(beamX - 26, probeY + 10 + faceWobble, 52, 3.4)
    drawLabel(ctx, 'PROBE', beamX + 40, probeY - 4, { colour: UC.violet, size: 9.5, weight: 700 })
    drawLabel(ctx, 'piezo element', beamX + 40, probeY + 10, { colour: UC.amber, size: 8.5 })
    if (vibrating) {
      drawArrowHead(ctx, beamX - 38, probeY + 12, -Math.PI / 2, 6, UC.amber)
      drawArrowHead(ctx, beamX - 38, probeY + 20, Math.PI / 2, 6, UC.amber)
    }

    /* --- reflectors, with far-plane copies ---------------------------------- */
    const reflectors = [
      { cm: depth1Cm, label: 'reflector 1' },
      { cm: depth2Cm, label: 'reflector 2' },
    ]
    reflectors.forEach((r) => {
      if (r.cm > imagingDepthCm) return
      const y = yFor(r.cm)
      // Far copy first (behind), then the front disc.
      ctx.fillStyle = withAlpha(UC.text, 0.16)
      ctx.beginPath()
      ctx.ellipse(beamX + fx, y + fy, 26 * fScale, 5 * fScale, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = withAlpha(UC.text, 0.55)
      ctx.strokeStyle = withAlpha(UC.white, 0.5)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(beamX, y, 26, 5.5, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      drawLabel(ctx, `${r.label} · ${r.cm.toFixed(1)} cm`, beamX + 34, y, {
        colour: UC.muted,
        size: 8.5,
      })
    })

    /* --- the travelling pulse packet ---------------------------------------- */
    const packet = (yCm: number, colour: string, strength = 1) => {
      const y = yFor(yCm)
      for (let i = 0; i < 3; i += 1) {
        ctx.strokeStyle = withAlpha(colour, (0.85 - i * 0.25) * strength)
        ctx.lineWidth = 2.2 - i * 0.5
        ctx.beginPath()
        ctx.moveTo(beamX - 12 + i * 2, y + i * 4)
        ctx.quadraticCurveTo(beamX, y - 4 + i * 4, beamX + 12 - i * 2, y + i * 4)
        ctx.stroke()
      }
    }

    const spark = (x: number) => {
      ctx.fillStyle = UC.amber
      ctx.beginPath()
      ctx.arc(x, probeY, 4, 0, Math.PI * 2)
      ctx.fill()
      const glow = ctx.createRadialGradient(x, probeY, 0, x, probeY, 12)
      glow.addColorStop(0, withAlpha(UC.amber, 0.5))
      glow.addColorStop(1, withAlpha(UC.amber, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(x, probeY, 12, 0, Math.PI * 2)
      ctx.fill()
    }

    const beamLine = (fromCm: number, toCm: number, colour: string, alpha: number) => {
      const y0 = yFor(fromCm)
      const y1 = yFor(toCm)
      // Honest dimming: brightest at the source end, fading along the path.
      const lineGrad = ctx.createLinearGradient(0, y0, 0, y1)
      lineGrad.addColorStop(0, withAlpha(colour, Math.min(1, alpha * 2)))
      lineGrad.addColorStop(1, withAlpha(colour, alpha * 0.27))
      ctx.strokeStyle = lineGrad
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(beamX, y0)
      ctx.lineTo(beamX, y1)
      ctx.stroke()
    }

    // Emission glow at the probe face, pulsed as each packet is fired.
    const faceGlow = (amount: number) => {
      if (amount <= 0) return
      const g = ctx.createRadialGradient(beamX, probeY + 12, 0, beamX, probeY + 12, 26)
      g.addColorStop(0, withAlpha(UC.cyan, 0.28 * amount))
      g.addColorStop(1, withAlpha(UC.cyan, 0))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(beamX, probeY + 12, 26, 0, Math.PI * 2)
      ctx.fill()
    }

    switch (phase) {
      case 'electrical':
        spark(4 + (beamX - 36 - 4) * t)
        break
      case 'vibrate':
        break
      case 'enter':
        faceGlow(Math.max(0, 1 - t * 4))
        beamLine(0, t * imagingDepthCm * 0.14, UC.cyan, 0.3)
        packet(t * imagingDepthCm * 0.14, UC.cyan)
        break
      case 'interface':
        faceGlow(Math.max(0, 1 - t * 4))
        beamLine(0, t * depth1Cm, UC.cyan, 0.3)
        packet(t * depth1Cm, UC.cyan)
        break
      case 'reflect': {
        beamLine(0, depth1Cm, UC.cyan, 0.2)
        // Part reflects (up), the rest carries on (down, weaker) — one tissue,
        // one speed, so both packets cover the same distance in the same time.
        const sCm = t * depth1Cm * 0.3
        packet(depth1Cm - sCm, UC.amber, 0.9)
        packet(Math.min(imagingDepthCm, depth1Cm + sCm), UC.cyan, 0.55)
        break
      }
      case 'return': {
        // Echo and onward pulse share one distance travelled at one speed.
        const sCm = t * depth1Cm
        beamLine(depth1Cm - sCm, depth1Cm, UC.amber, 0.25)
        packet(depth1Cm - sCm, UC.amber, 0.9)
        packet(Math.min(imagingDepthCm, depth1Cm + sCm), UC.cyan, 0.4)
        break
      }
      case 'convert':
        spark(beamX - 36 - (beamX - 36 - 4) * t)
        break
      case 'depth': {
        beamLine(0, depth1Cm, UC.cyan, 0.4)
        drawArrowHead(ctx, beamX, yFor(depth1Cm) - 8, Math.PI / 2, 8, UC.cyan)
        ctx.strokeStyle = withAlpha(UC.amber, 0.5)
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(beamX + 8, yFor(depth1Cm))
        ctx.lineTo(beamX + 8, yFor(0))
        ctx.stroke()
        drawArrowHead(ctx, beamX + 8, yFor(0) + 8, -Math.PI / 2, 8, UC.amber)
        const echoUs = timeFromDepthUs(depth1Cm * 10)
        drawLabel(ctx, `round trip t = ${echoUs.toFixed(0)} µs`, beamX + 44, yFor(depth1Cm * 0.4), {
          colour: UC.amber,
          size: 10,
          weight: 700,
          background: true,
        })
        drawLabel(
          ctx,
          `depth = c·t/2 = ${(depthFromTimeMm(echoUs) / 10).toFixed(1)} cm`,
          beamX + 44,
          yFor(depth1Cm * 0.4) + 18,
          { colour: UC.cyan, size: 10, weight: 700, background: true },
        )
        drawLabel(ctx, '≈ 13 µs per cm', beamX + 44, yFor(depth1Cm * 0.4) + 36, {
          colour: UC.muted,
          size: 9.5,
          background: true,
        })
        break
      }
      default: {
        // amode, bmode-sweep, free: a continuous quiet loop keeps the stage alive.
        // The echo retraces from the depth the pulse actually reached, at the
        // same speed, so there is no jump at the turnaround or the wrap.
        const reachCm = imagingDepthCm * 0.96
        const loop = (time * 0.35) % 2
        faceGlow(Math.max(0, 1 - loop * 4))
        if (loop < 1) {
          packet(loop * reachCm, UC.cyan, 0.5)
        } else {
          packet(reachCm * (2 - loop), UC.amber, 0.5)
        }
        // A weaker partial reflection returns from reflector 1 once the pulse passes it.
        const echo1Cm = 2 * depth1Cm - loop * reachCm
        if (depth1Cm < reachCm && loop * reachCm > depth1Cm && echo1Cm >= 0) {
          packet(echo1Cm, UC.amber, 0.3)
        }
        beamLine(0, reachCm, UC.cyan, 0.1)
      }
    }

    /* --- A-mode trace beside the tissue ------------------------------------- */
    const aX = width * 0.62
    const aW = 58
    const highlightA = phase === 'amode'
    drawLabel(ctx, 'A-MODE', aX, tissueTop - 10, {
      colour: highlightA ? UC.cyan : UC.muted,
      size: 9,
      weight: 700,
    })
    ctx.strokeStyle = withAlpha(UC.white, 0.22)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.moveTo(aX, tissueTop)
    ctx.lineTo(aX, tissueBottom)
    ctx.stroke()
    // The trace only exists once the echo has been converted back (step 7+).
    const traceVisible = ['convert', 'depth', 'amode', 'bmode-sweep', 'free'].includes(phase)
    if (traceVisible) {
      ctx.strokeStyle = highlightA ? UC.cyan : withAlpha(UC.cyan, 0.6)
      ctx.lineWidth = 1.8
      ctx.beginPath()
      ctx.moveTo(aX, tissueTop)
      reflectors.forEach((r) => {
        if (r.cm > imagingDepthCm) return
        const y = yFor(r.cm)
        const amp = aW * (1 - 0.55 * (r.cm / imagingDepthCm)) // deeper echo is weaker
        ctx.lineTo(aX, y - 5)
        ctx.lineTo(aX + amp, y)
        ctx.lineTo(aX, y + 5)
      })
      ctx.lineTo(aX, tissueBottom)
      ctx.stroke()
      if (highlightA) {
        drawLabel(ctx, 'spike height = echo amplitude', aX + 4, tissueBottom + 12, {
          colour: UC.cyan,
          size: 9,
        })
      }
    }

    /* --- B-mode strip / sweeping frame --------------------------------------- */
    const sweeping = phase === 'bmode-sweep' || phase === 'free'
    const bX = width * 0.78
    const bW = sweeping ? width - 16 - bX : 26
    const highlightB = phase === 'amode' || sweeping
    drawLabel(ctx, sweeping ? 'B-MODE FRAME' : 'B-MODE', bX, tissueTop - 10, {
      colour: highlightB ? UC.text : UC.muted,
      size: 9,
      weight: 700,
    })
    ctx.fillStyle = '#000'
    ctx.fillRect(bX, tissueTop, bW, tissueBottom - tissueTop)
    ctx.strokeStyle = withAlpha(UC.white, 0.2)
    ctx.strokeRect(bX, tissueTop, bW, tissueBottom - tissueTop)

    if (traceVisible) {
      const lines = sweeping ? 26 : 1
      const sweepPos = (time * 5) % (lines + 6)
      const filled = sweeping ? Math.floor(sweepPos + 1) : 1
      // Un-swept lines keep the previous frame, easing down to a dim ghost so
      // the wrap reads as a new sweep passing over an existing image.
      const dim = 0.4 + 0.6 * Math.max(0, 1 - sweepPos / 6)
      for (let lIdx = 0; lIdx < lines; lIdx += 1) {
        const bright = lIdx < filled ? 1 : dim
        const lx = bX + ((lIdx + 0.5) / lines) * bW
        const colW = Math.max(2, bW / lines - 1)
        // Faint stable background speckle down the line.
        for (let s = 0; s < 22; s += 1) {
          const sy = tissueTop + ((s + 0.5) / 22) * (tissueBottom - tissueTop)
          const v = Math.floor(hash(lIdx, s) * 42 * bright)
          ctx.fillStyle = `rgb(${v},${v},${v})`
          ctx.fillRect(lx - colW / 2, sy - 2, colW, 4)
        }
        // Bright pixels at the reflector depths; deeper is dimmer.
        reflectors.forEach((r) => {
          if (r.cm > imagingDepthCm) return
          const level = Math.round((235 - (r.cm / imagingDepthCm) * 130) * bright)
          ctx.fillStyle = `rgb(${level},${level},${level})`
          ctx.fillRect(lx - colW / 2, yFor(r.cm) - 2, colW, 4)
        })
      }
      if (sweeping && filled <= lines) {
        // The active scan line, highlighted.
        const lx = bX + ((Math.min(filled, lines) - 0.5) / lines) * bW
        ctx.strokeStyle = withAlpha(UC.cyan, 0.8)
        ctx.lineWidth = 1.4
        ctx.beginPath()
        ctx.moveTo(lx, tissueTop)
        ctx.lineTo(lx, tissueBottom)
        ctx.stroke()
      }
      if (phase === 'amode') {
        // Arrow from spike to pixel: amplitude becomes brightness.
        const y1 = yFor(Math.min(depth1Cm, imagingDepthCm))
        ctx.strokeStyle = withAlpha(UC.amber, 0.7)
        ctx.lineWidth = 1.3
        ctx.setLineDash([3, 3])
        ctx.beginPath()
        ctx.moveTo(aX + aW * 0.9 + 4, y1)
        ctx.lineTo(bX - 6, y1)
        ctx.stroke()
        ctx.setLineDash([])
        drawArrowHead(ctx, bX - 4, y1, 0, 7, UC.amber)
        drawLabel(ctx, 'amplitude → brightness', (aX + bX) / 2 + 10, y1 - 12, {
          colour: UC.amber,
          align: 'center',
          size: 9,
          weight: 700,
          background: true,
        })
      }
      if (sweeping) {
        drawDashedLine(ctx, beamX, tissueTop - 4, bX, tissueTop - 4, withAlpha(UC.muted, 0.4), [2, 4])
        drawLabel(ctx, 'one pulse per line, line by line', bX + bW / 2, tissueBottom + 12, {
          colour: UC.muted,
          align: 'center',
          size: 9,
        })
      }
    }
  }, [depth1Cm, depth2Cm, imagingDepthCm, prfHz, time, t, phase])

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label={`Pulse–echo stage showing the ${phase} step. Two reflectors at ${depth1Cm.toFixed(1)} and ${depth2Cm.toFixed(1)} centimetres in a ${imagingDepthCm} centimetre field. The echo from ${depth1Cm.toFixed(1)} centimetres returns after ${timeFromDepthUs(depth1Cm * 10).toFixed(0)} microseconds, about 13 microseconds per centimetre of depth.`}
    />
  )
}
