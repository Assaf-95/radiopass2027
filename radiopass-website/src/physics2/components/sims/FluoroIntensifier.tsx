/**
 * The image intensifier, assembled one component at a time.
 *
 * The drawing is V1's own tube — `drawII` from src/labs/fluoro.tsx, reused
 * whole — which builds itself up as the focus advances: the CsI input face,
 * then the photocathode, the electrostatic lenses and their crossover, the
 * anode's kilovolts, the small output phosphor and its camera, magnification
 * mode, and finally the finished tube running live, photon by photon.
 *
 * In V2 an animation must always say what it is showing and every control
 * must carry a name, so the seven lesson steps become one named stage picker
 * with a "Showing:" line. Re-mounting the canvas on each choice (the key) is
 * deliberate: it restarts the reveal so the chosen component assembles itself
 * in front of the learner rather than appearing already finished — and it is
 * the one thing that also repaints for a reduced-motion visitor.
 */

import { useState } from 'react'
import { drawII, type IiPart } from '../../../labs/fluoro'
import { DrawCanvas } from './DrawCanvas'

const STAGES: { focus: IiPart | 'all'; name: string; showing: string }[] = [
  {
    focus: 'input',
    name: 'CsI input phosphor',
    showing:
      'X-rays that survived the patient enter the evacuated envelope and strike the caesium iodide input phosphor. Its columnar needles pipe the light forwards instead of letting it spread sideways, and one absorbed X-ray becomes thousands of light photons.',
  },
  {
    focus: 'cathode',
    name: 'Photocathode',
    showing:
      'The photocathode, in optical contact with the phosphor: the flash of light frees photoelectrons from it. From here to the far end of the tube the picture travels as electrons, which is what makes it amplifiable.',
  },
  {
    focus: 'optics',
    name: 'Electrostatic lenses',
    showing:
      'Charged focusing electrodes steer every electron along a curved route through a single crossover point — which is why the image lands inverted and the electronics have to flip it back. The focusing is electrostatic; photomultiplier tubes are never in this chain.',
  },
  {
    focus: 'anode',
    name: 'Anode — 25–30 kV',
    showing:
      'The anode accelerates each electron across the vacuum to 25–30 keV. The image is unchanged; every electron simply arrives carrying far more energy, and releases far more light when it lands. That is the flux gain.',
  },
  {
    focus: 'output',
    name: 'Output phosphor',
    showing:
      'The electrons land on an output phosphor about 25 mm across, from an input face of 250–300 mm. The same image squeezed onto a smaller area is brighter again — the minification gain, (input ÷ output diameter)² — and flux × minification is the ≈ 5000× total. A camera views the little disc.',
  },
  {
    focus: 'mag',
    name: 'Magnification mode',
    showing:
      'Only the central part of the input face is used, refocused to fill the whole output. Less input area means less minification gain, so the picture dims and automatic brightness control raises the exposure to restore it — the zoom is bought with dose rate.',
  },
  {
    focus: 'all',
    name: 'The whole tube, live',
    showing:
      'The finished intensifier running photon by photon: an X-ray arrives, a burst of light appears in the needles, an electron dashes through the crossover to the anode, and a flash lands on the small output disc — one blip on the live display, thousands of times brighter than the flash that started it.',
  },
]

export function FluoroIntensifier() {
  const [idx, setIdx] = useState(0)
  const stage = STAGES[idx]

  return (
    <div className="v2-ctwin" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div>
        <DrawCanvas
          key={stage.focus}
          draw={(ctx, w, h, p, t) => drawII(ctx, w, h, stage.focus, p, t)}
          height={400}
          label={`Image intensifier in cross-section, showing ${stage.name}`}
        />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>Component of the intensifier on screen</span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which component of the image intensifier to show">
          {STAGES.map((s, i) => (
            <button key={s.focus} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {stage.showing}
        </p>
        <p className="v2-ctwin-read">
          Components already taught stay on the tube; nothing that has not been reached yet is drawn.
          Solid arrow = X-ray · fine dashes = light photon · long dashes = electron.
        </p>
      </div>
    </div>
  )
}
