/**
 * The ultrasound artefact gallery, V2 dress.
 *
 * The drawings are V1's ArtefactStage — the laboratory's own scenes, reused
 * whole — driven here by a simple clock and a named picker, because an
 * animation must always say what it is showing and every control must carry
 * a name. All nineteen kinds are offered: the picker used to stop at eight
 * "exam-core" scenes and send the learner to the laboratory for the rest,
 * which was exactly the linked-at-the-end pattern the merge removes — and the
 * eleven missing kinds include speckle, anisotropy and range ambiguity, all
 * of which the paper asks about by name.
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
  {
    kind: 'gratinglobe',
    name: 'Grating lobes',
    showing:
      'An array whose elements are spaced too far apart throws energy at discrete angles — a duplicate of a strong reflector appears well off-axis, further out than a side lobe ever puts it.',
  },
  {
    kind: 'ringdown',
    name: 'Ring-down',
    showing:
      'A pocket of gas bubbles resonates and keeps emitting after the pulse has passed — a solid bright line trailing into depth, distinct from the ladder of discrete reverberation echoes.',
  },
  {
    kind: 'beamwidth',
    name: 'Beam width',
    showing:
      'The beam is wider than the small cyst it straddles, so echoes from tissue beside the cyst are painted inside it — the clean anechoic space fills with false low-level echo.',
  },
  {
    kind: 'slicethickness',
    name: 'Slice thickness',
    showing:
      'The same failure in the elevation plane: the slice is thicker than the cyst, tissue in front of and behind the imaging plane contributes echo, and the cyst appears debris-filled.',
  },
  {
    kind: 'rangeambiguity',
    name: 'Range ambiguity',
    showing:
      'A deep echo from the PREVIOUS pulse arrives after the next one has gone out, and the machine — which dates every echo from the newest pulse — plots it impossibly shallow.',
  },
  {
    kind: 'speckle',
    name: 'Speckle',
    showing:
      'The granular texture of parenchyma is not the tissue microstructure — it is an interference pattern from scatterers smaller than the wavelength, which is why compounding changes it while anatomy stays put.',
  },
  {
    kind: 'anisotropy',
    name: 'Anisotropy',
    showing:
      'A tendon reflects strongly only when the beam hits it at 90°. Tilt away and its echoes miss the probe — the fibrillar structure goes artificially dark and can mimic a tear.',
  },
  {
    kind: 'doppler-aliasing',
    name: 'Doppler aliasing',
    showing:
      'Velocity past the Nyquist limit wraps: the peak of the jet paints in the reversed colour with a wrap-around seam, not the mosaic of true turbulence.',
  },
  {
    kind: 'doppler-blooming',
    name: 'Colour blooming',
    showing:
      'Gain pushed too high lets colour spill past the vessel wall into the tissue — the flow looks wider than the lumen that contains it.',
  },
  {
    kind: 'doppler-flash',
    name: 'Flash artefact',
    showing:
      'Tissue motion — a heartbeat, a breath, a probe nudge — is motion too, and colour Doppler paints it across the field in one flash that has nothing to do with blood.',
  },
  {
    kind: 'doppler-twinkle',
    name: 'Twinkle',
    showing:
      'Behind a rough calcified surface the colour box fills with a rapidly changing mosaic — a machine artefact that usefully marks stones, where a real shadow would merely be dark.',
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
