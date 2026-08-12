/**
 * The two subject scenes that were built, styled — and then stranded.
 *
 * `src/home/scenes/` holds five scroll-driven canvas scenes. Three of them are
 * subject chapters built to the same pattern: X-ray, MRI and ultrasound. Only
 * the X-ray one is still rendered anywhere. MriScene.tsx (292 lines, seven
 * chapters from "no field" to "contrast") and UsScene.tsx (290 lines, five
 * chapters of genuine longitudinal wave propagation) had no importer at all —
 * every rule they need was still sitting in home.css, including their own
 * `.hm-stage-mri { height: 560vh }` and `.hm-stage-us { height: 520vh }` scroll
 * stages and their accent colours. The components survived, the styling
 * survived; only the two lines that rendered them were lost.
 *
 * They are given routes of their own here rather than being put back on the
 * home page. The home page is deliberately not touched: it is the one file in
 * this project that has caused the worst regressions, and completing a set of
 * scenes there is a change to it however small. As their own doors they are
 * reachable, testable and reversible, and they sit where the Visual Lab index
 * already advertises "the other doors into the same subject".
 *
 * The scenes carry their own heading, chapter copy and call to action, so the
 * wrapper adds nothing but the token scope and a way back. `.home-page` is that
 * scope: every `--hm-*` variable the scenes read is declared on it, so without
 * the class the canvases paint with unresolved colours.
 */

import { Link } from 'react-router-dom'

import MriScene from '../home/scenes/MriScene'
import UsScene from '../home/scenes/UsScene'
import '../home/home.css'

function SceneStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="home-page lab-motion">
      <main>{children}</main>
      <div className="lab-motion-foot">
        <Link to="/visual-lab" className="hm-btn hm-btn-line">
          ← Back to the laboratories
        </Link>
      </div>
    </div>
  )
}

/** MRI: alignment, excitation, relaxation and signal, drawn in three dimensions. */
export function MriMotion() {
  return (
    <SceneStage>
      <MriScene />
    </SceneStage>
  )
}

/** Ultrasound: a longitudinal pulse crossing three tissue layers. */
export function UsMotion() {
  return (
    <SceneStage>
      <UsScene />
    </SceneStage>
  )
}
