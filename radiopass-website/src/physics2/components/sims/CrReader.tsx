/**
 * The CR reader and the two flat-panel stacks, re-hosted from the V1 lesson
 * (src/labs/digital.tsx). The drawings are V1's own — drawCrReader and
 * drawDrCompare — mounted here unchanged.
 *
 * V1 teaches the reader as seven consecutive lesson steps on one shared
 * machine: each step assembles its own component in, everything already taught
 * stays, anything not yet taught is simply absent, and the last step runs the
 * whole thing. V2 has no step player, so the sequence becomes a named picker —
 * the same seven stages, in the same order, with a "Showing:" line saying what
 * is on screen. Remounting the canvas on each choice (the key) restarts the
 * clock, so the newest component still assembles itself in rather than
 * appearing fully formed.
 */

import { useState } from 'react'
import { drawCrReader, drawDrCompare, type CrPart } from '../../../labs/digital'
import { DrawCanvas } from './DrawCanvas'

type Focus = CrPart | 'all'

const STAGES: { focus: Focus; name: string; showing: string }[] = [
  {
    focus: 'plate',
    name: 'The plate goes in',
    showing:
      'The exposed plate on its carriage. The amber dots are the latent image — trapped electrons, densest where the exposure was heaviest. The arrow is the slow scan: the plate feeding steadily through the reader. Nothing has touched the traps yet.',
  },
  {
    focus: 'laser',
    name: 'Red laser and mirror',
    showing:
      'A fine red laser and a rotating polygon mirror. One facet drags the spot right across the plate — the fast scan — and the amber dots go out behind it as their traps empty. Sweep across, plate steps on, sweep again: a raster over a plate that has no pixels of its own.',
  },
  {
    focus: 'light',
    name: 'Blue light comes out',
    showing:
      'The spot parked on one point. The released electrons fall back to the ground state and give up their stored energy as blue light, leaving in every direction (dotted), in proportion to the local exposure. Red stimulates, blue is the signal — far enough apart in wavelength that a filter can pass one and block the other.',
  },
  {
    focus: 'collect',
    name: 'Light guide and PMT',
    showing:
      'A light guide lies along the whole scan line, catching that faint blue and funnelling it into the photomultiplier tube. What leaves the PMT (dashed) is an electrical signal — one measurement for every point the laser visits.',
  },
  {
    focus: 'adc',
    name: 'ADC — the image appears',
    showing:
      'The signal digitised by the analogue-to-digital converter and laid down line by line in the image store. This is where the pixels are born: pixel size is set by the laser spot and the sampling interval, not by the phosphor.',
  },
  {
    focus: 'lamp',
    name: 'Erase lamp',
    showing:
      'Reading does not empty every trap, so a flood lamp washes the plate with bright white light before it returns to its cassette — ready for thousands of reuses. Watch the remaining amber dots disappear; leave them there and they ghost onto the next image.',
  },
  {
    focus: 'all',
    name: 'The whole reader, running',
    showing:
      'Everything at once, on a loop: the mirror sweeps the red spot line by line, each released blue flash is funnelled, amplified and digitised, and a new line of image lands — then the flood lamp wipes the plate while the finished image stays safe in the computer.',
  },
]

export function CrReaderStages() {
  const [idx, setIdx] = useState(0)
  const stage = STAGES[idx]

  return (
    <div className="v2-ctwin" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <DrawCanvas
        key={stage.focus}
        draw={(ctx, w, h, p, t) => drawCrReader(ctx, w, h, stage.focus, p, t)}
        height={400}
        label={`Computed radiography reader — ${stage.name}. ${stage.showing}`}
      />
      <div className="v2-ctwin-side">
        <label>
          <span>Reader stage — each one adds the next component to the machine</span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose which stage of the CR reader to show">
          {STAGES.map((s, i) => (
            <button key={s.focus} type="button" className={i === idx ? 'on' : ''} onClick={() => setIdx(i)}>
              {i + 1}. {s.name}
            </button>
          ))}
        </div>
        <p className="v2-ctwin-read">
          <b>Showing:</b> {stage.showing}
        </p>
      </div>
    </div>
  )
}

export function DrConversionStacks() {
  return (
    <DrawCanvas
      draw={drawDrCompare}
      height={380}
      label="The same X-ray landing on an indirect panel and a direct panel: light spreading sideways through the caesium iodide to the photodiodes, charge drifting straight down through the amorphous selenium, and the two signal profiles that result — spread against tight"
    />
  )
}
