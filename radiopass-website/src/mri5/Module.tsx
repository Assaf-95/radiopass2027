/**
 * The MRI module shell and its front page.
 *
 * The hero is the bore seen down its own axis, with a proton precessing in it.
 * It is drawn, not photographed, and it is the one piece of the module allowed
 * to be atmospheric — everything past it has to earn its pixels by teaching.
 * It also does real work: the precession it shows is the Larmor precession
 * section 5.2 goes on to define, at a rate that actually scales with the field
 * strength printed beside it.
 */

import { useEffect, useRef } from 'react'
import { Link, Outlet } from 'react-router-dom'

import { C, rgba, useReducedMotion } from '../home/fx'
import { ModuleNav } from './Nav'
import { GROUPS, SECTIONS, sectionPath } from './sections'
import './mri5.css'

const MRI = C.mri
const FIELD_T = 1.5
const GAMMA_BAR = 42.58 // MHz/T

/* ------------------------------------------------------------------ *
 * Hero
 * ------------------------------------------------------------------ */

/** The bore in perspective, with B₀ along its axis and one proton precessing. */
function drawHero(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  const cx = w * 0.5
  const cy = h * 0.52
  const reach = Math.min(w, h)

  // --- the bore: concentric ellipses receding down the z axis -------------
  const rings = 16
  for (let i = rings - 1; i >= 0; i -= 1) {
    const depth = i / (rings - 1)
    const scale = 1 - depth * 0.62
    const rx = reach * 0.46 * scale
    const ry = reach * 0.34 * scale
    const y = cy + depth * reach * 0.06
    const alpha = (1 - depth) * 0.16 + 0.03
    ctx.strokeStyle = rgba(C.xray, alpha)
    ctx.lineWidth = i === 0 ? 1.6 : 1
    ctx.beginPath()
    ctx.ellipse(cx, y, rx, ry, 0, 0, Math.PI * 2)
    ctx.stroke()
  }

  // A pool of light in the throat of the bore.
  const glow = ctx.createRadialGradient(cx, cy + reach * 0.05, reach * 0.02, cx, cy, reach * 0.34)
  glow.addColorStop(0, rgba(MRI, 0.16))
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.beginPath()
  ctx.ellipse(cx, cy, reach * 0.44, reach * 0.33, 0, 0, Math.PI * 2)
  ctx.fill()

  // --- B0 along the bore axis --------------------------------------------
  // Drawn as flow marks travelling into the bore: the field is not a picture,
  // it has a direction, and every later section relies on it being +z.
  const marks = 9
  for (let i = 0; i < marks; i += 1) {
    const phase = ((t * 0.09) + i / marks) % 1
    const scale = 1 - phase * 0.62
    const rx = reach * 0.46 * scale
    const ry = reach * 0.34 * scale
    const y = cy + phase * reach * 0.06
    const a = Math.sin(phase * Math.PI) * 0.36
    ctx.strokeStyle = rgba(C.xrayBright, a)
    ctx.lineWidth = 1.2
    for (const angle of [-Math.PI / 2, Math.PI / 2]) {
      ctx.beginPath()
      ctx.ellipse(cx, y, rx, ry, 0, angle - 0.16, angle + 0.16)
      ctx.stroke()
    }
  }

  // --- the proton ---------------------------------------------------------
  // Precession about B0: the spin axis sweeps a cone, it does not tumble.
  const px = cx
  const py = cy - reach * 0.02
  const coneR = reach * 0.13
  const coneH = reach * 0.2
  const omega = t * 1.15

  // the cone the magnetic moment sweeps
  ctx.strokeStyle = rgba(MRI, 0.22)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.ellipse(px, py - coneH, coneR, coneR * 0.34, 0, 0, Math.PI * 2)
  ctx.stroke()

  // B0 axis through the proton
  ctx.strokeStyle = rgba(C.ink, 0.3)
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(px, py + coneH * 0.5)
  ctx.lineTo(px, py - coneH * 1.5)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(px - 5, py - coneH * 1.34)
  ctx.lineTo(px, py - coneH * 1.5)
  ctx.lineTo(px + 5, py - coneH * 1.34)
  ctx.stroke()

  // the moment itself
  const tipX = px + Math.cos(omega) * coneR
  const tipY = py - coneH + Math.sin(omega) * coneR * 0.34
  ctx.save()
  ctx.shadowColor = rgba(MRI, 0.8)
  ctx.shadowBlur = 16
  ctx.strokeStyle = rgba(C.ink, 0.95)
  ctx.lineWidth = 2.4
  ctx.beginPath()
  ctx.moveTo(px, py)
  ctx.lineTo(tipX, tipY)
  ctx.stroke()
  ctx.restore()
  ctx.fillStyle = rgba(C.ink, 0.95)
  ctx.beginPath()
  ctx.arc(tipX, tipY, 4, 0, Math.PI * 2)
  ctx.fill()

  // the nucleus
  const g = ctx.createRadialGradient(px - 3, py - 3, 0, px, py, 11)
  g.addColorStop(0, rgba(MRI, 0.9))
  g.addColorStop(1, rgba(MRI, 0.12))
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(px, py, 11, 0, Math.PI * 2)
  ctx.fill()

  // a faint trail of the tip, so the path reads as circular
  ctx.strokeStyle = rgba(MRI, 0.4)
  ctx.lineWidth = 1.4
  ctx.beginPath()
  for (let i = 0; i <= 22; i += 1) {
    const a = omega - (i / 22) * 1.5
    const x = px + Math.cos(a) * coneR
    const y = py - coneH + Math.sin(a) * coneR * 0.34
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()

  // --- labels -------------------------------------------------------------
  ctx.font = '500 11px Inter, system-ui, sans-serif'
  ctx.fillStyle = rgba(C.ink, 0.5)
  ctx.textAlign = 'center'
  ctx.fillText('B₀', px, py - coneH * 1.5 - 12)
  ctx.textAlign = 'left'
  ctx.fillStyle = rgba(C.mut, 0.9)
  ctx.fillText(`${FIELD_T} T  ·  f₀ = ${(GAMMA_BAR * FIELD_T).toFixed(2)} MHz`, 16, h - 18)
  ctx.textAlign = 'right'
  ctx.fillText('z — head to foot', w - 16, h - 18)
}

function Hero() {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    const host = hostRef.current
    const canvas = canvasRef.current
    if (!host || !canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let w = 0
    let h = 0
    let visible = true
    const t0 = performance.now()

    const paint = (t: number) => {
      if (!w || !h) return
      ctx.clearRect(0, 0, w, h)
      drawHero(ctx, w, h, t)
    }
    const size = () => {
      const rect = host.getBoundingClientRect()
      const nw = Math.max(1, Math.floor(rect.width))
      const nh = Math.max(1, Math.floor(rect.height))
      if (nw === w && nh === h) return
      w = nw; h = nh
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      canvas.width = Math.round(w * dpr)
      canvas.height = Math.round(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      paint(reduced ? 2.4 : (performance.now() - t0) / 1000)
    }
    const loop = () => {
      paint((performance.now() - t0) / 1000)
      raf = visible ? requestAnimationFrame(loop) : 0
    }
    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? true
      if (visible && !reduced && !raf) raf = requestAnimationFrame(loop)
      else if (!visible && raf) { cancelAnimationFrame(raf); raf = 0 }
    })
    io.observe(host)
    const ro = new ResizeObserver(size)
    ro.observe(host)
    size()
    if (reduced) paint(2.4)
    else raf = requestAnimationFrame(loop)

    return () => { if (raf) cancelAnimationFrame(raf); io.disconnect(); ro.disconnect() }
  }, [reduced])

  return (
    <div ref={hostRef} className="m5-hero-art">
      <canvas ref={canvasRef} role="img" aria-label="A proton precessing about the B₀ field inside the magnet bore, seen down the bore axis." />
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The causal chain — the module's argument in one line each
 * ------------------------------------------------------------------ */

const CHAIN: { label: string; slug: string }[] = [
  { label: 'Hydrogen has a magnetic moment', slug: 'introduction' },
  { label: 'B₀ makes it precess', slug: 'introduction' },
  { label: 'Precession has a Larmor frequency', slug: 'introduction' },
  { label: 'RF at that frequency is resonance', slug: 'introduction' },
  { label: 'B₁ tips the magnetisation over', slug: 'introduction' },
  { label: 'Transverse magnetisation induces a signal', slug: 'introduction' },
  { label: 'The signal decays — T1 and T2', slug: 't1-t2-signal' },
  { label: 'Sequences time when you look', slug: 'spin-echo' },
  { label: 'TR and TE choose the weighting', slug: 'weighting' },
  { label: 'Gradients encode position', slug: 'spatial-encoding' },
  { label: 'K-space stores spatial frequency', slug: 'k-space' },
  { label: 'The Fourier transform makes the image', slug: 'k-space' },
]

export function KnowledgeMap() {
  return (
    <section className="m5-map" aria-label="How the module fits together">
      <h3>One argument, twelve steps</h3>
      <p className="m5-map-lede">
        Nothing in MRI is a standalone fact. Every line below is caused by the one
        above it — follow any node back to the section that establishes it.
      </p>
      <ol className="m5-map-chain">
        {CHAIN.map((node, i) => (
          <li key={`${node.slug}-${i}`}>
            <Link to={sectionPath(node.slug)}>
              <span aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              {node.label}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ------------------------------------------------------------------ *
 * Front page
 * ------------------------------------------------------------------ */

export function MriHome() {
  useEffect(() => {
    document.title = 'MRI physics · RadioPass'
    return () => { document.title = 'RadioPass — FRCR Part 1 Physics, Made Visual' }
  }, [])

  return (
    <div className="m5-home">
      <header className="m5-hero">
        <div className="m5-hero-copy">
          <p className="m5-eyebrow"><span className="m5-number">5</span> FRCR Part 1 · Physics</p>
          <h1>Magnetic resonance,<br /><em>shown moving.</em></h1>
          <p className="m5-hero-lede">
            MRI is hard for one reason: almost everything that matters is a
            three-dimensional motion you are expected to imagine. So this module
            does not describe those motions — it runs them. Twenty-one sections,
            every mechanism animated, every control wired to the real equation.
          </p>
          <div className="m5-hero-actions">
            <Link className="m5-btn m5-btn-solid" to={sectionPath('mr-machine')}>Start at the machine</Link>
            <Link className="m5-btn m5-btn-ghost" to="/mri-lab/course">The sequence laboratory</Link>
          </div>
        </div>
        <Hero />
      </header>

      <section className="m5-contents" aria-label="Contents">
        {GROUPS.map((group) => {
          const rows = SECTIONS.filter((s) => s.group === group.id)
          if (rows.length === 0) return null
          return (
            <div key={group.id} className="m5-contents-group">
              <div className="m5-contents-label">
                <h3>{group.label}</h3>
                <span>{rows.length === 1 ? '1 section' : `${rows.length} sections`}</span>
              </div>
              <ul>
                {rows.map((s) => (
                  <li key={s.slug}>
                    <Link to={sectionPath(s.slug)} className="m5-contents-card">
                      <span className="m5-contents-n">{s.number}</span>
                      <span className="m5-contents-body">
                        <strong>{s.title}</strong>
                        <span>{s.summary}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </section>

      <KnowledgeMap />
    </div>
  )
}

/** Route shell: the navigator plus whichever section is showing. */
export default function MriModule() {
  return (
    <main className="m5-root">
      <ModuleNav />
      <div className="m5-body">
        <Outlet />
      </div>
      <footer className="m5-foot">
        <Link to="/visual-lab">← Visual lab</Link>
        <span>MRI · chapter 5 · FRCR Part 1 physics</span>
        <Link to="/mri-lab/course">Sequence laboratory →</Link>
      </footer>
    </main>
  )
}
