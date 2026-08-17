/**
 * The X-ray spectrum, redrawn natively.
 *
 * Replaces the iframed SVG version, which stepped visibly when dragged. Here
 * every input redraws one canvas immediately, so the curve moves with the
 * slider. The target is chosen by name — Tungsten or Molybdenum — never by
 * an atomic-number dial, and every control carries its label.
 *
 * The model is the teaching model: a Kramers continuum I(E) ∝ Z·(kVp − E)
 * scaled by mAs, filtered by an E⁻³ attenuation term; characteristic lines
 * appear only once kVp exceeds the K-shell binding energy.
 */

import { useState } from 'react'
import { DrawCanvas } from './DrawCanvas'

type Target = 'W' | 'Mo'

const TARGETS: Record<
  Target,
  { name: string; z: number; ka: number; kb: number; kEdge: number }
> = {
  W: { name: 'Tungsten', z: 74, ka: 59.3, kb: 67.2, kEdge: 69.5 },
  Mo: { name: 'Molybdenum', z: 42, ka: 17.5, kb: 19.6, kEdge: 20.0 },
}

const E_AXIS_MAX = 150 // keV, fixed so the endpoint visibly follows kVp
const MAS_MAX = 400 // the top of the mAs slider — also the drawing's full height

export function XraySpectrum({ initialTarget = 'W', initialKvp = 80 }: { initialTarget?: Target; initialKvp?: number }) {
  const [target, setTarget] = useState<Target>(initialTarget)
  const [kvp, setKvp] = useState(initialKvp)
  const [mas, setMas] = useState(200)
  const [filt, setFilt] = useState(2.5)

  const t = TARGETS[target]
  const linesVisible = kvp > t.kEdge

  // The spectrum, sampled finely. Filtration eats the low energies with an
  // E⁻³-shaped term; the continuum is Kramers' straight line down to kVp.
  // `atMas` exists so the drawing can be scaled against the curve at a fixed
  // reference mAs — otherwise normalising by the curve's own peak would
  // cancel the mAs term exactly, and the mAs control would do nothing at all.
  const spectrumAt = (E: number, m: number) => {
    if (E <= 0 || E >= kvp) return 0
    const continuum = t.z * (kvp - E) * (m / MAS_MAX)
    const filtration = Math.exp(-filt * 160 / (E * E * E) * 30)
    return continuum * filtration
  }
  const spectrum = (E: number) => spectrumAt(E, mas)

  // Mean energy from the same curve the eye sees.
  let sum = 0
  let wsum = 0
  for (let E = 1; E < kvp; E += 0.5) {
    const s = spectrum(E)
    sum += s
    wsum += s * E
  }
  const meanE = sum > 0 ? wsum / sum : 0

  const draw = (ctx: CanvasRenderingContext2D, w: number, h: number, p: number) => {
    const x0 = 46
    const y0 = h - 34
    const gw = w - x0 - 16
    const gh = y0 - 18
    const ex = (E: number) => x0 + (E / E_AXIS_MAX) * gw

    // The vertical scale is fixed at FULL mAs for the current kVp, target and
    // filtration — so lowering mAs visibly lowers the whole curve (its only
    // effect: amplitude, never shape) while the graph still fills the frame
    // across the kVp range.
    let peak = 0
    for (let E = 1; E < kvp; E += 0.5) peak = Math.max(peak, spectrumAt(E, MAS_MAX))
    const yOf = (v: number) => y0 - (peak > 0 ? (v / (peak * 1.2)) * gh : 0)

    // axes
    ctx.strokeStyle = 'rgba(240,240,235,0.35)'
    ctx.beginPath()
    ctx.moveTo(x0, y0 - gh)
    ctx.lineTo(x0, y0)
    ctx.lineTo(x0 + gw, y0)
    ctx.stroke()
    ctx.font = '500 10.5px Inter, system-ui, sans-serif'
    ctx.fillStyle = 'rgba(240,240,235,0.55)'
    ctx.textAlign = 'center'
    for (let E = 0; E <= E_AXIS_MAX; E += 25) ctx.fillText(String(E), ex(E), y0 + 15)
    ctx.fillText('photon energy (keV)', x0 + gw / 2, y0 + 29)
    ctx.save()
    ctx.translate(13, y0 - gh / 2)
    ctx.rotate(-Math.PI / 2)
    ctx.fillText('relative intensity', 0, 0)
    ctx.restore()

    // the filtered continuum
    ctx.beginPath()
    ctx.moveTo(ex(0), y0)
    for (let E = 0.5; E <= kvp; E += 0.4) ctx.lineTo(ex(E), yOf(spectrum(E) * p))
    ctx.lineTo(ex(kvp), y0)
    ctx.closePath()
    ctx.fillStyle = 'rgba(217,168,78,0.16)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(217,168,78,0.9)'
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.lineWidth = 1

    // characteristic lines — only above the K-edge
    if (linesVisible) {
      // Kα and Kβ can be only a couple of keV apart (molybdenum: 17.5 and
      // 19.6), which is a few pixels on a 150 keV axis — so the two labels
      // are pushed to opposite sides of their spikes rather than stacked.
      for (const [E, rel, name, align, dx] of [
        [t.ka, 1.6, 'Kα', 'right', -4],
        [t.kb, 1.15, 'Kβ', 'left', 4],
      ] as const) {
        const base = spectrum(E)
        const top = yOf(Math.max(base * rel, peak * 0.55) * p)
        ctx.strokeStyle = 'rgba(168,203,234,0.95)'
        ctx.lineWidth = 2.2
        ctx.beginPath()
        ctx.moveTo(ex(E), yOf(base * p))
        ctx.lineTo(ex(E), top)
        ctx.stroke()
        ctx.lineWidth = 1
        ctx.fillStyle = 'rgba(168,203,234,0.95)'
        ctx.textAlign = align
        ctx.fillText(name, ex(E) + dx, top - 7)
        ctx.textAlign = 'center'
      }
    }

    // endpoint = kVp, always marked
    ctx.strokeStyle = 'rgba(240,240,235,0.5)'
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(ex(kvp), y0)
    ctx.lineTo(ex(kvp), y0 - gh * 0.82)
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = 'rgba(240,240,235,0.75)'
    ctx.fillText(`E max = ${kvp} keV`, ex(kvp), y0 - gh * 0.86)

    // mean energy
    if (meanE > 0) {
      ctx.strokeStyle = 'rgba(217,168,78,0.55)'
      ctx.setLineDash([2, 5])
      ctx.beginPath()
      ctx.moveTo(ex(meanE), y0)
      ctx.lineTo(ex(meanE), y0 - gh * 0.6)
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(217,168,78,0.9)'
      ctx.fillText(`mean ${meanE.toFixed(0)} keV`, ex(meanE), y0 - gh * 0.64)
    }
  }

  return (
    <div className="v2-ctwin">
      <div>
        <DrawCanvas
          draw={draw}
          height={330}
          label={`Filtered ${t.name} spectrum at ${kvp} kVp: continuum ending at ${kvp} keV, mean ${meanE.toFixed(0)} keV${linesVisible ? ', characteristic lines visible' : ', characteristic lines absent below the K-edge'}`}
        />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>
            Target material <b>{t.name} · Z {t.z}</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose the target material">
          {(Object.keys(TARGETS) as Target[]).map((key) => (
            <button key={key} type="button" className={key === target ? 'on' : ''} onClick={() => setTarget(key)}>
              {TARGETS[key].name}
            </button>
          ))}
        </div>
        <label>
          <span>
            Tube potential <b>{kvp} kVp</b>
          </span>
          <input type="range" min={20} max={150} step={1} value={kvp} onChange={(e) => setKvp(Number(e.target.value))} />
        </label>
        <label>
          <span>
            mAs — how many photons <b>{mas} mAs</b>
          </span>
          <input type="range" min={50} max={MAS_MAX} step={10} value={mas} onChange={(e) => setMas(Number(e.target.value))} />
        </label>
        <label>
          <span>
            Added filtration <b>{filt.toFixed(1)} mm Al</b>
          </span>
          <input type="range" min={0} max={5} step={0.1} value={filt} onChange={(e) => setFilt(Number(e.target.value))} />
        </label>
        <p className="v2-ctwin-read">
          {linesVisible
            ? `${t.name}'s characteristic lines sit at ${t.ka} and ${t.kb} keV — they appear because kVp now exceeds the K-shell binding energy (${t.kEdge} keV), and they refuse to move when kVp changes.`
            : `No characteristic lines: kVp is below ${t.name}'s K-shell binding energy (${t.kEdge} keV). Raise the potential past it and the lines appear at ${t.ka} and ${t.kb} keV.`}{' '}
          mAs scales the whole curve without moving anything; filtration eats the low-energy end, raising the mean while the endpoint stays at kVp.
        </p>
      </div>
    </div>
  )
}
