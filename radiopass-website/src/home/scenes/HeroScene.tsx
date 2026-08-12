// The hero: one enormous proton suspended in space, rendered in WebGL.
//
// This replaces the earlier 2D atom-and-photon schematic. The homepage is not
// where the physics is taught — the MRI laboratory is — so the hero's only job
// is to give RadioPass a visual identity and make a visitor stop scrolling.
// The teaching version of this object, with its precession ring and controls,
// lives in the laboratory.

import { lazy, Suspense, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usePinnedScene, applyFades, useElRegistry } from '../fx'

const ProtonHero = lazy(() => import('./ProtonHero'))

const noDraw = () => {}

export default function HeroScene() {
  const { els, set } = useElRegistry()
  const progressRef = useRef(0)

  const scene = usePinnedScene(noDraw, p => {
    // The camera reads this every frame; scroll never touches the proton's spin.
    progressRef.current = p
    applyFades([
      { el: els.current.mark, in: [-0.02, -0.01], out: [0.085, 0.14], y: 10 },
      { el: els.current.hint, in: [-0.02, -0.01], out: [0.03, 0.07], y: 0 },
      // The heading, subtitle and call to action are present from the first
      // frame — a visitor should never land on an unexplained sphere — and
      // hand over to the stages as the camera journey ends.
      { el: els.current.h1, in: [-0.02, -0.01], out: [0.86, 0.94] },
      { el: els.current.eq, in: [-0.02, -0.01], out: [0.86, 0.94] },
      { el: els.current.sup, in: [-0.02, -0.01], out: [0.86, 0.94] },
      { el: els.current.cta, in: [-0.02, -0.01], out: [0.86, 0.94] },
    ], p)
    if (els.current.cta) els.current.cta.style.pointerEvents = p < 0.9 ? 'auto' : 'none'
  }, { staticP: 0.5 })

  return (
    <section className={`hm-hero hm-hero-3d${scene.reduced ? ' is-rm' : ''}`} ref={scene.wrapRef} aria-label="RadioPass — Radiology physics, made visible">
      <div className="hm-pin">
        <Suspense fallback={<div className="hm-proton-host" aria-hidden="true" />}>
          <ProtonHero progressRef={progressRef} />
        </Suspense>
        <canvas ref={scene.canvasRef} className="hm-canvas hm-canvas-idle" aria-hidden="true" />
        <div className="hm-hero-copy">
          <p ref={set('mark')} className="hm-wordmark hm-fade-init">RADIOPASS</p>
          <h1 ref={set('h1')} className="hm-fade">Radiology Physics,<br /><em>Made Visible.</em></h1>
          <p ref={set('eq')} className="hm-hero-eq hm-fade">See what the equation means.</p>
          <p ref={set('sup')} className="hm-hero-sup hm-fade">Interactive visual learning for FRCR Part&nbsp;1 Physics.</p>
          {/* The two primary branches from the homepage: the learning
              modules (which fan out into the labs) and the question bank. */}
          <div ref={set('cta')} className="hm-hero-cta hm-fade">
            <a className="hm-btn hm-btn-solid" href="#modules">Explore the Modules</a>
            <Link className="hm-btn hm-btn-ghost" to="/question-bank">Question Bank</Link>
          </div>
        </div>
        <div ref={set('hint')} className="hm-scroll-hint hm-fade-init" aria-hidden="true"><span></span>Scroll</div>
      </div>
    </section>
  )
}
