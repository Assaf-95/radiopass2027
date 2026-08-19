/**
 * The RadioPass front door.
 *
 * Anatomy and Physics were built as two separate deployments; to a candidate
 * they are one revision platform for one examination, and this is the page
 * that says so. It teaches nothing itself — its whole job is to state what the
 * First FRCR asks for, show that both halves of it are here, and send someone
 * into the right one in a click.
 *
 * The voice is a journal's rather than a landing page's: a masthead rule,
 * roman-numbered sections in the margin, a contents index set with dotted
 * leaders, and a data layer in monospace — which on a radiology site is not a
 * stylistic tic but the typeface a DICOM overlay is actually set in.
 *
 * The signature is one unbroken hairline drawn across the whole hero: on the
 * left it is a lateral profile — the form, which is anatomy — and without
 * lifting off the page it becomes a decaying resonance — the signal, which is
 * physics. One line, both papers. An amber readout travels it like a plotter
 * head, because everything on this site is drawn rather than photographed.
 *
 * Below, the two modules are presented as numbered plates, the way figures
 * are set in a monograph. Every number on this page is counted from the
 * shipped data (see COUNTS). Nothing here claims a past paper or a recall —
 * see the site's content rules.
 */

import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import './portal.css'
import { Logo } from '../design/logo'
import { ThemeToggle } from '../design/theme'
import { SIGNAL_GLYPHS } from '../design/signals'
/* The anatomy visual family — the owner's approved renders (19 Aug 2026),
   presented as sculptural objects, never labelled, never used in questions. */
import imgBrain from '../assets/sculpture/brain.jpg'
import imgChest from '../assets/sculpture/chest.jpg'
import imgGi from '../assets/sculpture/gi.jpg'
import imgRenal from '../assets/sculpture/renal.jpg'
import imgMsk from '../assets/sculpture/msk.jpg'

/* Anatomy is a route of this application now, not a second deployment, so
   these are ordinary internal paths and ordinary <Link>s: client-side
   navigation, no page reload, no VITE_ANATOMY_URL to configure. The old
   `${ANATOMY_URL}/#/section/…` form still resolves for anyone arriving on an
   old bookmark — AnatomyRoutes redirects it — but nothing in the product
   should still be MINTING that form. */
const anatomy = (path = '') => `/anatomy${path}`

/* The anatomy gallery: five sculptural objects, each the door to its region.
   Two regions have no render yet (upper limb, spine) — the owner supplies
   those in the same style; the gallery composition already leaves them room.
   Kidneys and GI tract both belong to Abdomen & Pelvis and both say so:
   the caption names the OBJECT first and the exam region under it. */
const SCULPTURES: { key: string; img: string; name: string; region: string; to: string }[] = [
  { key: 'brain', img: imgBrain, name: 'Brain', region: 'Head & Neck', to: anatomy('/section/head-neck') },
  { key: 'chest', img: imgChest, name: 'Lungs', region: 'Thorax', to: anatomy('/section/thorax') },
  { key: 'gi', img: imgGi, name: 'GI tract', region: 'Abdomen & Pelvis', to: anatomy('/section/abdo-pelvis') },
  { key: 'renal', img: imgRenal, name: 'Kidneys', region: 'Abdomen & Pelvis', to: anatomy('/section/abdo-pelvis') },
  { key: 'msk', img: imgMsk, name: 'Bone', region: 'Lower Limb', to: anatomy('/section/lower-limb') },
]

/* ------------------------------------------------------------------ *
 * The numbers
 *
 * Counted from the shipped data rather than estimated, and written here as
 * literals rather than imported, because importing them would pull the whole
 * question bank and both regions' JSON into the first page a visitor loads.
 * Recount with:
 *
 *   anatomy   node -e "…filter(q=>!q.excludeFromPlay)…"  in frcr-anatomy/src/data
 *   physics   src/qbank/data/{questions.base,extracted}.json
 *
 * If a count drifts, it under-claims: every figure below is the number of
 * items that a candidate can actually open today.
 * ------------------------------------------------------------------ */

const COUNTS = {
  anatomyCases: 499,
  anatomyStructures: 2244,
  anatomyRegions: 6,
  physicsLabs: 5,
  physicsQuestions: 511,
  physicsStems: 1715,
  physicsMocks: 3,
}

/* The published shape of the examination, as the RCR sets it. Kept in one
   place, in one constant, so it can be checked against the current candidate
   guidance and corrected in a single edit rather than hunted through prose. */
const EXAM_SPEC: { module: string; parts: string[] }[] = [
  { module: 'Anatomy module', parts: ['100 images', '200 questions', '90 minutes'] },
  { module: 'Physics module', parts: ['40 questions', '200 statements', '2 hours'] },
]

/* ------------------------------------------------------------------ *
 * Shared drawing helpers
 * ------------------------------------------------------------------ */

/* The canvas palette, read from the live tokens so the drawings follow the
   theme. A canvas cannot read a custom property mid-stroke, so the two
   channels are cached as "r,g,b" strings and refreshed when the theme
   attribute changes (see HeroLine). The names are kept — IVORY was the
   drawing ink of the charcoal era; it now resolves to the structure/rim
   blue of the navy system, and AMBER to the one warm core. */
const CANVAS_PAL = { ink: '164,209,236', warm: '216,168,116' }
function refreshCanvasPalette() {
  const cs = getComputedStyle(document.documentElement)
  const rgb = (name: string, fallback: string) => {
    const m = /^#([0-9a-f]{6})$/i.exec(cs.getPropertyValue(name).trim())
    if (!m) return fallback
    const n = parseInt(m[1], 16)
    return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`
  }
  CANVAS_PAL.ink = rgb('--rim', CANVAS_PAL.ink)
  CANVAS_PAL.warm = rgb('--core', CANVAS_PAL.warm)
}
const IVORY = (a: number) => `rgba(${CANVAS_PAL.ink},${a})`
const AMBER = (a: number) => `rgba(${CANVAS_PAL.warm},${a})`

/** Edge ruler ticks — the same on both plate viewports. */
function ticks(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.strokeStyle = IVORY(0.16)
  ctx.lineWidth = 1
  for (let i = 0; i <= 8; i++) {
    const y = h * 0.08 + (i / 8) * h * 0.84
    const len = i % 2 === 0 ? 9 : 5
    ctx.beginPath()
    ctx.moveTo(w - 1, Math.round(y) + 0.5)
    ctx.lineTo(w - 1 - len, Math.round(y) + 0.5)
    ctx.stroke()
  }
}

const gauss = (u: number, centre: number, spread: number) =>
  Math.exp(-Math.pow((u - centre) / spread, 2))

/* ------------------------------------------------------------------ *
 * The hero line
 *
 * One continuous open path. The profile is defined in canvas-height units so
 * the head keeps human proportions at any viewport width; the baseline it
 * rises from and returns to is the same axis the resonance decays along. The
 * whole path is flattened once per resize into a polyline with cumulative arc
 * lengths, so the readout can travel it at constant pen speed.
 * ------------------------------------------------------------------ */

/** The lateral profile, as cubic segments from an implicit previous point:
    [c1u, c1v, c2u, c2v, u, v] — u rightward in units of canvas height from
    the anchor, v downward as a fraction of canvas height. Baseline v = 0.66. */
const PROFILE_START: [number, number] = [0, 0.66]
const PROFILE: [number, number, number, number, number, number][] = [
  [0.005, 0.585, -0.085, 0.480, -0.075, 0.320],   // occiput, bulging behind the neck
  [-0.065, 0.200, 0.020, 0.115, 0.140, 0.105],    // up and over to the crown
  [0.260, 0.095, 0.340, 0.140, 0.385, 0.235],     // the forehead
  [0.405, 0.280, 0.405, 0.310, 0.398, 0.345],     // brow
  [0.394, 0.362, 0.395, 0.372, 0.398, 0.380],     // nasion dip
  [0.405, 0.400, 0.432, 0.425, 0.437, 0.443],     // nasal dorsum to tip
  [0.439, 0.457, 0.421, 0.463, 0.415, 0.470],     // subnasale
  [0.413, 0.485, 0.424, 0.492, 0.425, 0.505],     // upper lip
  [0.426, 0.514, 0.416, 0.517, 0.415, 0.521],     // lip seam
  [0.417, 0.532, 0.425, 0.537, 0.423, 0.549],     // lower lip
  [0.420, 0.560, 0.410, 0.563, 0.412, 0.571],     // mentolabial groove
  [0.428, 0.582, 0.430, 0.612, 0.412, 0.634],     // chin
  [0.392, 0.654, 0.370, 0.658, 0.350, 0.659],     // under the jaw
  [0.356, 0.667, 0.380, 0.6655, 0.420, 0.663],    // larynx
  [0.450, 0.661, 0.470, 0.660, 0.500, 0.660],     // the neck settles to the axis
]

type HeroPath = {
  pts: { x: number; y: number }[]
  cum: number[]
  headMid: number
  fid0: number
  fid1: number
}

function buildHeroPath(w: number, h: number): HeroPath {
  const B = 0.66
  const pts: { x: number; y: number }[] = []
  const push = (x: number, y: number) => pts.push({ x, y })

  // The head sits around a fifth of the way across, clamped so the occipital
  // bulge (which reaches behind the anchor) can never run off the left edge.
  const xA = Math.max(0.03 * w + 0.1 * h, 0.2 * w - 0.2 * h)

  push(0.03 * w, B * h)
  let prev = PROFILE_START
  push(xA + prev[0] * h, prev[1] * h)
  for (const [c1u, c1v, c2u, c2v, pu, pv] of PROFILE) {
    for (let i = 1; i <= 22; i++) {
      const s = i / 22
      const r = 1 - s
      const u = r * r * r * prev[0] + 3 * r * r * s * c1u + 3 * r * s * s * c2u + s * s * s * pu
      const v = r * r * r * prev[1] + 3 * r * r * s * c1v + 3 * r * s * s * c2v + s * s * s * pv
      push(xA + u * h, v * h)
    }
    prev = [pu, pv]
  }

  // Along the shared axis, then the resonance: an induced signal ringing at a
  // fixed frequency and decaying exponentially — drawn, like everything else,
  // out of the one line. Narrow viewports get fewer rings over a wider share
  // of the width, so the oscillation stays legible on a phone.
  const fid0 = Math.max(0.44 * w, xA + 0.5 * h)
  const fid1 = 0.93 * w
  const rings = w < 640 ? 8 : 11
  push(fid0, B * h)
  const n = 280
  for (let i = 1; i <= n; i++) {
    const s = i / n
    const y = B - 0.2 * Math.sin(2 * Math.PI * s * rings) * Math.min(1, s * 16) * Math.exp(-s / 0.3)
    push(fid0 + (fid1 - fid0) * s, y * h)
  }
  push(0.97 * w, B * h)

  const cum = [0]
  for (let i = 1; i < pts.length; i++) {
    cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y))
  }
  return { pts, cum, headMid: xA + 0.17 * h, fid0, fid1 }
}

/** Index of the last path point within arc length L. */
function indexAt(path: HeroPath, L: number): number {
  let lo = 0
  let hi = path.cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (path.cum[mid] < L) lo = mid + 1
    else hi = mid
  }
  return lo
}

function drawHeroLine(
  ctx: CanvasRenderingContext2D,
  path: HeroPath,
  w: number,
  h: number,
  t: number,
  reduced: boolean,
) {
  ctx.clearRect(0, 0, w, h)
  const B = 0.66 * h
  ctx.lineJoin = 'round'
  ctx.lineCap = 'round'

  // The axis both halves live on, and the envelope the ringing dies inside —
  // the quiet apparatus layer, dashed so it never competes with the line.
  ctx.setLineDash([2, 7])
  ctx.strokeStyle = IVORY(0.07)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(0.03 * w, B + 0.5)
  ctx.lineTo(0.97 * w, B + 0.5)
  ctx.stroke()
  ctx.strokeStyle = IVORY(0.09)
  for (const sgn of [-1, 1]) {
    ctx.beginPath()
    for (let i = 0; i <= 60; i++) {
      const s = i / 60
      const x = path.fid0 + (path.fid1 - path.fid0) * s
      const y = B - sgn * 0.2 * h * Math.min(1, s * 16) * Math.exp(-s / 0.3)
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    }
    ctx.stroke()
  }
  ctx.setLineDash([])

  const N = path.pts.length - 1
  const trace = (from: number, to: number) => {
    ctx.beginPath()
    ctx.moveTo(path.pts[from].x, path.pts[from].y)
    for (let i = from + 1; i <= to; i++) ctx.lineTo(path.pts[i].x, path.pts[i].y)
    ctx.stroke()
  }

  // The full line, faint — the sheet always shows what will be drawn.
  ctx.strokeStyle = IVORY(reduced ? 0.42 : 0.13)
  ctx.lineWidth = 1.3
  trace(0, N)

  if (!reduced) {
    // A ten-second cycle: draw for ~6, rest complete, breathe out, begin again.
    const T = t % 10
    const p = Math.min(1, T / 6.2)
    const fade = T > 9.2 ? Math.max(0, 1 - (T - 9.2) / 0.8) : 1
    const L = path.cum[N] * p
    const idx = Math.max(1, indexAt(path, L))

    ctx.strokeStyle = IVORY(0.42 * fade)
    ctx.lineWidth = 1.3
    trace(0, idx)

    // The pen: a short amber trail and a glowing head.
    const tail = Math.max(0, indexAt(path, Math.max(0, L - 70)))
    ctx.strokeStyle = AMBER(0.55 * fade)
    ctx.lineWidth = 1.5
    trace(tail, idx)
    const hp = path.pts[Math.min(idx, N)]
    ctx.fillStyle = AMBER(0.95 * fade)
    ctx.beginPath()
    ctx.arc(hp.x, hp.y, 2.7, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = AMBER(0.22 * fade)
    ctx.lineWidth = 1
    ctx.beginPath()
    ctx.arc(hp.x, hp.y, 8, 0, Math.PI * 2)
    ctx.stroke()
  }

  // The two halves named — an italic aside and a small-caps catalogue label,
  // the same pairing the rest of the page sets its headings in.
  //
  // These sizes are written here rather than taken from a token because a
  // canvas cannot read a custom property; they are the drawing's own labels,
  // and they are set to match what the token scale resolves to on the page
  // around them — the aside at the support step, the catalogue label at the
  // metadata step — so the signature does not read a size smaller than
  // anything else on the screen.
  ctx.textAlign = 'center'
  ctx.textBaseline = 'alphabetic'
  const fidMid = (path.fid0 + path.fid1) / 2
  ctx.fillStyle = IVORY(0.55)
  ctx.font = '320 17px Archivo, Inter, system-ui, sans-serif'
  ctx.fillText('the form', path.headMid, 0.875 * h)
  ctx.fillText('the signal', fidMid, 0.875 * h)
  ctx.fillStyle = IVORY(0.32)
  ctx.font = '600 11px ui-monospace, SFMono-Regular, Menlo, monospace'
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '0.3em' } catch { /* older engines */ }
  ctx.fillText('ANATOMY', path.headMid, 0.95 * h)
  ctx.fillText('PHYSICS', fidMid, 0.95 * h)
  try { (ctx as unknown as { letterSpacing: string }).letterSpacing = '0px' } catch { /* older engines */ }
}

function HeroLine() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    refreshCanvasPalette()

    let raf = 0
    let path: HeroPath | null = null
    let W = 0
    let H = 0
    const t0 = performance.now()
    const dpr = () => Math.min(2, window.devicePixelRatio || 1)
    const size = () => {
      const host = canvas.parentElement
      if (!host) return
      const r = dpr()
      W = host.clientWidth
      H = host.clientHeight
      canvas.width = Math.round(W * r)
      canvas.height = Math.round(H * r)
      ctx.setTransform(r, 0, 0, r, 0, 0)
      path = buildHeroPath(W, H)
      if (reduced) drawHeroLine(ctx, path, W, H, 0, true)
    }
    const frame = () => {
      if (path) drawHeroLine(ctx, path, W, H, (performance.now() - t0) / 1000, false)
      raf = requestAnimationFrame(frame)
    }
    const ro = new ResizeObserver(size)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    size()
    if (!reduced) {
      raf = requestAnimationFrame(frame)
    } else {
      // A static draw races the webfonts; redraw once they land so the
      // labels don't stay in the fallback face forever.
      document.fonts?.ready?.then(() => { if (path) drawHeroLine(ctx, path, W, H, 0, true) })
    }
    // Theme switches re-value --rim/--core; the continuous loop picks the
    // refresh up on its next frame, and the reduced-motion static draw is
    // repainted here explicitly.
    const mo = new MutationObserver(() => {
      refreshCanvasPalette()
      if (reduced && path) drawHeroLine(ctx, path, W, H, 0, true)
    })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { cancelAnimationFrame(raf); ro.disconnect(); mo.disconnect() }
  }, [])

  return <canvas ref={ref} className="pt-heroline-canvas" aria-hidden="true" />
}

/* ------------------------------------------------------------------ *
 * Plate artwork — drawn, never photographed
 *
 * The two are deliberately siblings: same hairline weight, same edge ticks,
 * so the pair reads as one instrument showing two things rather than two
 * illustrations.
 * ------------------------------------------------------------------ */

/**
 * Anatomy: an anatomical plate.
 *
 * Drawn in the same hairline language as the spectrum beside it — a PA chest
 * from the apices to the diaphragm, every border a curve, nothing rendered as
 * a photograph or as a grey film. The two lung fields are the load-bearing
 * shapes and everything else is quieter than them, which is what makes it
 * read as a chest at a glance rather than as a wireframe: the ribs are
 * clipped inside the lungs, so no line ever escapes the body.
 *
 * Radiographic convention: the patient's left is the viewer's right, so the
 * heart bulges viewer-right and the higher dome sits viewer-left.
 *
 * The four lettered markers arrive in turn, which is the module in one
 * gesture — a structure is pointed at, and you name it. The plate itself
 * never names them.
 */
const PLATE_ASPECT = 1.1

/** point (x, y) and its label (lx, ly), in plate coordinates. */
const MARKERS: { letter: string; x: number; y: number; lx: number; ly: number }[] = [
  { letter: 'A', x: 0.500, y: 0.120, lx: 0.660, ly: 0.045 }, // trachea
  { letter: 'B', x: 0.612, y: 0.415, lx: 0.800, ly: 0.285 }, // left hilum
  { letter: 'C', x: 0.697, y: 0.520, lx: 0.885, ly: 0.470 }, // left heart border
  { letter: 'D', x: 0.265, y: 0.612, lx: 0.085, ly: 0.560 }, // right hemidiaphragm
]

function drawAnatomy(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, hover: number) {
  ctx.clearRect(0, 0, w, h)

  // The plate keeps its own proportions inside whatever frame it is given.
  const pw = Math.min(w * 0.9, h * 0.9 * PLATE_ASPECT)
  const ph = pw / PLATE_ASPECT
  const px = (w - pw) / 2
  const py = (h - ph) / 2
  const X = (u: number) => px + u * pw
  // The drawing occupies v 0.015–0.775; stretching that band to the full box
  // is what keeps the cardiothoracic proportions right instead of squat.
  const Y = (v: number) => py + ((v - 0.015) / 0.76) * ph

  const lift = 1 + hover * 0.45
  const ink = (a: number) => IVORY(Math.min(0.62, a * lift))
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const stroke = (colour: string, width: number, run: () => void) => {
    ctx.strokeStyle = colour
    ctx.lineWidth = width
    ctx.beginPath()
    run()
    ctx.stroke()
  }

  /* The two lung fields, each traced apex → lateral border → costophrenic
     angle → hemidiaphragm → mediastinal border → back to the apex. The
     mediastinal border of a lung IS the heart border beside it, which is why
     they are one path and not two. */
  const rightLung = () => {
    ctx.moveTo(X(0.355), Y(0.025))
    ctx.bezierCurveTo(X(0.19), Y(0.09), X(0.075), Y(0.26), X(0.072), Y(0.50))
    ctx.bezierCurveTo(X(0.071), Y(0.60), X(0.078), Y(0.68), X(0.092), Y(0.735))
    ctx.quadraticCurveTo(X(0.265), Y(0.585), X(0.437), Y(0.700))
    ctx.bezierCurveTo(X(0.404), Y(0.545), X(0.421), Y(0.370), X(0.452), Y(0.225))
    ctx.bezierCurveTo(X(0.442), Y(0.135), X(0.405), Y(0.060), X(0.355), Y(0.025))
  }
  const leftLung = () => {
    ctx.moveTo(X(0.645), Y(0.025))
    ctx.bezierCurveTo(X(0.815), Y(0.09), X(0.929), Y(0.26), X(0.930), Y(0.50))
    ctx.bezierCurveTo(X(0.931), Y(0.62), X(0.922), Y(0.70), X(0.906), Y(0.760))
    ctx.quadraticCurveTo(X(0.750), Y(0.640), X(0.598), Y(0.735))
    // The left heart border, bulging into this lung.
    ctx.bezierCurveTo(X(0.700), Y(0.600), X(0.706), Y(0.430), X(0.596), Y(0.270))
    // The aortic knuckle, then up to the apex.
    ctx.bezierCurveTo(X(0.585), Y(0.205), X(0.600), Y(0.075), X(0.645), Y(0.025))
  }

  // --- ribs, clipped so no line leaves the body ---------------------------
  for (const [lung, side] of [[rightLung, -1], [leftLung, 1]] as const) {
    ctx.save()
    ctx.beginPath()
    lung()
    ctx.clip()
    const S = (u: number) => X(0.5 + side * u)
    for (let i = 0; i < 8; i++) {
      const v = 0.02 + i * 0.098
      stroke(ink(0.16 - i * 0.011), 1, () => {
        ctx.moveTo(S(0.02), Y(v))
        ctx.bezierCurveTo(S(0.19), Y(v - 0.035), S(0.37), Y(v + 0.02), S(0.46), Y(v + 0.15))
      })
      // Anterior ribs: fainter, sloping back toward the midline.
      if (i > 0 && i < 6) {
        stroke(ink(0.07), 1, () => {
          ctx.moveTo(S(0.44), Y(v + 0.18))
          ctx.quadraticCurveTo(S(0.25), Y(v + 0.285), S(0.06), Y(v + 0.265))
        })
      }
    }
    // Vascular markings fanning from the hilum.
    const hu = 0.5 + side * 0.1
    for (let i = 0; i < 6; i++) {
      const a = -0.5 + i * 0.3
      // Each vessel leaves the hilum at its own level: a fan, not a starburst.
      const v0 = 0.40 + (i - 2.5) * 0.012
      stroke(ink(0.1), 1, () => {
        ctx.moveTo(X(hu - side * 0.012), Y(v0))
        ctx.quadraticCurveTo(
          X(hu + side * 0.085 * Math.cos(a)), Y(v0 + 0.095 * Math.sin(a) + 0.055),
          X(hu + side * 0.16 * Math.cos(a)), Y(v0 + 0.19 * Math.sin(a) + 0.115),
        )
      })
    }
    ctx.restore()
  }

  // --- the lung fields themselves, over the ribs ---------------------------
  stroke(ink(0.40), 1.35, () => { rightLung(); leftLung() })

  // --- mediastinum: spine, trachea, carina, main bronchi -------------------
  for (const side of [-1, 1] as const) {
    stroke(ink(0.13), 1, () => {
      ctx.moveTo(X(0.5 + side * 0.026), Y(0.02))
      ctx.lineTo(X(0.5 + side * 0.026), Y(0.72))
    })
  }
  for (let i = 0; i < 8; i++) {
    stroke(ink(0.075), 1, () => {
      ctx.moveTo(X(0.478), Y(0.07 + i * 0.082))
      ctx.lineTo(X(0.522), Y(0.07 + i * 0.082))
    })
  }
  for (const side of [-1, 1] as const) {
    stroke(ink(0.3), 1.1, () => {
      ctx.moveTo(X(0.5 + side * 0.017), Y(0.015))
      ctx.lineTo(X(0.5 + side * 0.017), Y(0.245))
    })
  }
  // The right main bronchus runs steeper than the left.
  stroke(ink(0.26), 1.1, () => {
    ctx.moveTo(X(0.483), Y(0.245))
    ctx.quadraticCurveTo(X(0.458), Y(0.315), X(0.442), Y(0.375))
    ctx.moveTo(X(0.517), Y(0.245))
    ctx.quadraticCurveTo(X(0.567), Y(0.295), X(0.608), Y(0.322))
  })

  // --- clavicles, crossing the apices --------------------------------------
  for (const side of [-1, 1] as const) {
    const S = (u: number) => X(0.5 + side * u)
    stroke(ink(0.3), 1.2, () => {
      ctx.moveTo(S(0.045), Y(0.105))
      ctx.bezierCurveTo(S(0.13), Y(0.084), S(0.24), Y(0.05), S(0.345), Y(0.062))
    })
  }

  // --- the markers ---------------------------------------------------------
  // They arrive one at a time, hold, then the plate is cleared and it begins
  // again. Amber is spent here and nowhere else in this panel.
  const phase = t % 10
  // A single letter on the end of a leader line: this one is geometry, not
  // text — it has to stay small enough not to cover the structure it points at.
  ctx.font = '600 13px ui-monospace, SFMono-Regular, Menlo, monospace'
  ctx.textBaseline = 'middle'

  MARKERS.forEach((m, i) => {
    const appear = Math.max(0, Math.min(1, (phase - (0.7 + i * 1.2)) / 0.45))
    const clear = Math.max(0, Math.min(1, (phase - 8.2) / 0.9))
    const a = appear * (1 - clear)
    if (a <= 0.01) return

    const tx = X(m.x)
    const ty = Y(m.y)
    const lx = X(m.lx)
    const ly = Y(m.ly)

    stroke(AMBER(a * (0.5 + hover * 0.25)), 1, () => {
      ctx.moveTo(lx, ly)
      ctx.lineTo(lx + (tx - lx) * appear, ly + (ty - ly) * appear)
    })

    // A ring rather than a blob, so the anatomy under it stays visible.
    stroke(AMBER(a * (0.9 + hover * 0.1)), 1.4, () => {
      ctx.moveTo(tx + 4.5, ty)
      ctx.arc(tx, ty, 4.5, 0, Math.PI * 2)
    })
    ctx.fillStyle = AMBER(a)
    ctx.beginPath()
    ctx.arc(tx, ty, 1.3, 0, Math.PI * 2)
    ctx.fill()

    ctx.textAlign = m.lx > m.x ? 'left' : 'right'
    ctx.fillText(m.letter, lx + (m.lx > m.x ? 7 : -7), ly)
  })

  ticks(ctx, w, h)
}

/**
 * Physics: the beam above, the spectrum it is made of below.
 *
 * The continuum is bremsstrahlung shaped the way filtration actually leaves
 * it — nothing at the low-energy end, a peak around a third of the way up,
 * and a hard stop at the tube potential — with the characteristic line
 * standing on top of it. Physics gets no amber: its accent is the x-ray blue
 * both sites already use for the modality.
 */
function drawPhysics(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, hover: number) {
  ctx.clearRect(0, 0, w, h)
  const midY = h * 0.26
  const base = h * 0.88
  const x0 = w * 0.05
  const x1 = w * 0.95
  const span = x1 - x0

  // The beam, drawn as the wave it is.
  ctx.strokeStyle = `rgba(168,203,234,${0.45 + hover * 0.35})`
  ctx.lineWidth = 1.6
  ctx.beginPath()
  for (let x = 0; x <= w; x += 2) {
    const u = x / w
    const envelope = Math.exp(-Math.pow((u - 0.5) * 2.4, 2))
    const y = midY + Math.sin(u * 28 - t * 2.6) * h * 0.1 * envelope
    x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.stroke()

  const CHARACTERISTIC = 0.66
  const bars = 40
  for (let i = 0; i < bars; i++) {
    const u = (i + 0.5) / bars
    // Filtration removes the softest photons; the continuum then falls
    // linearly to zero at the tube potential.
    const continuum = Math.max(0, 1 - u) * (1 - Math.exp(-Math.pow(u / 0.17, 3)))
    const line = 0.62 * gauss(u, CHARACTERISTIC, 0.012)
    const peak = continuum * 1.3 + line
    const grow = Math.min(1, Math.max(0, t * 0.7 - i * 0.012))
    const bh = peak * h * 0.47 * grow
    ctx.fillStyle = line > 0.08
      ? `rgba(168,203,234,${0.6 + hover * 0.3})`
      : IVORY(0.12 + Math.min(1, peak) * 0.2 + hover * 0.07)
    ctx.fillRect(x0 + u * span - 2, base - bh, 4, bh)
  }

  // Energy axis.
  ctx.strokeStyle = IVORY(0.14)
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x0 - 6, base + 0.5)
  ctx.lineTo(x1 + 6, base + 0.5)
  ctx.stroke()
  for (let i = 0; i <= 8; i++) {
    const x = Math.round(x0 + (i / 8) * span) + 0.5
    ctx.beginPath()
    ctx.moveTo(x, base)
    ctx.lineTo(x, base + (i % 2 === 0 ? 6 : 3))
    ctx.stroke()
  }

  ticks(ctx, w, h)
}

/* The plate drawings are no longer mounted on the front door — the two
   galleries took their place (universal redesign, 19 Aug 2026) — but the
   work is kept and exported: the synthetic PA chest and the live spectrum
   remain correct, owner-approved drawings that a later surface can mount. */
export function DoorArt({ kind, hovered }: { kind: 'anatomy' | 'physics'; hovered: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const hoverRef = useRef(0)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    let raf = 0
    const t0 = performance.now()
    const dpr = () => Math.min(2, window.devicePixelRatio || 1)
    const size = () => {
      const host = canvas.parentElement
      if (!host) return
      const r = dpr()
      canvas.width = Math.round(host.clientWidth * r)
      canvas.height = Math.round(host.clientHeight * r)
      ctx.setTransform(r, 0, 0, r, 0, 0)
    }
    const frame = () => {
      // Frozen at a representative moment when motion is unwelcome: all four
      // structures marked, the spectrum fully grown.
      const t = reduced ? 6.6 : (performance.now() - t0) / 1000
      hoverRef.current += ((hovered ? 1 : 0) - hoverRef.current) * 0.12
      const r = dpr()
      const w = canvas.width / r
      const h = canvas.height / r
      if (kind === 'anatomy') drawAnatomy(ctx, w, h, t, hoverRef.current)
      else drawPhysics(ctx, w, h, t, hoverRef.current)
      if (!reduced) raf = requestAnimationFrame(frame)
    }
    const ro = new ResizeObserver(size)
    if (canvas.parentElement) ro.observe(canvas.parentElement)
    size()
    frame()
    return () => { cancelAnimationFrame(raf); ro.disconnect() }
  }, [kind, hovered])

  return <canvas ref={ref} className="pt-door-art" aria-hidden="true" />
}

/* ------------------------------------------------------------------ *
 * Reveal-on-scroll
 *
 * One threshold, one direction, disconnect after firing: a section rises a
 * few pixels into place the first time it is seen and never moves again.
 * Reduced motion renders everything in place immediately.
 * ------------------------------------------------------------------ */

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [vis, setVis] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setVis(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVis(true)
          io.disconnect()
        }
      },
      { threshold: 0.1 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return { ref, vis }
}

/* ------------------------------------------------------------------ *
 * Page
 * ------------------------------------------------------------------ */

export default function Portal() {
  const plates = useReveal<HTMLElement>()
  const physg = useReveal<HTMLElement>()
  const method = useReveal<HTMLElement>()
  const close = useReveal<HTMLElement>()

  useEffect(() => {
    const previous = document.title
    document.title = 'RadioPass — First FRCR anatomy and physics'
    // Every other route that names the tab puts the title back when it leaves.
    // Without this the front door's title followed the visitor onto every page
    // they opened from it — /pricing, /about, the labs — all still reading
    // "First FRCR anatomy and physics" in the tab and in any bookmark made there.
    return () => { document.title = previous }
  }, [])

  return (
    <div className="pt-root">
      <a className="pt-skip" href="#pt-main">Skip to content</a>

      <header className="pt-bar">
        <div className="pt-bar-inner">
          <Link to="/" className="pt-wordmark" aria-label="RadioPass home">
            <Logo markHeight={22} />
          </Link>
          <span className="pt-bar-sub">First FRCR · Anatomy &amp; Physics</span>
          <nav className="pt-bar-nav" aria-label="Sections">
            <Link to={anatomy()}>Anatomy</Link>
            <Link to="/physics">Physics</Link>
            {/* An access route, deliberately after the two branches and set in
                the same quiet type — it must not read as a third subject. */}
            <Link to="/free-trial">Free trial</Link>
            <Link to="/pricing">Pricing</Link>
          </nav>
          <ThemeToggle />
        </div>
      </header>

      <main id="pt-main">
        {/* ---------------- hero: one line, both papers ---------------- */}
        <section className="pt-hero" aria-labelledby="pt-hero-h">
          <div className="pt-hero-copy">
            <p className="pt-kicker">The First FRCR Examination</p>
            <h1 id="pt-hero-h">
              Both papers.
              <br />
              One <em>preparation</em>.
            </h1>
            <p className="pt-lede">
              The First FRCR asks two things of a radiology trainee: name the structure,
              and explain the physics that made the image. RadioPass prepares both, the
              same way — every mechanism drawn and driveable, every answer explained
              against its source.
            </p>
            <div className="pt-hero-actions">
              <Link className="pt-btn pt-btn-solid" to={anatomy()}>Enter anatomy</Link>
              <Link className="pt-btn pt-btn-ghost" to="/physics">Enter physics</Link>
            </div>
          </div>

          {/* The signature: one unbroken line — the form, then the signal. */}
          <div className="pt-heroline">
            <HeroLine />
          </div>

        </section>

        {/* ---------------- the anatomy gallery ---------------- */}
        <section
          ref={plates.ref}
          className={`pt-section pt-reveal${plates.vis ? ' in-view' : ''}`}
          aria-labelledby="pt-anat-h"
        >
          <div className="pt-section-head">
            <span className="pt-numeral" aria-hidden="true">I</span>
            <h2 id="pt-anat-h">Name the structure.</h2>
          </div>
          <p className="pt-gallery-lede">
            Radiographs, CT, MRI, ultrasound, fluoroscopy and angiography, each with
            its structures marked where the examiner marks them. You type the name;
            it is graded on what you actually wrote, laterality included.
          </p>

          {/* Sculptural objects, not cards: each render is the door to its
              region. The composition is deliberately unequal — a gallery
              wall, not a grid of tiles. */}
          <div className="pt-gallery pt-gallery-anatomy">
            {SCULPTURES.map((o) => (
              <Link key={o.key} className={`pt-obj pt-obj-${o.key}`} to={o.to}>
                <span className="rp-sculpt"><img src={o.img} alt="" loading="lazy" /></span>
                <span className="pt-obj-cap">
                  <b>{o.name}</b>
                  <i>{o.region}</i>
                  <span className="pt-obj-go">Explore <span aria-hidden="true">&rarr;</span></span>
                </span>
              </Link>
            ))}
          </div>

          <div className="pt-gallery-foot">
            <span className="pt-figures">
              <span><b>{COUNTS.anatomyCases}</b>labelled cases</span>
              <span><b>{COUNTS.anatomyStructures.toLocaleString('en-GB')}</b>structures to name</span>
              <span><b>{COUNTS.anatomyRegions}</b>regions</span>
            </span>
            <Link className="pt-btn pt-btn-solid" to={anatomy()}>Enter anatomy</Link>
          </div>
        </section>

        {/* ---------------- the physics gallery ---------------- */}
        <section
          ref={physg.ref}
          className={`pt-section pt-reveal${physg.vis ? ' in-view' : ''}`}
          aria-labelledby="pt-phys-h"
        >
          <div className="pt-section-head">
            <span className="pt-numeral" aria-hidden="true">II</span>
            <h2 id="pt-phys-h">See what the equation means.</h2>
          </div>
          <p className="pt-gallery-lede">
            Five laboratories where you move the variable and watch the physics
            answer &mdash; then the question bank and three timed mock papers in the
            real true-or-false format, each stem explained.
          </p>

          {/* The physics visual family: the five signals, drawn live &mdash; the
              same composition as the anatomy wall, so the two halves read as
              one universe. */}
          <div className="pt-gallery pt-gallery-physics">
            {SIGNAL_GLYPHS.map((g) => (
              <Link key={g.key} className={`pt-glyph pt-obj-${g.key}`} to="/physics">
                <span className="pt-glyph-stage">{g.svg}</span>
                <span className="pt-obj-cap">
                  <b>{g.name}</b>
                  <i>{g.desc}</i>
                  <span className="pt-obj-go">Explore <span aria-hidden="true">&rarr;</span></span>
                </span>
              </Link>
            ))}
          </div>

          <div className="pt-gallery-foot">
            <span className="pt-figures">
              <span><b>{COUNTS.physicsQuestions}</b>questions</span>
              <span><b>{COUNTS.physicsStems.toLocaleString('en-GB')}</b>true-or-false stems</span>
              <span><b>{COUNTS.physicsMocks}</b>mock papers</span>
            </span>
            <Link className="pt-btn pt-btn-solid" to="/physics">Enter physics</Link>
          </div>

          {/* The trial sits UNDER the two galleries and looks nothing like
              them: one line of type and a link. The galleries ask "which
              subject?"; this asks a different question &mdash; "do you want to
              try first?" &mdash; and the hierarchy has to say so. */}
          <aside className="pt-trial">
            <p className="pt-trial-copy">
              <strong>Not ready to choose?</strong> Try RadioPass first &mdash; a sample of both
              anatomy and physics.
            </p>
            <Link className="pt-trial-go" to="/free-trial">
              Free trial <i aria-hidden="true">&rarr;</i>
            </Link>
          </aside>
        </section>


        {/* ---------------- method ---------------- */}
        <section
          ref={method.ref}
          className={`pt-section pt-method pt-reveal${method.vis ? ' in-view' : ''}`}
          aria-labelledby="pt-method-h"
        >
          <div className="pt-section-head">
            <span className="pt-numeral" aria-hidden="true">III</span>
            <h2 id="pt-method-h">How it is built.</h2>
          </div>
          <div className="pt-method-grid">
            <article>
              <h3>Drawn, not photographed</h3>
              <p>
                Every mechanism on the site is generated live in the browser — the beam,
                the gantry, the precessing moment, the pulse and its echo. You can stop
                it, drive it and take it apart, which is the difference between watching
                a diagram and understanding one.
              </p>
            </article>
            <article>
              <h3>Marked the way it is marked</h3>
              <p>
                Anatomy answers are free text, graded against the official wording and its
                accepted variants, with laterality enforced where the examiner enforces
                it. Physics stems are true or false, one mark each, and every stem carries
                its explanation.
              </p>
            </article>
            <article>
              <h3>Sourced, and corrected in the open</h3>
              <p>
                Each question names where it came from. Where a source is wrong or
                contradicts itself, the correction is shown beside it rather than quietly
                instead of it — you see both, and why.
              </p>
            </article>
          </div>

          <div className="pt-spec-band">
            <p className="pt-spec-head">Examination format</p>
            <dl className="pt-spec">
              {EXAM_SPEC.map((s) => (
                <div key={s.module}>
                  <dt>{s.module}</dt>
                  <dd>{s.parts.join(' · ')}</dd>
                </div>
              ))}
            </dl>
            <p className="pt-spec-note">
              Format as published by the Royal College of Radiologists. RadioPass is not
              affiliated with the RCR.
            </p>
          </div>
        </section>

        {/* ---------------- close ---------------- */}
        <section
          ref={close.ref}
          className={`pt-close pt-reveal${close.vis ? ' in-view' : ''}`}
          aria-labelledby="pt-close-h"
        >
          <h2 id="pt-close-h">
            One exam. <em>Both halves.</em> One place.
          </h2>
          <div className="pt-hero-actions">
            <Link className="pt-btn pt-btn-solid" to={anatomy()}>Start with anatomy</Link>
            <Link className="pt-btn pt-btn-ghost" to="/physics">Start with physics</Link>
          </div>
          <p className="pt-close-note">
            Free while RadioPass is in early access — the Ultrasound Physics Lab stays
            free, permanently, with no account at all. <Link to="/pricing">See pricing</Link>
          </p>
        </section>
      </main>

      <footer className="pt-foot">
        <div className="pt-foot-grid">
          <div className="pt-foot-brand">
            <span className="pt-wordmark"><Logo markHeight={20} /></span>
            <p>Anatomy and physics for the First FRCR Examination, in one place.</p>
          </div>
          {/* Two branches, not two feature lists. Everything that lives inside a
              branch is reachable from that branch's own homepage — the front door
              never links past the choice it exists to offer. */}
          <nav aria-label="Branches">
            <h4>Branches</h4>
            <Link to={anatomy()}>Anatomy</Link>
            <Link to="/physics">Physics</Link>
          </nav>
          <nav aria-label="RadioPass">
            <h4>RadioPass</h4>
            <Link to="/about">About</Link>
            <Link to="/pricing">Pricing</Link>
            <a href="mailto:hello@radiopass.co.uk">Contact</a>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </nav>
        </div>
        <div className="pt-foot-bottom">
          <span>© {new Date().getFullYear()} RadioPass</span>
          <span>Built for radiology trainees. Not affiliated with the Royal College of Radiologists.</span>
        </div>
      </footer>
    </div>
  )
}
