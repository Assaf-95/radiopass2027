/**
 * Two ultrasound laboratory scenes, re-hosted in the course.
 *
 * These are the "contract C" scenes the merge audit deferred to last: unlike a
 * propless component, each is driven by a bundle of numeric state that lives in
 * its laboratory page (`src/us/pages/*.tsx`), plus an animation clock. Nothing
 * is redrawn here — the scene components are imported exactly as the laboratory
 * runs them, so a change to the physics reaches both surfaces at once. What the
 * wrappers add is the smallest set of controls that makes each scene teach on
 * its own, without the surrounding twenty-one-stage experiment.
 *
 * Deliberately fewer knobs than the laboratory has. The lab is where a learner
 * drives everything; a chapter plate has one question to answer, and a row of
 * sliders on a page someone is reading is a distraction from the sentence above
 * it. The lab door at the end of the topic is how the rest is reached.
 */

import { useEffect, useState } from 'react'

import { WaveChamber } from '../../../us/scenes/WaveChamber'
import { TransducerStage } from '../../../us/scenes/TransducerStage'
import { medium as mediumById, wavelengthMm, type MediumId } from '../../../us/engine'

/** One shared clock for a scene, in seconds. Paused for reduced motion. */
function useSceneClock(): number {
  const [time, setTime] = useState(0)
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      // One settled frame, no loop — the same contract the canvas plates keep.
      setTime(3.4)
      return
    }
    let raf = 0
    const t0 = performance.now()
    const loop = () => {
      setTime((performance.now() - t0) / 1000)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return time
}

/* ------------------------------------------------------------------ *
 * The wave, and the medium that owns its speed
 * ------------------------------------------------------------------ */

/* Four the exam actually contrasts: the reference tissue, the one just below
   it, the one far above, and the one that stops the beam dead. Speeds come
   from the laboratory's own medium table, never from numbers retyped here. */
const MEDIUM_IDS: MediumId[] = ['softTissue', 'fat', 'bone', 'air']

export function UsWave() {
  const time = useSceneClock()
  const [mediumIdx, setMediumIdx] = useState(0)
  const [frequency, setFrequency] = useState(3)
  const chosen = mediumById(MEDIUM_IDS[mediumIdx])
  const lambda = wavelengthMm(chosen.speed, frequency)

  return (
    <div className="v2-ussim">
      <div className="v2-ussim-stage">
        <WaveChamber
          medium={chosen}
          frequencyMHz={frequency}
          amplitude={0.8}
          cycles={3}
          prfHz={2000}
          time={time}
          phase="free"
        />
      </div>
      <div className="v2-ussim-side">
        <label>
          <span>
            Medium <b>{chosen.name} — {chosen.speed} m/s</b>
          </span>
        </label>
        <div className="v2-ctwin-presets" role="group" aria-label="Choose the medium">
          {MEDIUM_IDS.map((id, i) => (
            <button key={id} type="button" className={i === mediumIdx ? 'on' : ''} onClick={() => setMediumIdx(i)}>
              {mediumById(id).name}
            </button>
          ))}
        </div>
        <label>
          <span>
            Frequency <b>{frequency.toFixed(1)} MHz</b>
          </span>
          <input
            type="range"
            min={1}
            max={12}
            step={0.5}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          />
        </label>
        <p className="v2-atom-note">
          Wavelength <b>{lambda.toFixed(2)} mm</b> — λ = c ⁄ f. The medium sets c and the probe sets
          f, so wavelength is the one you never choose directly. Every scanner assumes 1540 m/s
          regardless of what the sound is actually travelling through, which is where a whole
          family of artefacts begins.
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ *
 * The probe, and what damping costs
 * ------------------------------------------------------------------ */

export function UsTransducer() {
  const time = useSceneClock()
  const [explode, setExplode] = useState(0)
  const [damping, setDamping] = useState(60)

  return (
    <div className="v2-ussim">
      <div className="v2-ussim-stage">
        <TransducerStage
          explode={explode}
          thicknessMm={0.4}
          dampingPct={damping}
          arrayMode="sequential"
          focusDepthMm={60}
          probeType="linear"
          time={time}
          phase="damping"
        />
      </div>
      <div className="v2-ussim-side">
        <label>
          <span>
            Take it apart <b>{Math.round(explode * 100)}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={explode}
            onChange={(e) => setExplode(Number(e.target.value))}
          />
        </label>
        <label>
          <span>
            Backing damping <b>{damping}%</b>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={damping}
            onChange={(e) => setDamping(Number(e.target.value))}
          />
        </label>
        <p className="v2-atom-note">
          The backing block is there to <b>kill</b> the ringing, not to help it. Heavy damping
          shortens the pulse, which is what buys axial resolution — and it broadens the bandwidth
          and throws away sensitivity to get it. The matching layer in front does the opposite job:
          it bridges the impedance gap between crystal and skin so the pulse leaves at all.
        </p>
      </div>
    </div>
  )
}
