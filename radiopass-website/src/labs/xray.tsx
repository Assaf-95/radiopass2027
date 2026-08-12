/**
 * The X-ray techniques hub: three focused lessons under one roof.
 */

import { Link } from 'react-router-dom'
import './labs.css'

/* The existing visual-lab designs, brought under X-ray rather than rebuilt.
   They are self-contained HTML pages served from /visuals, so they open as
   they were authored — no redraw, no reinterpretation. */
const DESIGNS: { href: string; name: string; blurb: string }[] = [
  { href: '/visuals/xray-tube-physics-canvas.html', name: 'The X-ray tube',
    blurb: 'Cathode, anode, filament and the tube current — the machine itself, drawn live.' },
  { href: '/visuals/xray-focal-spot-unsharpness.html', name: 'Anode angle & focal spot',
    blurb: 'The line-focus principle, effective focal spot and geometric unsharpness.' },
  { href: '/visuals/xray-guided-interactions.html', name: 'Interactions — guided tour',
    blurb: 'A walk through what the beam does inside tissue, one step at a time.' },
  { href: '/visuals/diagrams-1-5.html', name: 'Atoms & X-ray production',
    blurb: 'Atomic structure, characteristic radiation and bremsstrahlung.' },
  { href: '/visuals/xray-spectrum-simulator.html', name: 'The emission spectrum, live',
    blurb: 'Tungsten against molybdenum: kVp, mA, filtration and generator, each with a note on what it just changed.' },
  { href: '/visuals/xray-beam-quality.html', name: 'Beam quality & filtration',
    blurb: 'kVp, HVL and filtration — what hardens the beam and what it costs.' },
  { href: '/visuals/radiographic-magnification.html', name: 'Magnification & geometry',
    blurb: 'Object–film distance, penumbra and the geometry of the projection.' },
  { href: '/visuals/diagrams-16-24.html', name: 'More tube & image diagrams',
    blurb: 'The remaining step diagrams from the original visual set.' },
]

/* Magnetisation is MRI physics, not X-ray. It is listed here because it was
   part of the same design set and you asked for it, but it is labelled so a
   reader is not taught it belongs to the projection family. */
const CROSS: { href: string; name: string; blurb: string } = {
  href: '/visuals/mri-magnetisation-recovery.html',
  name: 'Magnetisation & proton behaviour',
  blurb: 'From the same design set — this one is MRI physics, kept here for reference.',
}

/* The guided course: core X-ray physics in order, one focused lesson each.
   The order is the physics: make the beam, describe the beam, project it,
   then follow what it does inside the patient. */
const GUIDED = [
  { to: '/xray-lab/production', accent: '#A8CBEA', name: 'X-ray Production', blurb: 'One electron from the filament to the anode: thermionic emission, mA and kVp, bremsstrahlung, characteristic lines and the heat nobody wants.', count: '12 concepts' },
  { to: '/xray-lab/spectrum', accent: '#A8CBEA', name: 'The X-ray Spectrum', blurb: 'What the curve means — the kVp endpoint, mean energy, and what mAs, filtration and target Z each do to its shape.', count: '8 concepts' },
  { to: '/xray-lab/geometry', accent: '#A8CBEA', name: 'Projection Geometry', blurb: 'SOD, SDD and ODD; magnification M = SDD/SOD; focal-spot blur Ug = f × ODD/SOD.', count: '10 concepts' },
  { to: '/xray-lab/interactions', accent: '#A8CBEA', name: 'Interactions in Tissue', blurb: 'Attenuation, μ and HVL; the photoelectric journey and Compton scatter — where contrast, fog and dose are born.', count: '10 concepts' },
]

const MODULES = [
  { to: '/xray-lab/mammography', accent: '#D9909F', name: 'Mammography', blurb: 'Low-energy contrast, compression, magnification views and tomosynthesis.', count: '10 concepts' },
  { to: '/xray-lab/fluoroscopy', accent: '#E0955A', name: 'Fluoroscopy', blurb: 'The image intensifier, flat panels, brightness control, skin dose and DSA.', count: '7 concepts' },
  { to: '/xray-lab/digital', accent: '#8FB8C9', name: 'CR & Digital Radiography', blurb: 'The photostimulable plate, direct and indirect panels, MTF and dose creep.', count: '8 concepts' },
]

export default function XrayHub() {
  return (
    <main className="lx-root" style={{ ['--lx-accent' as string]: '#A8CBEA' }}>
      <header className="lx-bar">
        <Link to="/visual-lab" className="lx-exit">← Visual Lab</Link>
        <span className="lx-bar-title">X-ray techniques</span>
        {/* Counted from the arrays below, not typed by hand: the header used to
            claim 5 lessons and 8 diagrams while the page showed 7 and 9. */}
        <span className="lx-bar-count">{GUIDED.length + MODULES.length} lessons · {DESIGNS.length + 1} diagrams</span>
      </header>
      <section className="lx-cover">
        <p className="lx-kicker">X-ray techniques</p>
        <h1>Three machines,<br />one family of physics.</h1>
        <p className="lx-intro">Each module is a focused walk: one concept, one diagram, one Next button. Start with the core physics, then pick a machine.</p>
        <div className="lx-hub">
          {GUIDED.map(m => (
            <Link key={m.to} to={m.to} className="lx-hub-card" style={{ ['--lx-accent' as string]: m.accent }}>
              <span className="lx-hub-count">{m.count}</span>
              <h2>{m.name}</h2>
              <p>{m.blurb}</p>
              <span className="lx-hub-go">Begin →</span>
            </Link>
          ))}
          {MODULES.map(m => (
            <Link key={m.to} to={m.to} className="lx-hub-card" style={{ ['--lx-accent' as string]: m.accent }}>
              <span className="lx-hub-count">{m.count}</span>
              <h2>{m.name}</h2>
              <p>{m.blurb}</p>
              <span className="lx-hub-go">Begin →</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="lx-cover lx-designs">
        <p className="lx-kicker">The diagrams</p>
        <h2>The designs, where they belong.</h2>
        <p className="lx-intro">
          The visual-lab designs for the tube, the anode, the interactions and the atom —
          the same pages, gathered under X-ray instead of scattered.
        </p>
        <div className="lx-hub">
          {DESIGNS.map(d => (
            <a key={d.href} href={d.href} className="lx-hub-card" style={{ ['--lx-accent' as string]: '#A8CBEA' }}>
              <span className="lx-hub-count">Diagram</span>
              <h2>{d.name}</h2>
              <p>{d.blurb}</p>
              <span className="lx-hub-go">Open →</span>
            </a>
          ))}
          <a href={CROSS.href} className="lx-hub-card lx-hub-cross" style={{ ['--lx-accent' as string]: '#C6A6E8' }}>
            <span className="lx-hub-count">MRI physics</span>
            <h2>{CROSS.name}</h2>
            <p>{CROSS.blurb}</p>
            <span className="lx-hub-go">Open →</span>
          </a>
        </div>
      </section>
    </main>
  )
}
