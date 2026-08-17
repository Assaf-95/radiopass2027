/**
 * The ultrasound artefact gallery, V2 dress.
 *
 * The drawings are V1's ArtefactStage — the laboratory's own scenes, reused
 * whole — driven here by a simple clock and a named picker, because in V2 an
 * animation must always say what it is showing and every control must carry
 * a name. Only the exam-core scenes are offered; the full nineteen live in
 * the laboratory the section links to.
 */

import { useEffect, useState } from 'react'
import { ArtefactStage, type ArtefactSceneKind } from '../../../us/scenes/ArtefactStage'

const SCENES: { kind: ArtefactSceneKind; name: string; showing: string }[] = [
  {
    kind: 'assumptions',
    name: 'The four assumptions',
    showing:
      'The rules the scanner trusts: 1540 m/s everywhere, straight-line travel, echoes only from the main beam, uniform attenuation. Every artefact that follows is one of these breaking.',
  },
  {
    kind: 'shadowing',
    name: 'Shadowing',
    showing:
      'A strong attenuator — here a stone — starves everything beneath it of beam. The dark band below is missing information, not anatomy.',
  },
  {
    kind: 'enhancement',
    name: 'Posterior enhancement',
    showing:
      'Fluid attenuates almost nothing, so the beam arrives behind the cyst stronger than the TGC expected — and the tissue behind is painted too bright. This is the artefact that certifies a cyst.',
  },
  {
    kind: 'reverberation',
    name: 'Reverberation',
    showing:
      'The echo bounces back and forth between two strong parallel interfaces; each extra round trip returns later and is drawn as a deeper, fainter copy at equal spacing.',
  },
  {
    kind: 'mirror',
    name: 'Mirror image',
    showing:
      'The diaphragm bounces the beam onto a second target and back; the extra travel time is drawn as extra depth, so a phantom copy appears beyond the reflector.',
  },
  {
    kind: 'refraction',
    name: 'Refraction',
    showing:
      'At an oblique speed boundary the beam bends, but the machine draws the echo along the straight path it assumed — the structure is shown displaced sideways.',
  },
  {
    kind: 'speed',
    name: 'Speed error',
    showing:
      'Through slower fat the echo comes home late — and late is drawn as deep. The structure is displaced along the beam axis; the 1540 m/s assumption is the one that broke.',
  },
  {
    kind: 'sidelobe',
    name: 'Side lobes',
    showing:
      'Off-axis energy finds a strong reflector, and its echo is credited to the main beam — spurious soft echoes inside what should be a clean, anechoic bladder.',
  },
]

export function UsArtefacts() {
  const [idx, setIdx] = useState(0)
  const [reveal, setReveal] = useState(true)
  const [time, setTime] = useState(0)

  useEffect(() => {
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      setTime((performance.now() - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])

  const scene = SCENES[idx]
  return (
    <div className="v2-ussim">
      <div className="v2-ussim-stage">
        <ArtefactStage
          kind={scene.kind}
          revealPath={reveal}
          time={time}
          phase={scene.kind === 'assumptions' ? 'assumptions' : 'demo'}
          describe={scene.showing}
        />
      </div>
      <div className="v2-ussim-side">
        <label>
          <span>Artefact on screen</span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which artefact to show">
          {SCENES.map((s, i) => (
            <button key={s.kind} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {s.name}
            </button>
          ))}
        </div>
        <label className="v2-uscheck">
          <input
            type="checkbox"
            checked={reveal}
            onChange={(e) => setReveal(e.target.checked)}
          />
          <span>Reveal the true path — amber, against the machine’s assumed path, dashed</span>
        </label>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {scene.showing}
        </p>
      </div>
    </div>
  )
}
