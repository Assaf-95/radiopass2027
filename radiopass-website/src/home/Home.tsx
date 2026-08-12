// RadioPass homepage — a cinematic scroll journey through radiology physics.
// Everything here is scoped under .home-page with hm- prefixed classes so the
// rest of the site's styling is untouched.

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import HeroScene from './scenes/HeroScene'
import XrayScene from './scenes/XrayScene'
import { useInView, DEBUG_ONLY, DEBUG_P } from './fx'
import './home.css'

/* ---------------- navigation ---------------- */

// One door per stage of the journey — the same order as the shared header.
const NAV_LINKS: [string, string][] = [
  ['Learn', '/visual-lab'],
  ['Practise', '/question-bank'],
  ['Mock Exams', '/question-bank/mock'],
  ['Fact Bank', '/fact-bank'],
  ['Study Plan', '/study-plan'],
]

function HomeNav() {
  const [scrolled, setScrolled] = useState(false)
  const [branded, setBranded] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 24)
      setBranded(window.scrollY > window.innerHeight * 0.45)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <header className={`hm-nav${scrolled ? ' is-scrolled' : ''}${open ? ' is-open' : ''}`}>
      <div className="hm-nav-inner">
        <Link to="/" className={`hm-nav-brand${branded || open ? ' is-on' : ''}`} aria-label="RadioPass home">RADIOPASS</Link>
        <nav className="hm-nav-links" aria-label="Primary">
          {NAV_LINKS.map(([label, href]) => <Link key={label} to={href}>{label}</Link>)}
        </nav>
        <div className="hm-nav-actions">
          <Link to="/pricing" className="hm-btn hm-btn-solid hm-btn-sm hm-nav-cta">Start Learning</Link>
          <button
            className="hm-nav-burger" aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open} onClick={() => setOpen(!open)}
          >
            <span /><span />
          </button>
        </div>
      </div>
      <div className="hm-nav-sheet" role="dialog" aria-label="Menu" aria-hidden={!open}>
        <nav aria-label="Primary mobile">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} to={href} onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>{label}</Link>
          ))}
        </nav>
        <Link to="/pricing" className="hm-btn hm-btn-solid" onClick={() => setOpen(false)} tabIndex={open ? 0 : -1}>Start Learning</Link>
      </div>
    </header>
  )
}

/* ---------------- section 1: the invisible science ---------------- */

/* The four signal vignettes are drawn as fine-line instrument sketches: every
   stroke is physics. The X-ray and ultrasound waves genuinely travel (a
   pattern one wavelength longer than the frame, translated by exactly one
   wavelength, loops seamlessly); the gamma photon leaves the nucleus as a
   tight high-frequency wiggle because that is what separates it from the
   longer-wavelength X-ray beside it. */

/** One EM wavelength is 28 px; the paths span one extra λ for the drift loop. */
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

/** Compression field: line spacing and brightness both follow the pressure wave (λ = 56 px). */
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

/** Seven nucleons in a close-packed cluster: centre plus a hexagonal shell. */
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

/** The gamma photon: a tight 9 px wavelength — visibly higher frequency than the X-ray. */
const GAMMA_PATH = (() => {
  let d = 'M46 28'
  for (let x = 46; x < 100; x += 9) d += ` Q ${x + 2.25} 22 ${x + 4.5} 28 T ${x + 9} 28`
  return d
})()

const SIGNALS = [
  {
    key: 'xray', name: 'X-ray', to: '/xray-lab', desc: 'Electromagnetic wave',
    svg: (
      <svg viewBox="0 0 120 56" aria-hidden="true">
        <defs>
          <clipPath id="hm-sigclip-x"><rect x="0" y="0" width="120" height="56" /></clipPath>
        </defs>
        <line x1="2" y1="28" x2="112" y2="28" className="hm-sig-axis" />
        <path d="m116 28 -5 -3 M116 28 l-5 3" className="hm-sig-axishead" />
        <g clipPath="url(#hm-sigclip-x)">
          <g className="hm-sig2-drift-x">
            <path className="hm-sig2-b" d={XRAY_B_PATH} />
            <path className="hm-sig2-e" d={XRAY_E_PATH} />
          </g>
        </g>
      </svg>
    ),
  },
  {
    key: 'us', name: 'Ultrasound', to: '/ultrasound-lab', desc: 'Longitudinal pressure wave',
    svg: (
      <svg viewBox="0 0 120 56" aria-hidden="true">
        <defs>
          <clipPath id="hm-sigclip-us"><rect x="0" y="0" width="120" height="56" /></clipPath>
        </defs>
        <g clipPath="url(#hm-sigclip-us)">
          <g className="hm-sig2-drift-us">
            {US_LINES.map((line, i) => (
              <line
                key={i}
                x1={line.x}
                y1={line.tall ? 10 : 14}
                x2={line.x}
                y2={line.tall ? 46 : 42}
                className="hm-sig-us"
                style={{ opacity: line.opacity }}
              />
            ))}
          </g>
        </g>
      </svg>
    ),
  },
  {
    key: 'mri', name: 'MRI', to: '/mri', desc: 'Precessing magnetic moment',
    svg: (
      <svg viewBox="0 0 120 56" aria-hidden="true">
        <line x1="60" y1="52" x2="60" y2="8" className="hm-sig-axis" />
        <path d="m60 5 -3 5 M60 5 l3 5" className="hm-sig-axishead" />
        <text x="66" y="12" className="hm-sig2-label">B₀</text>
        <ellipse cx="60" cy="16" rx="26" ry="7" className="hm-sig-cone" />
        <ellipse cx="60" cy="16" rx="15" ry="4" className="hm-sig-cone hm-sig2-cone-inner" />
        <g className="hm-sig-spin">
          <line x1="60" y1="48" x2="82" y2="15" className="hm-sig2-ghost" />
          <line x1="60" y1="48" x2="82" y2="15" className="hm-sig-mri" />
          <circle cx="82" cy="15" r="5.5" className="hm-sig2-tip-halo" />
          <circle cx="82" cy="15" r="2.4" className="hm-sig-mri-dot" />
        </g>
      </svg>
    ),
  },
  {
    key: 'nm', name: 'Nuclear medicine', to: '/nm-lab', desc: 'Gamma emission from a radionuclide',
    svg: (
      <svg viewBox="0 0 120 56" aria-hidden="true">
        <circle cx="28" cy="28" r="14.5" className="hm-sig2-halo" />
        <g className="hm-sig-nucleus">
          {NUCLEONS.map((n, i) => (
            <circle
              key={i}
              cx={n.cx}
              cy={n.cy}
              r="3.3"
              className={n.proton ? 'hm-sig2-proton' : 'hm-sig2-neutron'}
              style={{ animationDelay: `${i * 0.42}s` }}
            />
          ))}
        </g>
        <path className="hm-sig-gamma" d={GAMMA_PATH} />
        <path className="hm-sig-gamma-head" d="m104 28 -5.5 -3.3 M104 28 l-5.5 3.3" />
        <circle r="1.7" className="hm-sig2-photon">
          <animateMotion dur="2.6s" repeatCount="indefinite" path={GAMMA_PATH.slice(1)} />
        </circle>
        <text x="106" y="20" className="hm-sig2-label hm-sig2-label-gamma">γ</text>
      </svg>
    ),
  },
]

/* The CT tile.
   Every other tile draws a distinct physical signal; CT's is the same X-ray
   photon as the first tile, which is exactly the point worth drawing. What
   makes it CT is that the measurement goes round: a source and its detector
   arc rotating about the patient, one projection per angle. The rotation is
   the whole idea, so the rotation is the animation. */
const CT_SIGNAL = {
  key: 'ct', name: 'CT', desc: 'X-ray attenuation, measured from every angle',
  to: '/ct-lab',
  svg: (
    <svg viewBox="0 0 120 56" aria-hidden="true">
      <circle cx="60" cy="28" r="21" className="hm-sig-cone hm-sig-ct-bore" />
      <circle cx="60" cy="28" r="8.5" className="hm-sig-ct-patient" />
      <g className="hm-sig-ct-gantry">
        <circle cx="60" cy="7" r="3.2" className="hm-sig-ct-source" />
        {/* The fan: three rays from the source across the patient to the arc. */}
        <path d="M60 10 L52 46 M60 10 L60 46 M60 10 L68 46" className="hm-sig-ct-fan" />
        <path d="M46 46 A 17 17 0 0 0 74 46" className="hm-sig-ct-detector" />
      </g>
    </svg>
  ),
}

function SignalsSection() {
  const { ref, vis } = useInView<HTMLElement>()
  return (
    <section ref={ref} className={`hm-section hm-signals${vis ? ' in-view' : ''}`} aria-labelledby="hm-sig-h">
      <div className="hm-wrap">
        <p className="hm-eyebrow">The invisible science</p>
        <h2 id="hm-sig-h" className="hm-display">Every image begins<br />with an interaction.</h2>
        <p className="hm-lede">Photons, electrons, tissues, fields and sound waves determine the image before it reaches the screen.</p>
        <ul className="hm-signal-grid">
          {[...SIGNALS, CT_SIGNAL].map((s, i) => (
            <li key={s.key} style={{ transitionDelay: `${i * 90}ms` }}>
              <Link to={s.to} className="hm-signal-link">
                {s.svg}
                <h3>{s.name}</h3>
                <p>{s.desc}</p>
                <span className="hm-signal-go" aria-hidden="true">Open the laboratory →</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/* ---------------- section 5: learning modules ---------------- */

// The learning modules: one laboratory per modality. Each entry is a lab —
// the focused, concept-at-a-time route in first position, the deeper
// instruments behind it.
const MODULES: { n: string; title: string; desc: string; href: string; glyph: React.ReactNode }[] = [
  {
    n: '01', title: 'X-ray Techniques', desc: 'Mammography · Fluoroscopy · CR & digital radiography — three focused lessons.', href: '/xray-lab',
    glyph: <svg viewBox="0 0 48 48"><path d="M10 12 L24 24 L10 36" /><path d="M26 24 h14 M26 24 l10 -8 M26 24 l10 8" className="thin" /></svg>,
  },
  {
    n: '02', title: 'CT Physics', desc: 'Sixteen concepts — the four generations, the spinning gantry, the dose report — each one drawn.', href: '/ct-lab',
    glyph: <svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="9.5" className="thin" /><circle cx="24" cy="7" r="3" className="fill" /></svg>,
  },
  {
    n: '03', title: 'MRI Laboratory', desc: 'Ten connected stages on one live signal engine — magnetisation to contrast.', href: '/mri-lab',
    glyph: <svg viewBox="0 0 48 48"><ellipse cx="24" cy="14" rx="14" ry="4.5" /><path d="M24 40 L33 15" /><circle cx="33" cy="15" r="2.2" className="fill" /><path d="M24 42 V8" className="thin" strokeDasharray="3 4" /></svg>,
  },
  {
    n: '04', title: 'Ultrasound Laboratory', desc: 'Twenty-one experiments, one concept at a time — the full instrument one click away.', href: '/ultrasound-lab/focus',
    glyph: <svg viewBox="0 0 48 48"><path d="M10 10 A20 20 0 0 1 10 38" /><path d="M18 15 A13 13 0 0 1 18 33" className="thin" /><path d="M26 20 A6.5 6.5 0 0 1 26 28" className="thin" /></svg>,
  },
  {
    n: '05', title: 'Nuclear Medicine', desc: 'Fourteen concepts, from the technetium generator to the PET ring.', href: '/nm-lab',
    glyph: <svg viewBox="0 0 48 48"><ellipse cx="24" cy="24" rx="19" ry="8" /><ellipse cx="24" cy="24" rx="19" ry="8" transform="rotate(64 24 24)" /><circle cx="24" cy="24" r="2.6" className="fill" /></svg>,
  },
]

/* ---------------- the three doors ----------------
   The homepage does not teach. It opens doors: learn it, drill it, keep it.
   The five modality glyphs — the site's jewellery — live inside the first
   door, and nothing on this page explains anything. */

function DoorsSection() {
  const { ref, vis } = useInView<HTMLElement>(0.1)
  return (
    <section ref={ref} id="modules" className={`hm-section hm-doors${vis ? ' in-view' : ''}`} aria-labelledby="hm-doors-h">
      <div className="hm-wrap">
        <p className="hm-eyebrow">One path</p>
        <h2 id="hm-doors-h" className="hm-display">Learn it. Drill it.<br />Keep it.</h2>
        <div className="hm-door-list">
          <Link to="/visual-lab" className="hm-door">
            <span className="hm-door-txt">
              <h3>Learn</h3>
              <p>Five laboratories — every mechanism drawn, moving, yours to drive.</p>
            </span>
            <span className="hm-door-glyphs" aria-hidden="true">
              {MODULES.map(m => <span key={m.n} className="hm-mod-glyph">{m.glyph}</span>)}
            </span>
            <span className="hm-mod-arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/question-bank" className="hm-door">
            <span className="hm-door-txt">
              <h3>Practise</h3>
              <p>The question bank and three timed mock papers, in the real exam format.</p>
            </span>
            <span className="hm-mod-arrow" aria-hidden="true">→</span>
          </Link>
          <Link to="/fact-bank" className="hm-door">
            <span className="hm-door-txt">
              <h3>Remember</h3>
              <p>The Fact Bank — the sentences that decide marks, one screen at a time.</p>
            </span>
            <span className="hm-mod-arrow" aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  )
}

/* ---------------- section 8: finale ---------------- */

/* Ultrasound compression pattern for the finale glyph: one 56-unit period of
   line offsets; tight spacing reads as compression, wide as rarefaction. */
const FIN_US_XS: [number, number][] = [
  [0, 0.5], [7, 0.5], [12, 0.95], [15, 0.95], [18, 0.95], [25, 0.5], [35, 0.3], [47, 0.3],
]

const FINALE_BANDS: { name: string; colour: string; glyph: React.ReactNode }[] = [
  {
    name: 'X-ray', colour: '#A8CBEA',
    glyph: (
      <svg viewBox="0 0 120 44" className="hm-fin-glyph" aria-hidden="true">
        <defs><clipPath id="hm-finclip-x"><rect x="4" y="0" width="112" height="44" /></clipPath></defs>
        <g clipPath="url(#hm-finclip-x)">
          <g className="hm-fin-drift">
            <path d="M-24 22 Q -18 8 -12 22 T 0 22 Q 6 8 12 22 T 24 22 Q 30 8 36 22 T 48 22 Q 54 8 60 22 T 72 22 Q 78 8 84 22 T 96 22 Q 102 8 108 22 T 120 22 Q 126 8 132 22 T 144 22" />
          </g>
        </g>
      </svg>
    ),
  },
  {
    name: 'Ultrasound', colour: '#7BCBC4',
    glyph: (
      <svg viewBox="0 0 120 44" className="hm-fin-glyph" aria-hidden="true">
        <defs><clipPath id="hm-finclip-us"><rect x="4" y="0" width="112" height="44" /></clipPath></defs>
        <g clipPath="url(#hm-finclip-us)">
          <g className="hm-fin-usdrift">
            {[-56, 0, 56].map(off => FIN_US_XS.map(([x, o]) => (
              <line
                key={`${off}-${x}`} x1={off + x} x2={off + x}
                y1={o > 0.9 ? 10 : 13} y2={o > 0.9 ? 34 : 31}
                style={{ opacity: o }}
              />
            )))}
          </g>
        </g>
      </svg>
    ),
  },
  {
    name: 'CT', colour: '#D9A84E',
    glyph: (
      <svg viewBox="0 0 120 44" className="hm-fin-glyph" aria-hidden="true">
        <circle cx="60" cy="22" r="16" style={{ opacity: 0.55 }} />
        <ellipse cx="60" cy="24" rx="6.5" ry="8" style={{ opacity: 0.75 }} />
        <g className="hm-fin-gantry">
          <circle cx="60" cy="6" r="2.4" className="fill" />
          <path d="M60 6 L53.5 23 M60 6 L66.5 23" style={{ opacity: 0.45 }} strokeWidth="1" />
        </g>
      </svg>
    ),
  },
  {
    name: 'MRI', colour: '#A99EDB',
    glyph: (
      <svg viewBox="0 0 120 44" className="hm-fin-glyph" aria-hidden="true">
        <line x1="60" y1="40" x2="60" y2="7" strokeDasharray="2 4" style={{ opacity: 0.55 }} />
        <path d="m60 4 -3 5 M60 4 l3 5" style={{ opacity: 0.55 }} />
        <ellipse cx="60" cy="13" rx="17" ry="4.5" style={{ opacity: 0.5 }} />
        <g className="hm-fin-precess">
          <line x1="60" y1="38" x2="75" y2="12" />
          <circle cx="75" cy="12" r="2.2" className="fill" />
        </g>
      </svg>
    ),
  },
]

function FinaleSection() {
  const { ref, vis } = useInView<HTMLElement>(0.2)
  return (
    <section ref={ref} className={`hm-section hm-finale${vis ? ' in-view' : ''}`} aria-labelledby="hm-fin-h">
      <div className="hm-wrap">
        <div className="hm-finale-rail" aria-hidden="true">
          {FINALE_BANDS.map(({ name, colour, glyph }) => (
            <div key={name} style={{ ['--band' as string]: colour }}>
              {glyph}
              <i /><span>{name}</span>
            </div>
          ))}
        </div>
        <h2 id="hm-fin-h" className="hm-display hm-finale-h">Physics is easier<br />when you can see it.</h2>
        <p className="hm-lede">Build understanding. Recognise patterns. Pass FRCR Part&nbsp;1.</p>
        <div className="hm-finale-cta">
          <Link className="hm-btn hm-btn-solid" to="/pricing">Start Learning</Link>
          <Link className="hm-btn hm-btn-ghost" to="/visual-lab">Explore the labs</Link>
        </div>
        <p className="hm-finale-price">Free to explore · £19 a month for everything · <Link to="/pricing">see pricing</Link></p>
      </div>
    </section>
  )
}

/* ---------------- footer ---------------- */

function HomeFooter() {
  return (
    <footer className="hm-footer">
      <div className="hm-wrap hm-footer-grid">
        <div className="hm-footer-brand">
          <span className="hm-footer-mark">RADIOPASS</span>
          <p>Radiology physics, made visible — interactive learning for FRCR Part 1 candidates.</p>
        </div>
        <nav aria-label="Platform">
          <h3>Platform</h3>
          <Link to="/question-bank">Question Bank</Link>
          <Link to="/fact-bank">Fact Bank</Link>
          <Link to="/visual-lab">Visual Lab</Link>
          <Link to="/mri-lab">MRI Laboratory</Link>
          <Link to="/ultrasound-lab">Ultrasound Laboratory</Link>
          <Link to="/study-plan">Study Plan</Link>
        </nav>
        <nav aria-label="Company">
          <h3>Company</h3>
          <Link to="/about">About</Link>
          <Link to="/pricing">Pricing</Link>
          <a href="mailto:hello@radiopass.co.uk">Contact</a>
        </nav>
        <nav aria-label="Legal">
          <h3>Legal</h3>
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
        </nav>
      </div>
      <div className="hm-wrap hm-footer-bottom">
        <span>© 2026 RadioPass. All rights reserved.</span>
        <span>Built for radiology trainees.</span>
      </div>
    </footer>
  )
}

/* ---------------- page ---------------- */

export default function Home() {
  return (
    <div className={DEBUG_P !== null ? 'home-page hm-debug' : 'home-page'}>
      <a className="hm-skip" href="#hm-main">Skip to content</a>
      <HomeNav />
      <main id="hm-main">
        {(!DEBUG_ONLY || DEBUG_ONLY === 'hero') && <HeroScene />}
        {(!DEBUG_ONLY || DEBUG_ONLY === 'sections') && <SignalsSection />}
        {(!DEBUG_ONLY || DEBUG_ONLY === 'xray') && <XrayScene />}
        {(!DEBUG_ONLY || DEBUG_ONLY === 'sections') && <DoorsSection />}
        {(!DEBUG_ONLY || DEBUG_ONLY === 'finale' || DEBUG_ONLY === 'sections') && <FinaleSection />}
      </main>
      <HomeFooter />
    </div>
  )
}
