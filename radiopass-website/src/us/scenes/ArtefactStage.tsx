/**
 * The artefact workshop stage — the physical setup behind each classic artefact.
 *
 * One canvas, many setups. Each `kind` draws the true anatomy and the true
 * (often indirect) beam path; the "reveal" overlay adds the path the machine
 * ASSUMED — a dashed straight line — and the ghost it therefore drew. The amber
 * path is what the sound actually did; the dashed cyan path is the machine's
 * belief. The distance between the two IS the artefact.
 *
 * Depth is carried by a darkening gradient, receding sector guide lines and a
 * ruler, so the block reads as a volume of tissue below a probe rather than a
 * flat diagram.
 */

import { useEffect, useRef } from 'react'

import {
  drawArrowHead,
  drawGraticule,
  drawLabel,
  prepareCanvas,
  UC,
  withAlpha,
} from '../components/theme'
import { apparentDepthMm } from '../engine'

export type ArtefactPhase = 'assumptions' | 'demo' | 'free'

export type ArtefactSceneKind =
  | 'assumptions'
  | 'shadowing'
  | 'enhancement'
  | 'reverberation'
  | 'ringdown'
  | 'mirror'
  | 'refraction'
  | 'speed'
  | 'sidelobe'
  | 'gratinglobe'
  | 'beamwidth'
  | 'slicethickness'
  | 'rangeambiguity'
  | 'speckle'
  | 'anisotropy'
  | 'doppler-aliasing'
  | 'doppler-blooming'
  | 'doppler-flash'
  | 'doppler-twinkle'

const DEPTH_CM = 8

type Pt = { x: number; y: number }

export function ArtefactStage({
  kind,
  revealPath,
  time,
  phase,
  describe,
  showLabels = true,
}: {
  kind: ArtefactSceneKind
  /** Draw the true path (amber) against the machine's assumed path (dashed cyan). */
  revealPath: boolean
  /** Seconds of animation time. */
  time: number
  phase: ArtefactPhase
  /** Accessible description of the current physics. */
  describe: string
  showLabels?: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const prepared = prepareCanvas(canvas)
    if (!prepared) return
    const { ctx, width, height } = prepared

    /* --- geometry --------------------------------------------------------- */
    const probeY = 26
    const yTop = probeY + 14
    const yBottom = height - 12
    const yFor = (cm: number) => yTop + (cm / DEPTH_CM) * (yBottom - yTop)
    const xFor = (f: number) => width * 0.5 + f * width * 0.4

    /* --- tissue block with depth cues -------------------------------------- */
    const tissue = ctx.createLinearGradient(0, yTop, 0, yBottom)
    tissue.addColorStop(0, withAlpha('#28405c', 0.5))
    tissue.addColorStop(1, withAlpha('#0a1220', 0.9))
    ctx.fillStyle = tissue
    ctx.fillRect(xFor(-1.06), yTop, xFor(1.06) - xFor(-1.06), yBottom - yTop)
    drawGraticule(ctx, width, height, 44)

    // Receding sector guides: the field widens gently with depth, a cheap but
    // effective cue that we are looking INTO a volume from the probe face.
    ctx.strokeStyle = withAlpha(UC.cyan, 0.14)
    ctx.lineWidth = 1
    for (const side of [-1, 1]) {
      ctx.beginPath()
      ctx.moveTo(xFor(side * 0.92), yTop)
      ctx.lineTo(xFor(side * 1.06), yBottom)
      ctx.stroke()
    }

    // Depth ruler.
    ctx.strokeStyle = withAlpha(UC.text, 0.35)
    ctx.fillStyle = withAlpha(UC.text, 0.5)
    ctx.font = '600 9px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    for (let cm = 2; cm < DEPTH_CM; cm += 2) {
      const y = yFor(cm)
      ctx.beginPath()
      ctx.moveTo(width - 26, y)
      ctx.lineTo(width - 20, y)
      ctx.stroke()
      ctx.fillText(`${cm}`, width - 17, y)
    }

    /* --- the probe --------------------------------------------------------- */
    const drawProbe = (cx: number, w: number) => {
      ctx.fillStyle = withAlpha('#b18cff', 0.24)
      ctx.strokeStyle = withAlpha('#b18cff', 0.75)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.roundRect(cx - w / 2, probeY - 14, w, 16, 4)
      ctx.fill()
      ctx.stroke()
      // Array elements.
      ctx.strokeStyle = withAlpha('#b18cff', 0.5)
      ctx.lineWidth = 1
      for (let i = 1; i < 8; i += 1) {
        const x = cx - w / 2 + (w * i) / 8
        ctx.beginPath()
        ctx.moveTo(x, probeY - 11)
        ctx.lineTo(x, probeY - 1)
        ctx.stroke()
      }
    }
    drawProbe(xFor(0), width * 0.34)
    if (showLabels) {
      drawLabel(ctx, 'PROBE', xFor(0), probeY - 22, {
        colour: UC.violet,
        align: 'center',
        size: 9.5,
        weight: 700,
      })
    }

    /* --- path helpers ------------------------------------------------------ */
    const pathLength = (pts: Pt[]) => {
      let total = 0
      for (let i = 1; i < pts.length; i += 1)
        total += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
      return total
    }

    const pointAt = (pts: Pt[], s: number): Pt => {
      let left = s
      for (let i = 1; i < pts.length; i += 1) {
        const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
        if (left <= seg) {
          const t = seg === 0 ? 0 : left / seg
          return {
            x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * t,
            y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * t,
          }
        }
        left -= seg
      }
      return pts[pts.length - 1]
    }

    const drawPath = (
      pts: Pt[],
      colour: string,
      options: { dash?: number[]; width?: number; alpha?: number; arrow?: boolean } = {},
    ) => {
      const { dash, width: lw = 1.8, alpha = 0.85, arrow = false } = options
      ctx.save()
      if (dash) ctx.setLineDash(dash)
      ctx.strokeStyle = withAlpha(colour, alpha)
      ctx.lineWidth = lw
      ctx.beginPath()
      pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)))
      ctx.stroke()
      ctx.restore()
      if (arrow && pts.length >= 2) {
        const a = pts[pts.length - 2]
        const b = pts[pts.length - 1]
        drawArrowHead(ctx, b.x, b.y, Math.atan2(b.y - a.y, b.x - a.x), 7, colour)
      }
    }

    /** A pulse travelling out along the path and echoing back, endlessly. */
    const drawPulse = (pts: Pt[], colour: string = UC.cyan, speedPx = 110, crawlWithin?: number) => {
      const total = pathLength(pts)
      // Crossing the first `crawlWithin` px (a slow surface layer) at 0.6× the
      // usual speed costs extra time outbound AND on the way home — the
      // speed-error cue.
      const slowLen = crawlWithin === undefined ? 0 : Math.min(crawlWithin, total)
      const slowRaw = slowLen / 0.6
      const rawTotal = total * 2 + (slowRaw - slowLen) * 2
      const cycle = rawTotal / speedPx + 0.7
      const t = time % cycle
      const s = t * speedPx
      if (s > rawTotal) return
      // Map raw distance to journey position, crawling inside the slow layer.
      let j: number
      if (s <= slowRaw) j = s * 0.6
      else if (s <= rawTotal - slowRaw) j = slowLen + (s - slowRaw)
      else j = total * 2 - slowLen + (s - (rawTotal - slowRaw)) * 0.6
      const outward = j <= total
      const at = outward ? j : Math.max(0, total * 2 - j)
      // Born softly at the face, echo weaker than the transmit, absorbed on
      // return — no single-frame pops at either end of the trip.
      const fadeIn = Math.min(1, j / 14)
      const fadeOut = Math.min(1, (total * 2 - j) / 14)
      const returnDecay = outward ? 1 : 0.5 + 0.5 * (at / total)
      const amp = fadeIn * fadeOut * returnDecay
      const p = pointAt(pts, at)
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 11)
      glow.addColorStop(0, withAlpha(outward ? colour : UC.amber, 0.85 * amp))
      glow.addColorStop(1, withAlpha(outward ? colour : UC.amber, 0))
      ctx.fillStyle = glow
      ctx.beginPath()
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(p.x, p.y, 3.4, 0, Math.PI * 2)
      ctx.fillStyle = withAlpha(outward ? colour : UC.amber, amp)
      ctx.fill()
    }

    const drawGhost = (x: number, y: number, r: number, tag?: string) => {
      ctx.save()
      ctx.setLineDash([4, 4])
      ctx.strokeStyle = withAlpha(UC.cyan, 0.8)
      ctx.lineWidth = 1.6
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.stroke()
      ctx.restore()
      if (tag && showLabels) {
        drawLabel(ctx, tag, x, y + r + 11, {
          colour: UC.cyan,
          align: 'center',
          size: 9.5,
          background: true,
        })
      }
    }

    const blob = (x: number, y: number, r: number, colour: string, alpha = 0.8) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r)
      g.addColorStop(0, withAlpha(colour, alpha))
      g.addColorStop(1, withAlpha(colour, alpha * 0.25))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.arc(x, y, r, 0, Math.PI * 2)
      ctx.fill()
    }

    const shadeBand = (x0: number, x1: number, yFrom: number, dirty: boolean) => {
      ctx.fillStyle = withAlpha('#000000', 0.55)
      ctx.fillRect(x0, yFrom, x1 - x0, yBottom - yFrom)
      if (dirty) {
        ctx.fillStyle = withAlpha(UC.text, 0.3)
        for (let i = 0; i < 46; i += 1) {
          const hx = ((i * 9301 + 49297) % 233280) / 233280
          const hy = ((i * 4093 + 12345) % 233280) / 233280
          ctx.beginPath()
          ctx.arc(x0 + hx * (x1 - x0), yFrom + hy * (yBottom - yFrom), 1.4, 0, Math.PI * 2)
          ctx.fill()
        }
      }
    }

    const label = (
      text: string,
      x: number,
      y: number,
      colour: string = UC.muted,
      align: CanvasTextAlign = 'center',
    ) => {
      if (!showLabels) return
      drawLabel(ctx, text, x, y, { colour, align, size: 10, background: true })
    }

    const assumed = (pts: Pt[], arrow = true) => {
      if (revealPath) drawPath(pts, UC.cyan, { dash: [5, 4], width: 1.4, alpha: 0.85, arrow })
    }
    const truePath = (pts: Pt[], arrow = true) => {
      if (revealPath) drawPath(pts, UC.amber, { width: 2, alpha: 0.9, arrow })
    }

    /* ====================================================================== *
     * Per-artefact setups
     * ====================================================================== */

    if (kind === 'assumptions' || phase === 'assumptions') {
      // A well-behaved echo: the one situation in which every assumption holds.
      const target: Pt = { x: xFor(0), y: yFor(4.5) }
      blob(target.x, target.y, 9, UC.text, 0.9)
      drawPath([{ x: xFor(0), y: yTop }, target], UC.cyan, { width: 1.4, alpha: 0.5 })
      drawPulse([{ x: xFor(0), y: yTop }, target])
      label('one straight round trip at 1540 m/s', xFor(0), yFor(5.4), UC.green)
      const rules = [
        '1  Speed is 1540 m/s everywhere',
        '2  Sound travels in straight lines',
        '3  Echoes come from the main beam',
        '4  Attenuation is predictable',
      ]
      rules.forEach((rule, i) => {
        drawLabel(ctx, rule, xFor(-0.98), yFor(1.1) + i * 20, {
          colour: UC.cyan,
          size: 10.5,
          weight: 700,
          background: true,
        })
      })
      label('break any one of these and an artefact appears', xFor(0), yBottom - 12, UC.amber)
    } else if (kind === 'shadowing') {
      const stone: Pt = { x: xFor(-0.42), y: yFor(3.2) }
      const gas: Pt = { x: xFor(0.42), y: yFor(3.2) }
      shadeBand(stone.x - 22, stone.x + 22, stone.y + 12, false)
      shadeBand(gas.x - 24, gas.x + 24, gas.y + 12, true)
      blob(stone.x, stone.y, 13, '#f5f5f5', 0.95)
      // Gas: a cluster of small bubbles.
      for (const [dx, dy, r] of [[-8, 0, 7], [4, -5, 6], [7, 5, 5], [-2, 7, 4]] as const) {
        blob(gas.x + dx, gas.y + dy, r, '#8ea3b8', 0.8)
      }
      drawPulse([{ x: stone.x, y: yTop }, stone], UC.cyan, 100)
      drawPulse([{ x: gas.x, y: yTop }, gas], UC.cyan, 100)
      truePath([{ x: stone.x, y: yTop }, stone])
      assumed([{ x: stone.x, y: yTop }, { x: stone.x, y: yBottom - 6 }], false)
      label('STONE — clean shadow', stone.x, yFor(6.6), UC.amber)
      label('GAS — dirty shadow', gas.x, yFor(6.6), UC.amber)
      label('almost nothing passes the surface', xFor(0), yFor(1.6), UC.muted)
    } else if (kind === 'enhancement') {
      const cx = xFor(0)
      const cy = yFor(3.2)
      const r = yFor(4.2) - yFor(3.2)
      // The cyst: anechoic fluid, barely attenuating.
      ctx.fillStyle = withAlpha('#0b1c30', 0.92)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.5)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 1.1, r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // The beam through the cyst keeps its energy; neighbours lose theirs.
      const beam = (x: number, throughCyst: boolean) => {
        const g = ctx.createLinearGradient(0, yTop, 0, yBottom)
        g.addColorStop(0, withAlpha(UC.cyan, 0.5))
        g.addColorStop(1, withAlpha(UC.cyan, throughCyst ? 0.4 : 0.06))
        ctx.strokeStyle = g
        ctx.lineWidth = throughCyst ? 3 : 2
        ctx.beginPath()
        ctx.moveTo(x, yTop)
        ctx.lineTo(x, yBottom - 6)
        ctx.stroke()
      }
      beam(cx - r * 1.7, false)
      beam(cx + r * 1.7, false)
      beam(cx, true)
      // The bright band beyond the fluid.
      ctx.fillStyle = withAlpha(UC.text, 0.3)
      ctx.fillRect(cx - r * 0.95, yFor(4.4), r * 1.9, yFor(6.4) - yFor(4.4))
      drawPulse([{ x: cx, y: yTop }, { x: cx, y: yFor(6.4) }], UC.cyan, 120)
      label('fluid removes almost no energy', cx, cy, UC.cyan)
      label('brighter band — the beam arrived stronger', cx, yFor(5.4), UC.muted)
    } else if (kind === 'reverberation' || kind === 'ringdown') {
      const x = xFor(-0.25)
      const y1 = yFor(1.1)
      const y2 = yFor(2.0)
      ctx.strokeStyle = withAlpha(UC.text, 0.95)
      ctx.lineWidth = 3
      for (const y of [y1, y2]) {
        ctx.beginPath()
        ctx.moveTo(x - 54, y)
        ctx.lineTo(x + 54, y)
        ctx.stroke()
      }
      if (kind === 'reverberation') {
        // The pulse rattles between the two strong parallel interfaces; the
        // path ends at its last interface contact so drawPulse's retrace
        // supplies the amber return leg rather than a doubled traversal.
        const zig: Pt[] = [
          { x, y: yTop },
          { x, y: y2 },
          { x: x + 10, y: y1 },
          { x: x + 20, y: y2 },
          { x: x + 30, y: y1 },
        ]
        truePath([...zig, { x: x + 30, y: yTop }])
        drawPulse(zig, UC.cyan, 90)
        const spacing = y2 - y1
        for (let i = 1; i <= 3; i += 1) {
          drawGhost(x + 15, y2 + spacing * i, 8)
          if (revealPath) assumed([{ x: x + 15, y: yTop }, { x: x + 15, y: y2 + spacing * i }], false)
        }
        label('equally spaced, ever fainter repeats', x + 15, y2 + spacing * 3 + 22, UC.cyan)
        label('two strong parallel interfaces', x, y1 - 14, UC.muted)
      } else {
        // Ring-down: fluid trapped between bubbles keeps ringing after the
        // pulse has gone — a continuous emission, not discrete repeats.
        const gx = xFor(0.3)
        const gy = yFor(1.5)
        for (const [dx, dy, r] of [[-10, -4, 7], [2, -7, 6], [10, -2, 6], [-3, 3, 5], [7, 6, 5]] as const) {
          blob(gx + dx, gy + dy, r, '#8ea3b8', 0.85)
        }
        blob(gx, gy, 3.5, UC.cyan, 0.9)
        // The continuous resonant tail, shimmering with time.
        const wobble = 0.75 + 0.25 * Math.sin(time * 6)
        const tail = ctx.createLinearGradient(0, gy, 0, yBottom)
        tail.addColorStop(0, withAlpha(UC.text, 0.85 * wobble))
        tail.addColorStop(1, withAlpha(UC.text, 0.2 * wobble))
        ctx.fillStyle = tail
        ctx.fillRect(gx - 4, gy + 8, 8, yBottom - gy - 16)
        drawPulse([{ x: gx, y: yTop }, { x: gx, y: gy }], UC.cyan, 100)
        label('trapped fluid resonates continuously', gx, gy - 22, UC.cyan)
        label('unbroken bright line — no discrete bands', gx + 8, yFor(5.4), UC.amber, 'left')
        label('reverberation would give separate stripes', xFor(-0.45), yFor(5.4), UC.muted)
      }
    } else if (kind === 'mirror') {
      // The diaphragm: a strong, smooth, curved specular reflector.
      const dy = yFor(4.6)
      ctx.strokeStyle = withAlpha(UC.text, 0.95)
      ctx.lineWidth = 3.5
      ctx.beginPath()
      ctx.moveTo(xFor(-0.95), dy + 26)
      ctx.quadraticCurveTo(xFor(0), dy - 30, xFor(0.95), dy + 26)
      ctx.stroke()
      const lesion: Pt = { x: xFor(0.3), y: yFor(3.1) }
      blob(lesion.x, lesion.y, 10, UC.green, 0.85)
      const bounce: Pt = { x: xFor(-0.05), y: dy - 15 }
      const start: Pt = { x: xFor(-0.3), y: yTop }
      truePath([start, bounce, lesion])
      // Outbound half only — drawPulse's built-in retrace shows the amber echo
      // returning lesion → diaphragm → probe.
      drawPulse([start, bounce, lesion], UC.cyan, 100)
      // The machine times the long detour and draws a copy BEYOND the mirror,
      // along its transmit line of sight through the bounce point.
      const extra = Math.hypot(lesion.x - bounce.x, lesion.y - bounce.y)
      const inLen = Math.hypot(bounce.x - start.x, bounce.y - start.y)
      const ghostAt: Pt = {
        x: bounce.x + ((bounce.x - start.x) / inLen) * extra,
        y: bounce.y + ((bounce.y - start.y) / inLen) * extra,
      }
      drawGhost(ghostAt.x, ghostAt.y, 10, 'machine places a copy here')
      assumed([start, ghostAt])
      label('DIAPHRAGM — acoustic mirror', xFor(0.62), dy - 26, UC.muted)
      label('true structure', lesion.x + 14, lesion.y - 12, UC.green, 'left')
    } else if (kind === 'refraction') {
      // A curved fluid boundary bends the beam; the machine draws straight.
      const cx = xFor(-0.1)
      const cy = yFor(2.6)
      const r = yFor(3.7) - yFor(2.6)
      ctx.fillStyle = withAlpha('#0b1c30', 0.9)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.5)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(cx, cy, r * 1.15, r, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Edge rays bend AWAY, leaving narrow shadows past each edge.
      const edgeL = cx - r * 1.05
      const edgeR = cx + r * 1.05
      shadeBand(edgeL - 7, edgeL + 7, cy + r * 0.7, false)
      shadeBand(edgeR - 7, edgeR + 7, cy + r * 0.7, false)
      const bentL: Pt[] = [
        { x: edgeL + 4, y: yTop },
        { x: edgeL + 2, y: cy },
        { x: edgeL - 26, y: yBottom - 8 },
      ]
      truePath(bentL)
      drawPulse(bentL, UC.cyan, 110)
      assumed([{ x: edgeL + 4, y: yTop }, { x: edgeL + 4, y: yBottom - 8 }], false)
      // A target reached by a bent beam is drawn on the straight line instead.
      const target: Pt = { x: xFor(0.52), y: yFor(5.4) }
      blob(target.x, target.y, 9, UC.green, 0.85)
      const bent: Pt[] = [{ x: xFor(0.28), y: yTop }, { x: xFor(0.33), y: yFor(2.4) }, target]
      truePath(bent)
      if (revealPath) {
        const ghost: Pt = { x: xFor(0.28), y: yFor(5.55) }
        drawGhost(ghost.x, ghost.y, 9, 'duplicate on the straight line')
        assumed([{ x: xFor(0.28), y: yTop }, ghost], false)
      }
      label('edge shadow', edgeL, cy + r + 26, UC.muted)
      label('edge shadow', edgeR, cy + r + 26, UC.muted)
    } else if (kind === 'speed') {
      // A slow fat layer: the echo is late, so the machine draws it too deep.
      const fatCm = 2.4
      const fatBottom = yFor(fatCm)
      ctx.fillStyle = withAlpha('#f0c674', 0.16)
      ctx.fillRect(xFor(-1.06), yTop, xFor(1.06) - xFor(-1.06), fatBottom - yTop)
      ctx.strokeStyle = withAlpha('#f0c674', 0.5)
      ctx.lineWidth = 1.2
      ctx.beginPath()
      ctx.moveTo(xFor(-1.06), fatBottom)
      ctx.lineTo(xFor(1.06), fatBottom)
      ctx.stroke()
      const trueDepthCm = 4.5
      const reflector: Pt = { x: xFor(0), y: yFor(trueDepthCm) }
      blob(reflector.x, reflector.y, 9, UC.green, 0.9)
      // The pulse crawls through the fat — 1450 m/s, not 1540 — and resumes
      // full speed in the tissue below.
      drawPulse([{ x: reflector.x, y: yTop }, reflector], UC.cyan, 110, fatBottom - yTop)
      // Only the slow layer is mis-scaled: the fat is stretched by 1540/1450,
      // the normal-speed tissue beneath it is not.
      const apparentCm = apparentDepthMm(fatCm * 10, 1450) / 10 + (trueDepthCm - fatCm)
      drawGhost(reflector.x, yFor(apparentCm), 9, `drawn at ${apparentCm.toFixed(1)} cm — too deep`)
      truePath([{ x: reflector.x, y: yTop }, reflector], false)
      assumed([{ x: reflector.x + 16, y: yTop }, { x: reflector.x + 16, y: yFor(apparentCm) }])
      label('FAT · c = 1450 m/s — the pulse is LATE', xFor(-0.5), yFor(1.2), '#f0c674')
      label(`true depth ${trueDepthCm.toFixed(1)} cm`, reflector.x - 16, reflector.y, UC.green, 'right')
    } else if (kind === 'sidelobe' || kind === 'gratinglobe') {
      // The bladder: large, smooth and anechoic — nothing should be inside it.
      const bx = xFor(0)
      const by = yFor(4.2)
      const br = yFor(5.8) - yFor(4.2)
      ctx.fillStyle = withAlpha('#0b1c30', 0.92)
      ctx.strokeStyle = withAlpha(UC.text, 0.6)
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.ellipse(bx, by, br * 1.5, br, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Main beam straight down; the weak off-axis lobe finds bowel gas.
      drawPath([{ x: bx, y: yTop }, { x: bx, y: by }], UC.cyan, { width: 3, alpha: 0.45 })
      const gas: Pt = { x: xFor(kind === 'sidelobe' ? -0.62 : -0.72), y: yFor(2.5) }
      for (const [dx, dy, r] of [[-7, 0, 7], [4, -4, 6], [6, 5, 5]] as const) {
        blob(gas.x + dx, gas.y + dy, r, '#8ea3b8', 0.85)
      }
      const lobe: Pt[] = [{ x: bx - 8, y: yTop }, gas]
      truePath(lobe)
      drawPulse(lobe, UC.violet, 100)
      if (kind === 'gratinglobe') {
        // Grating lobes are symmetric: the periodic array sprays copies both ways.
        const lobeR: Pt[] = [{ x: bx + 8, y: yTop }, { x: xFor(0.72), y: yFor(2.5) }]
        drawPath(lobeR, UC.violet, { width: 1.4, alpha: 0.5, arrow: true })
        label('periodic element spacing → symmetric extra lobes', bx, probeY + 24, UC.violet)
      } else {
        label('weak off-axis side lobe', gas.x, gas.y - 22, UC.violet)
      }
      const echoDist = Math.hypot(gas.x - (bx - 8), gas.y - yTop)
      const ghost: Pt = { x: bx - 8, y: yTop + echoDist }
      drawGhost(ghost.x, ghost.y, 7, 'pseudo-debris on the main line')
      assumed([{ x: bx - 8, y: yTop }, ghost], false)
      label('BLADDER — should be empty', bx + br * 0.4, by + br + 16, UC.muted)
    } else if (kind === 'beamwidth' || kind === 'slicethickness') {
      // A beam (or slice) fatter than the cyst: neighbours vote in its pixels.
      const cy = yFor(5.2)
      const cr = yFor(5.9) - yFor(5.2)
      const cx = xFor(0)
      const halfAt = (y: number) => 10 + Math.abs(y - yFor(2.6)) * 0.16
      ctx.fillStyle = withAlpha(kind === 'beamwidth' ? UC.cyan : UC.violet, 0.12)
      ctx.beginPath()
      ctx.moveTo(cx - halfAt(yTop), yTop)
      ctx.lineTo(cx - halfAt(yBottom), yBottom)
      ctx.lineTo(cx + halfAt(yBottom), yBottom)
      ctx.lineTo(cx + halfAt(yTop), yTop)
      ctx.closePath()
      ctx.fill()
      ctx.fillStyle = withAlpha('#0b1c30', 0.95)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.5)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.arc(cx, cy, cr, 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()
      // Scatterers beside (or out of plane of) the cyst share its resolution cell.
      ctx.fillStyle = withAlpha(UC.text, 0.75)
      for (const dx of [-1.35, 1.3, 1.6, -1.7]) {
        ctx.beginPath()
        ctx.arc(cx + cr * dx, cy + (dx > 0 ? 6 : -5), 2.2, 0, Math.PI * 2)
        ctx.fill()
      }
      drawGhost(cx - 6, cy + 4, 4)
      drawGhost(cx + 7, cy - 3, 4)
      label(
        kind === 'beamwidth' ? 'beam wider than the cyst' : 'slice (elevation) thicker than the cyst',
        cx,
        yFor(3.4),
        kind === 'beamwidth' ? UC.cyan : UC.violet,
      )
      label('their echoes are averaged INTO the cyst pixels', cx, cy + cr + 18, UC.muted)
      if (kind === 'slicethickness') {
        label('viewed side-on: the slab has thickness out of plane', xFor(-0.6), yFor(1.2), UC.muted)
      }
    } else if (kind === 'rangeambiguity') {
      const deep: Pt = { x: xFor(-0.15), y: yFor(7.2) }
      blob(deep.x, deep.y, 9, UC.green, 0.9)
      drawPulse([{ x: deep.x, y: yTop }, deep], UC.cyan, 150)
      truePath([{ x: deep.x, y: yTop }, deep], false)
      // Timeline: pulse 2 fires before the echo of pulse 1 returns.
      const tlY = yFor(0.8)
      ctx.strokeStyle = withAlpha(UC.text, 0.4)
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(xFor(0.1), tlY)
      ctx.lineTo(xFor(0.95), tlY)
      ctx.stroke()
      for (const [f, name] of [[0.16, 'pulse 1'], [0.55, 'pulse 2']] as const) {
        ctx.strokeStyle = UC.cyan
        ctx.lineWidth = 2
        ctx.beginPath()
        ctx.moveTo(xFor(f), tlY - 8)
        ctx.lineTo(xFor(f), tlY + 8)
        ctx.stroke()
        label(name, xFor(f), tlY - 18, UC.cyan)
      }
      ctx.strokeStyle = UC.amber
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(xFor(0.78), tlY - 8)
      ctx.lineTo(xFor(0.78), tlY + 8)
      ctx.stroke()
      label('echo of pulse 1 arrives', xFor(0.78), tlY + 18, UC.amber)
      // The late echo is timed against pulse 2, so only the leftover time is
      // converted to depth — the reflector is drawn far too shallow.
      const ghostDepthCm = 2.0
      drawGhost(deep.x, yFor(ghostDepthCm), 9, 'assigned to pulse 2 — drawn shallow')
      assumed([{ x: deep.x + 16, y: yTop }, { x: deep.x + 16, y: yFor(ghostDepthCm) }])
      label('PRF too high for this depth', xFor(-0.55), yFor(0.8), UC.muted)
    } else if (kind === 'speckle') {
      // One resolution cell, magnified: many sub-wavelength scatterers whose
      // wavelets interfere. The grain is the interference pattern, not anatomy.
      const cellX = xFor(-0.42)
      const cellY = yFor(3.4)
      const cellR = 56
      ctx.strokeStyle = withAlpha(UC.cyan, 0.55)
      ctx.lineWidth = 1.4
      ctx.strokeRect(cellX - cellR, cellY - cellR * 0.7, cellR * 2, cellR * 1.4)
      for (let i = 0; i < 26; i += 1) {
        const hx = ((i * 9301 + 49297) % 233280) / 233280
        const hy = ((i * 4093 + 12345) % 233280) / 233280
        const sx = cellX - cellR + hx * cellR * 2
        const sy = cellY - cellR * 0.7 + hy * cellR * 1.4
        ctx.fillStyle = withAlpha(UC.text, 0.8)
        ctx.beginPath()
        ctx.arc(sx, sy, 1.6, 0, Math.PI * 2)
        ctx.fill()
        // Expanding wavelets from a few of them.
        if (i % 6 === 0) {
          const r = ((time * 26) % 30) + i
          ctx.strokeStyle = withAlpha(UC.cyan, Math.max(0, 0.4 - r * 0.01))
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(sx, sy, r * 0.6, 0, Math.PI * 2)
          ctx.stroke()
        }
      }
      label('scatterers ≪ λ — wavelets interfere', cellX, cellY + cellR * 0.7 + 16, UC.cyan)
      // The resulting texture patch.
      const px = xFor(0.45)
      for (let gy = 0; gy < 10; gy += 1) {
        for (let gx = 0; gx < 12; gx += 1) {
          const h = (((gx * 9301 + gy * 49297) % 233280) / 233280) * 0.8 + 0.1
          ctx.fillStyle = withAlpha('#ffffff', h * 0.55)
          ctx.fillRect(px - 54 + gx * 9, cellY - 45 + gy * 9, 8, 8)
        }
      }
      label('grainy texture — NOT microstructure', px, cellY + 60, UC.amber)
    } else if (kind === 'anisotropy') {
      // A tendon: strong, highly angle-dependent parallel fibres.
      const ty = yFor(3.2)
      ctx.strokeStyle = withAlpha(UC.text, 0.8)
      ctx.lineWidth = 1.6
      for (let i = 0; i < 5; i += 1) {
        ctx.beginPath()
        ctx.moveTo(xFor(-0.85), ty + i * 5)
        ctx.lineTo(xFor(0.85), ty + i * 5)
        ctx.stroke()
      }
      // Perpendicular beam: the echo returns to the probe.
      const px1 = xFor(-0.4)
      drawPath([{ x: px1, y: yTop }, { x: px1, y: ty }], UC.cyan, { width: 2, alpha: 0.6 })
      drawPath([{ x: px1, y: ty }, { x: px1, y: yTop }], UC.green, { width: 2, alpha: 0.6, arrow: true })
      label('90° — echo returns: BRIGHT', px1, ty + 44, UC.green)
      // Oblique beam: the specular echo misses the probe entirely.
      const px2 = xFor(0.35)
      const hit: Pt = { x: xFor(0.5), y: ty }
      drawPath([{ x: px2, y: yTop }, hit], UC.cyan, { width: 2, alpha: 0.6 })
      drawPath([hit, { x: xFor(0.95), y: yTop + 24 }], UC.amber, { width: 2, alpha: 0.8, arrow: true })
      label('oblique — echo misses: FALSELY DARK', xFor(0.5), ty + 44, UC.amber)
    } else {
      // Doppler artefact mocks: a colour box drawn INSIDE the greyscale scene.
      const boxX0 = xFor(-0.7)
      const boxX1 = xFor(0.7)
      const boxY0 = yFor(1.6)
      const boxY1 = yFor(6.2)
      ctx.strokeStyle = withAlpha(UC.cyan, 0.7)
      ctx.lineWidth = 1.4
      ctx.strokeRect(boxX0, boxY0, boxX1 - boxX0, boxY1 - boxY0)
      label('COLOUR BOX', boxX1 - 40, boxY0 - 10, UC.cyan)
      const vy = (boxY0 + boxY1) / 2
      const vr = 20
      const cell = 7
      const paint = (x: number, y: number, colour: string, a = 0.85) => {
        ctx.fillStyle = withAlpha(colour, a)
        ctx.fillRect(x, y, cell - 1, cell - 1)
      }
      if (kind === 'doppler-twinkle') {
        // A rough calculus with a rapidly alternating mosaic tail behind it.
        blob(xFor(0), vy - 30, 12, '#f5f5f5', 0.95)
        shadeBand(xFor(0) - 14, xFor(0) + 14, vy - 16, false)
        for (let gy = 0; gy < 8; gy += 1) {
          for (let gx = 0; gx < 4; gx += 1) {
            const flick = Math.sin(time * 14 + gx * 3 + gy * 5) > 0
            paint(xFor(0) - 14 + gx * cell, vy - 12 + gy * cell, flick ? UC.red : UC.blue)
          }
        }
        label('rapid alternating colour BEHIND a rough calculus', xFor(0), boxY1 + 14, UC.muted)
      } else {
        // A vessel crossing the box.
        ctx.fillStyle = withAlpha('#0b1c30', 0.95)
        ctx.fillRect(boxX0, vy - vr, boxX1 - boxX0, vr * 2)
        ctx.strokeStyle = withAlpha(UC.text, 0.55)
        ctx.lineWidth = 1.6
        ctx.beginPath()
        ctx.moveTo(boxX0, vy - vr)
        ctx.lineTo(boxX1, vy - vr)
        ctx.moveTo(boxX0, vy + vr)
        ctx.lineTo(boxX1, vy + vr)
        ctx.stroke()
        const cols = Math.floor((boxX1 - boxX0) / cell)
        for (let gx = 0; gx < cols; gx += 1) {
          const f = gx / cols
          for (let gy = 0; gy < Math.floor((vr * 2) / cell); gy += 1) {
            const centre = Math.abs(gy * cell - vr + cell / 2) < vr * 0.45
            if (kind === 'doppler-aliasing') {
              // The fast core wraps to the opposite end of the scale.
              paint(boxX0 + gx * cell, vy - vr + 2 + gy * cell, centre ? UC.blue : UC.red, centre ? 0.9 : 0.75)
            } else if (kind === 'doppler-blooming') {
              paint(boxX0 + gx * cell, vy - vr + 2 + gy * cell, UC.red, 0.85)
            } else {
              // Flash: power Doppler splashes with tissue or probe motion.
              const on = Math.sin(time * 3 + f * 9) > 0.1
              if (on) paint(boxX0 + gx * cell, vy - vr + 2 + gy * cell, UC.amber, 0.7)
            }
          }
          if (kind === 'doppler-blooming') {
            // Excess colour gain spills OVER the vessel wall.
            const spill = 8 + 5 * Math.sin(time * 2 + f * 7)
            paint(boxX0 + gx * cell, vy - vr - spill, UC.red, 0.5)
            paint(boxX0 + gx * cell, vy + vr + spill - cell, UC.red, 0.5)
          }
          if (kind === 'doppler-flash') {
            const on = Math.sin(time * 3 + f * 5) > 0.55
            if (on) paint(boxX0 + gx * cell, boxY0 + 8 + ((gx * 13) % 40), UC.amber, 0.45)
          }
        }
        if (kind === 'doppler-aliasing') {
          label('fast core wraps red → blue: aliasing mosaic', xFor(0), boxY1 + 14, UC.muted)
        } else if (kind === 'doppler-blooming') {
          label('colour gain too high — colour spills past the wall', xFor(0), boxY1 + 14, UC.muted)
        } else {
          label('probe or tissue motion — colour splashed everywhere', xFor(0), boxY1 + 14, UC.muted)
        }
      }
    }

    /* --- reveal legend ------------------------------------------------------ */
    if (revealPath && showLabels && kind !== 'assumptions' && phase !== 'assumptions') {
      drawLabel(ctx, 'amber = true path · dashed cyan = machine assumed', xFor(0), height - 12, {
        colour: UC.muted,
        align: 'center',
        size: 9.5,
        background: true,
      })
    }
  }, [kind, revealPath, time, phase, describe, showLabels])

  return <canvas ref={canvasRef} role="img" aria-label={describe} />
}
