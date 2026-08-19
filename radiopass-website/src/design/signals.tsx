/**
 * The physics visual family — five modality signals as sculptural glyphs.
 *
 * These are the approved signal vignettes from the cinematic tour
 * (src/home/Home.tsx), lifted into a shared, token-coloured module so the
 * portal and any future surface can present them at monumental scale.
 * The geometry is IDENTICAL to the tour's; only the colour classes moved
 * from the .home-page scope onto tokens (see signals.css). The tour page
 * still renders its own copies until it takes its own redesign pass.
 *
 * Physics of each drawing, unchanged and deliberate:
 *  - X-ray: E field solid over a fainter dashed B field; the wave extends
 *    one wavelength (28px) past the frame and translates by exactly that,
 *    so the travel loops seamlessly.
 *  - Ultrasound: a longitudinal compression field — line spacing AND
 *    brightness follow the pressure wave (λ = 56px).
 *  - MRI: a moment precessing about B₀ on its cone.
 *  - NM: a close-packed nucleus in an unstable halo emitting a gamma
 *    wiggle — visibly higher frequency than the X-ray wave.
 *  - CT: the same photon, but the measurement goes round — source, fan
 *    and detector arc rotating about the patient, one direction, never
 *    reversing.
 */
import type { ReactNode } from 'react'
import './signals.css'

const XRAY_E_PATH = (() => {
  let d = 'M-28 28'
  for (let x = -28; x < 172; x += 28) d += ` Q ${x + 7} 8 ${x + 14} 28 T ${x + 28} 28`
  return d
})()

const XRAY_B_PATH = (() => {
  let d = 'M-28 28'
  for (let x = -28; x < 172; x += 28) d += ` Q ${x + 7} 21 ${x + 14} 28 T ${x + 28} 28`
  return d
})()

const US_LINES = (() => {
  const lines: { x: number; opacity: number; tall: boolean }[] = []
  for (let x0 = -56; x0 <= 180; x0 += 4.6) {
    const phase = (2 * Math.PI * x0) / 56
    lines.push({
      x: x0 + 5.5 * Math.sin(phase),
      opacity: 0.22 + 0.68 * Math.max(0, Math.cos(phase)),
      tall: Math.cos(phase) > 0.6,
    })
  }
  return lines
})()

const NUCLEONS = (() => {
  const cluster: { cx: number; cy: number; proton: boolean }[] = [{ cx: 28, cy: 28, proton: true }]
  for (let i = 0; i < 6; i += 1) {
    const angle = (Math.PI / 3) * i + 0.35
    cluster.push({
      cx: 28 + 6.4 * Math.cos(angle),
      cy: 28 + 6.4 * Math.sin(angle),
      proton: i % 2 === 0,
    })
  }
  return cluster
})()

const GAMMA_PATH = (() => {
  let d = 'M46 28'
  for (let x = 46; x < 100; x += 9) d += ` Q ${x + 2.25} 22 ${x + 4.5} 28 T ${x + 9} 28`
  return d
})()

export type SignalKey = 'xray' | 'ct' | 'mri' | 'us' | 'nm'

export const SIGNAL_GLYPHS: { key: SignalKey; name: string; desc: string; svg: ReactNode }[] = [
  {
    key: 'xray', name: 'X-ray', desc: 'Electromagnetic wave',
    svg: (
      <svg className="rp-sig" viewBox="0 0 120 56" aria-hidden="true">
        <defs>
          <clipPath id="rp-sigclip-x"><rect x="0" y="0" width="120" height="56" /></clipPath>
        </defs>
        <line x1="2" y1="28" x2="112" y2="28" className="rp-sig-axis" />
        <path d="m116 28 -5 -3 M116 28 l-5 3" className="rp-sig-axishead" />
        <g clipPath="url(#rp-sigclip-x)">
          <g className="rp-sig-drift-x">
            <path className="rp-sig-b" d={XRAY_B_PATH} />
            <path className="rp-sig-e" d={XRAY_E_PATH} />
          </g>
        </g>
      </svg>
    ),
  },
  {
    key: 'ct', name: 'CT', desc: 'Attenuation, every angle',
    svg: (
      <svg className="rp-sig" viewBox="0 0 120 56" aria-hidden="true">
        <circle cx="60" cy="28" r="21" className="rp-sig-cone rp-sig-ct-bore" />
        <circle cx="60" cy="28" r="8.5" className="rp-sig-ct-patient" />
        <g className="rp-sig-ct-gantry">
          <circle cx="60" cy="7" r="3.2" className="rp-sig-ct-source" />
          <path d="M60 10 L52 46 M60 10 L60 46 M60 10 L68 46" className="rp-sig-ct-fan" />
          <path d="M46 46 A 17 17 0 0 0 74 46" className="rp-sig-ct-detector" />
        </g>
      </svg>
    ),
  },
  {
    key: 'mri', name: 'MRI', desc: 'Precessing moment',
    svg: (
      <svg className="rp-sig" viewBox="0 0 120 56" aria-hidden="true">
        <line x1="60" y1="52" x2="60" y2="8" className="rp-sig-axis" />
        <path d="m60 5 -3 5 M60 5 l3 5" className="rp-sig-axishead" />
        <text x="66" y="12" className="rp-sig-label">B₀</text>
        <ellipse cx="60" cy="16" rx="26" ry="7" className="rp-sig-cone" />
        <ellipse cx="60" cy="16" rx="15" ry="4" className="rp-sig-cone rp-sig-cone-inner" />
        <g className="rp-sig-spin">
          <line x1="60" y1="48" x2="82" y2="15" className="rp-sig-ghost" />
          <line x1="60" y1="48" x2="82" y2="15" className="rp-sig-mri" />
          <circle cx="82" cy="15" r="5.5" className="rp-sig-tip-halo" />
          <circle cx="82" cy="15" r="2.4" className="rp-sig-mri-dot" />
        </g>
      </svg>
    ),
  },
  {
    key: 'us', name: 'Ultrasound', desc: 'Pressure wave',
    svg: (
      <svg className="rp-sig" viewBox="0 0 120 56" aria-hidden="true">
        <defs>
          <clipPath id="rp-sigclip-us"><rect x="0" y="0" width="120" height="56" /></clipPath>
        </defs>
        <g clipPath="url(#rp-sigclip-us)">
          <g className="rp-sig-drift-us">
            {US_LINES.map((line, i) => (
              <line
                key={i}
                x1={line.x}
                y1={line.tall ? 10 : 14}
                x2={line.x}
                y2={line.tall ? 46 : 42}
                className="rp-sig-us"
                style={{ opacity: line.opacity }}
              />
            ))}
          </g>
        </g>
      </svg>
    ),
  },
  {
    key: 'nm', name: 'Nuclear medicine', desc: 'Gamma emission',
    svg: (
      <svg className="rp-sig" viewBox="0 0 120 56" aria-hidden="true">
        <circle cx="28" cy="28" r="14.5" className="rp-sig-halo" />
        <g className="rp-sig-nucleus">
          {NUCLEONS.map((n, i) => (
            <circle
              key={i}
              cx={n.cx}
              cy={n.cy}
              r="3.3"
              className={n.proton ? 'rp-sig-proton' : 'rp-sig-neutron'}
              style={{ animationDelay: `${i * 0.42}s` }}
            />
          ))}
        </g>
        <path className="rp-sig-gamma" d={GAMMA_PATH} />
        <path className="rp-sig-gamma-head" d="m104 28 -5.5 -3.3 M104 28 l-5.5 3.3" />
        <text x="106" y="20" className="rp-sig-label rp-sig-label-gamma">γ</text>
      </svg>
    ),
  },
]
