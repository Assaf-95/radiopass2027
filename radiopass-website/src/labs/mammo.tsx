/**
 * Mammography — a focused lesson: why every design choice serves contrast
 * and resolution at minimal dose. Original procedural diagrams throughout.
 */

import { C, rgba, lerp, seg, smoothstep, sceneLabel } from '../home/fx'
import { LessonPage, type LessonStep, type StepDraw } from './lesson'

const ACC = '#D9909F'
const INK = C.ink
const AMBER = '#D9A84E'

function axes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.3) {
  ctx.strokeStyle = rgba(INK, alpha)
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + h); ctx.lineTo(x + w, y + h); ctx.stroke()
}

const STEPS: LessonStep[] = [
  {
    id: 'why-low',
    title: 'Why mammography lives at low energy',
    body: 'Glandular tissue, fat and early tumour differ by almost nothing. Only the **photoelectric effect** — with its steep energy dependence — amplifies such tiny differences, and it only dominates at **low photon energies**. So the whole machine is built around a **~17–20 keV** beam: high contrast, at the cost of dose and penetration.',
    numbers: 'Working beam ≈ **17–20 keV**; tube at **26–32 kVp**.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.18, gw = w * 0.62, gh = h * 0.5
      axes(ctx, gx, gy, gw, gh)
      // contrast vs energy falling curve
      ctx.beginPath()
      for (let i = 0; i <= 100 * p; i++) {
        const f = i / 100
        const v = Math.exp(-f * 3.2)
        const x = gx + f * gw
        const y = gy + gh - v * gh * 0.85
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // sweet spot band
      const bx = gx + gw * 0.12, bw = gw * 0.12
      const ba = smoothstep(seg(p, 0.5, 0.9))
      ctx.fillStyle = rgba(ACC, 0.1 * ba)
      ctx.fillRect(bx, gy, bw, gh)
      ctx.strokeStyle = rgba(ACC, 0.5 * ba)
      ctx.strokeRect(bx, gy, bw, gh)
      sceneLabel(ctx, '17–20 keV', bx + bw / 2, gy - 10, ba, { align: 'center', color: rgba(ACC, 0.95) })
      sceneLabel(ctx, 'soft-tissue contrast', gx - 6, gy - 12, p, { size: 10 })
      sceneLabel(ctx, 'photon energy →', gx + gw, gy + gh + 16, p, { align: 'right', size: 10 })
      sceneLabel(ctx, 'contrast collapses as energy rises — stay low', gx + gw / 2, gy + gh + 34, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'target-filter',
    title: 'Molybdenum target, molybdenum filter',
    body: 'A **Mo target** emits characteristic lines at **17.5 and 19.6 keV** — exactly where mammography wants to work. A **Mo filter** then uses its own **k-edge (20 keV)** to cut the photons just above the lines and the useless soft tail below, leaving a nearly ideal narrow spectrum. **Rh** variants push slightly higher for dense breasts.',
    trap: 'The tube window is **beryllium** — ordinary glass would absorb the very photons the technique depends on.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.16, gy = h * 0.16, gw = w * 0.62, gh = h * 0.52
      axes(ctx, gx, gy, gw, gh)
      const X = (e: number) => gx + (e / 35) * gw
      // unfiltered brems (dashed) + filtered spectrum + characteristic lines
      ctx.setLineDash([4, 4])
      ctx.beginPath()
      for (let i = 0; i <= 100; i++) {
        const e = (i / 100) * 32
        const v = e < 3 ? 0 : Math.max(0, (30 - e) / 30) * 0.55
        const x = X(e), y = gy + gh - v * gh
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(INK, 0.3 * p)
      ctx.stroke()
      ctx.setLineDash([])
      // filtered: suppressed below ~15 and above 20 (k-edge)
      ctx.beginPath()
      for (let i = 0; i <= 100 * p; i++) {
        const e = (i / 100) * 32
        let v = e < 3 ? 0 : Math.max(0, (30 - e) / 30) * 0.55
        if (e < 15) v *= Math.exp(-(15 - e) * 0.35)
        if (e > 20) v *= 0.18
        const x = X(e), y = gy + gh - v * gh
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 1.6
      ctx.stroke()
      // characteristic lines
      for (const [e, hgt] of [[17.5, 0.92], [19.6, 0.72]] as const) {
        const a = smoothstep(seg(p, 0.45, 0.8))
        ctx.strokeStyle = rgba(ACC, 0.95 * a)
        ctx.lineWidth = 2.5
        ctx.beginPath(); ctx.moveTo(X(e), gy + gh); ctx.lineTo(X(e), gy + gh - hgt * gh * a); ctx.stroke()
      }
      ctx.lineWidth = 1
      const ka = smoothstep(seg(p, 0.6, 0.95))
      ctx.strokeStyle = rgba(AMBER, 0.7 * ka)
      ctx.setLineDash([3, 4])
      ctx.beginPath(); ctx.moveTo(X(20), gy); ctx.lineTo(X(20), gy + gh); ctx.stroke()
      ctx.setLineDash([])
      sceneLabel(ctx, 'Mo k-edge 20 keV', X(20) + 6, gy + 12, ka, { color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, '17.5', X(17.5), gy - 8, seg(p, 0.5, 0.8), { align: 'center', size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, '19.6 keV', X(19.6) + 14, gy + gh * 0.24, seg(p, 0.55, 0.85), { size: 10, color: rgba(ACC, 0.9) })
      sceneLabel(ctx, 'unfiltered', gx + gw * 0.55, gy + gh * 0.35, p * 0.7, { size: 10 })
    },
  },
  {
    id: 'pairs',
    title: 'Beyond Mo/Mo: matching the pair to the breast',
    body: 'One pair does not fit every breast. **Mo/Mo** suits small, fatty breasts; **Mo/Rh** hardens the beam slightly for thicker ones; and modern digital units favour **W/Rh** — a tungsten continuum shaped by rhodium’s **23.2 keV k-edge** — better penetration at lower dose. The **AEC chooses the pair** from a brief test pulse through the compressed breast.',
    draw: (ctx, w, h, p) => {
      const gx = w * 0.14, gy = h * 0.16, gw = w * 0.64, gh = h * 0.52
      axes(ctx, gx, gy, gw, gh)
      const X = (e: number) => gx + (e / 40) * gw
      const spec = (peakE: number, width: number, height: number, colour: string, a: number, lines?: [number, number][]) => {
        ctx.beginPath()
        for (let i = 0; i <= 90; i++) {
          const e = (i / 90) * 38
          let v = Math.exp(-Math.pow((e - peakE) / width, 2)) * height
          if (e < 10) v *= Math.exp(-(10 - e) * 0.5)
          const x = X(e), y = gy + gh - v * gh
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
        }
        ctx.strokeStyle = rgba(colour, 0.85 * a)
        ctx.lineWidth = 1.5
        ctx.stroke()
        ctx.lineWidth = 1
        if (lines) for (const [e, hh] of lines) {
          ctx.strokeStyle = rgba(colour, 0.95 * a)
          ctx.lineWidth = 2.2
          ctx.beginPath(); ctx.moveTo(X(e), gy + gh); ctx.lineTo(X(e), gy + gh - hh * gh * a); ctx.stroke()
          ctx.lineWidth = 1
        }
      }
      spec(17, 3.2, 0.5, ACC, smoothstep(seg(p, 0, 0.4)), [[17.5, 0.85], [19.6, 0.6]])
      spec(21, 4.5, 0.55, AMBER, smoothstep(seg(p, 0.25, 0.6)))
      spec(24, 6, 0.6, '#8FB8C9', smoothstep(seg(p, 0.5, 0.85)))
      sceneLabel(ctx, 'Mo/Mo — small, fatty', X(13), gy + 14, seg(p, 0.2, 0.5), { color: rgba(ACC, 0.9), size: 10.5 })
      sceneLabel(ctx, 'Mo/Rh — thicker', X(22), gy + gh * 0.28, seg(p, 0.4, 0.7), { color: rgba(AMBER, 0.9), size: 10.5 })
      sceneLabel(ctx, 'W/Rh — dense, digital', X(29), gy + gh * 0.14, seg(p, 0.6, 0.9), { color: rgba('#8FB8C9', 0.9), size: 10.5 })
      sceneLabel(ctx, 'harder pairs penetrate denser breasts at lower dose', gx + gw / 2, gy + gh + 22, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'compression',
    title: 'Compression: four wins from one paddle',
    body: 'Compressing the breast **spreads tissue instead of magnifying it**, and everything improves at once: **lower dose** (thinner part), **less scatter**, **better contrast**, and **no motion blur** — with structures separated so they cannot masquerade as masses. No other single action buys as much.',
    draw: (ctx, w, h, p) => {
      const y0 = h * 0.3
      // before: thick breast
      const bx = w * 0.26
      const squeeze = smoothstep(seg(p, 0.2, 0.8))
      const thick = lerp(h * 0.3, h * 0.14, squeeze)
      // paddle
      ctx.strokeStyle = rgba(INK, 0.6)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx - w * 0.16, y0 + (h * 0.3 - thick)); ctx.lineTo(bx + w * 0.16, y0 + (h * 0.3 - thick)); ctx.stroke()
      // breast shape
      ctx.strokeStyle = rgba(ACC, 0.8)
      ctx.lineWidth = 1.4
      ctx.beginPath()
      ctx.ellipse(bx, y0 + h * 0.3 - thick / 2, w * 0.15 + squeeze * w * 0.05, thick / 2, 0, 0, Math.PI * 2)
      ctx.stroke()
      // support
      ctx.strokeStyle = rgba(INK, 0.6)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(bx - w * 0.18, y0 + h * 0.3); ctx.lineTo(bx + w * 0.18, y0 + h * 0.3); ctx.stroke()
      sceneLabel(ctx, 'paddle', bx + w * 0.18, y0 + (h * 0.3 - thick) - 8, 1, { align: 'right', size: 10 })
      // four wins list drawn as ticks
      const wins = ['dose ↓', 'scatter ↓', 'contrast ↑', 'blur ↓']
      wins.forEach((win, i) => {
        const a = smoothstep(seg(p, 0.4 + i * 0.12, 0.6 + i * 0.12))
        const y = h * 0.24 + i * 30
        ctx.strokeStyle = rgba(ACC, 0.9 * a)
        ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(w * 0.6, y + 4); ctx.lineTo(w * 0.615, y + 10); ctx.lineTo(w * 0.64, y - 4); ctx.stroke()
        sceneLabel(ctx, win, w * 0.66, y + 2, a, { size: 13 })
      })
      sceneLabel(ctx, 'spreads tissue — does not magnify it', bx, y0 + h * 0.3 + 24, seg(p, 0.6, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'tube-geometry',
    title: 'Small spots and a tilted tube',
    body: 'Microcalcifications demand tiny focal spots: **0.3 mm for contact views, 0.1 mm for magnification**. The tube is tilted so the **cathode sits over the chest wall** — the heel effect then puts the stronger part of the beam through the thickest tissue, evening the exposure.',
    draw: (ctx, w, h, p) => {
      const tx = w * 0.5, ty = h * 0.14
      // tube + tilted anode line
      ctx.strokeStyle = rgba(INK, 0.6)
      ctx.strokeRect(tx - 40, ty - 12, 80, 30)
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.lineWidth = 2
      ctx.beginPath(); ctx.moveTo(tx - 12, ty + 2); ctx.lineTo(tx + 12, ty + 12); ctx.stroke()
      ctx.lineWidth = 1
      // beam fan: stronger toward chest wall (left)
      const chestX = w * 0.24
      for (let i = 0; i < 8; i++) {
        const f = i / 7
        const x2 = lerp(chestX, w * 0.74, f)
        const a = lerp(0.55, 0.18, f) * p
        ctx.strokeStyle = rgba(ACC, a)
        ctx.beginPath(); ctx.moveTo(tx, ty + 14); ctx.lineTo(x2, h * 0.62); ctx.stroke()
      }
      // chest wall + breast
      ctx.strokeStyle = rgba(INK, 0.55)
      ctx.beginPath(); ctx.moveTo(chestX, h * 0.36); ctx.lineTo(chestX, h * 0.72); ctx.stroke()
      ctx.strokeStyle = rgba(ACC, 0.7)
      ctx.beginPath()
      ctx.moveTo(chestX, h * 0.5)
      ctx.quadraticCurveTo(w * 0.52, h * 0.44, w * 0.62, h * 0.56)
      ctx.quadraticCurveTo(w * 0.52, h * 0.66, chestX, h * 0.64)
      ctx.stroke()
      sceneLabel(ctx, 'chest wall — thickest tissue, strongest beam', chestX - 8, h * 0.32, seg(p, 0.4, 0.8), { size: 10.5 })
      sceneLabel(ctx, 'cathode end', tx - 52, ty + 4, seg(p, 0.3, 0.6), { align: 'right', size: 10.5 })
      sceneLabel(ctx, 'focal spot 0.3 mm (0.1 mm for magnification)', w * 0.5, h * 0.84, seg(p, 0.6, 1), { align: 'center', size: 11, color: rgba(ACC, 0.9) })
    },
  },
  {
    id: 'grid-aec',
    title: 'Grid for contact views, AEC after the breast',
    body: 'Even a compressed breast scatters, so **contact views use a moving grid** — accepting its dose penalty for the contrast. The **AEC sensor sits under the support**: it measures what actually penetrated and ends the exposure when enough has arrived, automatically adapting to density and thickness.',
    draw: (ctx, w, h, p) => {
      const cx = w * 0.5
      const layers: [string, number][] = [['compressed breast', h * 0.26], ['moving grid', h * 0.42], ['detector', h * 0.52], ['AEC sensor', h * 0.64]]
      layers.forEach(([name, y], i) => {
        const a = smoothstep(seg(p, i * 0.15, 0.3 + i * 0.15))
        if (name === 'moving grid') {
          for (let g = 0; g < 24; g++) {
            ctx.fillStyle = rgba(INK, 0.4 * a)
            ctx.fillRect(cx - w * 0.2 + g * w * 0.017, y - 6, w * 0.006, 12)
          }
        } else if (name === 'AEC sensor') {
          ctx.strokeStyle = rgba(AMBER, 0.8 * a)
          ctx.strokeRect(cx - 26, y - 8, 52, 16)
        } else {
          ctx.strokeStyle = rgba(name === 'compressed breast' ? ACC : INK, 0.6 * a)
          ctx.lineWidth = name === 'detector' ? 3 : 1.4
          ctx.beginPath(); ctx.moveTo(cx - w * 0.2, y); ctx.lineTo(cx + w * 0.2, y); ctx.stroke()
          ctx.lineWidth = 1
        }
        sceneLabel(ctx, name, cx + w * 0.23, y, a)
      })
      // beam arrow
      const ba = smoothstep(seg(p, 0.5, 0.85))
      ctx.strokeStyle = rgba(ACC, 0.7 * ba)
      ctx.beginPath(); ctx.moveTo(cx, h * 0.12); ctx.lineTo(cx, h * 0.6 * ba + h * 0.12); ctx.stroke()
      sceneLabel(ctx, 'exposure ends when the sensor has seen enough', cx, h * 0.82, seg(p, 0.7, 1), { align: 'center', size: 11 })
    },
  },
  {
    id: 'magnification',
    title: 'Magnification views: drop the grid, use the air gap',
    body: 'Lifting the breast away from the detector magnifies the region (**×1.5–2.0**) — and the **air gap itself lets scatter diverge past the detector**, so the grid comes out. The geometry punishes any blur, which is why these views demand the **0.1 mm** focal spot.',
    trap: 'A magnification factor below 1 is physically impossible here — a favourite nonsense option.',
    draw: (ctx, w, h, p) => {
      const fx = w * 0.5, fy = h * 0.12
      // focal spot
      ctx.fillStyle = rgba(ACC, 0.95)
      ctx.beginPath(); ctx.arc(fx, fy, 3, 0, Math.PI * 2); ctx.fill()
      // raised breast platform
      const py = h * 0.4
      ctx.strokeStyle = rgba(INK, 0.55)
      ctx.beginPath(); ctx.moveTo(fx - w * 0.13, py); ctx.lineTo(fx + w * 0.13, py); ctx.stroke()
      // lesion
      ctx.strokeStyle = rgba(ACC, 0.9)
      ctx.beginPath(); ctx.arc(fx + w * 0.02, py - 10, 7, 0, Math.PI * 2); ctx.stroke()
      // detector
      const dy = h * 0.74
      ctx.strokeStyle = rgba(INK, 0.7)
      ctx.lineWidth = 3
      ctx.beginPath(); ctx.moveTo(fx - w * 0.24, dy); ctx.lineTo(fx + w * 0.24, dy); ctx.stroke()
      ctx.lineWidth = 1
      // projection rays
      const f = smoothstep(seg(p, 0.25, 0.7))
      for (const s of [-1, 1]) {
        const ox = fx + w * 0.02 + s * 7
        const proj = fx + ((ox - fx) * (dy - fy)) / (py - 10 - fy)
        ctx.strokeStyle = rgba(ACC, 0.5 * f)
        ctx.beginPath(); ctx.moveTo(fx, fy); ctx.lineTo(lerp(fx, proj, f), lerp(fy, dy, f)); ctx.stroke()
      }
      // magnified image mark
      const ia = smoothstep(seg(p, 0.65, 0.95))
      ctx.strokeStyle = rgba(ACC, 0.9 * ia)
      ctx.lineWidth = 2
      const half = 7 * ((dy - fy) / (py - 10 - fy))
      ctx.beginPath(); ctx.moveTo(fx + w * 0.02 * ((dy - fy) / (py - 10 - fy)) - half, dy); ctx.lineTo(fx + w * 0.02 * ((dy - fy) / (py - 10 - fy)) + half, dy); ctx.stroke()
      ctx.lineWidth = 1
      // air gap label + scatter diverging
      const sa = smoothstep(seg(p, 0.5, 0.85))
      ctx.setLineDash([3, 4])
      ctx.strokeStyle = rgba(AMBER, 0.55 * sa)
      ctx.beginPath(); ctx.moveTo(fx - w * 0.04, py - 4); ctx.lineTo(fx - w * 0.3, dy - 8); ctx.stroke()
      ctx.setLineDash([])
      sceneLabel(ctx, 'scatter diverges — misses the detector', fx - w * 0.31, dy - 20, sa, { size: 10.5, color: rgba(AMBER, 0.9) })
      sceneLabel(ctx, 'air gap', fx + w * 0.16, (py + dy) / 2, seg(p, 0.4, 0.7), { size: 11 })
      sceneLabel(ctx, 'magnified ×1.5–2.0 — no grid needed', fx, dy + 22, ia, { align: 'center', size: 11 })
    },
  },
  {
    id: 'resolution',
    title: 'The sharpest system in radiology',
    body: 'Detecting microcalcifications a few hundred microns across demands the sharpest imaging in radiology — **film-screen reached ~15–20 lp/mm; digital mammography resolves ~5–10** and still outresolves every other modality. That sharpness is bought with the small focal spot, the fine detector, firm compression and short exposures.',
    numbers: 'Film-screen mammo up to **~15–20 lp/mm** · digital mammo **~5–10** · general DR **3–5** · CT **1–2**.',
    draw: (ctx, w, h, p) => {
      // bar chart of lp/mm
      const gx = w * 0.2, gy = h * 0.18, gw = w * 0.56, gh = h * 0.5
      const bars: [string, number][] = [['CT', 2], ['fluoro', 1.5], ['DR', 4.5], ['mammo', 15]]
      const bw = gw / bars.length
      bars.forEach(([name, v], i) => {
        const a = smoothstep(seg(p, i * 0.15, 0.35 + i * 0.15))
        const bh = (v / 16) * gh * a
        const accent = name === 'mammo'
        ctx.fillStyle = rgba(accent ? ACC : INK, accent ? 0.75 : 0.3)
        ctx.fillRect(gx + i * bw + bw * 0.22, gy + gh - bh, bw * 0.56, bh)
        sceneLabel(ctx, name, gx + i * bw + bw / 2, gy + gh + 16, a, { align: 'center', size: 11 })
        sceneLabel(ctx, `${v}`, gx + i * bw + bw / 2, gy + gh - bh - 10, a, { align: 'center', size: 11, color: accent ? rgba(ACC, 0.95) : undefined })
      })
      ctx.strokeStyle = rgba(INK, 0.3)
      ctx.beginPath(); ctx.moveTo(gx, gy + gh); ctx.lineTo(gx + gw, gy + gh); ctx.stroke()
      sceneLabel(ctx, 'line pairs per millimetre', gx + gw / 2, gy - 8, p, { align: 'center', size: 10.5 })
    },
  },
  {
    id: 'cnr',
    title: 'What decides visibility: contrast-to-noise ratio',
    body: 'A microcalcification is seen only if its **contrast beats the noise around it** — the contrast-to-noise ratio. Digital detectors with high **DQE** convert more of the arriving dose into signal, holding CNR at lower dose — the case that retired film-screen. The statistics never bend: **halve the dose and CNR falls by √2**.',
    draw: (ctx, w, h, p) => {
      const s = Math.min(w, h) * 0.15, y = h * 0.4
      let seed = 987
      const rnd = () => { seed = (seed * 48271) % 2147483647; return seed / 2147483647 }
      const patch = (cx: number, grains: number, lesionA: number, label: string, a: number) => {
        ctx.strokeStyle = rgba(INK, 0.35 * a)
        ctx.strokeRect(cx - s, y - s, s * 2, s * 2)
        ctx.fillStyle = rgba(INK, 0.5 * a)
        for (let i = 0; i < grains; i++) ctx.fillRect(cx - s + rnd() * s * 2, y - s + rnd() * s * 2, 1.6, 1.6)
        // cluster of microcalcifications
        ctx.fillStyle = rgba(ACC, lesionA * a)
        for (const [dx, dy] of [[0.1, -0.05], [0.22, 0.08], [-0.02, 0.16], [0.3, -0.12], [0.16, 0.24]] as const) {
          ctx.beginPath(); ctx.arc(cx + dx * s, y + dy * s, 2.2, 0, Math.PI * 2); ctx.fill()
        }
        sceneLabel(ctx, label, cx, y + s + 18, a, { align: 'center', size: 11 })
      }
      patch(w * 0.3, 560, 0.55, 'low dose — the cluster drowns', smoothstep(seg(p, 0, 0.4)))
      patch(w * 0.7, 180, 0.95, 'adequate dose, high DQE — it stands out', smoothstep(seg(p, 0.35, 0.8)))
      sceneLabel(ctx, 'CNR = contrast ÷ noise · noise ∝ 1/√dose', w / 2, h * 0.12, seg(p, 0.6, 1), { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
  {
    id: 'tomo-dose',
    title: 'Tomosynthesis, and the dose that pays for screening',
    body: 'Sweep the tube through a **limited arc**, take low-dose projections, and reconstruct a **stack of slices**: overlapping tissue separates, at in-plane sharpness a whisker below a standard view. Each 2D view costs a **mean glandular dose of about 2 mGy** — kept deliberately low because screening exposes healthy women, repeatedly.',
    draw: (ctx, w, h, p, t) => {
      const cx = w * 0.5, cy = h * 0.6
      // arc sweep
      const sweep = Math.min(t / 2, 1)
      const arcR = h * 0.42
      for (let i = 0; i <= 6; i++) {
        const f = i / 6
        if (f > sweep) break
        const a = -Math.PI / 2 + (f - 0.5) * 0.7
        const x = cx + Math.cos(a) * arcR, y = cy + Math.sin(a) * arcR
        ctx.fillStyle = rgba(ACC, 0.85)
        ctx.beginPath(); ctx.arc(x, y, 3.4, 0, Math.PI * 2); ctx.fill()
        ctx.strokeStyle = rgba(ACC, 0.2)
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(cx, cy); ctx.stroke()
      }
      sceneLabel(ctx, 'limited arc — a few low-dose projections', cx, cy - arcR - 14, p, { align: 'center', size: 11 })
      // slice stack
      const sa = smoothstep(seg(p, 0.5, 0.95))
      for (let i = 0; i < 4; i++) {
        const y = cy + 6 + i * 12
        ctx.strokeStyle = rgba(INK, (0.55 - i * 0.1) * sa)
        ctx.beginPath(); ctx.moveTo(cx - w * 0.15 + i * 5, y); ctx.lineTo(cx + w * 0.15 + i * 5, y); ctx.stroke()
      }
      sceneLabel(ctx, 'reconstructed slices — overlap removed', cx, cy + 70, sa, { align: 'center', size: 11 })
      sceneLabel(ctx, 'mean glandular dose ≈ 2 mGy per view', cx, h * 0.12, seg(p, 0.7, 1), { align: 'center', size: 12, color: rgba(ACC, 0.95) })
    },
  },
]

/**
 * Lesson diagrams re-hosted by RADIOPASS PHYSICS topic 04.
 *
 * Every drawing in this module was unreachable from the course: the topic
 * embedded one spectrum sim and linked here for the rest, and nothing in this
 * file was exported. Ten purpose-built scenes — the low-energy argument,
 * the shaped spectrum, compression, the geometry pair, grids, resolution,
 * CNR and the tomosynthesis sweep — sat finished and invisible.
 */
function lessonDraw(id: string): StepDraw {
  const draw = STEPS.find((s) => s.id === id)?.draw
  if (!draw) throw new Error(`Mammography lesson step "${id}" has no diagram to replay`)
  return draw
}
export const drawWhyLow = lessonDraw('why-low')
export const drawTargetFilter = lessonDraw('target-filter')
export const drawPairs = lessonDraw('pairs')
export const drawCompression = lessonDraw('compression')
export const drawTubeGeometry = lessonDraw('tube-geometry')
export const drawGridAec = lessonDraw('grid-aec')
export const drawMagnification = lessonDraw('magnification')
export const drawResolution = lessonDraw('resolution')
export const drawCnr = lessonDraw('cnr')
export const drawTomoDose = lessonDraw('tomo-dose')

export default function MammoLab() {
  return (
    <LessonPage
      meta={{
        title: 'Mammography',
        kicker: 'X-ray techniques',
        accent: ACC,
        intro: 'A machine where **every design choice serves contrast and resolution at minimal dose** — ten ideas, each one drawn.',
        /* Practice and facts now arrive through the course spine — and the
           practice gate opens mammography's OWN question section, not the
           whole X-ray subject it used to dump learners into. */
        next: [],
        backTo: { label: 'X-ray physics', to: '/xray-lab' },
        synthesis: {
          headline: 'One imaging problem, every answer.',
          bigPicture:
            'Hold the problem and the machine explains itself: **tiny soft-tissue differences and microcalcifications** demand low energies, high resolution and merciless dose discipline. Compression wins on **every axis at once** — thickness, scatter, dose, motion, overlap. The Mo/Rh targets shape the spectrum to the task; the small focal spot and the air gap make magnification views possible. Nothing on this machine is an accident.',
          controls: [
            { change: '**Compression** ↑', effect: 'thickness ↓ → scatter ↓ → contrast ↑ · dose ↓ · motion ↓ · overlap ↓ · sharper geometry — **every axis at once**' },
            { change: '**Photon energy** too high', effect: 'differential attenuation ↓ → **subject contrast collapses**' },
            { change: '**Photon energy** too low', effect: 'penetration ↓ → **absorbed dose climbs** — the optimisation is a balance' },
            { change: '**Magnification view**', effect: 'object elevated → OID ↑ → M ↑ · needs the **0.1 mm focal spot** · the air gap replaces the grid' },
          ],
          confuse: [
            { a: '**Low-energy spectrum** — buys soft-tissue contrast', b: '**Small focal spot** — buys geometric sharpness; different jobs' },
            { a: '**Grid** — scatter control in contact imaging, costs dose', b: '**Air gap** — scatter control in magnification, no grid needed' },
            { a: '**Tomosynthesis** — separates superimposed tissue in depth', b: 'what it does NOT do — beat 2D mammography’s in-plane resolution' },
          ],
        },
      }}
      steps={STEPS}
    />
  )
}
