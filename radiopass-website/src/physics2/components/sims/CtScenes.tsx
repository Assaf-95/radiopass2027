/**
 * The CT scenes, re-hosted from the V1 lesson and film (src/labs/ct.tsx).
 *
 * Nothing here re-draws CT. Every pixel is V1's own procedural scene, imported
 * whole and mounted in a V2 film plate; this file only supplies the surround
 * V2 insists on — a named control, and a "Showing" line so an animation always
 * says what is on screen.
 *
 *   CtGenerations    the four scanner geometries, on one plate with a picker
 *   CtBackProjection profiles smeared back one at a time, then the kernel
 *   CtHelixPitch     the helix, with pitch driving how tightly it winds
 *   CtRingArtefact   one faulty detector channel drawing a ring
 */

import { useState, type CSSProperties } from 'react'
import { DrawCanvas } from './DrawCanvas'
import {
  drawBackProjection,
  drawGen1,
  drawGen2,
  drawGen3,
  drawGen4,
  drawHelicalScan,
  drawRingArtefact,
} from '../../../labs/ct'

/* ---------------- the four generations ---------------- */

const GENERATIONS = [
  {
    id: 'gen1',
    button: 'First — translate–rotate',
    draw: drawGen1,
    geometry: 'Pencil beam · one detector · translate then rotate',
    showing:
      'One pencil beam and one detector, rigidly linked. The pair shoots, glides one step sideways, shoots again — right across the patient — then rotates a degree and sweeps again. Every ray already measured stays on screen as a faint trace, so the coverage builds in front of you. Minutes per slice.',
    label:
      'First generation CT: a single pencil beam and one detector translating across the patient, then rotating for the next sweep',
  },
  {
    id: 'gen2',
    button: 'Second — small fan',
    draw: drawGen2,
    geometry: 'Narrow fan · short detector row · still translate–rotate',
    showing:
      'A narrow fan and a short row of detectors, so every shot measures several rays at once. The assembly still translates across the patient and still rotates between sweeps — but each rotation can be a bigger jump, so far fewer sweeps are needed.',
    label:
      'Second generation CT: a narrow fan beam and a short detector row, still translating and rotating',
  },
  {
    id: 'gen3',
    button: 'Third — rotate–rotate',
    draw: drawGen3,
    geometry: 'Wide fan · curved array of many small detectors · rotation only',
    showing:
      'The fan is now wide enough to cover the whole patient in one view, and it faces a curved array of many small detector elements — hundreds in a real scanner, not one large curved detector. Translation has disappeared entirely: tube and detector arc simply rotate together. This is the geometry inside almost every scanner today.',
    label:
      'Third generation CT: a wide fan beam and a curved array of many detector elements rotating together with the tube',
  },
  {
    id: 'gen4',
    button: 'Fourth — stationary ring',
    draw: drawGen4,
    geometry: 'Complete stationary detector ring · only the tube rotates',
    showing:
      'A complete ring of detectors that never moves, with the tube rotating inside it. Whichever detectors happen to face the fan at that instant are the ones measuring — watch them light up and hand over as the tube goes round. Detector-hungry, and now largely historical.',
    label:
      'Fourth generation CT: a complete stationary detector ring with only the tube rotating inside it',
  },
]

export function CtGenerations() {
  const [idx, setIdx] = useState(0)
  const gen = GENERATIONS[idx]

  return (
    <div className="v2-ctwin">
      <div>
        {/* Keyed on the generation so each pick restarts that scene from its
            first ray — and so the one settled frame a reduced-motion visitor
            gets is redrawn for the geometry they just chose. */}
        <DrawCanvas key={gen.id} draw={gen.draw} height={360} label={gen.label} />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>Scanner generation</span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which scanner generation to show">
          {GENERATIONS.map((g, i) => (
            <button key={g.id} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {g.button}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          <b>Geometry:</b> {gen.geometry}
        </p>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {gen.showing}
        </p>
      </div>
    </div>
  )
}

/* ---------------- back-projection ---------------- */

/**
 * The scenes with no controls sit alone on a wide plate, and both are drawn
 * around a centre at a scale set by the shorter side — so the plate is capped
 * to roughly the width the drawing actually uses instead of stranding it in
 * empty film.
 */
const SOLO: CSSProperties = { maxWidth: 560, margin: '0 auto' }

export function CtBackProjection() {
  return (
    <div style={SOLO}>
      <DrawCanvas
        draw={drawBackProjection}
        height={340}
        label="Back-projection: profiles smeared back across the image plane one at a time, the disc emerging as a haze, then sharpening once the filter kernel is applied"
      />
    </div>
  )
}

/* ---------------- the helix and pitch ---------------- */

/** Rotations drawn over the patient length on screen at pitch 1. */
const TURNS_AT_UNIT_PITCH = 6

/**
 * A reduced-motion visitor gets one settled frame instead of a loop, so the
 * canvas has to be remounted for a new pitch to be drawn at all. Everyone else
 * keeps the running helix and simply watches it rewind.
 */
const REDUCED_MOTION =
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches

function pitchReading(pitch: number): string {
  if (pitch < 1) {
    return 'Below 1 the turns overlap — the same tissue is crossed more than once. More data and less interpolation, and, at fixed tube current, more dose for the length scanned.'
  }
  if (pitch === 1) {
    return 'At exactly 1 each rotation advances the table by one beam width: the turns sit edge to edge, neither overlapping nor separated.'
  }
  return 'Above 1 the helix stretches — the volume is covered in fewer rotations, and the space between the turns has to be filled by interpolating from the data either side. At FIXED tube current that means less dose; with automatic exposure control the mA rises to hold noise and most of the saving disappears.'
}

export function CtHelixPitch() {
  const [pitch, setPitch] = useState(1)

  return (
    <div className="v2-ctwin">
      <div>
        <DrawCanvas
          key={REDUCED_MOTION ? pitch : 'live'}
          draw={(ctx, w, h, p, t) => drawHelicalScan(ctx, w, h, p, t, TURNS_AT_UNIT_PITCH / pitch)}
          height={300}
          label="Helical CT: the gantry sweeping along the patient while the tube traces a helix, wound more or less tightly by the pitch"
        />
      </div>
      <div className="v2-ctwin-side">
        <label>
          <span>
            Pitch <b>{pitch.toFixed(2)}</b>
          </span>
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.25}
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
          />
        </label>
        <p className="v2-ctwin-read">
          <b>Showing:</b> the same patient length every time, so how tightly the helix winds is a
          direct picture of the table travel per rotation — fewer turns means the table moved
          further each time round, which is exactly what a higher pitch is.
        </p>
        <p className="v2-ctwin-read">{pitchReading(pitch)}</p>
      </div>
    </div>
  )
}

/* ---------------- the ring artefact ---------------- */

export function CtRingArtefact() {
  return (
    <div style={SOLO}>
      <DrawCanvas
        draw={drawRingArtefact}
        height={380}
        label="The ring artefact: one faulty detector channel in a rotating third generation arc, its ray always passing the same distance from the isocentre, so its error draws a ring"
      />
    </div>
  )
}
