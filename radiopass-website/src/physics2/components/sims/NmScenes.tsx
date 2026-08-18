/**
 * The nuclear-medicine scenes, re-hosted from the V1 lesson (src/labs/nm.tsx).
 *
 * drawGammaCamera with focus 'all' plays the whole detection chain on a loop:
 * one photon every few seconds — emission, collimation, crystal flash, light
 * guide, PMT avalanche, position logic, PHA — landing as one dot on the
 * accumulating image, with every third photon scattering and being rejected.
 * The same function, given one component name, builds the camera instead: the
 * chosen layer assembles onto the bench and animates its own job, everything
 * already taught stays half-lit, and anything still to come is simply absent —
 * which is what GammaCameraBuild drives from its named picker.
 * drawModes and drawSpect are the acquisition scenes; drawPet shows
 * annihilation pairs and the lines of response crossing at the lesion. The
 * physics drawings are V1's, untouched.
 */

import { useState } from 'react'
import { drawGammaCamera, drawModes, drawPet, drawSpect } from '../../../labs/nm'
import { DrawCanvas } from './DrawCanvas'

/* Internal: the 'all' stage of GammaCameraBuild below. Was exported with no
   outside consumer, which made it read as an orphan API — it is not dead, it
   is simply not public. */
function GammaCameraChain() {
  return (
    <DrawCanvas
      draw={(ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, 'all', p, t)}
      height={460}
      label="The gamma camera chain: one photon followed from patient to image, scatter rejected by the pulse height analyser"
    />
  )
}

/* ---------------- the camera, built one component at a time ---------------- */

type GcFocus = Parameters<typeof drawGammaCamera>[3]

const BUILD: { focus: GcFocus; name: string; full: string; showing: string; label: string }[] = [
  {
    focus: 'patient',
    name: '1 · Patient',
    full: 'the patient, injected',
    showing:
      'After injection the patient is the radiation source: gamma photons leave in every direction, and the camera on one side can only ever use the tiny fraction that happens to fly its way. Everything the machine does next follows from how few photons that is.',
    label: 'The injected patient emitting gamma photons in every direction, only one heading toward the camera',
  },
  {
    focus: 'collimator',
    name: '2 · Lead collimator',
    full: 'the lead collimator',
    showing:
      'Five photons meet the parallel holes. The one travelling along a hole passes; every oblique one is absorbed by the septa and crossed out. This selection is the camera’s only optics — each survivor says “I came from straight ahead”.',
    label: 'The lead collimator passing one straight photon and absorbing four oblique ones in the septa',
  },
  {
    focus: 'crystal',
    name: '3 · NaI(Tl) crystal',
    full: 'the NaI(Tl) scintillation crystal',
    showing:
      'The surviving gamma stops in the thallium-activated sodium iodide slab and its energy reappears as a flash of light photons spreading from the interaction point. The slab is about 60 × 50 cm wide but only 6–13 mm thick — thin keeps the flash tight, which is what protects spatial resolution.',
    label: 'A gamma photon stopping in the NaI(Tl) crystal and its energy reappearing as a flash of light',
  },
  {
    focus: 'guide',
    name: '4 · Light guide',
    full: 'the light guide, onto the PM tubes',
    showing:
      'The light guide (or a smear of optical grease) gives optical contact between crystal and tubes, so the flash crosses into them instead of bouncing back off an air gap. The photomultiplier tubes arrive with it — the flash reaches several at once.',
    label: 'The light guide coupling the crystal flash into several photomultiplier tubes',
  },
  {
    focus: 'pmt',
    name: '5 · PM tubes',
    full: 'inside one photomultiplier tube',
    showing:
      'Inside one tube: light strikes the photocathode and frees a handful of photoelectrons, then each dynode knocks out more electrons than land on it — 2, 4, 8, 16 — until the handful is a measurable pulse. Overall gain near 10⁶.',
    label: 'Inside one photomultiplier tube: photocathode, dynode ladder and the electron avalanche reaching a gain of a million',
  },
  {
    focus: 'elec',
    name: '6 · Position logic',
    full: 'preamp, ADC and the Anger position logic',
    showing:
      'The flash is shared: the bars show each tube’s portion — tubes near the interaction see more light, distant ones less. The position logic compares every tube’s share and computes the X and Y position signals for the computer. The tube array is not a pixel grid.',
    label: 'Anger position logic comparing each tube’s share of the flash and sending X and Y position signals to the computer',
  },
  {
    focus: 'pha',
    name: '7 · Pulse height analyser',
    full: 'the Z-pulse and the pulse height analyser',
    showing:
      'Summing every tube’s signal gives the Z-pulse, proportional to the photon’s energy. A full-height pulse sits inside the ±10% window around the 140 keV photopeak and passes; the short pulse of a photon that scattered in the patient is rejected at the gate.',
    label: 'The Z-pulse passing the pulse height analyser window, and a shorter scattered pulse being rejected',
  },
  {
    focus: 'all',
    name: '8 · The whole chain, live',
    full: 'the finished camera, one photon at a time',
    showing:
      'The finished machine, running for ever: emission → collimation → flash → light → electron avalanche → X, Y and Z → the PHA’s verdict → one dot at (X, Y). Every third photon scattered inside the patient, sneaks through the lead, and still dies at the PHA. The image is nothing but a map of accepted photons.',
    label: 'The gamma camera chain: one photon followed from patient to image, scatter rejected by the pulse height analyser',
  },
]

export function GammaCameraBuild() {
  const [idx, setIdx] = useState(0)
  // Bumped on every press so the chosen component re-assembles from nothing —
  // the staged scenes play once and settle, exactly as they do in the lesson.
  const [run, setRun] = useState(0)
  const stage = BUILD[idx]
  const key = `${idx}-${run}`

  return (
    <div>
      {stage.focus === 'all' ? (
        <GammaCameraChain key={key} />
      ) : (
        <DrawCanvas
          key={key}
          draw={(ctx, w, h, p, t) => drawGammaCamera(ctx, w, h, stage.focus, p, t)}
          height={460}
          label={stage.label}
        />
      )}
      <div className="v2-ctwin-side">
        <label>
          <span>
            Component being built <b>{idx + 1} of 8 — {stage.full}</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which component of the gamma camera to build">
          {BUILD.map((s, i) => (
            <button
              key={s.focus}
              type="button"
              className={i === idx ? 'on' : ''}
              onClick={() => {
                setIdx(i)
                setRun((r) => r + 1)
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="v2-ctwin-presets" role="group" aria-label="Replay the component now on the bench">
          <button type="button" onClick={() => setRun((r) => r + 1)}>
            Replay {stage.full}
          </button>
        </div>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {stage.showing}
        </p>
      </div>
    </div>
  )
}

/* ---------------- acquisition: binning counts, then orbiting ---------------- */

const ACQ: { id: string; name: string; draw: typeof drawSpect; showing: string; label: string }[] = [
  {
    id: 'modes',
    name: 'Planar modes — static · dynamic · gated',
    draw: drawModes,
    showing:
      'Three ways to bin the counts in time. Static: one frame, counts simply accumulate. Dynamic: frame after frame, drawing a time–activity curve — the renogram. Gated: the ECG cuts each cardiac cycle into 8–16 bins, and every heartbeat adds its counts to the matching bin until an average beat emerges.',
    label: 'The three planar acquisitions: a static frame filling with counts, a time–activity curve drawing itself, and gated bins cycling with the ECG',
  },
  {
    id: 'spect',
    name: 'SPECT — the heads orbit',
    draw: drawSpect,
    showing:
      'Two opposed heads orbit the patient and a tick marks each projection angle as it is collected — with two heads every angle is covered within half a rotation. Reconstructed, the overlying activity disappears: the win is contrast, and spatial resolution is unchanged.',
    label: 'Two gamma camera heads orbiting a patient, ticking off each projection angle collected',
  },
]

export function NmAcquisition() {
  const [idx, setIdx] = useState(0)
  const scene = ACQ[idx]

  return (
    <div>
      <DrawCanvas key={scene.id} draw={scene.draw} height={380} label={scene.label} />
      <div className="v2-ctwin-side">
        <label>
          <span>
            Acquisition on the bench <b>{scene.id === 'modes' ? 'planar modes' : 'SPECT'}</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which acquisition to show">
          {ACQ.map((s, i) => (
            <button key={s.id} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {s.name}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {scene.showing}
        </p>
      </div>
    </div>
  )
}

export function PetCoincidence() {
  return (
    <DrawCanvas
      draw={drawPet}
      height={430}
      label="PET coincidence detection: annihilation photon pairs leaving back to back, lines of response crossing at the lesion"
    />
  )
}
