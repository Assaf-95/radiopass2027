/**
 * Doppler aliasing — the V1 ultrasound AliasingStage scene, re-hosted.
 *
 * The scene and every number in it come from src/us: the canvas renderer is
 * AliasingStage and the physics readouts are the same engine functions the
 * laboratory uses. This wrapper supplies the clock, V2-styled controls, and a
 * sized dark stage — nothing about the physics is redrawn.
 */

import { useState } from 'react'
import { dopplerShiftHz, nyquistLimitHz } from '../../../us/engine'
import { useClock } from '../../../us/components/Guided'
import { AliasingStage } from '../../../us/scenes/AliasingStage'

export function DopplerAliasing() {
  const [velocity, setVelocity] = useState(0.6)
  const [prf, setPrf] = useState(6000)
  const [frequency, setFrequency] = useState(4)
  const time = useClock(true)

  const shift = dopplerShiftHz(frequency, velocity, 60)
  const nyquist = nyquistLimitHz(prf)
  const aliasing = Math.abs(shift) > nyquist

  return (
    <div className="v2-ussim">
      <div className="v2-ussim-stage">
        <AliasingStage
          velocityMs={velocity}
          frequencyMHz={frequency}
          prfHz={prf}
          depthCm={6}
          angleDeg={60}
          baselineShift={0}
          cw={false}
          time={time}
          phase="free"
        />
      </div>
      <div className="v2-ussim-side">
        <label>
          <span>
            Blood velocity <b>{Math.round(velocity * 100)} cm/s</b>
          </span>
          <input
            type="range"
            min={0.1}
            max={1.5}
            step={0.05}
            value={velocity}
            onChange={(e) => setVelocity(Number(e.target.value))}
          />
        </label>
        <label>
          <span>
            PRF <b>{prf} Hz</b>
          </span>
          <input
            type="range"
            min={1000}
            max={12000}
            step={250}
            value={prf}
            onChange={(e) => setPrf(Number(e.target.value))}
          />
        </label>
        <label>
          <span>
            Transducer frequency <b>{frequency.toFixed(1)} MHz</b>
          </span>
          <input
            type="range"
            min={2}
            max={10}
            step={0.5}
            value={frequency}
            onChange={(e) => setFrequency(Number(e.target.value))}
          />
        </label>
        <p className="v2-ctwin-read">
          Doppler shift <b>{Math.round(Math.abs(shift))} Hz</b> against a Nyquist limit of{' '}
          <b>{Math.round(nyquist)} Hz</b> (PRF/2).{' '}
          {aliasing
            ? 'The shift exceeds the limit — the spectrum wraps to the far side of the baseline.'
            : 'Within the limit — the trace reads correctly.'}
        </p>
      </div>
    </div>
  )
}
