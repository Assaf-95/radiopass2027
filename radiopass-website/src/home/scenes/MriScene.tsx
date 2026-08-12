// Pinned MRI chapter: an ensemble of magnetic moments moves from random
// orientation, through alignment and precession, to RF excitation,
// relaxation and signal. The drawing is explicitly a conceptual model of
// net moments — the caption below the canvas says so.

import { Link } from 'react-router-dom'
import {
  C, rgba, lerp, seg, smoothstep, easeIO, mulberry32,
  type V3, rotX, rotY, add3, scale3, norm3, proj,
  usePinnedScene, applyFades, useElRegistry, sceneLabel, type Fade,
} from '../fx'

const CHAPTERS: [string, string][] = [
  ['No field', 'Outside the magnet, magnetic moments point randomly. The net magnetisation is zero.'],
  ['B₀ applied', 'A small excess aligns with the field — the tissue becomes polarised.'],
  ['Net magnetisation', 'The excess sums to M₀, precessing about B₀ at the Larmor frequency.'],
  ['RF excitation', 'A B₁ pulse at the Larmor frequency tips M₀ into the transverse plane.'],
  ['Relaxation', 'T1 — longitudinal recovery toward B₀. T2 — transverse dephasing and decay.'],
  ['Signal', 'The rotating transverse magnetisation induces the MR signal in the receive coil.'],
  ['Contrast', 'TR and TE choose which relaxation difference becomes image contrast.'],
]

const BANDS: [number, number][] = [
  [0, 0.12], [0.12, 0.26], [0.26, 0.4], [0.4, 0.54], [0.54, 0.7], [0.7, 0.84], [0.84, 1],
]

const rnd = mulberry32(90210)

interface Moment { pos: V3; random: V3; up: boolean; phase: number }
const MOMENTS: Moment[] = []
for (let gx = 0; gx < 4; gx++) for (let gy = 0; gy < 3; gy++) for (let gz = 0; gz < 2; gz++) {
  MOMENTS.push({
    pos: { x: (gx - 1.5) * 2.5, y: (gy - 1) * 2.7, z: (gz - 0.5) * 2.5 },
    random: norm3({ x: rnd() - 0.5, y: rnd() - 0.5, z: rnd() - 0.5 }),
    up: rnd() < 0.65,          // deliberate visual excess parallel to B₀
    phase: rnd() * Math.PI * 2,
  })
}

const CONE = 0.5

/* T1-weighted tissue signals for the closing contrast tiles (SE, TR 500 / TE 14). */
const TISSUES = [
  { name: 'Fat', t1: 260, t2: 80, pd: 0.95 },
  { name: 'White matter', t1: 780, t2: 90, pd: 0.8 },
  { name: 'CSF', t1: 4000, t2: 2000, pd: 1 },
].map(t => ({ ...t, s: t.pd * (1 - Math.exp(-500 / t.t1)) * Math.exp(-14 / t.t2) }))

function draw(ctx: CanvasRenderingContext2D, w: number, h: number, p: number, t: number) {
  const mobile = w < 760
  const cx = w * (mobile ? 0.5 : 0.6)
  const cy = h * (mobile ? 0.34 : 0.42)
  const f = Math.min(w, h) * 1.05
  const camZ = 11
  const world = (v: V3) => rotX(rotY(v, 0.55 + p * 0.25), 0.34)
  const P = (v: V3) => proj(world(v), cx, cy, f, camZ)

  const align = smoothstep(seg(p, 0.13, 0.24))
  const netA = smoothstep(seg(p, 0.27, 0.36))
  const flip = easeIO(seg(p, 0.41, 0.52)) * (Math.PI / 2)
  const coher = smoothstep(seg(p, 0.42, 0.52))
  const relax = seg(p, 0.55, 0.7)
  const mxy = Math.sin(flip) * Math.exp(-relax * 2.6)
  const mz = netA * (Math.cos(flip) + (1 - Math.cos(flip)) * (1 - Math.exp(-relax * 1.7)))

  /* --- B₀ field lines --- */
  const b0A = smoothstep(seg(p, 0.13, 0.2))
  if (b0A > 0) {
    ctx.strokeStyle = rgba(C.mri, 0.16 * b0A)
    ctx.lineWidth = 1
    for (let i = -3; i <= 3; i++) {
      const top = P({ x: i * 2, y: -5.4, z: 0 })
      const bot = P({ x: i * 2, y: 5.4, z: 0 })
      ctx.beginPath(); ctx.moveTo(bot.x, bot.y); ctx.lineTo(top.x, top.y); ctx.stroke()
    }
    const bTop = P({ x: -6.4, y: -5.2, z: 0 })
    const bBot = P({ x: -6.4, y: 5.2, z: 0 })
    ctx.strokeStyle = rgba(C.mri, 0.75 * b0A)
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.moveTo(bBot.x, bBot.y); ctx.lineTo(bTop.x, bTop.y); ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(bTop.x - 4, bTop.y + 7); ctx.lineTo(bTop.x, bTop.y); ctx.lineTo(bTop.x + 4, bTop.y + 7)
    ctx.stroke()
    sceneLabel(ctx, 'B₀', bTop.x, bTop.y - 12, b0A, { color: rgba(C.mri, 0.95), align: 'center', size: 13 })
  }

  /* --- moment arrows --- */
  const phCommon = t * 1.9 + p * 5
  for (const m of MOMENTS) {
    const ph = m.phase + t * 1.9 + p * 5
    const phase = lerp(ph, phCommon, coher * (1 - relax * 0.85))
    const axis = m.up ? -1 : 1
    const cone: V3 = {
      x: Math.sin(CONE) * Math.cos(phase),
      y: axis * Math.cos(CONE),
      z: Math.sin(CONE) * Math.sin(phase),
    }
    const dir = norm3({
      x: lerp(m.random.x, cone.x, align),
      y: lerp(m.random.y, cone.y, align),
      z: lerp(m.random.z, cone.z, align),
    })
    const len = 1.15
    const a = P(add3(m.pos, scale3(dir, -len * 0.5)))
    const b = P(add3(m.pos, scale3(dir, len * 0.5)))
    const alpha = (m.up || align < 0.5 ? 0.62 : 0.3) * (0.55 + b.s * 0.6)
    ctx.strokeStyle = rgba(C.ink, alpha)
    ctx.lineWidth = 1.3
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
    const ang = Math.atan2(b.y - a.y, b.x - a.x)
    ctx.beginPath()
    ctx.moveTo(b.x - Math.cos(ang - 0.45) * 5, b.y - Math.sin(ang - 0.45) * 5)
    ctx.lineTo(b.x, b.y)
    ctx.lineTo(b.x - Math.cos(ang + 0.45) * 5, b.y - Math.sin(ang + 0.45) * 5)
    ctx.stroke()
  }

  /* --- net magnetisation vector --- */
  if (netA > 0) {
    const mDir: V3 = {
      x: mxy * Math.cos(phCommon),
      y: -mz,
      z: mxy * Math.sin(phCommon),
    }
    const mLen = Math.max(0.15, Math.hypot(mDir.x, mDir.y, mDir.z))
    const tip = P(scale3(norm3(mDir), mLen * 4.4))
    const base = P({ x: 0, y: 0, z: 0 })
    // transverse plane, shown once RF becomes relevant
    const planeA = smoothstep(seg(p, 0.4, 0.47)) * (1 - smoothstep(seg(p, 0.8, 0.86)))
    if (planeA > 0) {
      ctx.strokeStyle = rgba(C.mri, 0.3 * planeA)
      ctx.setLineDash([3, 5])
      ctx.beginPath()
      for (let i = 0; i <= 48; i++) {
        const a = (i / 48) * Math.PI * 2
        const q = P({ x: Math.cos(a) * 4.4, y: 0, z: Math.sin(a) * 4.4 })
        i === 0 ? ctx.moveTo(q.x, q.y) : ctx.lineTo(q.x, q.y)
      }
      ctx.stroke()
      ctx.setLineDash([])
    }
    ctx.strokeStyle = rgba(C.amber, 0.95 * netA)
    ctx.lineWidth = 2.4
    ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(tip.x, tip.y); ctx.stroke()
    const ang = Math.atan2(tip.y - base.y, tip.x - base.x)
    ctx.fillStyle = rgba(C.amber, 0.95 * netA)
    ctx.beginPath()
    ctx.moveTo(tip.x, tip.y)
    ctx.lineTo(tip.x - Math.cos(ang - 0.4) * 9, tip.y - Math.sin(ang - 0.4) * 9)
    ctx.lineTo(tip.x - Math.cos(ang + 0.4) * 9, tip.y - Math.sin(ang + 0.4) * 9)
    ctx.closePath(); ctx.fill()
    sceneLabel(ctx, flip > 0.6 ? 'M — tipped by RF' : 'M₀ — net magnetisation', tip.x + 10, tip.y - 8,
      netA * (1 - smoothstep(seg(p, 0.82, 0.88))), { color: rgba(C.amber, 0.9) })
  }

  /* --- RF pulse marker --- */
  const rfA = smoothstep(seg(p, 0.41, 0.46)) * (1 - smoothstep(seg(p, 0.53, 0.6)))
  if (rfA > 0) {
    const bx = w * (mobile ? 0.1 : 0.33), by = cy + h * 0.16
    ctx.strokeStyle = rgba(C.mri, 0.85 * rfA)
    ctx.lineWidth = 1.4
    ctx.beginPath()
    for (let i = 0; i <= 60; i++) {
      const x = bx + i * 1.1
      const y = by + Math.sin(i * 0.55 + t * 6) * 7 * Math.sin((i / 60) * Math.PI)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
    sceneLabel(ctx, 'B₁ (RF) at the Larmor frequency', bx, by + 22, rfA, { color: rgba(C.mri, 0.9), size: 10.5 })
  }

  /* --- T1 / T2 relaxation graphs --- */
  const graphA = smoothstep(seg(p, 0.55, 0.61)) * (1 - smoothstep(seg(p, 0.84, 0.9)))
  if (graphA > 0 && !mobile) {
    const gw = w * 0.16, gh = h * 0.11
    const panels = [
      { x: w * 0.06, label: 'Mz — T1 recovery', fn: (u: number) => 1 - Math.exp(-u * 3.4), colour: C.amber },
      { x: w * 0.06 + gw + w * 0.04, label: 'Mxy — T2 decay', fn: (u: number) => Math.exp(-u * 3.4), colour: C.mri },
    ]
    for (const g of panels) {
      const gy = h * 0.72
      ctx.save()
      ctx.globalAlpha = graphA
      ctx.strokeStyle = rgba(C.ink, 0.28)
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(g.x, gy); ctx.lineTo(g.x, gy + gh); ctx.lineTo(g.x + gw, gy + gh); ctx.stroke()
      ctx.beginPath()
      const reach = Math.max(0.02, relax)
      for (let u = 0; u <= reach; u += 0.02) {
        const x = g.x + u * gw
        const y = gy + gh - g.fn(u) * gh * 0.9
        u === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(g.colour, 0.9)
      ctx.lineWidth = 1.5
      ctx.stroke()
      const mu = reach
      ctx.fillStyle = rgba(g.colour, 1)
      ctx.beginPath(); ctx.arc(g.x + mu * gw, gy + gh - g.fn(mu) * gh * 0.9, 2.4, 0, Math.PI * 2); ctx.fill()
      ctx.restore()
      sceneLabel(ctx, g.label, g.x, gy - 10, graphA, { size: 10.5, color: rgba(g.colour, 0.9) })
    }
  }

  /* --- receive coil + induced signal --- */
  const sigA = smoothstep(seg(p, 0.71, 0.77)) * (1 - smoothstep(seg(p, 0.9, 0.96)))
  if (sigA > 0) {
    const coil = P({ x: 6.6, y: 0, z: 0 })
    ctx.strokeStyle = rgba(C.ink, 0.6 * sigA)
    ctx.lineWidth = 1.4
    ctx.beginPath(); ctx.ellipse(coil.x, coil.y, 9, 16, 0, 0, Math.PI * 2); ctx.stroke()
    const sw = w * 0.14
    const prog = seg(p, 0.72, 0.84)
    ctx.strokeStyle = rgba(C.mri, 0.85 * sigA)
    ctx.beginPath()
    for (let i = 0; i <= 80 * prog; i++) {
      const x = coil.x + 16 + (i / 80) * sw
      const y = coil.y + Math.sin(i * 0.5) * 13 * Math.exp(-(i / 80) * 2.6)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
    sceneLabel(ctx, 'induced signal (FID)', coil.x + 20, coil.y + 26, sigA, { color: rgba(C.mri, 0.9), size: 10.5 })
  }

  /* --- contrast tiles --- */
  const tileA = smoothstep(seg(p, 0.85, 0.92))
  if (tileA > 0) {
    const tw = Math.min(110, w * 0.11), th = tw * 0.82
    const total = TISSUES.length * tw + (TISSUES.length - 1) * 14
    let tx = cx - total / 2
    const ty = mobile ? h * 0.62 : h * 0.66
    for (const tissue of TISSUES) {
      ctx.fillStyle = rgba('#0F1318', tileA)
      ctx.strokeStyle = rgba(C.ink, 0.25 * tileA)
      ctx.beginPath(); ctx.roundRect(tx, ty, tw, th, 6); ctx.fill(); ctx.stroke()
      ctx.fillStyle = rgba(C.ink, Math.min(1, tissue.s * 1.35) * tileA)
      ctx.beginPath(); ctx.roundRect(tx + 7, ty + 7, tw - 14, th - 26, 4); ctx.fill()
      sceneLabel(ctx, tissue.name, tx + tw / 2, ty + th - 10, tileA, { align: 'center', size: 10 })
      tx += tw + 14
    }
    sceneLabel(ctx, 'T1-weighted appearance — short TR, short TE', cx, ty + th + 18, tileA, { align: 'center', size: 11, color: rgba(C.amber, 0.9) })
  }
}

export default function MriScene() {
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
        in: [a + 0.005, a + 0.04],
        out: i === CHAPTERS.length - 1 ? undefined : [b - 0.025, b + 0.005],
        y: 22,
      })
    }
    applyFades(fades, p)
  }, { staticP: 0.48 })

  return (
    <section className={`hm-stage hm-stage-mri${scene.reduced ? ' is-rm' : ''}`} ref={scene.wrapRef} aria-labelledby="hm-mri-h">
      <div className="hm-pin">
        <canvas ref={scene.canvasRef} className="hm-canvas" aria-hidden="true" />
        <div className="hm-stage-copy">
          <div ref={set('head')} className="hm-fade hm-stage-head">
            <p className="hm-eyebrow hm-acc-mri">MRI physics</p>
            <h2 id="hm-mri-h">Turn magnetisation into contrast.</h2>
            <p className="hm-stage-sub">See alignment, excitation, relaxation and signal formation in three dimensions.</p>
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
            <Link className="hm-btn hm-btn-line" to="/mri-lab">Explore MRI Physics</Link>
          </div>
        </div>
        <p className="hm-scene-note">Conceptual model — arrows represent net magnetic moments and precession, not spinning particles.</p>
      </div>
    </section>
  )
}
