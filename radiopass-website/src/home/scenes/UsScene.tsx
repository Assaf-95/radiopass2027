// Pinned ultrasound chapter: a longitudinal pulse crosses three tissue
// layers. Particles genuinely oscillate along the direction of travel;
// reflection, transmission, refraction and attenuation all follow from
// the layer speeds and impedances used to drive the animation.

import { Link } from 'react-router-dom'
import {
  C, rgba, clamp, seg, smoothstep, easeIO,
  usePinnedScene, applyFades, useElRegistry, sceneLabel, type Fade,
} from '../fx'

const CHAPTERS: [string, string][] = [
  ['Longitudinal wave', 'Particles oscillate along the direction of travel — compression, then rarefaction.'],
  ['Wavelength', 'λ = c / f. The transducer sets the frequency; the tissue sets the speed.'],
  ['Acoustic impedance', 'The impedance mismatch at an interface decides how much reflects. The rest transmits.'],
  ['Refraction', 'A change of propagation speed at an oblique interface bends the transmitted beam.'],
  ['Attenuation', 'Absorption and scattering dim the pulse with depth — faster at higher frequency.'],
]

const BANDS: [number, number][] = [[0.02, 0.2], [0.2, 0.34], [0.34, 0.55], [0.55, 0.75], [0.75, 1]]

/* Relative propagation speeds and the tilt of the second interface. */
const C1 = 1, C2 = 1.35, C3 = 0.8
const TILT = 0.24 // rad

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const mobile = w < 760
  const x0 = w * 0.13, xa = w * 0.42, xb = w * 0.66
  const y1 = h * 0.14, y2 = h * (mobile ? 0.6 : 0.68)
  const yMid = (y1 + y2) / 2
  const lam1 = w * 0.03

  // Refraction geometry at the tilted interface.
  const thI = TILT
  const thT = Math.asin(clamp((C3 / C2) * Math.sin(thI), -1, 1))
  const bend = thI - thT
  const dirT = { x: Math.cos(bend), y: Math.sin(bend) }
  const i2x = (y: number) => xb + (yMid - y) * Math.tan(TILT)

  /* --- pulse kinematics (acoustic time; speed set by each medium) --- */
  const a1 = (xa - x0) / C1, a2 = (xb - xa) / C2, a3 = (w * 0.26) / C3
  const T = a1 + a2 + a3
  const tau = easeIO(seg(p, 0.04, 0.92)) * T

  let centre = { x: x0, y: yMid }, dir = { x: 1, y: 0 }, lam = lam1 * C1
  if (tau < a1) {
    centre = { x: x0 + tau * C1, y: yMid }
  } else if (tau < a1 + a2) {
    centre = { x: xa + (tau - a1) * C2, y: yMid }
    lam = lam1 * C2
  } else {
    const s = (tau - a1 - a2) * C3
    const px0 = i2x(yMid)
    centre = { x: px0 + dirT.x * s, y: yMid + dirT.y * s }
    dir = dirT
    lam = lam1 * C3
  }
  // Display amplitude: transmission losses at I1 plus depth attenuation.
  const afterI1 = tau > a1 ? 0.82 : 1
  const amp = afterI1 * Math.exp(-0.9 * (tau / T)) * (tau > a1 + a2 ? Math.exp(-1.4 * ((tau - a1 - a2) / a3)) : 1)

  // Reflected pulse from the first interface.
  const refX = tau > a1 ? xa - (tau - a1) * C1 : -1
  const refAmp = 0.42 * Math.exp(-0.5 * (tau / T))
  const refAlive = refX > x0 + 4

  /* --- tissue layers --- */
  const fills = [0.018, 0.042, 0.068]
  ctx.fillStyle = rgba(C.ink, fills[0]); ctx.fillRect(x0, y1, xa - x0, y2 - y1)
  ctx.fillStyle = rgba(C.ink, fills[1])
  ctx.beginPath()
  ctx.moveTo(xa, y1); ctx.lineTo(i2x(y1), y1); ctx.lineTo(i2x(y2), y2); ctx.lineTo(xa, y2)
  ctx.closePath(); ctx.fill()
  ctx.fillStyle = rgba(C.ink, fills[2])
  ctx.beginPath()
  ctx.moveTo(i2x(y1), y1); ctx.lineTo(w * 0.96, y1); ctx.lineTo(w * 0.96, y2); ctx.lineTo(i2x(y2), y2)
  ctx.closePath(); ctx.fill()
  ctx.strokeStyle = rgba(C.ink, 0.2)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(xa, y1); ctx.lineTo(xa, y2); ctx.stroke()
  ctx.beginPath(); ctx.moveTo(i2x(y1), y1); ctx.lineTo(i2x(y2), y2); ctx.stroke()

  /* --- transducer --- */
  ctx.fillStyle = rgba('#2A3038', 1)
  ctx.strokeStyle = rgba(C.ink, 0.4)
  ctx.beginPath()
  ctx.roundRect(w * 0.075, yMid - h * 0.09, x0 - w * 0.075, h * 0.18, 5)
  ctx.fill(); ctx.stroke()
  ctx.strokeStyle = rgba(C.us, 0.5)
  for (let i = 0; i < 4; i++) {
    const y = yMid - h * 0.06 + i * h * 0.04
    ctx.beginPath(); ctx.moveTo(w * 0.09, y); ctx.lineTo(x0 - 5, y); ctx.stroke()
  }

  /* --- particle lattice with longitudinal displacement --- */
  const colStep = w * (mobile ? 0.02 : 0.0125)
  const rowStep = (y2 - y1) / (mobile ? 9 : 13)
  const S = Math.min(8, colStep * 0.55)          // px displacement scale
  const sigma = lam * 1.15

  const packetDisp = (d: number, lamL: number, a: number) => {
    const env = Math.exp(-(d * d) / (2 * sigma * sigma))
    return {
      u: a * env * Math.sin((d / lamL) * Math.PI * 2),
      comp: -a * env * Math.cos((d / lamL) * Math.PI * 2),
    }
  }

  for (let x = x0 + colStep; x < w * 0.95; x += colStep) {
    for (let y = y1 + rowStep * 0.6; y < y2; y += rowStep) {
      // main packet: distance measured along its propagation direction
      const rel = { x: x - centre.x, y: y - centre.y }
      const d = rel.x * dir.x + rel.y * dir.y
      const off = rel.x * -dir.y + rel.y * dir.x
      const lateral = Math.exp(-(off * off) / (2 * Math.pow((y2 - y1) * 0.42, 2)))
      const m = packetDisp(d, lam, amp * lateral)
      // reflected packet moves along -x in layer 1
      const r = refAlive ? packetDisp(x - refX, lam1, x < xa ? refAmp : 0) : { u: 0, comp: 0 }
      const ux = dir.x * m.u * S - r.u * S
      const uy = dir.y * m.u * S
      const comp = m.comp + r.comp
      let alpha = 0.3, colour = C.ink
      if (comp > 0.05) { alpha = 0.3 + clamp(comp * 2.4) * 0.55; colour = C.us }
      else if (comp < -0.05) alpha = 0.18
      ctx.fillStyle = rgba(colour, alpha)
      ctx.beginPath(); ctx.arc(x + ux, y + uy, 1.5, 0, Math.PI * 2); ctx.fill()
    }
  }

  /* --- chapter-keyed callouts on the canvas --- */
  const yTop = y1 - 14

  // 1: compression / rarefaction, riding with the packet
  const ch1 = smoothstep(seg(p, 0.05, 0.1)) * (1 - smoothstep(seg(p, 0.19, 0.24)))
  if (ch1 > 0 && centre.x < xa) {
    sceneLabel(ctx, 'compression', centre.x - lam * 0.5, yTop, ch1, { color: rgba(C.us, 0.9), align: 'center', leader: [centre.x - lam * 0.5, y1 + 6] })
    sceneLabel(ctx, 'rarefaction', centre.x + lam * 0.55, y2 + 16, ch1, { align: 'center', leader: [centre.x + lam * 0.55, y2 - 6] })
  }

  // 2: wavelength bracket
  const ch2 = smoothstep(seg(p, 0.21, 0.26)) * (1 - smoothstep(seg(p, 0.33, 0.38)))
  if (ch2 > 0) {
    const bx1 = centre.x - lam / 2, bx2 = centre.x + lam / 2, by = y1 - 26
    ctx.save()
    ctx.globalAlpha = ch2
    ctx.strokeStyle = rgba(C.amber, 0.8)
    ctx.beginPath()
    ctx.moveTo(bx1, by + 5); ctx.lineTo(bx1, by); ctx.lineTo(bx2, by); ctx.lineTo(bx2, by + 5)
    ctx.stroke()
    ctx.restore()
    sceneLabel(ctx, 'λ = c / f', (bx1 + bx2) / 2, by - 11, ch2, { color: rgba(C.amber, 0.95), align: 'center', size: 12 })
  }

  // 3: impedance + reflected/transmitted split
  const ch3 = smoothstep(seg(p, 0.36, 0.42)) * (1 - smoothstep(seg(p, 0.53, 0.6)))
  if (ch3 > 0) {
    sceneLabel(ctx, 'Z₁ = ρ₁c₁', (x0 + xa) / 2, y2 + 18, ch3, { align: 'center' })
    sceneLabel(ctx, 'Z₂ = ρ₂c₂', (xa + xb) / 2, y2 + 18, ch3, { align: 'center' })
    if (refAlive) sceneLabel(ctx, '← reflected', refX, yTop, ch3, { color: rgba(C.us, 0.9), align: 'center' })
    if (centre.x > xa) sceneLabel(ctx, 'transmitted →', Math.min(centre.x, xb - 10), yTop, ch3, { align: 'center' })
  }

  // 4: refraction construction at the tilted interface
  const ch4 = smoothstep(seg(p, 0.56, 0.62)) * (1 - smoothstep(seg(p, 0.74, 0.8)))
  if (ch4 > 0) {
    const ix = i2x(yMid), iy = yMid
    ctx.save()
    ctx.globalAlpha = ch4
    // normal (dashed)
    const n = { x: Math.cos(TILT), y: Math.sin(TILT) }
    ctx.setLineDash([4, 4])
    ctx.strokeStyle = rgba(C.mut, 0.7)
    ctx.beginPath()
    ctx.moveTo(ix - n.x * w * 0.06, iy - n.y * w * 0.06)
    ctx.lineTo(ix + n.x * w * 0.06, iy + n.y * w * 0.06)
    ctx.stroke()
    ctx.setLineDash([])
    // incident + refracted beam arrows
    for (const [d, colour] of [[{ x: -1, y: 0 }, C.mut], [dirT, C.us]] as const) {
      const sgn = d === dirT ? 1 : 1
      ctx.strokeStyle = rgba(colour, 0.9)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.moveTo(ix - (d === dirT ? 0 : d.x * -w * 0.001), iy)
      ctx.lineTo(ix + d.x * sgn * w * 0.075, iy + d.y * sgn * w * 0.075)
      ctx.stroke()
    }
    ctx.restore()
    sceneLabel(ctx, 'slower medium — bends toward the normal', ix + w * 0.02, y2 + 18, ch4, { color: rgba(C.us, 0.9) })
  }

  // 5: scatter + absorption
  const ch5 = smoothstep(seg(p, 0.77, 0.83))
  if (ch5 > 0 && tau > a1 + a2) {
    const sx = i2x(yMid) + dirT.x * w * 0.1, sy = yMid + dirT.y * w * 0.1
    const tw = 0.6 + 0.4 * Math.sin(t * 2.2)
    ctx.strokeStyle = rgba(C.us, 0.45 * ch5 * tw)
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4
      ctx.beginPath()
      ctx.moveTo(sx + Math.cos(a) * 5, sy + Math.sin(a) * 5)
      ctx.lineTo(sx + Math.cos(a) * 13, sy + Math.sin(a) * 13)
      ctx.stroke()
    }
    sceneLabel(ctx, 'scattering', sx, sy - 20, ch5 * (1 - smoothstep(seg(p, 0.93, 0.98))), { color: rgba(C.us, 0.85), align: 'center' })
  }

  /* --- amplitude-vs-depth graph (explicitly a graph, not the wave) --- */
  const graphA = smoothstep(seg(p, 0.24, 0.32))
  if (graphA > 0) {
    const gy = h * (mobile ? 0.76 : 0.8), gh = h * 0.1
    ctx.save()
    ctx.globalAlpha = graphA
    ctx.strokeStyle = rgba(C.ink, 0.3)
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(x0, gy + gh); ctx.lineTo(w * 0.95, gy + gh); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0, gy + gh); ctx.stroke()
    const reach = Math.min(centre.x + (centre.y - yMid) * 0, w * 0.95)
    ctx.beginPath()
    for (let x = x0; x <= reach; x += 4) {
      let aHere = Math.exp(-0.9 * ((x - x0) / (w * 0.7)))
      if (x > xa) aHere *= 0.82
      if (x > xb) aHere *= Math.exp(-1.6 * ((x - xb) / (w * 0.28)))
      const y = gy + gh - aHere * gh * 0.95
      x === x0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.strokeStyle = rgba(C.us, 0.8)
    ctx.lineWidth = 1.4
    ctx.stroke()
    ctx.restore()
    sceneLabel(ctx, 'amplitude vs depth (graph)', x0 - 6, gy - 10, graphA, { size: 10, color: rgba(C.mut, 1) })
  }

  /* --- layer labels --- */
  if (!mobile) {
    const layA = smoothstep(seg(p, 0.02, 0.08))
    sceneLabel(ctx, 'Soft tissue · c ≈ 1540 m/s', (x0 + xa) / 2, y1 - 34, layA * 0.9, { align: 'center', size: 10.5 })
    sceneLabel(ctx, 'Faster medium', (xa + xb) / 2, y1 - 34, layA * 0.9 * smoothstep(seg(p, 0.3, 0.36)), { align: 'center', size: 10.5 })
    sceneLabel(ctx, 'Slower, attenuating medium', i2x(y1) + w * 0.1, y1 - 34, layA * 0.9 * smoothstep(seg(p, 0.5, 0.56)), { align: 'center', size: 10.5 })
    sceneLabel(ctx, 'Transducer — sets f', w * 0.1, yMid + h * 0.12, smoothstep(seg(p, 0.2, 0.27)) * (1 - smoothstep(seg(p, 0.36, 0.42))), { align: 'center', size: 10.5 })
  }
}

export default function UsScene() {
  const { els, set } = useElRegistry()

  const scene = usePinnedScene(draw, p => {
    const fades: Fade[] = [
      { el: els.current.head, in: [0, 0.03], y: 20 },
      { el: els.current.cta, in: [0.85, 0.91], y: 16 },
    ]
    for (let i = 0; i < CHAPTERS.length; i++) {
      const [a, b] = BANDS[i]
      fades.push({
        el: els.current['ch' + i],
        in: [a + 0.005, a + 0.045],
        out: i === CHAPTERS.length - 1 ? undefined : [b - 0.03, b + 0.005],
        y: 22,
      })
    }
    applyFades(fades, p)
  }, { staticP: 0.45 })

  return (
    <section className={`hm-stage hm-stage-us${scene.reduced ? ' is-rm' : ''}`} ref={scene.wrapRef} aria-labelledby="hm-us-h">
      <div className="hm-pin">
        <canvas ref={scene.canvasRef} className="hm-canvas" aria-hidden="true" />
        <div className="hm-stage-copy hm-copy-right">
          <div ref={set('head')} className="hm-fade hm-stage-head">
            <p className="hm-eyebrow hm-acc-us">Ultrasound physics</p>
            <h2 id="hm-us-h">Watch sound move through tissue.</h2>
            <p className="hm-stage-sub">Change the frequency, angle and acoustic interface. See the consequence immediately.</p>
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
            <Link className="hm-btn hm-btn-line" to="/ultrasound-lab">Enter the Ultrasound Lab</Link>
          </div>
        </div>
      </div>
    </section>
  )
}
